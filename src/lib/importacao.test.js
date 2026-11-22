import { describe, it, expect } from "vitest";
import { parseCSVComCabecalho, parseCSVTexto, parseOFXTexto, parseEntradaRapida } from "./importacao.js";

describe("CSV com cabeçalho (exportado pelo app)", () => {
  const csv = "﻿Data;Tipo;Categoria;Descrição;Pessoa;Status;Conta;Escopo;Valor\n" +
    "2026-11-03;despesa;Alimentação;Mercado;;Pago;Conta principal;pessoal;312,40\n" +
    "2026-11-05;receita;Salário;Salário empresa;;Pago;Conta principal;pessoal;3200,00\n" +
    "2026-11-08;despesa;Lazer;Cinema;;A pagar;Conta principal;negocio;48,00\n";
  it("lê data, tipo, valor, status, conta e escopo", () => {
    const { itens } = parseCSVComCabecalho(csv);
    expect(itens).toHaveLength(3);
    expect(itens[0]).toMatchObject({ data: "2026-11-03", tipo: "despesa", valor: 312.4, categoria: "Alimentação", contaNome: "Conta principal", status: "Pago" });
    expect(itens[1]).toMatchObject({ tipo: "receita", valor: 3200 });
    expect(itens[2]).toMatchObject({ status: "A pagar", escopo: "negocio" });
  });
  it("arquivo só com cabeçalho não tem itens", () => {
    expect(parseCSVComCabecalho("Data;Tipo;Categoria;Descrição;Pessoa;Status;Conta;Escopo;Valor").itens).toEqual([]);
  });
  it("extrato com vírgula, data dd/mm/aaaa e valor negativo (sem coluna Tipo)", () => {
    const { itens } = parseCSVComCabecalho("Data,Descrição,Valor\n05/11/2026,Uber,-32.90\n06/11/2026,Pix recebido,150.00");
    expect(itens.map((i) => [i.data, i.tipo, i.valor])).toEqual([["2026-11-05", "despesa", 32.9], ["2026-11-06", "receita", 150]]);
  });
  it("ignora transferências e linhas sem data ou valor", () => {
    const r = parseCSVComCabecalho("Data;Tipo;Descrição;Valor\n2026-11-01;transferencia;Entre contas;100,00\n;despesa;Sem data;10,00\n2026-11-02;despesa;Sem valor;");
    expect(r.itens).toEqual([]);
    expect(r.ignoradas).toBe(3);
  });
  it("não reconhece CSV de outro formato", () => {
    expect(parseCSVComCabecalho("A;B;C\n1;2;3")).toBeNull();
  });
});

describe("planilha antiga (; DESPESA ; QUANTIA ; NOME ; ANOTAÇÕES)", () => {
  it("lê despesas, status pelas anotações e o salário à parte", () => {
    const txt = ";Junho;;;\n;DESPESA;QUANTIA;NOME;ANOTAÇÕES\n;Internet;89,90;;pago\n;cartão;82,63;embaixador;a pagar\n;Total;172,53;;\n;Salario;2.000,00;;";
    const r = parseCSVTexto(txt);
    expect(r.mes).toBe(6);
    expect(r.salario).toBe(2000);
    expect(r.itens.map((i) => [i.descricao, i.valor, i.status])).toEqual([["Internet", 89.9, "Pago"], ["cartão", 82.63, "A pagar"]]);
  });
});

describe("OFX", () => {
  it("lê transações: valor negativo é despesa, positivo é receita", () => {
    const ofx = "<STMTTRN><DTPOSTED>20261105120000<TRNAMT>-32.90<MEMO>Uber</STMTTRN><STMTTRN><DTPOSTED>20261106<TRNAMT>150.00<MEMO>Pix</STMTTRN>";
    const itens = parseOFXTexto(ofx);
    expect(itens.map((i) => [i.data, i.tipo, i.valor, i.descricao])).toEqual([["2026-11-05", "despesa", 32.9, "Uber"], ["2026-11-06", "receita", 150, "Pix"]]);
  });
});

describe("entrada rápida", () => {
  it("'mercado 120' vira Alimentação de R$ 120", () => {
    const r = parseEntradaRapida("mercado 120");
    expect(r.valor).toBe(120);
    expect(r.categoria).toBe("Alimentação");
  });
});
