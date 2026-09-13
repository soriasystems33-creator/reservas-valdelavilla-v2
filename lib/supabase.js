import { createClient } from '@supabase/supabase-js';

// Usamos valores placeholder si las variables de entorno no están configuradas 
// para evitar caídas en tiempo de build o compilación.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
