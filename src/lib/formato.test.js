import { describe, it, expect } from "vitest";
import { parseValorStr, formatarMoeda, genId } from "./formato.js";

describe("formato", () => {
  it("parseValorStr entende o formato brasileiro", () => {
    expect(parseValorStr("R$ 1.234,56")).toBe(1234.56);
    expect(parseValorStr("89,90")).toBe(89.9);
    expect(parseValorStr(" 15 ")).toBe(15);
  });
  it("parseValorStr aceita ponto decimal de extratos (150.00 não vira 15.000)", () => {
    expect(parseValorStr("150.00")).toBe(150);
    expect(parseValorStr("-32.90")).toBe(-32.9);
    expect(parseValorStr("89.9")).toBe(89.9);
    expect(parseValorStr("1,234.56")).toBe(1234.56);
    expect(parseValorStr("R$ -32,90")).toBe(-32.9);
  });
  it("parseValorStr mantém milhar brasileiro (2.474 = 2474; 1.234.567,89)", () => {
    expect(parseValorStr("2.474")).toBe(2474);
    expect(parseValorStr("1.234.567,89")).toBe(1234567.89);
    expect(parseValorStr("2.000,00")).toBe(2000);
  });
  it("parseValorStr devolve null quando não há número", () => {
    expect(parseValorStr("")).toBeNull();
    expect(parseValorStr(null)).toBeNull();
    expect(parseValorStr("abc")).toBeNull();
  });
  it("formatarMoeda mostra R$ com vírgula", () => {
    expect(formatarMoeda(1500)).toMatch(/R\$\s?1\.500,00/);
    expect(formatarMoeda(undefined)).toMatch(/R\$\s?0,00/);
  });
  it("genId gera ids diferentes com o prefixo", () => {
    const a = genId("l"), b = genId("l");
    expect(a.startsWith("l-")).toBe(true);
    expect(a).not.toBe(b);
  });
});
