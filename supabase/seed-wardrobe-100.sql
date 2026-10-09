-- Añade otras 100 prendas de prueba (25 modelos x 4 colores) a una cuenta.
-- Reemplaza 'tu_correo@ejemplo.com' por el correo de la cuenta y ejecuta en SQL Editor.
-- Puede ejecutarse tras seed-wardrobe-30.sql; no repite nombres ya insertados.
-- Son datos ficticios, sin fotos; Gemini no se invoca desde SQL.

do $$
declare
  target_email text := lower(trim('tu_correo@ejemplo.com'));
  target_user_id uuid;
begin
  if target_email = 'tu_correo@ejemplo.com' then
    raise exception 'Edita target_email en supabase/seed-wardrobe-100.sql antes de ejecutarlo.';
  end if;

  select id into target_user_id from auth.users where lower(email) = target_email;
  if target_user_id is null then
    raise exception 'No se encontró una cuenta con ese correo.';
  end if;

  with palette(color) as (
    values ('negro'), ('blanco'), ('azul marino'), ('beige')
  ),
  models(category, subcategory, base_name, description, style, pattern, material, fit, formality, seasons) as (
    values
      ('Parte de arriba','Camiseta','Camiseta de algodón','Camiseta lisa de manga corta para uso diario.','casual','liso','algodón','recto','informal',array['primavera','verano','otoño']),
      ('Parte de arriba','Camisa','Camisa clásica','Camisa de botones de corte clásico.','smart casual','liso','algodón','clásico','smart casual',array['primavera','verano','otoño']),
      ('Parte de arriba','Blusa','Blusa fluida','Blusa de aspecto fluido para conjuntos arreglados.','elegante','liso','tejido ligero','fluido','smart casual',array['primavera','verano','otoño']),
      ('Parte de arriba','Top','Top básico','Top sencillo de manga corta para días cálidos.','casual','liso','algodón','ajustado','informal',array['primavera','verano']),
      ('Ropa de abrigo','Jersey','Jersey de punto','Jersey de manga larga para días frescos.','casual','liso','punto','relajado','informal',array['otoño','invierno','primavera']),
      ('Ropa de abrigo','Sudadera','Sudadera cómoda','Sudadera lisa de corte cómodo.','deportivo','liso','felpa','relajado','informal',array['otoño','invierno','primavera']),
      ('Ropa de abrigo','Chaqueta','Chaqueta ligera','Chaqueta ligera para completar looks de entretiempo.','casual','liso','tejido estructurado','recto','smart casual',array['primavera','otoño']),
      ('Ropa de abrigo','Abrigo','Abrigo clásico','Abrigo de manga larga para temperaturas bajas.','clásico','liso','paño','recto','smart casual',array['otoño','invierno']),
      ('Parte de abajo','Pantalón','Pantalón recto','Pantalón largo de corte recto y diseño sencillo.','smart casual','liso','tejido estructurado','recto','smart casual',array['otoño','invierno','primavera']),
      ('Parte de abajo','Vaquero','Vaquero clásico','Vaquero largo de estilo cotidiano.','casual','denim liso','denim','recto','informal',array['primavera','verano','otoño','invierno']),
      ('Parte de abajo','Falda','Falda midi','Falda midi de diseño sencillo.','elegante','liso','tejido ligero','midi','smart casual',array['primavera','verano','otoño']),
      ('Parte de abajo','Shorts','Shorts casuales','Shorts ligeros para días cálidos.','casual','liso','algodón','recto','informal',array['primavera','verano']),
      ('Parte de abajo','Leggings','Leggings cómodos','Leggings elásticos para looks cómodos o deportivos.','deportivo','liso','tejido elástico','ajustado','deportivo',array['primavera','verano','otoño','invierno']),
      ('Cuerpo completo','Vestido','Vestido midi','Vestido midi de diseño versátil.','elegante','liso','tejido ligero','midi','smart casual',array['primavera','verano','otoño']),
      ('Cuerpo completo','Mono','Mono de una pieza','Mono de una pieza con silueta sencilla.','casual','liso','tejido ligero','recto','smart casual',array['primavera','verano','otoño']),
      ('Cuerpo completo','Peto','Peto casual','Peto de estilo informal para combinar con una camiseta.','casual','liso','denim','recto','informal',array['primavera','verano','otoño']),
      ('Calzado','Zapatillas','Zapatillas urbanas','Zapatillas bajas para caminar y uso diario.','casual','liso','material sintético','bajo','informal',array['primavera','verano','otoño','invierno']),
      ('Calzado','Deportivas','Deportivas ligeras','Calzado deportivo cómodo para caminar.','deportivo','liso','malla y material sintético','deportivo','deportivo',array['primavera','verano','otoño','invierno']),
      ('Calzado','Sandalias','Sandalias abiertas','Sandalias abiertas para días cálidos.','casual','liso','material sintético','abierto','informal',array['primavera','verano']),
      ('Calzado','Botas','Botas de caña','Botas de caña para looks de otoño e invierno.','casual','liso','material sintético','caña alta','informal',array['otoño','invierno']),
      ('Calzado','Mocasines','Mocasines clásicos','Mocasines de diseño sencillo para looks arreglados.','clásico','liso','material sintético','clásico','smart casual',array['primavera','verano','otoño']),
      ('Bolsos',null,'Bolso pequeño','Bolso pequeño para llevar lo esencial.','clásico','liso','material sintético','pequeño','smart casual',array['primavera','verano','otoño','invierno']),
      ('Bolsos',null,'Bolso tote','Bolso tote amplio para uso diario.','casual','liso','lona','amplio','informal',array['primavera','verano','otoño','invierno']),
      ('Accesorios','Pulseras','Pulsera sencilla','Pulsera de diseño sencillo para combinar.','minimalista','liso','metal','fino','smart casual',array['primavera','verano','otoño','invierno']),
      ('Accesorios','Anillos','Anillo minimalista','Anillo de diseño sencillo para uso diario.','minimalista','liso','metal','fino','smart casual',array['primavera','verano','otoño','invierno'])
  ),
  sample as (
    select m.category, m.subcategory, p.color,
      'Prueba 100 · ' || initcap(p.color) || ' ' || m.base_name as name,
      m.description, m.style, m.pattern, m.material, m.fit, m.formality, m.seasons
    from models m cross join palette p
  )
  insert into public.wardrobe_items
    (user_id, name, category, subcategory, description, ai_attributes, color, brand, image_url)
  select target_user_id, s.name, s.category, s.subcategory, s.description,
    jsonb_build_object('style',s.style,'pattern',s.pattern,'material',s.material,'fit',s.fit,'formality',s.formality,'seasons',to_jsonb(s.seasons),'confidence',0.9,'source','manual-demo'),
    s.color, 'Prueba ampliada', null
  from sample s
  where not exists (
    select 1 from public.wardrobe_items w
    where w.user_id = target_user_id and w.name = s.name and w.category = s.category
  );
end $$;
