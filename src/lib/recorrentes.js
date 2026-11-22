import { diasNoMes, mesesEntre } from "./datas.js";
import { genId } from "./formato.js";

// Gera os lançamentos de recorrentes que ainda faltam até o mês alvo (normalmente o mês atual).
// - não repete um mês que já tem lançamento daquela recorrência (idempotente);
// - recorrência pausada não gera nada (e não acumula meses para depois);
// - respeita dataFim, inicioMes e mesesIgnorados.
export function gerarRecorrentes({ recorrentes, lancamentos, mesAlvo, novoId = genId }) {
  let lancFinal = lancamentos;
  const recAtualizados = recorrentes.map((r) => {
    if (r.ultimoMesGerado === mesAlvo) return r;
    const mesesParaGerar = r.ultimoMesGerado ? mesesEntre(r.ultimoMesGerado, mesAlvo) : [mesAlvo];
    const jaExiste = (m) => lancFinal.some((l) => l.recorrenteId === r.id && l.data.slice(0, 7) === m);
    const mesesAtivos = r.pausada ? [] : mesesParaGerar.filter((m) =>
      (!r.dataFim || m <= r.dataFim) && (!r.inicioMes || m >= r.inicioMes) && !(r.mesesIgnorados || []).includes(m) && !jaExiste(m));
    mesesAtivos.forEach((m) => {
      const dia = String(Math.min(r.diaDoMes, diasNoMes(m))).padStart(2, "0");
      lancFinal = [{
        id: novoId("rec"), data: `${m}-${dia}`, tipo: r.tipo || "despesa", categoria: r.categoria, descricao: r.descricao,
        pessoa: "", status: "-", contaId: r.contaId, cartaoId: r.cartaoId || null, valor: r.valor, escopo: "pessoal",
        observacoes: "Gerado automaticamente (recorrente)", anexo: null, parcelaInfo: null, recorrenteId: r.id,
        ...(r.tipo === "receita" ? { origem: r.origem || "salario" } : {}),
      }, ...lancFinal];
    });
    return { ...r, ultimoMesGerado: mesAlvo };
  });
  const alterou = recAtualizados.some((r, i) => r.ultimoMesGerado !== recorrentes[i]?.ultimoMesGerado);
  return { lancamentos: lancFinal, recorrentes: recAtualizados, alterou };
}
