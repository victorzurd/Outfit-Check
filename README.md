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
2. Ejecuta [`supabase/schema.sql`](supabase/schema.sql) en SQL Editor. El esquema crea las tablas del armario, los looks guardados y las valoraciones de outfits, activa Row Level Security y configura el bucket privado `wardrobe-photos` con permisos por usuario. Si ya tienes Supabase configurado, vuelve a ejecutar el esquema para añadir los campos y la tabla de valoraciones, y migrar las categorías antiguas del armario.
3. Configura las variables públicas del proyecto para el build:
   - `STORAGE_SUPABASE_URL` (también se acepta `STORAGE_VITE_PUBLIC_SUPABASE_URL`)
   - `STORAGE_SUPABASE_PUBLISHABLE_KEY` (o `STORAGE_SUPABASE_ANON_KEY`; también se aceptan los nombres `STORAGE_VITE_PUBLIC_SUPABASE_*`)
4. En local también se aceptan `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; puedes copiarlas en `.env`.
5. Añade el origen local y el dominio publicado a Authentication → URL Configuration → Redirect URLs.

Para borrar los datos de una cuenta concreta y volver a cargar su armario, usa [`supabase/reset-user-data.sql`](supabase/reset-user-data.sql): sustituye `correo@ejemplo.com` por el correo de esa cuenta antes de ejecutarlo. Borra prendas, looks guardados y valoraciones de ese usuario; no elimina la cuenta ni afecta a otros usuarios. Las fotos del bucket privado deben borrarse aparte desde Storage.

Para poblar una cuenta de pruebas, ejecuta [`supabase/seed-wardrobe-30.sql`](supabase/seed-wardrobe-30.sql) y luego, si quieres ampliar el armario, [`supabase/seed-wardrobe-100.sql`](supabase/seed-wardrobe-100.sql). En cada archivo sustituye `tu_correo@ejemplo.com` por el email de la cuenta. Los datos son ficticios, incluyen atributos de ejemplo y no tienen fotos; no se envían a Gemini.

Al iniciar sesión con correo y contraseña, la aplicación carga y guarda prendas y looks en Supabase. Las cuentas previas que todavía no tengan contraseña pueden usar “¿Olvidaste tu contraseña?” para establecer una. Sin sesión, conserva los datos localmente en el dispositivo.

No pongas claves `service_role`/secret, el secreto JWT ni credenciales de Postgres en variables expuestas al cliente. La app solo usa la URL y la clave pública de Supabase.

## Despliegue en Vercel

Importa el repositorio y usa `npm run build` como comando de build y `dist` como directorio de salida. La configuración de Vite traduce las variables públicas de la integración de Supabase a la configuración que usa la app.

La web no requiere servicios meteorológicos ni funciones de servidor adicionales fuera de Vercel.

### IA para describir prendas y recomendar looks

La web usa dos funciones de Vercel en `api/`: Gemini analiza la foto, o infiere atributos desde los datos de una prenda nueva sin foto, y guarda descripción y atributos en Supabase; Groq recomienda outfits usando solo datos de texto, sin enviarle imágenes. Con hasta 50 prendas Groq recibe el armario completo. En armarios mayores, el sistema puntúa todas las prendas con sus atributos, valoraciones y afinidad del subtipo con el plan y el estado de ánimo (por ejemplo, zapatillas para un plan cómodo o zapatos para uno elegante), y elige una selección variada de hasta 16 prendas para la parte superior o los extras, y hasta 12 para la parte inferior o el calzado. En el modo con cuenta, la aplicación espera 25 segundos entre generaciones. Para habilitarlo:

1. En la configuración del proyecto de Vercel, añade `GEMINI_API_KEY` y `GROQ_API_KEY` como variables de entorno para Production y Preview. Puedes crear las claves en Google AI Studio y Groq Console. Opcionalmente, configura `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` o `GROQ_MODEL` para elegir otros modelos. Si Gemini está saturado, la función prueba automáticamente modelos Flash alternativos.
2. Asegúrate de que Vercel tiene `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (también se acepta `SUPABASE_ANON_KEY`) además de la configuración pública usada por Vite. Las claves Gemini y Groq son privadas y no deben llevar el prefijo `VITE_`.
3. Ejecuta de nuevo `supabase/schema.sql` en Supabase para añadir `description` y `ai_attributes` (además de `subcategory`), y vuelve a desplegar en Vercel.

La IA necesita una sesión iniciada y conexión con Supabase. La página **Inspiración** propone outfits para distintas ocasiones, estaciones y temperaturas. Cada puntuación se guarda junto con el contexto y una copia de las prendas del outfit; Groq resume las valoraciones por situación y las usa al recomendar nuevos looks. Sin sesión, las puntuaciones solo se guardan en ese navegador. Las prendas añadidas antes de habilitar la IA conservan sus datos; al editar una prenda y guardar una foto se genera su descripción. El nivel gratuito de Gemini puede tener límites y Google indica que puede usar los datos enviados para mejorar sus productos; revisa sus condiciones antes de subir fotos privadas.

El armario separa **Parte de arriba**, **Parte de abajo**, **Cuerpo completo**, **Calzado**, **Bolsos** y **Accesorios**, con subtipos como sandalias, zapatillas, pantalones o pendientes. **Inspiración** crea combinaciones aleatorias del armario sin llamar a la IA. Groq construye las recomendaciones personalizadas en etapas y solo recibe las prendas candidatas para cada etapa; usa las valoraciones guardadas y las prendas de cada outfit como contexto para aprender los gustos del usuario. Los outfits incluyen calzado y una prenda de cuerpo completo o una parte de arriba más una de abajo; el bolso es opcional (máximo uno). Se pueden combinar varios accesorios, pero los que normalmente se llevan de uno en uno (pendientes, collares, relojes, cinturones, sombreros, bufandas y gafas) tienen un máximo de uno por tipo. Pulseras y anillos sí pueden repetirse.

## Instalar en ordenador, iPhone o iPad

La aplicación es una PWA instalable. Publícala en Vercel (HTTPS obligatorio) y abre el dominio publicado:

- **Windows/macOS:** abre el sitio en Chrome o Edge y selecciona **Instalar Outfit Check** en el menú del navegador. Algunos navegadores muestran un icono de instalación junto a la barra de direcciones.
- **iPhone/iPad:** abre el sitio en Safari, toca **Compartir** y selecciona **Añadir a pantalla de inicio**. iOS/iPadOS no instala la PWA desde Chrome; debe hacerse desde Safari.

La aplicación conserva la pantalla inicial para poder abrirla sin conexión, pero la autenticación y la sincronización con Supabase necesitan internet. La instalación PWA no genera un paquete de App Store ni un instalador nativo de Windows/macOS.

Si habías desplegado la antigua Edge Function `virtual-try-on`, elimínala desde Supabase o con `supabase functions delete virtual-try-on` y borra el secreto `FASHN_API_KEY` de Edge Functions → Secrets. Ejecutar el esquema también elimina la tabla y función SQL de límite diario que usaba la integración anterior.
