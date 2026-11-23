import { describe, it, expect } from "vitest";
import { calcularDisponivel } from "./disponivel.js";

const HOJE = "2026-11-22";
const conta = { id: "a", saldoInicial: 1500 };
const L = (o) => ({ id: Math.random().toString(), contaId: "a", tipo: "despesa", status: "Pago", valor: 10, data: "2026-11-01", ...o });

describe("calcularDisponivel", () => {
  it("saldo - reserva - a pagar do mês + a receber do mês", () => {
    const ls = [
      L({ valor: 100, status: "A pagar", data: "2026-11-28" }),
      L({ tipo: "receita", valor: 500, status: "A pagar", data: "2026-11-30" }),
      L({ valor: 999, status: "A pagar", data: "2026-12-05" }), // mês que vem: não entra
    ];
    const r = calcularDisponivel({ contas: [conta], lancamentos: ls, metasEconomia: [{ aportes: [{ valor: 1000 }] }], hoje: HOJE });
    expect(r).toMatchObject({ saldoContas: 1500, reservado: 1000, aPagar: 100, aReceber: 500, disponivel: 900 });
  });
  it("por dia divide pelos dias que faltam, contando hoje", () => {
    const r = calcularDisponivel({ contas: [conta], lancamentos: [], hoje: HOJE });
    expect(r.diasRestantes).toBe(9); // 22 a 30
    expect(r.porDia).toBeCloseTo(1500 / 9, 5);
  });
  it("sem sobra, por dia é zero (nunca negativo)", () => {
    const r = calcularDisponivel({ contas: [conta], lancamentos: [], metasEconomia: [{ aportes: [{ valor: 1500 }] }], hoje: HOJE });
    expect(r.disponivel).toBe(0);
    expect(r.porDia).toBe(0);
  });
  it("compra no crédito não tira do saldo, mas entra como a pagar até a fatura ser paga", () => {
    const cartoes = [{ id: "c1", tipo: "credito" }];
    const ls = [L({ valor: 200, cartaoId: "c1", status: "A pagar", data: "2026-11-10" })];
    const r = calcularDisponivel({ contas: [conta], lancamentos: ls, cartoes, hoje: HOJE });
    expect(r).toMatchObject({ saldoContas: 1500, aPagar: 200, disponivel: 1300 });
  });
  it("ignora contas arquivadas e ajustes de saldo", () => {
    const ls = [L({ valor: 300, status: "A pagar", categoria: "Ajuste de saldo", data: "2026-11-15" })];
    const r = calcularDisponivel({ contas: [conta, { id: "b", saldoInicial: 5000, arquivada: true }], lancamentos: ls, hoje: HOJE });
    expect(r).toMatchObject({ saldoContas: 1500, aPagar: 0 });
  });
});
