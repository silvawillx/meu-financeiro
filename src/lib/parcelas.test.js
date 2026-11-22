import { describe, it, expect } from "vitest";
import { gerarParcelas } from "./parcelas.js";

let n = 0;
const novoId = (p) => `${p}-${++n}`;
const base = { data: "2026-10-05", categoria: "Compras", descricao: " Monitor ", pessoa: "", status: "Pago", contaId: "a", cartaoId: "c1", observacoes: "", anexo: null };
const soma = (ps) => Math.round(ps.reduce((s, p) => s + p.valor, 0) * 100) / 100;

describe("gerarParcelas", () => {
  it("a soma das parcelas fecha o valor total (a última absorve os centavos)", () => {
    const ps = gerarParcelas({ ...base, valorTotalParcelamento: "100", qtdParcelas: "3", parcelaAtual: "1" }, novoId);
    expect(ps.map((p) => p.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(soma(ps)).toBe(100);
  });
  it("uma parcela por mês, só a primeira com o status escolhido", () => {
    const ps = gerarParcelas({ ...base, valorTotalParcelamento: "760", qtdParcelas: "8", parcelaAtual: "1" }, novoId);
    expect(ps).toHaveLength(8);
    expect(ps[0].data).toBe("2026-10-05");
    expect(ps[7].data).toBe("2027-05-05");
    expect(ps.map((p) => p.status)).toEqual(["Pago", ...Array(7).fill("A pagar")]);
    expect(new Set(ps.map((p) => p.parcelaInfo.grupo)).size).toBe(1);
  });
  it("começar na parcela 3 de 6 gera só as 4 restantes", () => {
    const ps = gerarParcelas({ ...base, valorTotalParcelamento: "600", qtdParcelas: "6", parcelaAtual: "3" }, novoId);
    expect(ps.map((p) => p.parcelaInfo.atual)).toEqual([3, 4, 5, 6]);
  });
  it("aceita valor com vírgula e tira espaços da descrição", () => {
    const ps = gerarParcelas({ ...base, valorTotalParcelamento: "99,90", qtdParcelas: "3", parcelaAtual: "1" }, novoId);
    expect(soma(ps)).toBe(99.9);
    expect(ps[0].descricao).toBe("Monitor");
  });
});
