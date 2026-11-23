import { describe, it, expect } from "vitest";
import { comprasDaFatura, totalFatura, pagarFatura } from "./faturas.js";

let n = 0;
const novoId = (p) => `${p}-${++n}`;
const cartao = { id: "c1", nome: "Nubank", fechamento: "05" };
const compra = (o) => ({ id: `x${++n}`, tipo: "despesa", cartaoId: "c1", status: "A pagar", valor: 10, data: "2026-10-20", ...o });

describe("fatura do cartão", () => {
  it("a fatura de novembro vai de 06/10 a 05/11", () => {
    const ls = [compra({ data: "2026-10-05" }), compra({ data: "2026-10-06" }), compra({ data: "2026-11-05" }), compra({ data: "2026-11-06" }), compra({ cartaoId: "outro" })];
    expect(comprasDaFatura(ls, cartao, "2026-11")).toHaveLength(2);
  });
  it("soma o total da fatura com centavos certos", () => {
    const ls = [compra({ valor: 28.9, data: "2026-10-10" }), compra({ valor: 34.9, data: "2026-10-12" })];
    expect(totalFatura(ls, cartao, "2026-11")).toBe(63.8);
  });
  it("pagar fatura cria UMA saída na conta e marca as compras como pagas", () => {
    const ls = [compra({ id: "a", valor: 50, data: "2026-10-10" }), compra({ id: "b", valor: 30, data: "2026-11-20" })];
    const r = pagarFatura({ lancamentos: ls, cartao, mesRef: "2026-11", contaId: "a1", valor: 50, data: "2026-11-12", novoId });
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ tipo: "transferencia", direcao: "saida", contaId: "a1", valor: 50, status: "Pago", faturaMes: "2026-11" });
    expect(r.find((l) => l.id === "a").status).toBe("Pago");
    expect(r.find((l) => l.id === "b").status).toBe("A pagar"); // outra fatura, continua pendente
  });
});
