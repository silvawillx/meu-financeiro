// Implementa a mesma API (window.storage.get/set/delete/list) que o app usa,
// mas gravando tudo no localStorage do navegador — ou seja, 100% local,
// sem servidor, sem internet, sem conta.

const PREFIXO = "meu-financeiro:";

function chaveCompleta(chave) {
  return PREFIXO + chave;
}

window.storage = {
  async get(chave, shared = false) {
    const bruto = localStorage.getItem(chaveCompleta(chave));
    if (bruto === null) return null;
    return { key: chave, value: bruto, shared: !!shared };
  },

  async set(chave, valor, shared = false) {
    try {
      localStorage.setItem(chaveCompleta(chave), valor);
      return { key: chave, value: valor, shared: !!shared };
    } catch (e) {
      console.error("Erro ao salvar no localStorage:", e);
      return null;
    }
  },

  async delete(chave, shared = false) {
    const existia = localStorage.getItem(chaveCompleta(chave)) !== null;
    localStorage.removeItem(chaveCompleta(chave));
    return { key: chave, deleted: existia, shared: !!shared };
  },

  async list(prefixo = "", shared = false) {
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIXO)) {
        const chaveCurta = k.slice(PREFIXO.length);
        if (!prefixo || chaveCurta.startsWith(prefixo)) chaves.push(chaveCurta);
      }
    }
    return { keys: chaves, prefix: prefixo, shared: !!shared };
  },
};
