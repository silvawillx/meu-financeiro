import { diasNoMes, hojeISO } from "./datas.js";
import { ehAjusteSaldo, saldoConta } from "./lancamentos.js";

// "Disponível para gastar" até o fim do mês:
//   saldo das contas - reservas (metas de economia) - contas a pagar até o fim do mês + a receber até o fim do mês.
// Compras no crédito entram como "a pagar" enquanto a fatura não for paga.
export function calcularDisponivel({ contas, lancamentos, cartoes = [], metasEconomia = [], hoje = hojeISO() }) {
  const mes = hoje.slice(0, 7);
  const fimMes = `${mes}-${String(diasNoMes(mes)).padStart(2, "0")}`;
  const saldoContas = contas.filter((c) => !c.arquivada).reduce((s, c) => s + saldoConta(lancamentos, c, { hoje, cartoes }), 0);
  const reservado = metasEconomia.reduce((s, m) => s + (m.aportes || []).reduce((x, a) => x + (a.valor || 0), 0), 0);
  const pendentes = lancamentos.filter((l) => l.status === "A pagar" && l.data <= fimMes && !ehAjusteSaldo(l));
  const aPagar = pendentes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
  const aReceber = pendentes.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const disponivel = Math.round((saldoContas - reservado - aPagar + aReceber) * 100) / 100;
  const diasRestantes = diasNoMes(mes) - parseInt(hoje.slice(8, 10), 10) + 1; // conta hoje
  return { saldoContas, reservado, aPagar, aReceber, disponivel, diasRestantes, porDia: disponivel > 0 ? disponivel / diasRestantes : 0 };
}
