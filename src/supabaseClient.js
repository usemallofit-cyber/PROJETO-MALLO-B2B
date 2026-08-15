import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Isso aparece no console do navegador se as variáveis de ambiente não
  // tiverem sido configuradas (veja .env.example e o README).
  console.error(
    "Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. " +
    "Configure o arquivo .env localmente, ou as Environment Variables na Vercel."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
