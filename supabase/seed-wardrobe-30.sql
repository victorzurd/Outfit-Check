-- Añade 30 prendas de prueba a una cuenta de Supabase.
-- Reemplaza 'tu_correo@ejemplo.com' por el correo de la cuenta y ejecuta en SQL Editor.
-- Los registros son datos ficticios de prueba; no incluyen fotos ni llaman a Gemini.

do $$
declare
  target_email text := lower(trim('tu_correo@ejemplo.com'));
  target_user_id uuid;
begin
  if target_email = 'tu_correo@ejemplo.com' then
    raise exception 'Edita target_email en supabase/seed-wardrobe-30.sql antes de ejecutarlo.';
  end if;

  select id into target_user_id from auth.users where lower(email) = target_email;
  if target_user_id is null then
    raise exception 'No se encontró una cuenta con ese correo.';
  end if;

  with sample(name, category, subcategory, color, description, style, pattern, material, fit, formality, seasons) as (
    values
      ('Camiseta blanca básica', 'Parte de arriba', 'Camiseta', 'blanco', 'Camiseta lisa de algodón, manga corta y corte recto.', 'casual', 'liso', 'algodón', 'recto', 'informal', array['primavera','verano','otoño']),
      ('Camiseta negra básica', 'Parte de arriba', 'Camiseta', 'negro', 'Camiseta lisa de algodón, manga corta y corte recto.', 'casual', 'liso', 'algodón', 'recto', 'informal', array['primavera','verano','otoño']),
      ('Camiseta verde oliva', 'Parte de arriba', 'Camiseta', 'verde oliva', 'Camiseta lisa de manga corta para looks cotidianos.', 'casual', 'liso', 'algodón', 'recto', 'informal', array['primavera','verano']),
      ('Camisa azul claro', 'Parte de arriba', 'Camisa', 'azul claro', 'Camisa de botones de aspecto ligero y corte clásico.', 'smart casual', 'liso', 'algodón', 'clásico', 'smart casual', array['primavera','verano','otoño']),
      ('Blusa beige', 'Parte de arriba', 'Blusa', 'beige', 'Blusa lisa de aspecto fluido para conjuntos arreglados.', 'elegante', 'liso', 'tejido ligero', 'fluido', 'smart casual', array['primavera','verano','otoño']),
      ('Jersey gris', 'Parte de arriba', 'Jersey', 'gris', 'Jersey de punto de manga larga y corte cómodo.', 'casual', 'liso', 'punto', 'relajado', 'informal', array['otoño','invierno','primavera']),
      ('Sudadera azul marino', 'Parte de arriba', 'Sudadera', 'azul marino', 'Sudadera lisa de manga larga para un conjunto cómodo.', 'deportivo', 'liso', 'felpa', 'relajado', 'informal', array['otoño','invierno','primavera']),
      ('Pantalón negro recto', 'Parte de abajo', 'Pantalón', 'negro', 'Pantalón largo liso de corte recto y fácil combinación.', 'smart casual', 'liso', 'tejido estructurado', 'recto', 'smart casual', array['otoño','invierno','primavera']),
      ('Vaquero azul claro', 'Parte de abajo', 'Vaquero', 'azul claro', 'Vaquero largo de corte recto para uso diario.', 'casual', 'denim liso', 'denim', 'recto', 'informal', array['primavera','verano','otoño','invierno']),
      ('Vaquero azul oscuro', 'Parte de abajo', 'Vaquero', 'azul oscuro', 'Vaquero largo de aspecto clásico y corte recto.', 'casual', 'denim liso', 'denim', 'recto', 'informal', array['primavera','verano','otoño','invierno']),
      ('Falda midi negra', 'Parte de abajo', 'Falda', 'negro', 'Falda midi lisa para conjuntos casuales o arreglados.', 'elegante', 'liso', 'tejido ligero', 'midi', 'smart casual', array['primavera','verano','otoño']),
      ('Pantalón beige ancho', 'Parte de abajo', 'Pantalón', 'beige', 'Pantalón largo de pernera ancha y aspecto ligero.', 'smart casual', 'liso', 'tejido ligero', 'ancho', 'smart casual', array['primavera','verano','otoño']),
      ('Vestido negro midi', 'Cuerpo completo', 'Vestido', 'negro', 'Vestido midi de diseño sencillo, apto para combinar con capas.', 'elegante', 'liso', 'tejido ligero', 'midi', 'smart casual', array['primavera','verano','otoño']),
      ('Vestido floral', 'Cuerpo completo', 'Vestido', 'multicolor', 'Vestido con estampado floral y silueta ligera.', 'romántico', 'floral', 'tejido ligero', 'fluido', 'smart casual', array['primavera','verano']),
      ('Mono azul marino', 'Cuerpo completo', 'Mono', 'azul marino', 'Mono de una pieza de aspecto sencillo y versátil.', 'casual', 'liso', 'tejido ligero', 'recto', 'smart casual', array['primavera','verano','otoño']),
      ('Zapatillas blancas', 'Calzado', 'Zapatillas', 'blanco', 'Zapatillas bajas de estilo sencillo para uso diario.', 'casual', 'liso', 'material sintético', 'bajo', 'informal', array['primavera','verano','otoño','invierno']),
      ('Deportivas negras', 'Calzado', 'Deportivas', 'negro', 'Calzado deportivo ligero para caminar y looks informales.', 'deportivo', 'liso', 'malla y material sintético', 'deportivo', 'deportivo', array['primavera','verano','otoño','invierno']),
      ('Botines marrones', 'Calzado', 'Botines', 'marrón', 'Botines de tobillo para conjuntos de entretiempo.', 'casual', 'liso', 'material sintético', 'tobillo', 'informal', array['otoño','invierno']),
      ('Sandalias beige', 'Calzado', 'Sandalias', 'beige', 'Sandalias abiertas de tono neutro para días cálidos.', 'casual', 'liso', 'material sintético', 'abierto', 'informal', array['primavera','verano']),
      ('Mocasines negros', 'Calzado', 'Mocasines', 'negro', 'Mocasines de diseño clásico para looks casuales arreglados.', 'clásico', 'liso', 'material sintético', 'clásico', 'smart casual', array['primavera','verano','otoño']),
      ('Bolso negro pequeño', 'Bolsos', null, 'negro', 'Bolso pequeño de color neutro para llevar lo esencial.', 'clásico', 'liso', 'material sintético', 'pequeño', 'smart casual', array['primavera','verano','otoño','invierno']),
      ('Bolso tote beige', 'Bolsos', null, 'beige', 'Bolso tote amplio de aspecto sencillo para diario.', 'casual', 'liso', 'lona', 'amplio', 'informal', array['primavera','verano','otoño','invierno']),
      ('Pendientes dorados', 'Accesorios', 'Pendientes', 'dorado', 'Pendientes pequeños de acabado dorado.', 'minimalista', 'liso', 'metal', 'pequeño', 'smart casual', array['primavera','verano','otoño','invierno']),
      ('Pendientes plateados', 'Accesorios', 'Pendientes', 'plateado', 'Pendientes pequeños de acabado plateado.', 'minimalista', 'liso', 'metal', 'pequeño', 'smart casual', array['primavera','verano','otoño','invierno']),
      ('Pulsera fina dorada', 'Accesorios', 'Pulseras', 'dorado', 'Pulsera fina de aspecto sencillo.', 'minimalista', 'liso', 'metal', 'fino', 'smart casual', array['primavera','verano','otoño','invierno']),
      ('Collar plateado', 'Accesorios', 'Collares', 'plateado', 'Collar fino de estilo minimalista.', 'minimalista', 'liso', 'metal', 'fino', 'smart casual', array['primavera','verano','otoño','invierno']),
      ('Cinturón negro', 'Accesorios', 'Cinturones', 'negro', 'Cinturón liso para completar pantalones o faldas.', 'clásico', 'liso', 'material sintético', 'clásico', 'smart casual', array['primavera','verano','otoño','invierno']),
      ('Bufanda gris', 'Accesorios', 'Bufandas', 'gris', 'Bufanda lisa para días frescos.', 'casual', 'liso', 'tejido suave', 'envolvente', 'informal', array['otoño','invierno']),
      ('Anillo plateado', 'Accesorios', 'Anillos', 'plateado', 'Anillo sencillo de acabado plateado.', 'minimalista', 'liso', 'metal', 'fino', 'smart casual', array['primavera','verano','otoño','invierno']),
      ('Gafas de sol negras', 'Accesorios', 'Gafas', 'negro', 'Gafas de sol de montura negra y diseño clásico.', 'clásico', 'liso', 'material sintético', 'clásico', 'informal', array['primavera','verano'])
  )
  insert into public.wardrobe_items
    (user_id, name, category, subcategory, description, ai_attributes, color, brand, image_url)
  select target_user_id, s.name, s.category, s.subcategory, s.description,
    jsonb_build_object('style',s.style,'pattern',s.pattern,'material',s.material,'fit',s.fit,'formality',s.formality,'seasons',to_jsonb(s.seasons),'confidence',0.9,'source','manual-demo'),
    s.color, 'Prueba', null
  from sample s
  where not exists (
    select 1 from public.wardrobe_items w
    where w.user_id = target_user_id and w.name = s.name and w.category = s.category
  );
end $$;
