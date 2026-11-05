-- Incremental production features. Apply only after supabase_schema.sql and
-- supabase_username_logo.sql have been applied to the existing project.
begin;

alter table public.couple_settings
    add column if not exists timezone text not null default 'UTC';

create table if not exists public.account_recovery_codes (
    user_id uuid primary key references auth.users (id) on delete cascade,
    salt text not null,
    code_hash text not null,
    expires_at timestamptz not null,
    failed_attempts integer not null default 0,
    locked_until timestamptz,
    used_at timestamptz,
    updated_at timestamptz not null default now()
);
alter table public.account_recovery_codes enable row level security;
revoke all on public.account_recovery_codes from public, anon, authenticated;
grant all on public.account_recovery_codes to service_role;

create table if not exists public.couple_activity (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null references public.couples (id) on delete cascade,
    actor_id uuid references auth.users (id) on delete set null,
    event_type text not null check (event_type in ('shared_change', 'date_reminder', 'capsule_revealed')),
    event_key text unique,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists couple_activity_couple_created_idx
    on public.couple_activity (couple_id, created_at desc);
alter table public.couple_activity enable row level security;
drop policy if exists couple_activity_select_own on public.couple_activity;
create policy couple_activity_select_own on public.couple_activity
    for select to authenticated using (
        exists (
            select 1 from public.couples c
            where c.id = couple_id and c.owner_id = auth.uid()
        )
    );
grant select on public.couple_activity to authenticated;
revoke insert, update, delete on public.couple_activity from public, anon, authenticated;
grant all on public.couple_activity to service_role;

create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null references public.couples (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth_key text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_couple_idx
    on public.push_subscriptions (couple_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant all on public.push_subscriptions to service_role;

create table if not exists public.notification_deliveries (
    event_key text primary key,
    couple_id uuid not null references public.couples (id) on delete cascade,
    activity_id uuid not null references public.couple_activity (id) on delete cascade,
    status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
    attempt_count integer not null default 1,
    locked_at timestamptz not null default now(),
    delivered_at timestamptz,
    last_error text
);
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from public, anon, authenticated;
grant all on public.notification_deliveries to service_role;

create or replace function public.set_couple_username(requested_username text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    normalized_username text := lower(trim(requested_username));
    current_user_id uuid := auth.uid();
begin
    if current_user_id is null then
        raise exception 'Se requiere una sesión activa.';
    end if;
    if normalized_username !~ '^[a-z0-9][a-z0-9_.-]{2,29}$' then
        raise exception 'El nombre de usuario no tiene un formato permitido.';
    end if;

    update public.couple_usernames
       set username = normalized_username
     where user_id = current_user_id;
    if not found then
        raise exception 'No se encontró el usuario de esta cuenta.';
    end if;
    return normalized_username;
end;
$$;
revoke all on function public.set_couple_username(text) from public, anon;
grant execute on function public.set_couple_username(text) to authenticated;

create or replace function public.record_couple_activity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    target_couple_id uuid;
    request_headers jsonb;
    requested_actor_name text;
    actor_name text;
    row_data jsonb;
    table_label text;
    item_name text;
    operation_verb text;
begin
    if tg_table_name = 'capsules' and tg_op = 'UPDATE' then
        if not old.revealed and new.revealed then
            return new;
        end if;
    end if;

    target_couple_id := coalesce(new.couple_id, old.couple_id);
    if target_couple_id is not null then
        begin
            request_headers := current_setting('request.headers', true)::jsonb;
            requested_actor_name := convert_from(
                decode(request_headers ->> 'x-couple-member-name', 'base64'),
                'UTF8'
            );
        exception
            when invalid_text_representation
              or invalid_parameter_value
              or character_not_in_repertoire then
                requested_actor_name := null;
        end;

        select nullif(btrim(requested_actor_name), '')
          into actor_name
          from public.couple_settings
         where couple_id = target_couple_id
           and nullif(btrim(couple_name_1), '') = btrim(requested_actor_name)
           and btrim(couple_name_1) <> '';

        if actor_name is null then
            select nullif(btrim(requested_actor_name), '')
              into actor_name
              from public.couple_settings
             where couple_id = target_couple_id
               and nullif(btrim(couple_name_2), '') = btrim(requested_actor_name)
               and btrim(couple_name_2) <> '';
        end if;

        if actor_name is null and auth.uid() is not null then
            select username into actor_name
              from public.couple_usernames
             where user_id = auth.uid();
        end if;
        actor_name := coalesce(actor_name, 'Alguien');

        if tg_op = 'DELETE' then
            row_data := to_jsonb(old);
        else
            row_data := to_jsonb(new);
        end if;

        table_label := case tg_table_name
            when 'memories' then 'el recuerdo'
            when 'photos' then 'la foto'
            when 'letters' then 'la carta'
            when 'songs' then 'la canción'
            when 'dreams' then 'el sueño'
            when 'capsules' then 'la cápsula del tiempo'
            when 'messages' then 'el mensaje del día'
            when 'dates' then 'la fecha especial'
            when 'moments' then 'el momento especial'
            when 'couple_settings' then 'la configuración de pareja'
            else 'un elemento'
        end;

        item_name := case tg_table_name
            when 'memories' then row_data ->> 'title'
            when 'photos' then row_data ->> 'title'
            when 'letters' then row_data ->> 'title'
            when 'songs' then coalesce(row_data ->> 'name', row_data ->> 'title')
            when 'capsules' then row_data ->> 'title'
            when 'dates' then coalesce(row_data ->> 'name', row_data ->> 'title')
            when 'moments' then row_data ->> 'title'
            else null
        end;
        item_name := left(nullif(btrim(item_name), ''), 80);

        operation_verb := case tg_op
            when 'INSERT' then 'agregó'
            when 'UPDATE' then 'actualizó'
            when 'DELETE' then 'eliminó'
            else 'modificó'
        end;

        insert into public.couple_activity (couple_id, actor_id, event_type, details)
        values (
            target_couple_id,
            auth.uid(),
            'shared_change',
            jsonb_build_object(
                'table', tg_table_name,
                'operation', lower(tg_op),
                'actor_name', actor_name,
                'item_name', item_name,
                'message', actor_name || ' ' || operation_verb || ' ' || table_label ||
                    case when item_name is null then '.' else ' «' || item_name || '».' end
            )
        );
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;
revoke all on function public.record_couple_activity() from public, anon, authenticated;

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'memories', 'photos', 'letters', 'songs', 'dreams',
        'capsules', 'messages', 'dates', 'moments', 'couple_settings'
    ] loop
        execute format('drop trigger if exists record_couple_activity on public.%I', table_name);
        execute format('alter table public.%I replica identity full', table_name);
        execute format(
            'create trigger record_couple_activity after insert or update or delete on public.%I ' ||
            'for each row execute function public.record_couple_activity()',
            table_name
        );
    end loop;
end;
$$;

create or replace function public.claim_notification_delivery(
    requested_event_key text,
    requested_couple_id uuid,
    requested_activity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    current_delivery public.notification_deliveries%rowtype;
begin
    insert into public.notification_deliveries (event_key, couple_id, activity_id)
    values (requested_event_key, requested_couple_id, requested_activity_id)
    on conflict (event_key) do nothing;

    select * into current_delivery
      from public.notification_deliveries
     where event_key = requested_event_key
     for update;
    if current_delivery.status = 'sent'
       or (current_delivery.status = 'sending' and current_delivery.locked_at > now() - interval '5 minutes') then
        return false;
    end if;

    update public.notification_deliveries
       set status = 'sending',
           attempt_count = attempt_count + 1,
           locked_at = now(),
           last_error = null
     where event_key = requested_event_key;
    return true;
end;
$$;
revoke all on function public.claim_notification_delivery(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(text, uuid, uuid) to service_role;

create or replace function public.finish_notification_delivery(
    requested_event_key text,
    was_delivered boolean,
    error_message text default null
)
returns void
language sql
security definer
set search_path = public
as $$
    update public.notification_deliveries
       set status = case when was_delivered then 'sent' else 'failed' end,
           delivered_at = case when was_delivered then now() else null end,
           last_error = case when was_delivered then null else left(error_message, 500) end
     where event_key = requested_event_key;
$$;
revoke all on function public.finish_notification_delivery(text, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_notification_delivery(text, boolean, text) to service_role;

create or replace function public.consume_couple_recovery_code(
    requested_user_id uuid,
    candidate_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    recovery public.account_recovery_codes%rowtype;
begin
    select * into recovery
      from public.account_recovery_codes
     where user_id = requested_user_id
     for update;
    if not found or recovery.used_at is not null or recovery.expires_at <= now()
       or (recovery.locked_until is not null and recovery.locked_until > now()) then
        return null;
    end if;

    if recovery.code_hash <> candidate_hash then
        update public.account_recovery_codes
           set failed_attempts = failed_attempts + 1,
               locked_until = case when failed_attempts + 1 >= 5 then now() + interval '30 minutes' else null end,
               updated_at = now()
         where user_id = requested_user_id;
        return null;
    end if;

    update public.account_recovery_codes
       set used_at = now(), updated_at = now()
     where user_id = requested_user_id;
    return requested_user_id;
end;
$$;
revoke all on function public.consume_couple_recovery_code(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_couple_recovery_code(uuid, text) to service_role;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1
             from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'couple_activity'
       ) then
        alter publication supabase_realtime add table public.couple_activity;
    end if;
end;
$$;

commit;
