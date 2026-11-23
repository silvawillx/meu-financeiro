import { cicloFatura } from "./datas.js";
import { genId } from "./formato.js";

// Compras de um cartão que entram na fatura do mês de referência
// (pelo ciclo fechamento→fechamento; sem dia de fechamento, o mês do calendário).
export function comprasDaFatura(lancamentos, cartao, mesRef) {
  const ciclo = cicloFatura(cartao, mesRef);
  return lancamentos.filter((l) => l.cartaoId === cartao.id && l.tipo === "despesa" &&
    (ciclo ? l.data >= ciclo.inicio && l.data <= ciclo.fim : l.data.slice(0, 7) === mesRef));
}

export const totalFatura = (lancamentos, cartao, mesRef) =>
  Math.round(comprasDaFatura(lancamentos, cartao, mesRef).reduce((s, l) => s + l.valor, 0) * 100) / 100;

// Pagar a fatura: cria a saída na conta (uma vez só) e marca as compras da fatura como pagas.
// A saída é do tipo "transferencia", então não conta de novo como gasto nas categorias.
export function pagarFatura({ lancamentos, cartao, mesRef, contaId, valor, data, novoId = genId }) {
  const ids = new Set(comprasDaFatura(lancamentos, cartao, mesRef).map((l) => l.id));
  const pagamento = {
    id: novoId("l"), data, tipo: "transferencia", direcao: "saida", categoria: "Fatura de cartão",
    descricao: `Fatura ${cartao.nome} (${mesRef})`, pessoa: "", status: "Pago", contaId, cartaoId: cartao.id,
    valor, observacoes: "Pagamento de fatura", anexo: null, escopo: "pessoal", emprestimo: false, viagemId: null,
    parcelaInfo: null, recorrenteId: null, faturaMes: mesRef,
  };
  return [pagamento, ...lancamentos.map((l) => (ids.has(l.id) ? { ...l, status: "Pago" } : l))];
}
