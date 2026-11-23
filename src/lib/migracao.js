import { genId } from "./formato.js";

export const CONTA_PADRAO_ID = "conta-padrao";


export function migrarDadosAntigos(gastosAntigos, rendasAntigas) {
  const contas = [{ id: CONTA_PADRAO_ID, nome: "Conta principal", tipo: "conta", saldoInicial: 0, cor: "#1B2A4A" }];
  const lancamentos = (gastosAntigos || []).map((g) => ({
    id: g.id || genId("mig"),
    data: g.data, tipo: "despesa", categoria: g.categoria || "Outros", descricao: g.descricao,
    pessoa: g.pessoa || "", status: g.status || "-", contaId: CONTA_PADRAO_ID, cartaoId: null, escopo: "pessoal",
    valor: g.valor, observacoes: g.observacoes || "", anexo: null, parcelaInfo: null, recorrenteId: null,
  }));
  Object.entries(rendasAntigas || {}).forEach(([mes, valor]) => {
    if (valor === undefined || valor === null || valor === "") return;
    lancamentos.push({
      id: genId("renda-mig"), data: `${mes}-01`, tipo: "receita", categoria: "Salário", descricao: "Renda do mês",
      pessoa: "", status: "Pago", contaId: CONTA_PADRAO_ID, cartaoId: null, valor: parseFloat(valor), escopo: "pessoal",
      observacoes: "", anexo: null, parcelaInfo: null, recorrenteId: null,
    });
  });
  return { contas, lancamentos };
}
