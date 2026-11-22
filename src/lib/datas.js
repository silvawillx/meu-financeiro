export const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Data local (não UTC): no Brasil, depois das 21h o UTC já é "amanhã".
export const dataLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const hojeISO = () => dataLocalISO(new Date());

export const mesAtual = () => hojeISO().slice(0, 7);

export const mesLabel = (chave) => {
  const [ano, mes] = chave.split("-");
  return `${MESES_ABREV[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
};

export const mesLabelCompleto = (chave) => {
  const [ano, mes] = chave.split("-");
  return `${MESES_PT[parseInt(mes, 10) - 1]} de ${ano}`;
};

export const diasNoMes = (chave) => {
  const [ano, mes] = chave.split("-").map(Number);
  return new Date(ano, mes, 0).getDate();
};

export const addMeses = (dataISO, n) => {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(ano, mes - 1 + n, 1);
  const ultimoDiaDoMesDestino = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDiaDoMesDestino));
  return dataLocalISO(d);
};

// Calcula o período real da fatura (dia após o fechamento anterior até o dia de fechamento),
// referenciado ao mês em que a fatura fecha. Se o cartão não tiver dia de fechamento
// cadastrado, retorna null (quem chamar deve usar o mês calendário como alternativa).
export function cicloFatura(cartao, mesReferencia) {
  const fech = parseInt(cartao?.fechamento, 10);
  if (!fech || fech < 1 || fech > 31) return null;
  const fimDia = Math.min(fech, diasNoMes(mesReferencia));
  const fim = `${mesReferencia}-${String(fimDia).padStart(2, "0")}`;
  const mesAnterior = addMeses(`${mesReferencia}-01`, -1).slice(0, 7);
  const inicioDia = Math.min(fech + 1, diasNoMes(mesAnterior));
  const inicio = `${mesAnterior}-${String(inicioDia).padStart(2, "0")}`;
  return { inicio, fim };
}

// Lista os meses entre (exclusive) e fim (inclusive) — usado pra gerar
// recorrentes que ficaram pendentes enquanto o app ficou fechado.
export function mesesEntre(mesInicioExclusivo, mesFimInclusivo, limite = 24) {
  const meses = [];
  let atual = addMeses(`${mesInicioExclusivo}-01`, 1).slice(0, 7);
  let contador = 0;
  while (atual <= mesFimInclusivo && contador < limite) {
    meses.push(atual);
    atual = addMeses(`${atual}-01`, 1).slice(0, 7);
    contador++;
  }
  return meses;
}
