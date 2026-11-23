import { describe, it, expect } from "vitest";
import { normalizarDescricao, chaveDaRegra, categorizar, aprenderRegra } from "./regras.js";

describe("regras de categoria", () => {
  it("normaliza: sem acento, sem símbolos, minúsculas", () => {
    expect(normalizarDescricao("UBER *TRIP 5832")).toBe("uber trip 5832");
    expect(normalizarDescricao("Farmácia São João")).toBe("farmacia sao joao");
  });
  it("a chave é a primeira palavra que identifica o estabelecimento", () => {
    expect(chaveDaRegra("UBER *TRIP 5832")).toBe("uber");
    expect(chaveDaRegra("Compra aprovada MERCADO EXTRA 12")).toBe("mercado");
    expect(chaveDaRegra("Pix para 123")).toBe("");
  });
  it("usa o dicionário do app quando não há regra", () => {
    expect(categorizar("UBER *TRIP", "despesa")).toBe("Transporte");
    expect(categorizar("Supermercado Boa Compra", "despesa")).toBe("Alimentação");
    expect(categorizar("Loja Qualquer", "despesa")).toBe("Compras"); // "loja" está no dicionário
    expect(categorizar("Xyz Abc", "despesa")).toBe("Outros");
  });
  it("a regra que você ensinou vale mais que o dicionário", () => {
    expect(categorizar("UBER *TRIP", "despesa", { uber: "Lazer" })).toBe("Lazer");
  });
  it("receitas não usam o dicionário de despesas", () => {
    expect(categorizar("Uber reembolso", "receita")).toBe("Outros");
  });
  it("se a categoria não existe na sua lista, cai em Outros", () => {
    expect(categorizar("UBER", "despesa", {}, ["Alimentação", "Outros"])).toBe("Outros");
  });
  it("aprende a regra e não aprende 'Outros' nem chave vazia", () => {
    expect(aprenderRegra({}, "PADARIA PÃO QUENTE 55", "Alimentação")).toEqual({ padaria: "Alimentação" });
    expect(aprenderRegra({}, "PADARIA", "Outros")).toEqual({});
    expect(aprenderRegra({}, "Pix para 123", "Lazer")).toEqual({});
    const r = { padaria: "Alimentação" };
    expect(aprenderRegra(r, "Padaria X", "Alimentação")).toBe(r);
  });
});
