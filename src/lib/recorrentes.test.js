import { describe, it, expect } from "vitest";
import { gerarRecorrentes } from "./recorrentes.js";

let n = 0;
const novoId = (p) => `${p}-${++n}`;
const rec = (o = {}) => ({ id: "r1", descricao: "Internet", categoria: "Moradia", valor: 90, diaDoMes: 5, contaId: "a", ultimoMesGerado: "2026-08", ...o });
const gerar = (recorrentes, lancamentos = [], mesAlvo = "2026-11") => gerarRecorrentes({ recorrentes, lancamentos, mesAlvo, novoId });
const meses = (r) => r.lancamentos.map((l) => l.data.slice(0, 7)).sort();

describe("gerarRecorrentes", () => {
  it("gera os meses que faltam, inclusive se você ficou um tempo sem abrir o app", () => {
    const r = gerar([rec()]);
    expect(meses(r)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(r.recorrentes[0].ultimoMesGerado).toBe("2026-11");
    expect(r.alterou).toBe(true);
  });
  it("não faz nada se o mês atual já foi gerado", () => {
    const r = gerar([rec({ ultimoMesGerado: "2026-11" })]);
    expect(r.lancamentos).toEqual([]);
    expect(r.alterou).toBe(false);
  });
  it("não duplica um mês que já existe (ex.: backup com recorrências geradas adiantado)", () => {
    const existente = { id: "x", recorrenteId: "r1", data: "2026-10-05" };
    const r = gerar([rec({ ultimoMesGerado: "2026-09" })], [existente]);
    expect(meses(r)).toEqual(["2026-10", "2026-11"]); // 1 existente + 1 nova
    expect(r.lancamentos.filter((l) => l.data.startsWith("2026-10")).length).toBe(1);
  });
  it("recorrência pausada não gera e não acumula meses para depois", () => {
    const r = gerar([rec({ pausada: true })]);
    expect(r.lancamentos).toEqual([]);
    expect(r.recorrentes[0].ultimoMesGerado).toBe("2026-11");
  });
  it("para na data final", () => {
    expect(meses(gerar([rec({ dataFim: "2026-10" })]))).toEqual(["2026-09", "2026-10"]);
  });
  it("respeita o mês de início e os meses ignorados", () => {
    expect(meses(gerar([rec({ inicioMes: "2026-10" })]))).toEqual(["2026-10", "2026-11"]);
    expect(meses(gerar([rec({ mesesIgnorados: ["2026-10"] })]))).toEqual(["2026-09", "2026-11"]);
  });
  it("receita recorrente leva a origem; dia 31 vira o último dia do mês", () => {
    const r = gerar([rec({ tipo: "receita", origem: "extra", diaDoMes: 31, ultimoMesGerado: "2026-01" })], [], "2026-02");
    expect(r.lancamentos[0]).toMatchObject({ tipo: "receita", origem: "extra", data: "2026-02-28", recorrenteId: "r1" });
  });
});
