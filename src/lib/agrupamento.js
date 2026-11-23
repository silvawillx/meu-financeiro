import { compraNoCredito } from "./lancamentos.js";

const arredonda = (v) => Math.round(v * 100) / 100;

// Agrupa os lançamentos pela ORIGEM do dinheiro:
//  - compra no cartão de crédito -> grupo do cartão (o dinheiro só sai da conta quando a fatura é paga);
//  - o resto (inclui débito) -> grupo da conta.
// Dentro de cada grupo separa gastos por categoria; entradas e transferências/faturas ficam à parte
// e não entram no total de gastos.
export function agruparPorOrigem(lancamentos, { contas = [], cartoes = [] } = {}) {
  const grupos = new Map();

  const novoGrupo = (chave, l) => {
    if (chave.startsWith("cartao:")) {
      const c = cartoes.find((x) => x.id === l.cartaoId);
      const fecha = parseInt(c?.fechamento, 10);
      return { chave, tipo: "cartao", nome: c?.nome || "Cartão", cor: c?.cor || "#8A3E5C", subtitulo: `Cartão de crédito${fecha ? ` · fecha dia ${fecha}` : ""}` };
    }
    const c = contas.find((x) => x.id === l.contaId);
    return { chave, tipo: "conta", nome: c?.nome || "Sem conta", cor: c?.cor || "#6B6459", subtitulo: "Conta" };
  };

  for (const l of lancamentos) {
    const chave = compraNoCredito(l, cartoes) ? `cartao:${l.cartaoId}` : `conta:${l.contaId || ""}`;
    if (!grupos.has(chave)) grupos.set(chave, { ...novoGrupo(chave, l), totalGastos: 0, totalEntradas: 0, qtd: 0, mapa: new Map() });
    const g = grupos.get(chave);
    g.qtd += 1;
    let nomeCat, tipoCat;
    if (l.tipo === "despesa") { nomeCat = l.categoria || "Outros"; tipoCat = "despesa"; g.totalGastos += l.valor; }
    else if (l.tipo === "receita") { nomeCat = "Entradas"; tipoCat = "entrada"; g.totalEntradas += l.valor; }
    else { nomeCat = "Transferências e faturas"; tipoCat = "transferencia"; }
    const k = `${tipoCat}:${nomeCat}`;
    if (!g.mapa.has(k)) g.mapa.set(k, { nome: nomeCat, tipo: tipoCat, total: 0, itens: [] });
    const c = g.mapa.get(k);
    c.total += l.valor;
    c.itens.push(l);
  }

  const ordem = { despesa: 0, entrada: 1, transferencia: 2 };
  return [...grupos.values()]
    .map(({ mapa, ...g }) => ({
      ...g,
      totalGastos: arredonda(g.totalGastos),
      totalEntradas: arredonda(g.totalEntradas),
      categorias: [...mapa.values()]
        .map((c) => ({ ...c, total: arredonda(c.total), itens: c.itens.sort((a, b) => (a.data < b.data ? 1 : -1)) }))
        .sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || b.total - a.total),
    }))
    .sort((a, b) => b.totalGastos - a.totalGastos || a.nome.localeCompare(b.nome));
}
