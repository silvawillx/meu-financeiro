import { hojeISO } from "./datas.js";

// Origem da receita: separa o que vem do trabalho do que vem "por fora".
export const ORIGENS_RECEITA = [
  { id: "salario", nome: "Salário", cor: "#3E6F5C", trabalho: true },
  { id: "extra", nome: "Renda extra", cor: "#2F5D8A", trabalho: false },
  { id: "rendimentos", nome: "Rendimentos", cor: "#C98A3A", trabalho: false },
  { id: "outras", nome: "Outras", cor: "#6B6459", trabalho: false },
];

// Lançamentos de "Ajuste de saldo" (conferência de conta) corrigem o saldo, mas não são renda nem gasto.
export const ehAjusteSaldo = (l) => /ajuste de saldo|concilia/i.test(`${l.categoria || ""} ${l.descricao || ""}`);

// "Aconteceu": já tem data de hoje ou antes e não está marcado como "A pagar".
// O saldo da conta só considera o que já aconteceu; salários e parcelas futuras ficam no "previsto".
export const aconteceu = (l, hoje = hojeISO()) => l.data <= hoje && l.status !== "A pagar";

// Receitas antigas não têm "origem": deduz pela categoria.
export const origemDe = (l) => {
  if (l.origem) return l.origem;
  const c = (l.categoria || "").toLowerCase();
  if (c.includes("ajuste") || c.includes("concilia")) return "ajuste"; // correção de saldo: não é renda
  if (c.includes("salario") || c.includes("salário") || c.includes("holerite")) return "salario";
  if (c.includes("free") || c.includes("extra") || c.includes("bico")) return "extra";
  if (c.includes("rendiment") || c.includes("dividend") || c.includes("juros")) return "rendimentos";
  return "outras";
};

// Saldo de uma conta: saldo inicial + o que entrou - o que saiu.
// Por padrão só conta o que já aconteceu (data até hoje e não "A pagar");
// com incluirFuturos = true vira o saldo "previsto".
export function saldoConta(lancamentos, conta, { incluirFuturos = false, hoje = hojeISO() } = {}) {
  const dela = lancamentos.filter((l) => l.contaId === conta.id && (incluirFuturos || aconteceu(l, hoje)));
  const soma = (fn) => dela.filter(fn).reduce((s, l) => s + l.valor, 0);
  const receitas = soma((l) => l.tipo === "receita");
  const despesas = soma((l) => l.tipo === "despesa");
  const transfSaida = soma((l) => l.tipo === "transferencia" && l.direcao === "saida");
  const transfEntrada = soma((l) => l.tipo === "transferencia" && l.direcao === "entrada");
  return (conta.saldoInicial || 0) + receitas - despesas - transfSaida + transfEntrada;
}
