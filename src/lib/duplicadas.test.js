import { describe, it, expect } from "vitest";
import { ehDuplicada } from "./duplicadas.js";

const ex = [{ id: "1", tipo: "despesa", valor: 32.9, data: "2026-11-05", descricao: "Uber" }];

describe("ehDuplicada", () => {
  it("mesmo valor, data e estabelecimento parecido", () => {
    expect(ehDuplicada({ tipo: "despesa", valor: 32.9, data: "2026-11-05", descricao: "UBER *TRIP 123" }, ex)).toBe(true);
  });
  it("aceita 1 dia de diferença, mas não 3", () => {
    expect(ehDuplicada({ tipo: "despesa", valor: 32.9, data: "2026-11-06", descricao: "Uber" }, ex)).toBe(true);
    expect(ehDuplicada({ tipo: "despesa", valor: 32.9, data: "2026-11-08", descricao: "Uber" }, ex)).toBe(false);
  });
  it("valor, tipo ou estabelecimento diferentes não são duplicadas", () => {
    expect(ehDuplicada({ tipo: "despesa", valor: 33.9, data: "2026-11-05", descricao: "Uber" }, ex)).toBe(false);
    expect(ehDuplicada({ tipo: "receita", valor: 32.9, data: "2026-11-05", descricao: "Uber" }, ex)).toBe(false);
    expect(ehDuplicada({ tipo: "despesa", valor: 32.9, data: "2026-11-05", descricao: "Padaria" }, ex)).toBe(false);
  });
  it("sem data no item, compara o mês", () => {
    expect(ehDuplicada({ tipo: "despesa", valor: 32.9, descricao: "Uber" }, ex, { mesPadrao: "2026-11" })).toBe(true);
    expect(ehDuplicada({ tipo: "despesa", valor: 32.9, descricao: "Uber" }, ex, { mesPadrao: "2026-10" })).toBe(false);
  });
  it("duas compras iguais no mesmo dia só marcam como duplicada se já existir uma", () => {
    expect(ehDuplicada({ tipo: "despesa", valor: 5, data: "2026-11-05", descricao: "Café" }, [])).toBe(false);
  });
});
