import { describe, it, expect } from "vitest";
import { calcularAtivo, diasDesde } from "./investimentos.js";

const HOJE = "2026-11-22";

describe("calcularAtivo", () => {
  it("ação: quantidade x cotação, comparada ao preço médio", () => {
    const a = { tipo: "acao", ticker: "PETR4", quantidade: 100, precoMedio: 30 };
    const r = calcularAtivo(a, { cotacoes: { PETR4: { preco: 35 } } }, HOJE);
    expect(r).toMatchObject({ investido: 3000, atual: 3500, semCotacao: false });
  });
  it("ação sem cotação usa o preço médio", () => {
    const r = calcularAtivo({ tipo: "acao", ticker: "XPTO3", quantidade: 10, precoMedio: 5 }, {}, HOJE);
    expect(r).toMatchObject({ investido: 50, atual: 50, semCotacao: true });
  });
  it("CDB a 100% do CDI de 10% a.a. rende 10% em 1 ano", () => {
    const a = { tipo: "cdb", percCDI: 100, movimentos: [{ tipo: "aporte", valor: 1000, data: "2025-11-22" }] };
    const r = calcularAtivo(a, { cdiAnual: 10 }, HOJE);
    expect(r.investido).toBe(1000);
    expect(r.atual).toBeCloseTo(1100, 0);
    expect(r.estimado).toBe(true);
  });
  it("a % do CDI maior rende mais", () => {
    const mov = [{ tipo: "aporte", valor: 1000, data: "2025-11-22" }];
    const a100 = calcularAtivo({ tipo: "cdb", percCDI: 100, movimentos: mov }, { cdiAnual: 10 }, HOJE).atual;
    const a110 = calcularAtivo({ tipo: "cdb", percCDI: 110, movimentos: mov }, { cdiAnual: 10 }, HOJE).atual;
    expect(a110).toBeGreaterThan(a100);
  });
  it("resgate diminui o investido", () => {
    const a = { tipo: "cdi", movimentos: [{ tipo: "aporte", valor: 1000, data: HOJE }, { tipo: "resgate", valor: 300, data: HOJE }] };
    expect(calcularAtivo(a, { cdiAnual: 10 }, HOJE).investido).toBe(700);
  });
  it("sem CDI mostra só o valor aplicado; valor manual vence a estimativa", () => {
    const mov = [{ tipo: "aporte", valor: 500, data: "2026-01-01" }];
    expect(calcularAtivo({ tipo: "cdb", movimentos: mov }, {}, HOJE)).toMatchObject({ atual: 500, semCDI: true });
    expect(calcularAtivo({ tipo: "cdb", movimentos: mov, valorAtualManual: 620 }, { cdiAnual: 10 }, HOJE)).toMatchObject({ atual: 620, manual: true });
  });
  it("diasDesde conta dias corridos", () => {
    expect(diasDesde("2026-11-12", HOJE)).toBe(10);
  });
});
