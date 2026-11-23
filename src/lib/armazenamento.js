// Armazenamento dos dados no banco (tabela "dados", uma linha por chave e por usuário).
//
// Protege contra dois aparelhos se sobrescrevendo: cada gravação só vale se a linha ainda
// estiver na versão (atualizado_em) que este aparelho carregou. Se outro aparelho gravou
// antes, a gravação é recusada e o app avisa (evento "storage-conflito"), em vez de
// apagar o que o outro aparelho salvou.
export function criarArmazenamento(supabase, { agora = () => new Date().toISOString(), emitir = () => {} } = {}) {
  let cache = new Map(); // chave -> { valor, v }  (v = versão = atualizado_em da linha)
  const filas = new Map(); // grava uma chave por vez, na ordem
  let pendentes = 0;
  let bloqueado = false; // depois de um conflito, nada mais é gravado até recarregar

  async function carregarTudo() {
    const { data, error } = await supabase.from("dados").select("chave, valor, atualizado_em");
    if (error) throw error;
    cache = new Map((data || []).map((l) => [l.chave, { valor: l.valor, v: l.atualizado_em }]));
    bloqueado = false;
  }

  function limpar() {
    cache = new Map();
    bloqueado = false;
  }

  // Há dados mais novos (de outro aparelho) do que os que este aparelho carregou?
  async function haNovidades() {
    if (pendentes > 0 || bloqueado) return false;
    const { data, error } = await supabase.from("dados").select("chave, atualizado_em");
    if (error || !data) return false;
    return data.some((l) => !cache.has(l.chave) || cache.get(l.chave).v !== l.atualizado_em);
  }

  async function gravar(chave, valor, shared) {
    if (bloqueado) return null;
    const atual = cache.get(chave);
    const quando = agora();
    const consulta = atual
      ? supabase.from("dados").update({ valor, atualizado_em: quando }).eq("chave", chave).eq("atualizado_em", atual.v).select("atualizado_em")
      : supabase.from("dados").insert({ chave, valor, atualizado_em: quando }).select("atualizado_em");
    const { data, error } = await consulta;
    const conflito = (error && error.code === "23505") || (!error && (!data || data.length === 0));
    if (conflito) {
      bloqueado = true;
      emitir("storage-conflito", chave);
      return null;
    }
    if (error) {
      emitir("storage-erro", error.message);
      return null;
    }
    cache.set(chave, { valor, v: data[0].atualizado_em });
    return { key: chave, value: valor, shared: !!shared };
  }

  return {
    carregarTudo,
    limpar,
    haNovidades,
    ocupado: () => pendentes > 0,

    async get(chave, shared = false) {
      if (!cache.has(chave)) return null;
      return { key: chave, value: cache.get(chave).valor, shared: !!shared };
    },

    async set(chave, valor, shared = false) {
      const anterior = filas.get(chave) || Promise.resolve();
      const proxima = anterior.then(() => gravar(chave, valor, shared));
      filas.set(chave, proxima.catch(() => {}));
      pendentes++;
      try { return await proxima; } finally { pendentes--; }
    },

    async delete(chave, shared = false) {
      if (bloqueado) return null;
      const existia = cache.has(chave);
      const { error } = await supabase.from("dados").delete().eq("chave", chave);
      if (error) { emitir("storage-erro", error.message); return null; }
      cache.delete(chave);
      return { key: chave, deleted: existia, shared: !!shared };
    },

    async list(prefixo = "", shared = false) {
      const chaves = [...cache.keys()].filter((k) => !prefixo || k.startsWith(prefixo));
      return { keys: chaves, prefix: prefixo, shared: !!shared };
    },
  };
}
