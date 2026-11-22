import { MESES_PT, dataLocalISO, hojeISO } from "./datas.js";
import { parseValorStr } from "./formato.js";

export function detectarMesTexto(texto) {
  const low = (texto || "").toLowerCase();
  for (let i = 0; i < MESES_PT.length; i++) if (low.includes(MESES_PT[i])) return i + 1;
  return null;
}

// Parser da planilha original do usuário (; DESPESA ; QUANTIA ; NOME ; ANOTAÇÕES)
export function parseCSVTexto(texto) {
  const linhas = texto.split(/\r?\n/).map((l) => l.split(";"));
  let headerIdx = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i][1] && linhas[i][1].trim().toUpperCase() === "DESPESA") { headerIdx = i; break; }
  }
  const mes = linhas[0] ? detectarMesTexto(linhas[0][1]) : null;
  const itens = [];
  let salario = null;
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < linhas.length; i++) {
      const row = linhas[i];
      if (!row || row.length < 3) continue;
      const despesa = (row[1] || "").trim();
      const quantiaStr = (row[2] || "").trim();
      const nome = (row[3] || "").trim();
      const anota = (row[4] || "").trim();
      const despesaLow = despesa.toLowerCase();
      if (despesaLow === "total") continue;
      if (despesaLow === "salario" || despesaLow === "salário") { salario = parseValorStr(quantiaStr); continue; }
      if (despesaLow === "sobrou") continue;
      if (!despesa && !quantiaStr) continue;
      const valor = parseValorStr(quantiaStr);
      if (valor === null) continue;
      const anotaLow = anota.toLowerCase();
      let status = "-";
      if (anotaLow.includes("a pagar")) status = "A pagar";
      else if (anotaLow.includes("pago")) status = "Pago";
      itens.push({ descricao: despesa, valor, pessoa: nome, observacoes: anota, status, categoria: "Outros", incluir: true });
    }
  }
  return { mes, itens, salario };
}

// Parser de CSV "com cabeçalho": Data;Tipo;Categoria;Descrição;Pessoa;Status;Conta;Escopo;Valor
// (o mesmo que o app exporta). Aceita ; ou , como separador, data dd/mm/aaaa ou aaaa-mm-dd
// e, sem coluna Tipo, usa o sinal do valor (negativo = despesa).
export function dividirLinhaCSV(linha, sep) {
  const out = []; let atual = ""; let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
    else if (c === sep && !aspas) { out.push(atual); atual = ""; }
    else atual += c;
  }
  out.push(atual);
  return out.map((x) => x.trim());
}

export function normalizarCabecalho(h) {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
}

export function normalizarDataCSV(d) {
  const t = (d || "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function parseCSVComCabecalho(texto) {
  const linhas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length === 0) return null;
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ";" : ",";
  const cab = dividirLinhaCSV(linhas[0], sep).map(normalizarCabecalho);
  const idx = (...nomes) => cab.findIndex((c) => nomes.includes(c));
  const iData = idx("data"), iValor = idx("valor", "quantia"), iDesc = idx("descricao", "historico", "nome");
  if (iData < 0 || iValor < 0 || iDesc < 0) return null; // não é esse formato
  const iTipo = idx("tipo"), iCat = idx("categoria"), iPessoa = idx("pessoa"), iStatus = idx("status"), iConta = idx("conta"), iEscopo = idx("escopo");
  const itens = []; let ignoradas = 0;
  linhas.slice(1).forEach((linha) => {
    const c = dividirLinhaCSV(linha, sep);
    const data = normalizarDataCSV(c[iData]);
    const bruto = parseValorStr(c[iValor]);
    if (!data || bruto === null || bruto === 0) { ignoradas++; return; }
    const tipoCol = iTipo >= 0 ? (c[iTipo] || "").toLowerCase() : "";
    const tipo = tipoCol.startsWith("rec") ? "receita" : tipoCol.startsWith("des") ? "despesa" : bruto < 0 ? "despesa" : "receita";
    if (tipoCol.startsWith("transf")) { ignoradas++; return; } // transferências entre contas ficam de fora
    const statusTxt = iStatus >= 0 ? (c[iStatus] || "") : "";
    const status = /a pagar|a receber/i.test(statusTxt) ? "A pagar" : /pago|recebido/i.test(statusTxt) ? "Pago" : "-";
    itens.push({
      data, tipo, valor: Math.abs(bruto), descricao: c[iDesc] || "Sem descrição", categoria: iCat >= 0 ? c[iCat] : "",
      pessoa: iPessoa >= 0 ? c[iPessoa] : "", status, contaNome: iConta >= 0 ? c[iConta] : "",
      escopo: iEscopo >= 0 && /neg/i.test(c[iEscopo]) ? "negocio" : "pessoal", observacoes: "", incluir: true,
    });
  });
  return { itens, ignoradas };
}

// Parser de extrato bancário no formato OFX (exportado por bancos como Nubank, Inter, Santander etc.)
export function parseOFXTexto(texto) {
  const itens = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  blocos.forEach((bloco) => {
    const fim = bloco.search(/<\/STMTTRN>/i);
    const trecho = fim >= 0 ? bloco.slice(0, fim) : bloco;
    const pegar = (tag) => {
      const m = trecho.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const dtStr = pegar("DTPOSTED");
    const valorStr = pegar("TRNAMT");
    const memo = pegar("MEMO") || pegar("NAME") || "Transação bancária";
    if (!dtStr || dtStr.length < 8 || !valorStr) return;
    const data = `${dtStr.slice(0, 4)}-${dtStr.slice(4, 6)}-${dtStr.slice(6, 8)}`;
    const valorNum = parseFloat(valorStr.replace(",", "."));
    if (isNaN(valorNum) || valorNum === 0) return;
    itens.push({
      descricao: memo, valor: Math.abs(valorNum), tipo: valorNum < 0 ? "despesa" : "receita",
      pessoa: "", observacoes: "", status: "Pago", categoria: "Outros", data, incluir: true,
    });
  });
  return itens;
}

// "IA local" por regras — entrada rápida tipo "mercado 120 hoje" / "uber 32 ontem" / "pix farmacia 45"
export const DICIONARIO_CATEGORIA = {
  mercado: "Alimentação", supermercado: "Alimentação", almoço: "Alimentação", almoco: "Alimentação",
  janta: "Alimentação", lanche: "Alimentação", ifood: "Alimentação", restaurante: "Alimentação",
  uber: "Transporte", "99": "Transporte", gasolina: "Transporte", combustivel: "Transporte", combustível: "Transporte", onibus: "Transporte", ônibus: "Transporte",
  aluguel: "Moradia", internet: "Moradia", energia: "Moradia", luz: "Moradia", agua: "Moradia", água: "Moradia", condominio: "Moradia", condomínio: "Moradia",
  farmacia: "Saúde", farmácia: "Saúde", remedio: "Saúde", remédio: "Saúde", academia: "Saúde", medico: "Saúde", médico: "Saúde",
  cinema: "Lazer", bar: "Lazer", show: "Lazer", viagem: "Lazer", streaming: "Lazer",
  curso: "Educação", livro: "Educação", faculdade: "Educação",
  roupa: "Compras", loja: "Compras",
};

export function parseEntradaRapida(textoOriginal) {
  const texto = textoOriginal.trim();
  const low = texto.toLowerCase();
  const matchValor = texto.match(/(\d+[.,]?\d*)/);
  const valor = matchValor ? parseValorStr(matchValor[1]) : null;
  let data = hojeISO();
  if (low.includes("ontem")) {
    const d = new Date(); d.setDate(d.getDate() - 1); data = dataLocalISO(d);
  }
  let contaSugerida = null;
  if (low.includes("pix")) contaSugerida = "PIX";
  else if (low.includes("cartão") || low.includes("cartao")) contaSugerida = "Cartão";
  else if (low.includes("dinheiro")) contaSugerida = "Dinheiro";
  let categoria = "Outros";
  for (const chave in DICIONARIO_CATEGORIA) {
    if (low.includes(chave)) { categoria = DICIONARIO_CATEGORIA[chave]; break; }
  }
  let descricao = texto
    .replace(/(\d+[.,]?\d*)/, "")
    .replace(/\b(hoje|ontem|pix|cart[aã]o|dinheiro|r\$)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!descricao) descricao = texto;
  descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);
  return { valor, data, categoria, contaSugerida, descricao };
}
