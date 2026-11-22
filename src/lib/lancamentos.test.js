import { describe, it, expect } from "vitest";
import { origemDe, ehAjusteSaldo, aconteceu, saldoConta } from "./lancamentos.js";

const L = (o) => ({ id: Math.random().toString(), contaId: "a", tipo: "despesa", status: "Pago", valor: 10, data: "2026-11-01", ...o });
const conta = { id: "a", saldoInicial: 100 };
const HOJE = "2026-11-22";

describe("origem da receita", () => {
  it("Salário é do trabalho; Freelance é renda extra", () => {
    expect(origemDe({ categoria: "Salário" })).toBe("salario");
    expect(origemDe({ categoria: "Freelance" })).toBe("extra");
    expect(origemDe({ categoria: "Dividendos" })).toBe("rendimentos");
    expect(origemDe({ categoria: "Qualquer" })).toBe("outras");
  });
  it('"Ajuste de saldo" NÃO é salário (a palavra "saldo" contém "sal")', () => {
    expect(origemDe({ categoria: "Ajuste de saldo" })).toBe("ajuste");
  });
  it("a origem gravada na receita vale mais que a dedução pela categoria", () => {
    expect(origemDe({ categoria: "Salário", origem: "extra" })).toBe("extra");
  });
  it("ehAjusteSaldo reconhece ajustes de conciliação", () => {
    expect(ehAjusteSaldo({ categoria: "Ajuste de saldo" })).toBe(true);
    expect(ehAjusteSaldo({ categoria: "Outros", descricao: "Ajuste de conciliação" })).toBe(true);
    expect(ehAjusteSaldo({ categoria: "Alimentação", descricao: "Mercado" })).toBe(false);
  });
});

describe("aconteceu", () => {
  it("conta o que é de hoje ou do passado e não está A pagar", () => {
    expect(aconteceu(L({ data: HOJE }), HOJE)).toBe(true);
    expect(aconteceu(L({ data: "2026-11-23" }), HOJE)).toBe(false);
    expect(aconteceu(L({ status: "A pagar" }), HOJE)).toBe(false);
    expect(aconteceu(L({ status: "-" }), HOJE)).toBe(true);
  });
});

describe("saldoConta", () => {
  it("soma receitas e subtrai despesas a partir do saldo inicial", () => {
    const ls = [L({ tipo: "receita", valor: 50 }), L({ valor: 30 })];
    expect(saldoConta(ls, conta, { hoje: HOJE })).toBe(120);
  });
  it("ignora o futuro e o 'A pagar' (salário e parcelas que ainda vão vir)", () => {
    const ls = [L({ tipo: "receita", valor: 2000, data: "2026-12-05" }), L({ valor: 90, status: "A pagar" }), L({ valor: 10 })];
    expect(saldoConta(ls, conta, { hoje: HOJE })).toBe(90);
  });
  it("incluirFuturos mostra o saldo previsto", () => {
    const ls = [L({ tipo: "receita", valor: 2000, data: "2026-12-05" }), L({ valor: 90, status: "A pagar" })];
    expect(saldoConta(ls, conta, { hoje: HOJE, incluirFuturos: true })).toBe(2010); // 100 + 2000 - 90
  });
  it("só considera lançamentos da própria conta", () => {
    expect(saldoConta([L({ contaId: "b", valor: 999 })], conta, { hoje: HOJE })).toBe(100);
  });
  it("transferências saem de uma conta e entram na outra", () => {
    const ls = [L({ tipo: "transferencia", direcao: "saida", valor: 40 }), L({ tipo: "transferencia", direcao: "entrada", valor: 15 })];
    expect(saldoConta(ls, conta, { hoje: HOJE })).toBe(75);
  });
});
