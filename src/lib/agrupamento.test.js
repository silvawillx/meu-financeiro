import { describe, it, expect } from "vitest";
import { agruparPorOrigem } from "./agrupamento.js";

const contas = [{ id: "mp", nome: "Mercado Pago", cor: "#111" }];
const cartoes = [{ id: "c6", nome: "C6bank", fechamento: "05" }, { id: "db", nome: "Débito Inter", tipo: "debito" }];
let n = 0;
const L = (o) => ({ id: `l${++n}`, tipo: "despesa", contaId: "mp", categoria: "Outros", valor: 10, data: "2026-11-10", status: "Pago", ...o });

describe("agruparPorOrigem", () => {
  it("separa conta e cartão de crédito, somando só gastos", () => {
    const g = agruparPorOrigem([
      L({ valor: 50, categoria: "Alimentação" }), L({ valor: 30, categoria: "Alimentação" }), L({ valor: 20, categoria: "Moradia" }),
      L({ valor: 100, cartaoId: "c6", categoria: "Compras" }), L({ valor: 2000, tipo: "receita", categoria: "Salário" }),
    ], { contas, cartoes });
    expect(g.map((x) => [x.nome, x.totalGastos])).toEqual([["Mercado Pago", 100], ["C6bank", 100]].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
    const mp = g.find((x) => x.tipo === "conta");
    expect(mp.totalEntradas).toBe(2000);
    expect(mp.categorias.filter((c) => c.tipo === "despesa").map((c) => [c.nome, c.total])).toEqual([["Alimentação", 80], ["Moradia", 20]]);
  });
  it("cartão de crédito mostra o dia de fechamento", () => {
    const g = agruparPorOrigem([L({ cartaoId: "c6" })], { contas, cartoes });
    expect(g[0]).toMatchObject({ tipo: "cartao", subtitulo: "Cartão de crédito · fecha dia 5" });
  });
  it("compra no débito fica no grupo da conta", () => {
    const g = agruparPorOrigem([L({ cartaoId: "db", valor: 40 })], { contas, cartoes });
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ tipo: "conta", nome: "Mercado Pago", totalGastos: 40 });
  });
  it("transferência e pagamento de fatura não contam como gasto", () => {
    const g = agruparPorOrigem([L({ tipo: "transferencia", direcao: "saida", valor: 159.9, cartaoId: "c6", faturaMes: "2026-11" }), L({ valor: 10 })], { contas, cartoes });
    expect(g[0].totalGastos).toBe(10);
    expect(g[0].categorias.find((c) => c.tipo === "transferencia").total).toBe(159.9);
  });
  it("itens de cada categoria vêm do mais recente para o mais antigo; soma com centavos certos", () => {
    const g = agruparPorOrigem([L({ valor: 0.1, data: "2026-11-01", categoria: "A" }), L({ valor: 0.2, data: "2026-11-09", categoria: "A" })], { contas, cartoes });
    const cat = g[0].categorias[0];
    expect(cat.total).toBe(0.3);
    expect(cat.itens.map((i) => i.data)).toEqual(["2026-11-09", "2026-11-01"]);
  });
  it("lançamento sem conta vai para 'Sem conta'; lista vazia dá lista vazia", () => {
    expect(agruparPorOrigem([L({ contaId: "" })], { contas, cartoes })[0].nome).toBe("Sem conta");
    expect(agruparPorOrigem([], { contas, cartoes })).toEqual([]);
  });
});
