import { addMeses, diasNoMes, hojeISO } from "./datas.js";
import { aconteceu, ehAjusteSaldo, saldoConta } from "./lancamentos.js";
import { gerarRecorrentes } from "./recorrentes.js";

const arredonda = (v) => Math.round(v * 100) / 100;

// Média mensal do que você gasta "no variável" (não é recorrente, parcela, transferência nem ajuste),
// olhando os últimos meses fechados que tiveram lançamentos.
export function mediaGastoVariavel(lancamentos, { hoje = hojeISO(), mesesBase = 3 } = {}) {
  const mesAtual = hoje.slice(0, 7);
  const meses = Array.from({ length: mesesBase }, (_, i) => addMeses(`${mesAtual}-01`, -(i + 1)).slice(0, 7));
  const porMes = meses.map((m) => lancamentos
    .filter((l) => l.tipo === "despesa" && l.data.slice(0, 7) === m && !l.recorrenteId && !l.parcelaInfo && !ehAjusteSaldo(l))
    .reduce((s, l) => s + l.valor, 0));
  const comDados = porMes.filter((v) => v > 0);
  return comDados.length ? arredonda(comDados.reduce((s, v) => s + v, 0) / comDados.length) : 0;
}

// Projeta o saldo "livre" (saldo das contas - reserva) mês a mês, somando só o que ainda vai acontecer:
// contas a pagar e a receber, parcelas já lançadas e recorrências ativas (mesmo as ainda não geradas).
// O que está atrasado entra no mês atual. gastoVariavelMensal (opcional) é descontado de cada mês.
export function projetar({ contas, lancamentos, cartoes = [], recorrentes = [], metasEconomia = [], hoje = hojeISO(), meses = 6, gastoVariavelMensal = 0 }) {
  const mes0 = hoje.slice(0, 7);
  const mesFim = addMeses(`${mes0}-01`, meses - 1).slice(0, 7);
  const todos = gerarRecorrentes({ recorrentes, lancamentos, mesAlvo: mesFim, novoId: (p) => `proj-${p}` }).lancamentos;

  const saldoContas = contas.filter((c) => !c.arquivada).reduce((s, c) => s + saldoConta(lancamentos, c, { hoje, cartoes }), 0);
  const reservado = metasEconomia.reduce((s, m) => s + (m.aportes || []).reduce((x, a) => x + (a.valor || 0), 0), 0);
  const pendentes = todos.filter((l) => (l.tipo === "despesa" || l.tipo === "receita") && !aconteceu(l, hoje) && !ehAjusteSaldo(l));

  let acumulado = saldoContas - reservado;
  const saldoInicial = arredonda(acumulado);
  const resultado = [];
  for (let k = 0; k < meses; k++) {
    const m = addMeses(`${mes0}-01`, k).slice(0, 7);
    const doMes = pendentes.filter((l) => (k === 0 ? l.data.slice(0, 7) <= m : l.data.slice(0, 7) === m));
    const entradas = doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
    const saidas = doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
    // no mês atual só falta a parte do mês que ainda não passou
    const fracao = k === 0 ? (diasNoMes(m) - parseInt(hoje.slice(8, 10), 10) + 1) / diasNoMes(m) : 1;
    const variavel = gastoVariavelMensal * fracao;
    acumulado += entradas - saidas - variavel;
    resultado.push({ mes: m, entradas: arredonda(entradas), saidas: arredonda(saidas), variavel: arredonda(variavel), saldoFinal: arredonda(acumulado), negativo: acumulado < 0 });
  }
  return { saldoInicial, meses: resultado, primeiroNegativo: resultado.find((r) => r.negativo) || null };
}
