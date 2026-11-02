-- Multi-couple migration. Existing rows are deliberately left in place with
-- couple_id = NULL; row-level security keeps those legacy rows inaccessible
-- until an administrator explicitly assigns them to a couple.

begin;

create table if not exists public.couples (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null unique references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.couple_settings (
    id integer primary key default 1,
    couple_name_1 text not null default '',
    couple_name_2 text not null default '',
    start_date text not null default '',
    main_quote text not null default '',
    updated_at timestamptz not null default now()
);

create table if not exists public.memories (
    id uuid primary key default gen_random_uuid(),
    title text not null default '',
    date text,
    description text,
    content text,
    emoji text,
    photos jsonb not null default '[]'::jsonb
);
create table if not exists public.photos (
    id uuid primary key default gen_random_uuid(),
    title text not null default '',
    date text,
    description text,
    image_url text
);
create table if not exists public.letters (
    id uuid primary key default gen_random_uuid(),
    category text,
    title text not null default '',
    content text not null default '',
    created_at text
);
create table if not exists public.songs (
    id uuid primary key default gen_random_uuid(),
    name text,
    title text,
    artist text,
    reason text,
    spotify text,
    youtube text,
    audio_url text
);
create table if not exists public.dreams (
    id uuid primary key default gen_random_uuid(),
    text text not null default '',
    completed boolean not null default false
);
create table if not exists public.capsules (
    id uuid primary key default gen_random_uuid(),
    title text not null default '',
    message text,
    content text,
    reveal_date text,
    revealed boolean not null default false
);
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    content text not null default ''
);
create table if not exists public.dates (
    id uuid primary key default gen_random_uuid(),
    name text,
    title text,
    date text,
    emoji text,
    recurring boolean not null default false
);
create table if not exists public.moments (
    id uuid primary key default gen_random_uuid(),
    title text not null default '',
    description text,
    image_url text,
    anniversary_number integer,
    anniversary_date text
);

alter table public.couple_settings
    add column if not exists start_date text not null default '',
    add column if not exists main_quote text not null default '',
    add column if not exists couple_id uuid references public.couples (id) on delete cascade;

alter table if exists public.memories
    add column if not exists couple_id uuid references public.couples (id) on delete cascade;
alter table if exists public.photos
    add column if not exists couple_id uuid references public.couples (id) on delete cascade,
    add column if not exists storage_path text;
alter table if exists public.letters
    add column if not exists couple_id uuid references public.couples (id) on delete cascade;
alter table if exists public.songs
    add column if not exists couple_id uuid references public.couples (id) on delete cascade,
    add column if not exists storage_path text;
alter table if exists public.dreams
    add column if not exists couple_id uuid references public.couples (id) on delete cascade;
alter table if exists public.capsules
    add column if not exists couple_id uuid references public.couples (id) on delete cascade;
alter table if exists public.messages
    add column if not exists couple_id uuid references public.couples (id) on delete cascade;
alter table if exists public.dates
    add column if not exists couple_id uuid references public.couples (id) on delete cascade;
alter table if exists public.moments
    add column if not exists couple_id uuid references public.couples (id) on delete cascade;
-- The old singleton settings row remains intact. Replace its id=1 restriction
-- and provide ids for additional couples while keeping couple_id unique.
do $$
declare
    restriction record;
begin
    for restriction in
        select conname
        from pg_constraint
        where conrelid = 'public.couple_settings'::regclass
          and contype = 'c'
          and pg_get_expr(conbin, conrelid) = '(id = 1)'
    loop
        execute format(
            'alter table public.couple_settings drop constraint %I',
            restriction.conname
        );
    end loop;
end
$$;

create sequence if not exists public.couple_settings_id_seq;
alter table public.couple_settings
    alter column id set default nextval('public.couple_settings_id_seq');
select setval(
    'public.couple_settings_id_seq',
    greatest(coalesce((select max(id) from public.couple_settings), 0), 1),
    exists (select 1 from public.couple_settings)
);
create unique index if not exists couple_settings_couple_id_key
    on public.couple_settings (couple_id);

create index if not exists memories_couple_id_idx on public.memories (couple_id);
create index if not exists photos_couple_id_idx on public.photos (couple_id);
create index if not exists letters_couple_id_idx on public.letters (couple_id);
create index if not exists songs_couple_id_idx on public.songs (couple_id);
create index if not exists dreams_couple_id_idx on public.dreams (couple_id);
create index if not exists capsules_couple_id_idx on public.capsules (couple_id);
create index if not exists messages_couple_id_idx on public.messages (couple_id);
create index if not exists dates_couple_id_idx on public.dates (couple_id);
create index if not exists moments_couple_id_idx on public.moments (couple_id);

create or replace function public.create_couple_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    current_user_id uuid := auth.uid();
    couple_uuid uuid;
begin
    if current_user_id is null then
        raise exception 'Authentication is required to create a couple.';
    end if;

    insert into public.couples (owner_id)
    values (current_user_id)
    on conflict (owner_id) do nothing;

    select id into couple_uuid
    from public.couples
    where owner_id = current_user_id;

    return couple_uuid;
end;
$$;

revoke all on function public.create_couple_for_current_user() from public;
grant execute on function public.create_couple_for_current_user() to authenticated;
grant select on public.couples to authenticated;
grant select, insert, update, delete on
    public.couple_settings, public.memories, public.photos, public.letters,
    public.songs, public.dreams, public.capsules, public.messages,
    public.dates, public.moments
to authenticated;
grant usage, select on sequence public.couple_settings_id_seq to authenticated;

alter table public.couples enable row level security;
drop policy if exists couples_owner_select on public.couples;
create policy couples_owner_select on public.couples
    for select to authenticated using (owner_id = auth.uid());

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'memories', 'photos', 'letters', 'songs', 'dreams',
        'capsules', 'messages', 'dates', 'moments', 'couple_settings'
    ]
    loop
        if to_regclass(format('public.%I', table_name)) is not null then
            execute format('alter table public.%I enable row level security', table_name);
            execute format('drop policy if exists couple_owner_access on public.%I', table_name);
            execute format(
                'create policy couple_owner_access on public.%I for all to authenticated ' ||
                'using (exists (select 1 from public.couples c ' ||
                'where c.id = couple_id and c.owner_id = auth.uid())) ' ||
                'with check (exists (select 1 from public.couples c ' ||
                'where c.id = couple_id and c.owner_id = auth.uid()))',
                table_name
            );
            execute format('drop policy if exists couple_security_boundary on public.%I', table_name);
            execute format(
                'create policy couple_security_boundary on public.%I as restrictive for all to public ' ||
                'using (couple_id is not null and exists (select 1 from public.couples c ' ||
                'where c.id = couple_id and c.owner_id = auth.uid())) ' ||
                'with check (couple_id is not null and exists (select 1 from public.couples c ' ||
                'where c.id = couple_id and c.owner_id = auth.uid()))',
                table_name
            );
        end if;
    end loop;
end
$$;

-- New uploads use private buckets with the couple UUID as their first path
-- segment. Existing public buckets and their files are not changed.
insert into storage.buckets (id, name, public)
values ('couple-photos', 'couple-photos', false),
       ('couple-songs', 'couple-songs', false)
on conflict (id) do update set public = false;

drop policy if exists couple_storage_select on storage.objects;
create policy couple_storage_select on storage.objects
    for select to authenticated
    using (
        bucket_id in ('couple-photos', 'couple-songs')
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

drop policy if exists couple_storage_insert on storage.objects;
create policy couple_storage_insert on storage.objects
    for insert to authenticated
    with check (
        bucket_id in ('couple-photos', 'couple-songs')
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

drop policy if exists couple_storage_update on storage.objects;
create policy couple_storage_update on storage.objects
    for update to authenticated
    using (
        bucket_id in ('couple-photos', 'couple-songs')
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    )
    with check (
        bucket_id in ('couple-photos', 'couple-songs')
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

drop policy if exists couple_storage_delete on storage.objects;
create policy couple_storage_delete on storage.objects
    for delete to authenticated
    using (
        bucket_id in ('couple-photos', 'couple-songs')
        and exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

drop policy if exists couple_storage_boundary on storage.objects;
create policy couple_storage_boundary on storage.objects
    as restrictive for all to public
    using (
        bucket_id not in ('couple-photos', 'couple-songs')
        or exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    )
    with check (
        bucket_id not in ('couple-photos', 'couple-songs')
        or exists (
            select 1 from public.couples c
            where c.id::text = (storage.foldername(name))[1]
              and c.owner_id = auth.uid()
        )
    );

commit;
