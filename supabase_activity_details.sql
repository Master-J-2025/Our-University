-- Add human-readable, attributed activity details without changing existing rows.
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
