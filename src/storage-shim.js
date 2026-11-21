// Implementa a mesma API (window.storage.get/set/delete/list) que o App.jsx usa,
// mas gravando na tabela "dados" do Supabase (uma linha por chave, por usuário).
// O App.jsx não precisa saber disso.
//
// Fluxo: depois do login, carregarTudo() baixa todas as linhas de uma vez para
// um cache em memória; get/list leem do cache (instantâneo) e set/delete
// atualizam o cache e gravam no banco.

import { supabase } from "./supabase.js";

let cache = new Map();

async function carregarTudo() {
  const { data, error } = await supabase.from("dados").select("chave, valor");
  if (error) throw error;
  cache = new Map((data || []).map((l) => [l.chave, l.valor]));
}

function limpar() {
  cache = new Map();
}

window.storage = {
  async get(chave, shared = false) {
    if (!cache.has(chave)) return null;
    return { key: chave, value: cache.get(chave), shared: !!shared };
  },

  async set(chave, valor, shared = false) {
    const { error } = await supabase
      .from("dados")
      .upsert({ chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: "user_id,chave" });
    if (error) {
      console.error("Erro ao salvar no Supabase:", error);
      window.dispatchEvent(new CustomEvent("storage-erro", { detail: error.message }));
      return null;
    }
    cache.set(chave, valor);
    return { key: chave, value: valor, shared: !!shared };
  },

  async delete(chave, shared = false) {
    const existia = cache.has(chave);
    const { error } = await supabase.from("dados").delete().eq("chave", chave);
    if (error) {
      console.error("Erro ao apagar no Supabase:", error);
      return null;
    }
    cache.delete(chave);
    return { key: chave, deleted: existia, shared: !!shared };
  },

  async list(prefixo = "", shared = false) {
    const chaves = [...cache.keys()].filter((k) => !prefixo || k.startsWith(prefixo));
    return { keys: chaves, prefix: prefixo, shared: !!shared };
  },
};

export { carregarTudo, limpar };
