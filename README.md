# Outfit Check

Aplicación web adaptable para organizar un armario personal, crear combinaciones de prendas, guardar looks y sincronizar los datos con Supabase. No incluye generación de imágenes ni servicios de pago.

## Desarrollo local

Necesitas Node.js 20 o superior.

```bash
npm install
npm run dev
```

Sin Supabase, las prendas y los looks se guardan en el almacenamiento local del navegador. Cada navegador mantiene sus propios datos.

## Supabase

1. Crea un proyecto de Supabase.
2. Ejecuta [`supabase/schema.sql`](supabase/schema.sql) en SQL Editor. El esquema crea las tablas del armario y los looks, activa Row Level Security y configura el bucket privado `wardrobe-photos` con permisos de lectura, carga y borrado por carpeta de usuario. Si ya tienes Supabase configurado, vuelve a ejecutar el esquema para añadir el campo de subcategoría.
3. Configura las variables públicas del proyecto para el build:
   - `STORAGE_SUPABASE_URL` (también se acepta `STORAGE_VITE_PUBLIC_SUPABASE_URL`)
   - `STORAGE_SUPABASE_PUBLISHABLE_KEY` (o `STORAGE_SUPABASE_ANON_KEY`; también se aceptan los nombres `STORAGE_VITE_PUBLIC_SUPABASE_*`)
4. En local también se aceptan `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; puedes copiarlas en `.env`.
5. Añade el origen local y el dominio publicado a Authentication → URL Configuration → Redirect URLs.

Al iniciar sesión con correo y contraseña, la aplicación carga y guarda prendas y looks en Supabase. Las cuentas previas que todavía no tengan contraseña pueden usar “¿Olvidaste tu contraseña?” para establecer una. Sin sesión, conserva los datos localmente en el dispositivo.

No pongas claves `service_role`/secret, el secreto JWT ni credenciales de Postgres en variables expuestas al cliente. La app solo usa la URL y la clave pública de Supabase.

## Despliegue en Vercel

Importa el repositorio y usa `npm run build` como comando de build y `dist` como directorio de salida. La configuración de Vite traduce las variables públicas de la integración de Supabase a la configuración que usa la app.

La aplicación no requiere funciones de servidor, claves de IA ni servicios meteorológicos.

## Instalar en ordenador, iPhone o iPad

La aplicación es una PWA instalable. Publícala en Vercel (HTTPS obligatorio) y abre el dominio publicado:

- **Windows/macOS:** abre el sitio en Chrome o Edge y selecciona **Instalar Outfit Check** en el menú del navegador. Algunos navegadores muestran un icono de instalación junto a la barra de direcciones.
- **iPhone/iPad:** abre el sitio en Safari, toca **Compartir** y selecciona **Añadir a pantalla de inicio**. iOS/iPadOS no instala la PWA desde Chrome; debe hacerse desde Safari.

La aplicación conserva la pantalla inicial para poder abrirla sin conexión, pero la autenticación y la sincronización con Supabase necesitan internet. La instalación PWA no genera un paquete de App Store ni un instalador nativo de Windows/macOS.

Si habías desplegado la antigua Edge Function `virtual-try-on`, elimínala desde Supabase o con `supabase functions delete virtual-try-on` y borra el secreto `FASHN_API_KEY` de Edge Functions → Secrets. Ejecutar el esquema también elimina la tabla y función SQL de límite diario que usaba la integración anterior.
