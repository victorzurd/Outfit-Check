-- Run this script in Supabase SQL Editor.
create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('Prendas', 'Zapatos', 'Bolsos', 'Accesorios')),
  color text,
  brand text,
  image_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.wardrobe_items enable row level security;
create policy "Users manage their own wardrobe" on public.wardrobe_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists wardrobe_items_user_created_idx on public.wardrobe_items(user_id, created_at desc);

create table if not exists public.saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mi look',
  occasion text,
  mood text,
  item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.saved_outfits enable row level security;
create policy "Users manage their own saved outfits" on public.saved_outfits
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Server-side daily cap for paid virtual try-on calls (3 attempts per account/day).
create table if not exists public.virtual_tryon_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  attempts integer not null default 0 check (attempts between 0 and 3),
  primary key (user_id, usage_date)
);
alter table public.virtual_tryon_daily_usage enable row level security;
revoke all on public.virtual_tryon_daily_usage from anon, authenticated;
grant all on public.virtual_tryon_daily_usage to service_role;

create or replace function public.reserve_virtual_tryon(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare reserved integer;
begin
  insert into public.virtual_tryon_daily_usage (user_id, usage_date, attempts)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date) do update
    set attempts = public.virtual_tryon_daily_usage.attempts + 1
    where public.virtual_tryon_daily_usage.attempts < 3
  returning attempts into reserved;

  if reserved is null then
    raise exception 'daily_limit_reached';
  end if;
  return reserved;
end;
$$;
revoke all on function public.reserve_virtual_tryon(uuid) from public, anon, authenticated;
grant execute on function public.reserve_virtual_tryon(uuid) to service_role;

-- Create a public Storage bucket for wardrobe photos. Row policies keep uploads
-- restricted to each user's own folder; public URLs are needed to render wardrobe photos.
insert into storage.buckets (id, name, public)
values ('wardrobe-photos', 'wardrobe-photos', true)
on conflict (id) do update set public = true;

create policy "Users upload wardrobe photos to their folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users update their wardrobe photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users delete their wardrobe photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
