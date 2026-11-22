import { addMeses } from "./datas.js";
import { genId } from "./formato.js";

// Cria as parcelas de uma compra parcelada a partir dos dados do formulário.
// Cada parcela vale total/qtd arredondado; a última absorve os centavos de arredondamento,
// para a soma das parcelas fechar exatamente o valor total.
export function gerarParcelas(f, novoId = genId) {
  const total = parseFloat(String(f.valorTotalParcelamento).replace(",", "."));
  const qtd = parseInt(f.qtdParcelas, 10);
  const atualInicio = parseInt(f.parcelaAtual || "1", 10);
  const valorParcela = Math.round((total / qtd) * 100) / 100;
  const ultima = Math.round((total - valorParcela * (qtd - 1)) * 100) / 100;
  const grupo = novoId("parc");
  const novos = [];
  for (let n = atualInicio; n <= qtd; n++) {
    novos.push({
      id: novoId("l"), data: addMeses(f.data, n - atualInicio), tipo: "despesa", categoria: f.categoria,
      descricao: f.descricao.trim(), pessoa: (f.pessoa || "").trim(), status: n === atualInicio ? f.status : "A pagar",
      contaId: f.contaId, cartaoId: f.cartaoId || null, valor: n === qtd ? ultima : valorParcela, observacoes: f.observacoes,
      anexo: f.anexo, escopo: f.escopo || "pessoal", emprestimo: !!f.emprestimo, viagemId: f.viagemId || null,
      parcelaInfo: { atual: n, total: qtd, grupo }, recorrenteId: null,
    });
  }
  return novos;
}
