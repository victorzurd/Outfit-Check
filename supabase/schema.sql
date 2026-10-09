-- Run this script in Supabase SQL Editor.
-- Remove the old paid virtual try-on quota objects, if this project had them.
drop function if exists public.reserve_virtual_tryon(uuid);
drop table if exists public.virtual_tryon_daily_usage;

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('Parte de arriba', 'Ropa de abrigo', 'Parte de abajo', 'Cuerpo completo', 'Calzado', 'Bolsos', 'Accesorios')),
  subcategory text,
  description text,
  ai_attributes jsonb not null default '{}'::jsonb,
  color text,
  brand text,
  image_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.wardrobe_items add column if not exists subcategory text;
alter table public.wardrobe_items add column if not exists description text;
alter table public.wardrobe_items add column if not exists ai_attributes jsonb not null default '{}'::jsonb;
-- Migrate existing broad categories and subcategories to the new wardrobe groups.
alter table public.wardrobe_items drop constraint if exists wardrobe_items_category_check;
update public.wardrobe_items
set category = case
  when category = 'Zapatos' then 'Calzado'
  when category = 'Prendas' and lower(coalesce(subcategory, '')) in ('vestido', 'mono', 'peto') then 'Cuerpo completo'
  when category = 'Prendas' and lower(coalesce(subcategory, '')) in ('pantalón', 'pantalon', 'vaquero', 'falda', 'shorts', 'leggings') then 'Parte de abajo'
  when category in ('Prendas', 'Parte de arriba') and lower(coalesce(subcategory, '')) in ('jersey', 'sudadera', 'cárdigan', 'cardigan', 'sobrecamisa', 'poncho', 'capa', 'abrigo', 'chaqueta', 'cazadora', 'gabardina', 'blazer', 'chaleco') then 'Ropa de abrigo'
  when category = 'Prendas' then 'Parte de arriba'
  else category
end
where category in ('Prendas', 'Zapatos')
   or (category = 'Parte de arriba' and lower(coalesce(subcategory, '')) in ('jersey', 'sudadera', 'cárdigan', 'cardigan', 'sobrecamisa', 'poncho', 'capa', 'abrigo', 'chaqueta', 'cazadora', 'gabardina', 'blazer', 'chaleco'));
alter table public.wardrobe_items add constraint wardrobe_items_category_check
  check (category in ('Parte de arriba', 'Ropa de abrigo', 'Parte de abajo', 'Cuerpo completo', 'Calzado', 'Bolsos', 'Accesorios'));
notify pgrst, 'reload schema';

alter table public.wardrobe_items enable row level security;
drop policy if exists "Users manage their own wardrobe" on public.wardrobe_items;
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
drop policy if exists "Users manage their own saved outfits" on public.saved_outfits;
create policy "Users manage their own saved outfits" on public.saved_outfits
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.outfit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occasion text not null,
  mood text,
  temperature_c integer,
  season text,
  rating smallint not null check (rating between 1 and 5),
  outfit_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.outfit_feedback enable row level security;
drop policy if exists "Users manage their own outfit feedback" on public.outfit_feedback;
create policy "Users manage their own outfit feedback" on public.outfit_feedback
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists outfit_feedback_user_created_idx on public.outfit_feedback(user_id, created_at desc);
notify pgrst, 'reload schema';

-- Private bucket: the app signs image URLs after authenticating the account.
insert into storage.buckets (id, name, public)
values ('wardrobe-photos', 'wardrobe-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Users read their wardrobe photos" on storage.objects;
create policy "Users read their wardrobe photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users upload wardrobe photos to their folder" on storage.objects;
create policy "Users upload wardrobe photos to their folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Users update their wardrobe photos" on storage.objects;
create policy "Users update their wardrobe photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Users delete their wardrobe photos" on storage.objects;
create policy "Users delete their wardrobe photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
