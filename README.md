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

## Publicar en Vercel

Importa el repositorio en [Vercel](https://vercel.com/), deja el comando de build como `npm run build` y el directorio de salida como `dist`. Añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Environment Variables. Después de desplegar, añade el dominio de Vercel a los redirect URLs de Supabase.

La interfaz se adapta a escritorio, iPad y móvil. El primer prototipo genera combinaciones con prendas de ejemplo; el servicio de recomendaciones de clima y estilo todavía no está conectado a una API externa.
