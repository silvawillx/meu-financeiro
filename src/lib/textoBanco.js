import { dataLocalISO, hojeISO } from "./datas.js";
import { parseValorStr } from "./formato.js";

const VALOR = /R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+(?:[.,]\d{1,2})?)/i;
const RECEITA = /\b(recebeu|recebido|recebida|recebimento|cr[eé]dito em conta|dep[oó]sito|estorno|reembolso|devolu[cç][aã]o|cashback)\b/i;

// "UBER *TRIP" -> "Uber Trip"; texto que já está em caixa mista não é mexido.
function arrumaNome(s) {
  const t = s.replace(/[*_]+/g, " ").replace(/\s+/g, " ").trim().replace(/[-:]+$/, "").trim();
  const letras = t.replace(/[^A-Za-zÀ-ú]/g, "");
  if (letras && letras === letras.toUpperCase()) return t.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase());
  return t;
}

function extrairDescricao(t, depoisDoValor, tipo) {
  // Pix: "Pix de FULANO ..." / "Pix para BELTRANO"
  const pix = t.match(/\bpix\s+(?:recebido\s+)?(de|para)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú .'-]*?)(?=\s+(?:no valor|valor|R\$|às|as|em\s+\d)|[.,;:]|$)/i);
  if (pix) return `Pix ${pix[1].toLowerCase()} ${arrumaNome(pix[2])}`;
  // "... em LOJA", "... para LOJA", "... a LOJA" (e "de" nas receitas)
  const preps = tipo === "receita" ? "em|para|a|à|de" : "em|para|a|à|no|na";
  const re = new RegExp(`\\b(?:${preps})\\s+([A-ZÀ-Ú0-9][^.,;:()]*?)(?=\\s+(?:às|as|em\\s+\\d|no\\s+cart|cart[aã]o|final|\\d{2}/\\d{2}|no valor)|[.,;:]|$)`, "");
  const m = depoisDoValor.match(re);
  if (m && m[1].trim().length >= 2) {
    const nome = arrumaNome(m[1]);
    // mensagem de Pix sem "Pix para/de" colado: "Pix enviado: R$ 50,00 para BELTRANO"
    return /\bpix\b/i.test(t) ? `Pix ${tipo === "receita" ? "de" : "para"} ${nome}` : nome;
  }
  const traco = t.match(/\s[-–]\s([^-–]{3,})$/);
  if (traco) return arrumaNome(traco[1]);
  return arrumaNome(t.replace(VALOR, "").slice(0, 40)) || "Lançamento";
}

// Lê UMA mensagem de banco ("Compra aprovada: R$ 28,90 em MC DONALDS") e devolve um lançamento sugerido.
export function interpretarMensagem(texto, { hoje = hojeISO() } = {}) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  const m = t.match(VALOR);
  if (!m) return null;
  const valor = Math.abs(parseValorStr(m[1]) || 0);
  if (!valor) return null;
  const tipo = RECEITA.test(t) ? "receita" : "despesa";

  let data = hoje;
  const dm = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (/\bontem\b/i.test(t)) { const d = new Date(hoje + "T00:00:00"); d.setDate(d.getDate() - 1); data = dataLocalISO(d); }
  else if (dm) {
    const ano = dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : hoje.slice(0, 4);
    data = `${ano}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  }

  const depois = t.slice((m.index || 0) + m[0].length);
  const descricao = extrairDescricao(t, depois, tipo);
  return { valor, tipo, descricao, data, categoria: "Outros", status: "Pago", pessoa: "", observacoes: "Lido de mensagem do banco", incluir: true };
}

// Várias mensagens coladas de uma vez: separadas por linha em branco; sem linhas em branco, uma por linha com "R$".
export function separarMensagens(texto) {
  const blocos = String(texto || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocos.length > 1) return blocos;
  const linhas = String(texto || "").split(/\n/).map((l) => l.trim()).filter(Boolean);
  return linhas.filter((l) => /R\$/i.test(l)).length > 1 ? linhas.filter((l) => /R\$/i.test(l)) : blocos;
}

export function interpretarTexto(texto, opcoes) {
  return separarMensagens(texto).map((b) => interpretarMensagem(b, opcoes)).filter(Boolean);
}
