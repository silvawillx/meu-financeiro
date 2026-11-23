import { describe, it, expect } from "vitest";
import { interpretarMensagem, interpretarTexto, separarMensagens } from "./textoBanco.js";

const HOJE = "2026-11-22";
const lê = (t) => interpretarMensagem(t, { hoje: HOJE });

describe("interpretarMensagem", () => {
  it("compra aprovada: valor, estabelecimento e despesa", () => {
    expect(lê("Compra de R$ 32,90 APROVADA em UBER *TRIP")).toMatchObject({ valor: 32.9, tipo: "despesa", descricao: "Uber Trip", data: HOJE });
    expect(lê("Compra aprovada: R$ 28,90 em MC DONALDS")).toMatchObject({ valor: 28.9, tipo: "despesa", descricao: "Mc Donalds" });
  });
  it("débito com horário e cartão: para o nome antes do 'às'", () => {
    expect(lê("Compra no débito de R$ 15,00 em PADARIA CENTRAL às 14:30")).toMatchObject({ valor: 15, descricao: "Padaria Central" });
    expect(lê("Compra aprovada no cartão final 1234: R$ 20,00 em FARMACIA SAO JOAO.")).toMatchObject({ valor: 20, descricao: "Farmacia Sao Joao" });
  });
  it("pix recebido e enviado", () => {
    expect(lê("Você recebeu um Pix de FULANO DA SILVA no valor de R$ 100,00")).toMatchObject({ tipo: "receita", valor: 100, descricao: "Pix de Fulano Da Silva" });
    expect(lê("Pix enviado: R$ 50,00 para BELTRANO")).toMatchObject({ tipo: "despesa", valor: 50, descricao: "Pix para Beltrano" });
  });
  it("pagou a alguém e recebeu de alguém", () => {
    expect(lê("Você pagou R$ 25,00 a LOJA X")).toMatchObject({ tipo: "despesa", valor: 25, descricao: "Loja X" });
    expect(lê("Você recebeu R$ 1.250,50 de EMPRESA LTDA")).toMatchObject({ tipo: "receita", valor: 1250.5, descricao: "Empresa Ltda" });
  });
  it("débito automático com traço", () => {
    expect(lê("Débito automático de R$ 89,90 - NETFLIX")).toMatchObject({ valor: 89.9, tipo: "despesa", descricao: "Netflix" });
  });
  it("entende ontem e datas dd/mm", () => {
    expect(lê("Compra de R$ 10,00 em CAFE ontem").data).toBe("2026-11-21");
    expect(lê("Compra de R$ 10,00 em CAFE em 05/11").data).toBe("2026-11-05");
    expect(lê("Compra de R$ 10,00 em CAFE em 05/11/2026").data).toBe("2026-11-05");
  });
  it("texto sem valor não vira lançamento", () => {
    expect(lê("Seu código de verificação é 123456")).toBeNull();
    expect(lê("")).toBeNull();
  });
  it("sem 'em/para' usa o texto como descrição, sem o valor", () => {
    expect(lê("Almoço R$ 35,00").descricao).toBe("Almoço");
  });
});

describe("várias mensagens de uma vez", () => {
  it("separa por linha em branco", () => {
    const t = "Compra de R$ 10,00 em A\nfinal 1234\n\nCompra de R$ 20,00 em B";
    expect(separarMensagens(t)).toHaveLength(2);
  });
  it("sem linha em branco, uma por linha com R$", () => {
    const t = "Compra de R$ 10,00 em CAFE\nCompra de R$ 20,00 em PADARIA";
    expect(interpretarTexto(t, { hoje: HOJE }).map((i) => [i.descricao, i.valor])).toEqual([["Cafe", 10], ["Padaria", 20]]);
  });
  it("ignora o que não é lançamento", () => {
    expect(interpretarTexto("Olá!\n\nCompra de R$ 5,00 em X", { hoje: HOJE })).toHaveLength(1);
  });
});
