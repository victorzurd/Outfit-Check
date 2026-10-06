# Outfit Check

Una aplicación web adaptable para organizar prendas y crear looks. Está construida con React y Vite; se puede publicar en Vercel y conectar a Supabase.

## Empezar en local

Necesitas Node.js 20 o superior. En la carpeta del proyecto:

```bash
npm install
npm run dev
```

Sin configuración de Supabase, la aplicación abre en modo de prueba y conserva el armario en este navegador. Las fotos de ejemplo necesitan conexión a internet.

## Conectar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En SQL Editor, ejecuta [`supabase/schema.sql`](supabase/schema.sql).
3. En Storage, crea un bucket público llamado `wardrobe-photos`. Añade políticas para que una persona autenticada pueda leer y escribir únicamente dentro de la carpeta cuyo nombre sea su ID de usuario. La app usa rutas con formato `<user-id>/<nombre-de-archivo>`.
4. Copia `.env.example` a `.env` y añade la URL del proyecto y la clave `anon` o publishable. No pongas nunca la `service_role` en la aplicación web.
5. En Authentication → URL Configuration, añade la URL local y la dirección final de Vercel como redirect URLs.

La app inicia sesión por enlace enviado por email. Al conectar la cuenta, carga y guarda las prendas en Supabase. Las cuentas nuevas empiezan con el armario vacío.

## Activar la prueba virtual

La pantalla «Probar en mí» y la integración de servidor están preparadas. Para obtener el resultado real hace falta una cuenta de API de FASHN: su API requiere comprar créditos antes de emitir una clave; cada imagen de Try-On v1.6 consume 1 crédito. El precio actual de pago por uso es 0,075 USD por crédito, con una compra mínima de 100 créditos (7,50 USD). Los créditos gratuitos de la aplicación web de FASHN no son créditos de API. Por tanto, la prueba virtual real no se puede ofrecer sin coste usando esta integración. No actives ni compartas la función sin decidir antes quién pagará esos créditos.

1. En FASHN Developer API, compra créditos y crea una clave. Consulta sus [precios](https://fashn.ai/pricing) y [requisitos de API](https://docs.fashn.ai/getting-started/api-setup).
2. Añade `FASHN_API_KEY` como secreto de Supabase Edge Functions. Nunca la pongas en `.env` del frontend ni en Vercel.
3. Despliega `supabase/functions/virtual-try-on` como Edge Function `virtual-try-on` (con Supabase CLI: `supabase functions deploy virtual-try-on`). La función exige inicio de sesión de Supabase; añade la clave FASHN y ejecuta el esquema SQL para habilitar el límite diario de 3 intentos por cuenta.
4. Publica la web. Las personas usuarias deben iniciar sesión y confirmar antes de cada generación.

La función comprime la foto del cuerpo en el navegador, la envía como base64 y solicita una respuesta de corta duración. La imagen de la persona no se escribe en la base de datos de Outfit Check. FASHN indica que elimina la copia temporal de entrada al terminar el proceso, aunque conserva metadatos de la solicitud; los resultados base64 están disponibles durante 60 minutos. Lee la [política de retención de FASHN](https://docs.fashn.ai/api-overview/data-retention-privacy). La función solo acepta fotos personales en base64 y prendas de Storage de este proyecto o de la galería de ejemplo.

## Publicar en Vercel

Importa el repositorio en [Vercel](https://vercel.com/), deja el comando de build como `npm run build` y el directorio de salida como `dist`. La integración de Supabase para Vercel puede proporcionar `STORAGE_VITE_PUBLIC_SUPABASE_URL` y `STORAGE_VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (también se acepta `STORAGE_VITE_PUBLIC_SUPABASE_ANON_KEY`). `vite.config.js` mapea esas dos variables públicas a la configuración que usa React durante la compilación. Para desarrollo local también se admiten los nombres `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

No expongas `STORAGE_SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_SUPABASE_SECRET_KEY`, secretos JWT ni credenciales Postgres al código del navegador. La app solo necesita la URL y la clave pública/publishable. La Edge Function desplegada en Supabase usa sus propios secretos de Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`), configurados en ese proyecto; las variables de Vercel no se transfieren a Supabase. La prueba virtual requiere además el secreto `FASHN_API_KEY` en Supabase.

Después de desplegar, añade el dominio de Vercel a los redirect URLs de Supabase.

La interfaz se adapta a escritorio, iPad y móvil. El primer prototipo genera combinaciones con prendas de ejemplo; el servicio de recomendaciones de clima y estilo todavía no está conectado a una API externa.
