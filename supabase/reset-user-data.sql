-- Reinicia los datos de una cuenta concreta sin eliminar la cuenta de Supabase
-- ni tocar los datos de otros usuarios.
-- Antes de ejecutar: reemplaza 'correo@ejemplo.com' por el email de la cuenta.
-- No incluyas este script en la ejecución automática del esquema principal.

do $$
declare
  target_email text := lower(trim('correo@ejemplo.com'));
  target_user_id uuid;
begin
  if target_email = 'correo@ejemplo.com' then
    raise exception 'Edita target_email en supabase/reset-user-data.sql y escribe el correo de la cuenta que quieres reiniciar.';
  end if;

  select id
    into target_user_id
  from auth.users
  where lower(email) = target_email;

  if target_user_id is null then
    raise exception 'No se encontró una cuenta con ese correo.';
  end if;

  delete from public.outfit_feedback where user_id = target_user_id;
  delete from public.saved_outfits where user_id = target_user_id;
  delete from public.wardrobe_items where user_id = target_user_id;
end $$;
