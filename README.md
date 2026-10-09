# Outfit Check

> Tu armario, tus planes, tu próximo look.

**Outfit Check** es una aplicación web para organizar prendas, descubrir combinaciones y guardar looks. Tiene una experiencia adaptable a ordenador y móvil, puede instalarse como PWA y permite guardar los datos en el dispositivo o sincronizarlos con una cuenta de Supabase.

## Qué puedes hacer

- **Organizar el armario:** añadir, editar y eliminar prendas, con foto opcional, categoría, subtipo, color, marca y descripción.
- **Separar las capas:** las prendas de primera capa (camisetas, camisas, blusas y tops) se guardan aparte de la ropa de abrigo o segunda capa (incluye jerseys, sudaderas, cárdigans, chaquetas y abrigos), que el generador elige según el tiempo.
- **Crear outfits:** generar combinaciones según el plan y cómo te apetece vestir. Con hasta 50 prendas se usa el algoritmo ligero local; para armarios más grandes se utiliza una selección de candidatas basada en atributos, puntuaciones previas y afinidad del subtipo con la ocasión y el estado de ánimo.
- **Descubrir inspiración:** explorar looks aleatorios del armario, valorar cada propuesta y guardar tus favoritas.
- **Aprender de tus gustos:** las valoraciones aportan contexto para recomendar combinaciones de color y prendas en situaciones similares.
- **Tener en cuenta el tiempo:** si lo deseas, puedes compartir la ubicación actual para consultar temperatura y condiciones meteorológicas. Se usa al generar recomendaciones y no se solicita permiso hasta que pulsas **Tiempo local**.
- **Sincronizar y exportar:** con una sesión de Supabase, prendas, looks y valoraciones pueden guardarse en la nube. También puedes descargar una copia de prendas y looks en JSON.
- **Instalarla en el móvil:** en iPhone y iPad se añade a la pantalla de inicio desde Safari; en ordenador puede instalarse desde Chrome o Edge.

## Requisitos

- Node.js 20 o superior.
- npm.
- Para sincronización: un proyecto de Supabase.
- Para descripciones y recomendaciones con IA: despliegue en Vercel con las claves de Gemini y Groq configuradas.

La app puede ejecutarse sin Supabase: en ese modo, los datos se guardan en el almacenamiento local del navegador y no se sincronizan entre dispositivos.

## Inicio rápido

```bash
npm install
npm run dev
```

Vite mostrará la dirección local en la terminal. Para generar y previsualizar una compilación de producción:

```bash
npm run build
npm run preview
```

## Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Ejecuta [`supabase/schema.sql`](supabase/schema.sql) desde **SQL Editor**. Configura las tablas del armario, looks y valoraciones, las políticas Row Level Security y el bucket privado `wardrobe-photos`. También migra jerseys, sudaderas, chaquetas, abrigos y otras capas existentes a **Ropa de abrigo**.
3. Copia [`.env.example`](.env.example) a `.env` y completa la URL y la clave pública de tu proyecto:

   ```dotenv
   STORAGE_SUPABASE_URL=https://tu-proyecto.supabase.co
   STORAGE_SUPABASE_PUBLISHABLE_KEY=tu-clave-publica
   ```

   Para desarrollo local también se aceptan `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

4. En **Authentication → URL Configuration → Redirect URLs**, añade la URL local y el dominio de producción.
5. Reinicia el servidor de desarrollo después de modificar `.env`.

La configuración solo necesita la clave pública de Supabase. **No expongas** claves `service_role` o `secret`, el secreto JWT ni credenciales de Postgres en el cliente o en variables `VITE_*`.

Al iniciar sesión con correo y contraseña, la app intenta sincronizar los datos con Supabase. Sin sesión, conserva los datos localmente. Una cuenta antigua que aún no tenga contraseña puede usar **¿Olvidaste tu contraseña?** para establecerla.

### Datos de ejemplo y borrado

- Para cargar un armario de prueba, ejecuta [`seed-wardrobe-30.sql`](supabase/seed-wardrobe-30.sql). Puedes ampliarlo con [`seed-wardrobe-100.sql`](supabase/seed-wardrobe-100.sql). En ambos archivos sustituye `tu_correo@ejemplo.com` por el correo de la cuenta. Son prendas ficticias, sin fotos.
- Para borrar prendas, looks y valoraciones de una cuenta concreta, revisa [`reset-user-data.sql`](supabase/reset-user-data.sql), sustituye el correo de ejemplo y ejecútalo conscientemente. No elimina la cuenta. Las fotos del bucket deben borrarse aparte desde Storage.

## Funciones de IA

Las funciones de servidor están en [`api/`](api/) y se despliegan en Vercel:

- `describe-garment.js` usa **Gemini** para describir una foto o inferir atributos a partir de los datos de una prenda nueva. Guarda descripción y atributos en Supabase.
- `recommend-outfit.js` usa **Groq** para generar recomendaciones personalizadas. Recibe información textual de las prendas candidatas; no recibe las imágenes.
- [`server/ai-utils.js`](server/ai-utils.js) reúne utilidades compartidas por las funciones.

Para habilitar estas funciones, configura en Vercel las siguientes variables:

| Variable | Uso |
| --- | --- |
| `GEMINI_API_KEY` | Clave privada de Google AI Studio para describir prendas. |
| `GROQ_API_KEY` | Clave privada de Groq para recomendar outfits. |
| `SUPABASE_URL` | URL del proyecto, necesaria para las funciones del servidor. |
| `SUPABASE_PUBLISHABLE_KEY` o `SUPABASE_ANON_KEY` | Clave pública de Supabase para validar y guardar datos del usuario. |

Opcionalmente puedes cambiar los modelos con `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` y `GROQ_MODEL`. Si Gemini está saturado, la función prueba modelos Flash alternativos. Las claves de IA son privadas: no uses el prefijo `VITE_`.

La recomendación personalizada requiere sesión y conexión con Supabase. El algoritmo usa atributos, contexto de uso y valoraciones. Con hasta 50 prendas Groq recibe el armario completo; por encima de ese umbral se puntúan las prendas y se envían candidatas variadas por etapa, incluida la ropa de abrigo. La segunda capa es opcional: se selecciona por la temperatura aparente (o la temperatura real si no está disponible), la lluvia, la estación, el subtipo y el plan. En general, prioriza abrigos y gabardinas con frío intenso, jerseys o sudaderas si no hay una prenda exterior más cálida, chaquetas con tiempo fresco y capas ligeras con temperatura templada; con calor procura omitirla. En el modo con cuenta se aplica un intervalo de 25 segundos entre generaciones.

Las valoraciones de inspiración se guardan con su contexto y una copia de las prendas del look. Sin sesión, se conservan solo en ese navegador. La ubicación precisa se utiliza para consultar Open-Meteo; las recomendaciones reciben la ciudad aproximada, estación y condiciones meteorológicas, no las coordenadas GPS. La geolocalización es opcional.

> **Privacidad:** al guardar una foto con una cuenta conectada, la imagen se envía a Gemini para describir la prenda. Groq recibe texto para recomendar outfits. Revisa las condiciones de los proveedores antes de subir imágenes privadas; el nivel gratuito de Gemini puede tener límites y condiciones de uso de datos propias.

## Publicar en Vercel

1. Importa el repositorio en Vercel.
2. Usa `npm run build` como comando de compilación y `dist` como directorio de salida.
3. Añade las variables públicas de Supabase para Vite y las variables privadas de Supabase, Gemini y Groq indicadas arriba.
4. Configura las Redirect URLs de Supabase con el dominio publicado.
5. Vuelve a desplegar tras cambiar variables de entorno o el esquema de Supabase.

La geolocalización consulta Open-Meteo desde el navegador y no requiere claves propias ni una función de servidor adicional.

## Instalar como aplicación

Outfit Check es una PWA. Para instalarla desde producción, el sitio debe estar publicado mediante HTTPS.

- **iPhone o iPad:** abre la web en Safari, toca **Compartir** y selecciona **Añadir a pantalla de inicio**. En iOS, la instalación debe hacerse desde Safari.
- **Windows o macOS:** abre el sitio en Chrome o Edge y selecciona **Instalar Outfit Check** en el menú del navegador, o utiliza el icono de instalación de la barra de direcciones si aparece.

La pantalla inicial puede abrirse sin conexión, pero la autenticación y la sincronización con Supabase necesitan internet. La PWA no crea una aplicación de App Store ni un instalador nativo de escritorio.

## Estructura del proyecto

```text
.
├── api/                    # Funciones de Vercel para Gemini y Groq
├── public/                 # Iconos, manifiesto PWA y service worker
├── server/                 # Utilidades compartidas del servidor
├── src/
│   ├── components/         # Componentes de interfaz reutilizables
│   ├── data/               # Catálogo, subtipos, perfiles de estilo y momentos de inspiración
│   ├── lib/                 # Supabase, IA, tiempo, fotos, armario y puntuación
│   ├── main.jsx             # Aplicación y coordinación de pantallas y flujos
│   └── styles.css           # Estilos y adaptación a móvil/escritorio
├── supabase/               # Esquema y scripts para gestionar datos de prueba
├── .env.example            # Plantilla de configuración local
└── vite.config.js          # Vite y configuración pública de Supabase
```

## Notas de mantenimiento

- El esquema de Supabase está en [`supabase/schema.sql`](supabase/schema.sql). Si actualizas una instalación existente, vuelve a ejecutarlo para aplicar las columnas, tablas y políticas más recientes.
- La app anterior podía usar una Edge Function `virtual-try-on`. Si aún existe en tu proyecto, elimínala con `supabase functions delete virtual-try-on` y borra el secreto `FASHN_API_KEY` de **Edge Functions → Secrets**. El esquema actual elimina también la tabla y función SQL del límite diario de aquella integración.
- No subas `.env` ni claves privadas al repositorio.
