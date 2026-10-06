-- Nido: setup del database. Incolla tutto nello SQL Editor di Supabase e premi "Run".
-- Si può rieseguire senza problemi.

-- 1. I due membri del Nido (i primi due account che entrano; poi è chiuso)
create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now()
);
alter table public.members enable row level security;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.join_nido()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  lock table public.members in exclusive mode;
  if exists (select 1 from public.members where user_id = auth.uid()) then return true; end if;
  if (select count(*) from public.members) >= 2 then return false; end if;
  insert into public.members (user_id) values (auth.uid());
  return true;
end;
$$;
revoke all on function public.join_nido() from public, anon;
grant execute on function public.join_nido() to authenticated;

drop policy if exists "members see members" on public.members;
create policy "members see members" on public.members for select to authenticated using (public.is_member());

-- 2. Tutti i contenuti (già cifrati sul telefono prima di arrivare qui)
create table if not exists public.docs (
  path text primary key,
  coll text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists docs_coll_idx on public.docs (coll);
alter table public.docs enable row level security;
alter table public.docs replica identity full;

drop policy if exists "only members" on public.docs;
create policy "only members" on public.docs for all to authenticated
  using (public.is_member()) with check (public.is_member());

do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 3. Archivio privato per foto, video e vocali (anch'essi cifrati)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists "nido media read" on storage.objects;
drop policy if exists "nido media insert" on storage.objects;
drop policy if exists "nido media update" on storage.objects;
drop policy if exists "nido media delete" on storage.objects;
create policy "nido media read" on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_member());
create policy "nido media insert" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_member());
create policy "nido media update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_member());
create policy "nido media delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_member());

select 'Nido pronto ✔' as esito;
