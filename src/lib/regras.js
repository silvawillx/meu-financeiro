import { DICIONARIO_CATEGORIA } from "./importacao.js";

export const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// Palavras que aparecem em quase todo extrato e não dizem onde o dinheiro foi gasto.
const RUIDO = new Set([
  "compra", "aprovada", "aprovado", "debito", "credito", "pix", "ted", "doc", "pagamento", "pag", "pgto", "transferencia",
  "enviada", "enviado", "recebida", "recebido", "para", "cartao", "final", "parcela", "trip", "ltda", "brasil",
]);

// Texto em minúsculas, sem acento nem símbolos: "UBER *TRIP 5832" -> "uber trip 5832".
export const normalizarDescricao = (desc) => semAcento(desc).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// A "chave" que identifica o estabelecimento: a primeira palavra que diz alguma coisa.
export function chaveDaRegra(desc) {
  return normalizarDescricao(desc).split(" ").find((t) => t.length >= 3 && !/^\d+$/.test(t) && !RUIDO.has(t)) || "";
}

// Sugere a categoria: 1º as regras que você ensinou, 2º o dicionário do app, 3º "Outros".
// Só despesas usam o dicionário (receitas não).
export function categorizar(desc, tipo = "despesa", regras = {}, categoriasValidas = null) {
  const norm = normalizarDescricao(desc);
  const dela = Object.keys(regras).filter((k) => k && norm.includes(k)).sort((a, b) => b.length - a.length)[0];
  let cat = dela ? regras[dela] : null;
  if (!cat && tipo === "despesa") {
    for (const palavra in DICIONARIO_CATEGORIA) {
      if (norm.split(" ").includes(semAcento(palavra).toLowerCase())) { cat = DICIONARIO_CATEGORIA[palavra]; break; }
    }
  }
  cat = cat || "Outros";
  if (categoriasValidas && !categoriasValidas.includes(cat)) return categoriasValidas.includes("Outros") ? "Outros" : categoriasValidas[0];
  return cat;
}

// Ensina o app: da próxima vez que aparecer esse estabelecimento, já vem nessa categoria.
export function aprenderRegra(regras, desc, categoria) {
  const chave = chaveDaRegra(desc);
  if (!chave || !categoria || categoria === "Outros" || regras[chave] === categoria) return regras;
  return { ...regras, [chave]: categoria };
}
