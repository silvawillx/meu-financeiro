export const genId = (prefixo = "id") => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const formatarMoeda = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// Converte texto em número aceitando "R$ 1.234,56" (BR), "1,234.56" (US), "150.00" e "-32.90".
// - com ponto e vírgula juntos, o último separador é o decimal;
// - só vírgula: decimal (convenção brasileira);
// - só ponto: milhar quando segue o padrão 1.234 / 1.234.567; caso contrário, decimal ("150.00", "89.9").
export function parseValorStr(s) {
  if (s === null || s === undefined || s === "") return null;
  let t = String(s).replace("R$", "").replace(/\s/g, "");
  const temPonto = t.includes("."), temVirgula = t.includes(",");
  if (temPonto && temVirgula) {
    const decimal = t.lastIndexOf(",") > t.lastIndexOf(".") ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    t = t.split(milhar).join("").replace(decimal, ".");
  } else if (temVirgula) {
    t = t.replace(",", ".");
  } else if (temPonto && /^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  const v = parseFloat(t);
  return isNaN(v) ? null : v;
}
