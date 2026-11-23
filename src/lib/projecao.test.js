import { describe, it, expect } from "vitest";
import { projetar, mediaGastoVariavel } from "./projecao.js";

const HOJE = "2026-11-22";
const contas = [{ id: "a", saldoInicial: 1000 }];
let n = 0;
const L = (o) => ({ id: `l${++n}`, contaId: "a", tipo: "despesa", status: "A pagar", valor: 10, data: "2026-11-25", ...o });
const proj = (o) => projetar({ contas, lancamentos: [], hoje: HOJE, ...o });

describe("projetar", () => {
  it("sem nada pendente o saldo se mantém nos 6 meses", () => {
    const r = proj();
    expect(r.saldoInicial).toBe(1000);
    expect(r.meses).toHaveLength(6);
    expect(r.meses.map((m) => m.saldoFinal)).toEqual(Array(6).fill(1000));
    expect(r.meses[0].mes).toBe("2026-11");
    expect(r.meses[5].mes).toBe("2027-04");
    expect(r.primeiroNegativo).toBeNull();
  });
  it("desconta a reserva do saldo livre", () => {
    expect(proj({ metasEconomia: [{ aportes: [{ valor: 600 }] }] }).saldoInicial).toBe(400);
  });
  it("soma contas a pagar e a receber no mês certo, acumulando", () => {
    const ls = [L({ valor: 300, data: "2026-11-28" }), L({ tipo: "receita", valor: 2000, data: "2026-12-05" }), L({ valor: 500, data: "2026-12-10" })];
    const r = proj({ lancamentos: ls });
    expect(r.meses[0]).toMatchObject({ entradas: 0, saidas: 300, saldoFinal: 700 });
    expect(r.meses[1]).toMatchObject({ entradas: 2000, saidas: 500, saldoFinal: 2200 });
    expect(r.meses[2].saldoFinal).toBe(2200);
  });
  it("atrasados (data passada e A pagar) entram no mês atual", () => {
    const r = proj({ lancamentos: [L({ valor: 80, data: "2026-10-05" })] });
    expect(r.meses[0].saidas).toBe(80);
  });
  it("o que já aconteceu não entra de novo (já está no saldo)", () => {
    const r = proj({ lancamentos: [L({ valor: 80, data: "2026-11-10", status: "Pago" })] });
    expect(r.meses[0].saidas).toBe(0);
  });
  it("recorrências ativas aparecem nos meses futuros mesmo sem lançamentos gerados", () => {
    const rec = [{ id: "r1", descricao: "Internet", categoria: "Moradia", valor: 90, diaDoMes: 5, contaId: "a", ultimoMesGerado: "2026-11" }];
    const r = proj({ recorrentes: rec });
    expect(r.meses.map((m) => m.saidas)).toEqual([0, 90, 90, 90, 90, 90]);
    expect(r.meses[5].saldoFinal).toBe(1000 - 90 * 5);
  });
  it("recorrência pausada ou com data final não passa do limite", () => {
    const base = { id: "r1", descricao: "X", categoria: "Y", valor: 100, diaDoMes: 5, contaId: "a", ultimoMesGerado: "2026-11" };
    expect(proj({ recorrentes: [{ ...base, pausada: true }] }).meses.every((m) => m.saidas === 0)).toBe(true);
    expect(proj({ recorrentes: [{ ...base, dataFim: "2027-01" }] }).meses.map((m) => m.saidas)).toEqual([0, 100, 100, 0, 0, 0]);
  });
  it("parcelas futuras já lançadas pesam em cada mês", () => {
    const ls = [L({ valor: 95, data: "2026-12-05" }), L({ valor: 95, data: "2027-01-05" })];
    expect(proj({ lancamentos: ls }).meses.map((m) => m.saidas)).toEqual([0, 95, 95, 0, 0, 0]);
  });
  it("avisa o primeiro mês em que o saldo fica negativo", () => {
    const ls = [L({ valor: 1500, data: "2027-01-10" })];
    const r = proj({ lancamentos: ls });
    expect(r.primeiroNegativo).toMatchObject({ mes: "2027-01", saldoFinal: -500 });
  });
  it("ignora ajustes de saldo", () => {
    expect(proj({ lancamentos: [L({ valor: 999, categoria: "Ajuste de saldo" })] }).meses[0].saidas).toBe(0);
  });
  it("gasto variável: no mês atual desconta só os dias que faltam; nos demais, o mês todo", () => {
    const r = proj({ gastoVariavelMensal: 900 });
    expect(r.meses[0].variavel).toBe(270); // 9 de 30 dias (22 a 30)
    expect(r.meses[1].variavel).toBe(900);
    expect(r.meses[1].saldoFinal).toBe(1000 - 270 - 900);
  });
});

describe("mediaGastoVariavel", () => {
  it("média dos últimos meses, sem recorrentes, parcelas nem ajustes", () => {
    const ls = [
      L({ valor: 300, data: "2026-10-10", status: "Pago" }), L({ valor: 100, data: "2026-10-12", recorrenteId: "r" }),
      L({ valor: 500, data: "2026-09-10", status: "Pago" }), L({ valor: 50, data: "2026-09-11", parcelaInfo: { atual: 1, total: 2 } }),
      L({ valor: 999, data: "2026-09-12", categoria: "Ajuste de saldo" }),
    ];
    expect(mediaGastoVariavel(ls, { hoje: HOJE })).toBe(400); // (300 + 500) / 2 meses com dados
  });
  it("sem histórico, zero", () => {
    expect(mediaGastoVariavel([], { hoje: HOJE })).toBe(0);
  });
});
