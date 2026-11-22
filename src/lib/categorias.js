export const CATEGORIAS_DESPESA_PADRAO = [
  { nome: "Alimentação", cor: "#B4552F" },
  { nome: "Transporte", cor: "#3E6F5C" },
  { nome: "Moradia", cor: "#1B2A4A" },
  { nome: "Saúde", cor: "#8A3E5C" },
  { nome: "Lazer", cor: "#C98A3A" },
  { nome: "Educação", cor: "#2F5D8A" },
  { nome: "Compras", cor: "#6B4E9C" },
  { nome: "Dívidas/Cartão", cor: "#8A5A2F" },
  { nome: "Outros", cor: "#6B6459" },
];

export const CATEGORIAS_RECEITA_PADRAO = [
  { nome: "Salário", cor: "#3E6F5C" },
  { nome: "Freelance", cor: "#2F5D8A" },
  { nome: "Outros", cor: "#6B6459" },
];

export const todasCategorias = (tipo, categoriasDespesa, categoriasReceita) => (tipo === "receita" ? categoriasReceita : categoriasDespesa);

export const corCategoria = (nome, categorias) => {
  const c = (categorias || []).find((c) => c.nome === nome);
  return c ? c.cor : "#6B6459";
};

// O valor guardado do status continua sendo "Pago"/"A pagar" (não muda o dado nem os filtros),
// só o texto mostrado na tela muda quando é receita, pra fazer mais sentido: "Recebido"/"A receber".
export const rotuloStatus = (status, tipo) => {
  if (tipo !== "receita") return status;
  if (status === "Pago") return "Recebido";
  if (status === "A pagar") return "A receber";
  return status;
};
