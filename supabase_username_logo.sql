-- Add username-only login and couple-specific branding to the existing project.
-- Existing email-based accounts keep working. New username accounts are
-- created with an internal, non-deliverable Supabase Auth email alias.

begin;

create table if not exists public.couple_usernames (
    username text primary key,
    user_id uuid not null unique references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint couple_usernames_format check (
        username = lower(username)
        and username ~ '^[a-z0-9][a-z0-9_.-]{2,29}$'
    )
);

alter table public.couple_usernames enable row level security;
drop policy if exists couple_username_select_own on public.couple_usernames;
create policy couple_username_select_own on public.couple_usernames
    for select to authenticated using (user_id = auth.uid());
drop policy if exists couple_username_boundary on public.couple_usernames;
create policy couple_username_boundary on public.couple_usernames
    as restrictive for all to public using (user_id = auth.uid())
    with check (user_id = auth.uid());
grant select on public.couple_usernames to authenticated;

create or replace function public.register_couple_username()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    requested_username text := lower(trim(new.raw_user_meta_data ->> 'username'));
begin
    if requested_username is null or requested_username = '' then
        return new;
    end if;
    if requested_username !~ '^[a-z0-9][a-z0-9_.-]{2,29}$' then
        raise exception 'El nombre de usuario no tiene un formato permitido.';
    end if;

    insert into public.couple_usernames (username, user_id)
    values (requested_username, new.id)
    on conflict do nothing;

    if not exists (
        select 1 from public.couple_usernames where user_id = new.id
    ) then
        raise exception 'Ese nombre de usuario ya está en uso.';
    end if;
    return new;
end;
$$;
revoke all on function public.register_couple_username() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_couple_username on auth.users;
create trigger on_auth_user_created_couple_username
    after insert on auth.users
    for each row execute function public.register_couple_username();

alter table public.couple_settings
    add column if not exists logo_path text;

insert into storage.buckets (id, name, public)
values ('couple-logos', 'couple-logos', false)
on conflict (id) do update set public = false;

drop policy if exists couple_logo_select on storage.objects;
create policy couple_logo_select on storage.objects
    for select to authenticated
    using (
        bucket_id = 'couple-logos'
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

drop policy if exists couple_logo_insert on storage.objects;
create policy couple_logo_insert on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'couple-logos'
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

drop policy if exists couple_logo_update on storage.objects;
create policy couple_logo_update on storage.objects
    for update to authenticated
    using (
        bucket_id = 'couple-logos'
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    )
    with check (
        bucket_id = 'couple-logos'
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

drop policy if exists couple_logo_delete on storage.objects;
create policy couple_logo_delete on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'couple-logos'
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

drop policy if exists couple_logo_boundary on storage.objects;
create policy couple_logo_boundary on storage.objects
    as restrictive for all to public
    using (
        bucket_id <> 'couple-logos'
        or exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    )
    with check (
        bucket_id <> 'couple-logos'
        or exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

commit;
