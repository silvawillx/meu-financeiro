import { describe, it, expect } from "vitest";
import { origemDe, ehAjusteSaldo, aconteceu, saldoConta, compraNoCredito } from "./lancamentos.js";

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
  it("o previsto pode parar numa data (ex.: fim do mês)", () => {
    const ls = [L({ valor: 90, status: "A pagar", data: "2026-11-28" }), L({ valor: 500, status: "A pagar", data: "2027-02-05" })];
    expect(saldoConta(ls, conta, { hoje: HOJE, incluirFuturos: true, ate: "2026-11-30" })).toBe(10);
    expect(saldoConta(ls, conta, { hoje: HOJE, incluirFuturos: true })).toBe(-490);
  });
  it("só considera lançamentos da própria conta", () => {
    expect(saldoConta([L({ contaId: "b", valor: 999 })], conta, { hoje: HOJE })).toBe(100);
  });
  it("transferências saem de uma conta e entram na outra", () => {
    const ls = [L({ tipo: "transferencia", direcao: "saida", valor: 40 }), L({ tipo: "transferencia", direcao: "entrada", valor: 15 })];
    expect(saldoConta(ls, conta, { hoje: HOJE })).toBe(75);
  });
  it("compra no crédito não desconta da conta; compra no débito desconta", () => {
    const cartoes = [{ id: "cr", tipo: "credito" }, { id: "antigo" }, { id: "db", tipo: "debito" }];
    const ls = [L({ valor: 50, cartaoId: "cr" }), L({ valor: 20, cartaoId: "antigo" }), L({ valor: 30, cartaoId: "db" })];
    expect(saldoConta(ls, conta, { hoje: HOJE, cartoes })).toBe(70); // 100 - 30 (só o débito)
    expect(saldoConta(ls, conta, { hoje: HOJE })).toBe(0); // sem informar cartões: comportamento antigo
    expect(compraNoCredito(ls[0], cartoes)).toBe(true);
    expect(compraNoCredito(ls[2], cartoes)).toBe(false);
  });
  it("o pagamento da fatura (transferência de saída) desconta da conta", () => {
    const ls = [L({ tipo: "transferencia", direcao: "saida", valor: 60, cartaoId: "cr", faturaMes: "2026-11" })];
    expect(saldoConta(ls, conta, { hoje: HOJE, cartoes: [{ id: "cr", tipo: "credito" }] })).toBe(40);
  });
});
