// Os testes rodam no fuso do Brasil, onde apareceu o erro de data (UTC adiantava o dia depois das 21h).
export default function setup() {
  process.env.TZ = "America/Sao_Paulo";
}
