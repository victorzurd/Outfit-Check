import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Vercel's Supabase integration prefixes its variables with STORAGE_. Read
  // those at build time and expose only the public URL/key to the browser.
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.STORAGE_VITE_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || ''
  const supabaseKey = env.STORAGE_VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || env.STORAGE_VITE_PUBLIC_SUPABASE_ANON_KEY
    || env.VITE_SUPABASE_ANON_KEY
    || ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
    },
  }
})
