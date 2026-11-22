import { hojeISO } from "./datas.js";

export const TIPOS_INVEST = [
  { id: "acao", nome: "Ação / FII", cor: "#2F5D8A" },
  { id: "cdb", nome: "CDB / renda fixa", cor: "#3E6F5C" },
  { id: "cdi", nome: "Conta/caixinha (CDI)", cor: "#C98A3A" },
  { id: "outro", nome: "Outro", cor: "#6B6459" },
];

// CDI anualizado (% a.a.) — série 4389 do Banco Central.
export async function buscarCDI() {
  const r = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json");
  if (!r.ok) throw new Error("CDI");
  const j = await r.json();
  const v = parseFloat(j?.[0]?.valor);
  if (!v) throw new Error("CDI");
  return v;
}
// Cotação de ação/FII pela brapi.dev (token opcional; alguns papéis exigem).
export async function buscarCotacao(ticker, token) {
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(ticker);
  const j = await r.json();
  const p = j?.results?.[0]?.regularMarketPrice;
  if (!p) throw new Error(ticker);
  return p;
}

export const diasDesde = (iso, hoje = hojeISO()) => Math.max(0, Math.round((new Date(hoje + "T00:00:00") - new Date(iso + "T00:00:00")) / 86400000));

// Calcula quanto foi investido e quanto vale hoje (estimativa bruta, sem IR/IOF).
export function calcularAtivo(a, mercado, hoje = hojeISO()) {
  if (a.tipo === "acao") {
    const cot = mercado?.cotacoes?.[(a.ticker || "").toUpperCase()];
    const preco = cot?.preco ?? a.precoMedio ?? 0;
    return { investido: (a.quantidade || 0) * (a.precoMedio || 0), atual: (a.quantidade || 0) * preco, preco, semCotacao: !cot };
  }
  const movs = a.movimentos || [];
  const investido = movs.reduce((s, m) => s + (m.tipo === "aporte" ? m.valor : -m.valor), 0);
  if (a.valorAtualManual !== undefined && a.valorAtualManual !== null && a.valorAtualManual !== "") {
    return { investido, atual: Number(a.valorAtualManual), manual: true };
  }
  const cdi = mercado?.cdiAnual;
  if (a.tipo === "outro" || !cdi) return { investido, atual: investido, semCDI: a.tipo !== "outro" };
  const taxa = (cdi / 100) * ((a.percCDI || 100) / 100);
  const atual = movs.reduce((s, m) => s + (m.tipo === "aporte" ? 1 : -1) * m.valor * Math.pow(1 + taxa, diasDesde(m.data, hoje) / 365), 0);
  return { investido, atual, estimado: true };
}
