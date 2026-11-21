import { createClient } from "@supabase/supabase-js";

// URL e chave PUBLICÁVEL (feita para ficar no navegador). Quem protege os dados
// é o RLS da tabela "dados" + o login — nunca coloque a chave service_role aqui.
// Pode ser trocada por variáveis de ambiente (VITE_SUPABASE_URL / VITE_SUPABASE_KEY).
const URL = import.meta.env.VITE_SUPABASE_URL || "https://lqluesidlvmtvaeiclwe.supabase.co";
const CHAVE = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_A9YlcGxY7vDkfLYtgbecxA_Jc9hoJ1r";

export const supabase = createClient(URL, CHAVE);
