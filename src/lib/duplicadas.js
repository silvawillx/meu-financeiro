import { normalizarDescricao, chaveDaRegra } from "./regras.js";

const diasEntre = (a, b) => Math.abs(Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 86400000));

const parecidas = (a, b) => {
  const na = normalizarDescricao(a), nb = normalizarDescricao(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ka = chaveDaRegra(a);
  return !!ka && ka === chaveDaRegra(b);
};

// Esse item importado já existe nos lançamentos? Mesmo tipo e valor, data igual (ou 1 dia de diferença,
// porque o banco e você nem sempre registram no mesmo dia) e descrição parecida.
// Sem data no item (planilhas antigas), compara só o mês: passe mesPadrao ("AAAA-MM").
export function ehDuplicada(item, lancamentos, { tolerarDias = 1, mesPadrao = null } = {}) {
  const tipo = item.tipo || "despesa";
  return lancamentos.some((l) => {
    if (l.tipo !== tipo || Math.abs(l.valor - item.valor) >= 0.01) return false;
    const mesmaEpoca = item.data ? diasEntre(l.data, item.data) <= tolerarDias : l.data.slice(0, 7) === mesPadrao;
    return mesmaEpoca && parecidas(l.descricao || "", item.descricao || "");
  });
}
