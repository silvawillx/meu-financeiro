import { useState, useEffect, useMemo, useRef, useContext, createContext } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Sankey,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import {
  LayoutDashboard, Receipt, Calendar, Landmark, CreditCard, BarChart3, Target,
  Star, Archive, Settings, Plus, Trash2, Pencil, Search, X, Check, Upload,
  Download, Wallet, Sun, Moon, Zap, Paperclip, ChevronLeft, ChevronRight,
  AlertTriangle, ArrowUp, ArrowDown, Menu, RefreshCw, Copy, Banknote, Bell, Printer, Plane,
} from "lucide-react";

/* ============================================================
   1. CONSTANTES E HELPERS
   ============================================================ */

const CATEGORIAS_DESPESA_PADRAO = [
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
const CATEGORIAS_RECEITA_PADRAO = [
  { nome: "Salário", cor: "#3E6F5C" },
  { nome: "Freelance", cor: "#2F5D8A" },
  { nome: "Outros", cor: "#6B6459" },
];
const todasCategorias = (tipo, categoriasDespesa, categoriasReceita) => (tipo === "receita" ? categoriasReceita : categoriasDespesa);
const corCategoria = (nome, categorias) => {
  const c = (categorias || []).find((c) => c.nome === nome);
  return c ? c.cor : "#6B6459";
};

// O valor guardado do status continua sendo "Pago"/"A pagar" (não muda o dado nem os filtros),
// só o texto mostrado na tela muda quando é receita, pra fazer mais sentido: "Recebido"/"A receber".
const rotuloStatus = (status, tipo) => {
  if (tipo !== "receita") return status;
  if (status === "Pago") return "Recebido";
  if (status === "A pagar") return "A receber";
  return status;
};

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const hojeISO = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => hojeISO().slice(0, 7);
const genId = (prefixo = "id") => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const formatarMoeda = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const mesLabel = (chave) => {
  const [ano, mes] = chave.split("-");
  return `${MESES_ABREV[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
};
const mesLabelCompleto = (chave) => {
  const [ano, mes] = chave.split("-");
  return `${MESES_PT[parseInt(mes, 10) - 1]} de ${ano}`;
};
const diasNoMes = (chave) => {
  const [ano, mes] = chave.split("-").map(Number);
  return new Date(ano, mes, 0).getDate();
};
const addMeses = (dataISO, n) => {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(ano, mes - 1 + n, 1);
  const ultimoDiaDoMesDestino = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDiaDoMesDestino));
  return d.toISOString().slice(0, 10);
};

// Calcula o período real da fatura (dia após o fechamento anterior até o dia de fechamento),
// referenciado ao mês em que a fatura fecha. Se o cartão não tiver dia de fechamento
// cadastrado, retorna null (quem chamar deve usar o mês calendário como alternativa).
function cicloFatura(cartao, mesReferencia) {
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
function mesesEntre(mesInicioExclusivo, mesFimInclusivo, limite = 24) {
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

function parseValorStr(s) {
  if (s === null || s === undefined || s === "") return null;
  let t = String(s).trim().replace("R$", "").trim();
  t = t.replace(/\./g, "").replace(",", ".");
  const v = parseFloat(t);
  return isNaN(v) ? null : v;
}

function detectarMesTexto(texto) {
  const low = (texto || "").toLowerCase();
  for (let i = 0; i < MESES_PT.length; i++) if (low.includes(MESES_PT[i])) return i + 1;
  return null;
}

// Parser da planilha original do usuário (; DESPESA ; QUANTIA ; NOME ; ANOTAÇÕES)
function parseCSVTexto(texto) {
  const linhas = texto.split(/\r?\n/).map((l) => l.split(";"));
  let headerIdx = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i][1] && linhas[i][1].trim().toUpperCase() === "DESPESA") { headerIdx = i; break; }
  }
  const mes = linhas[0] ? detectarMesTexto(linhas[0][1]) : null;
  const itens = [];
  let salario = null;
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < linhas.length; i++) {
      const row = linhas[i];
      if (!row || row.length < 3) continue;
      const despesa = (row[1] || "").trim();
      const quantiaStr = (row[2] || "").trim();
      const nome = (row[3] || "").trim();
      const anota = (row[4] || "").trim();
      const despesaLow = despesa.toLowerCase();
      if (despesaLow === "total") continue;
      if (despesaLow === "salario" || despesaLow === "salário") { salario = parseValorStr(quantiaStr); continue; }
      if (despesaLow === "sobrou") continue;
      if (!despesa && !quantiaStr) continue;
      const valor = parseValorStr(quantiaStr);
      if (valor === null) continue;
      const anotaLow = anota.toLowerCase();
      let status = "-";
      if (anotaLow.includes("a pagar")) status = "A pagar";
      else if (anotaLow.includes("pago")) status = "Pago";
      itens.push({ descricao: despesa, valor, pessoa: nome, observacoes: anota, status, categoria: "Outros", incluir: true });
    }
  }
  return { mes, itens, salario };
}

// Parser de extrato bancário no formato OFX (exportado por bancos como Nubank, Inter, Santander etc.)
function parseOFXTexto(texto) {
  const itens = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  blocos.forEach((bloco) => {
    const fim = bloco.search(/<\/STMTTRN>/i);
    const trecho = fim >= 0 ? bloco.slice(0, fim) : bloco;
    const pegar = (tag) => {
      const m = trecho.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const dtStr = pegar("DTPOSTED");
    const valorStr = pegar("TRNAMT");
    const memo = pegar("MEMO") || pegar("NAME") || "Transação bancária";
    if (!dtStr || dtStr.length < 8 || !valorStr) return;
    const data = `${dtStr.slice(0, 4)}-${dtStr.slice(4, 6)}-${dtStr.slice(6, 8)}`;
    const valorNum = parseFloat(valorStr.replace(",", "."));
    if (isNaN(valorNum) || valorNum === 0) return;
    itens.push({
      descricao: memo, valor: Math.abs(valorNum), tipo: valorNum < 0 ? "despesa" : "receita",
      pessoa: "", observacoes: "", status: "Pago", categoria: "Outros", data, incluir: true,
    });
  });
  return itens;
}

// "IA local" por regras — entrada rápida tipo "mercado 120 hoje" / "uber 32 ontem" / "pix farmacia 45"
const DICIONARIO_CATEGORIA = {
  mercado: "Alimentação", supermercado: "Alimentação", almoço: "Alimentação", almoco: "Alimentação",
  janta: "Alimentação", lanche: "Alimentação", ifood: "Alimentação", restaurante: "Alimentação",
  uber: "Transporte", "99": "Transporte", gasolina: "Transporte", combustivel: "Transporte", combustível: "Transporte", onibus: "Transporte", ônibus: "Transporte",
  aluguel: "Moradia", internet: "Moradia", energia: "Moradia", luz: "Moradia", agua: "Moradia", água: "Moradia", condominio: "Moradia", condomínio: "Moradia",
  farmacia: "Saúde", farmácia: "Saúde", remedio: "Saúde", remédio: "Saúde", academia: "Saúde", medico: "Saúde", médico: "Saúde",
  cinema: "Lazer", bar: "Lazer", show: "Lazer", viagem: "Lazer", streaming: "Lazer",
  curso: "Educação", livro: "Educação", faculdade: "Educação",
  roupa: "Compras", loja: "Compras",
};
function parseEntradaRapida(textoOriginal) {
  const texto = textoOriginal.trim();
  const low = texto.toLowerCase();
  const matchValor = texto.match(/(\d+[.,]?\d*)/);
  const valor = matchValor ? parseValorStr(matchValor[1]) : null;
  let data = hojeISO();
  if (low.includes("ontem")) {
    const d = new Date(); d.setDate(d.getDate() - 1); data = d.toISOString().slice(0, 10);
  }
  let contaSugerida = null;
  if (low.includes("pix")) contaSugerida = "PIX";
  else if (low.includes("cartão") || low.includes("cartao")) contaSugerida = "Cartão";
  else if (low.includes("dinheiro")) contaSugerida = "Dinheiro";
  let categoria = "Outros";
  for (const chave in DICIONARIO_CATEGORIA) {
    if (low.includes(chave)) { categoria = DICIONARIO_CATEGORIA[chave]; break; }
  }
  let descricao = texto
    .replace(/(\d+[.,]?\d*)/, "")
    .replace(/\b(hoje|ontem|pix|cart[aã]o|dinheiro|r\$)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!descricao) descricao = texto;
  descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);
  return { valor, data, categoria, contaSugerida, descricao };
}

/* ============================================================
   2. TEMA
   ============================================================ */
const PALETA = {
  claro: { fundo: "#F7F5F0", cartao: "#FFFFFF", borda: "#E4DFD3", texto: "#1B2A4A", textoSuave: "#6B6459", bordaSuave: "#F0ECE2" },
  escuro: { fundo: "#11161D", cartao: "#181F28", borda: "#2A323D", texto: "#EDEAE2", textoSuave: "#8B93A0", bordaSuave: "#232B35" },
};
const VERDE = "#3E6F5C";
const VERMELHO = "#B4552F";

/* ============================================================
   3. SEED / MIGRAÇÃO
   ============================================================ */
const CONTA_PADRAO_ID = "conta-padrao";

function migrarDadosAntigos(gastosAntigos, rendasAntigas) {
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

const SEED_GASTOS_ANTIGOS = [
  { data: "2026-06-01", categoria: "Outros", descricao: "Cruchyrool", pessoa: "Yago", status: "Pago", valor: 5.0 },
  { data: "2026-06-01", categoria: "Lazer", descricao: "sair de casa", pessoa: "Eu", status: "-", valor: 200.0 },
  { data: "2026-06-01", categoria: "Moradia", descricao: "Internet", pessoa: "Internet", status: "Pago", valor: 89.9 },
  { data: "2026-06-01", categoria: "Saúde", descricao: "Pag bank", pessoa: "academia", status: "-", valor: 429.45 },
  { data: "2026-06-01", categoria: "Outros", descricao: "Placa mãe", pessoa: "Titio", status: "Pago", observacoes: "6/6 pago", valor: 143.35 },
  { data: "2026-06-01", categoria: "Dívidas/Cartão", descricao: "jeitto", pessoa: "cartão", status: "Pago", valor: 21.41 },
  { data: "2026-06-01", categoria: "Dívidas/Cartão", descricao: "cartão", pessoa: "embaixador", status: "A pagar", observacoes: "4/6 a pagar", valor: 82.63 },
  { data: "2026-06-01", categoria: "Outros", descricao: "felipe", pessoa: "premier", status: "Pago", valor: 15.0 },
  { data: "2026-07-01", categoria: "Dívidas/Cartão", descricao: "picpay", pessoa: "renegociação", status: "Pago", valor: 131.12 },
  { data: "2026-07-01", categoria: "Outros", descricao: "Cruchyrool", pessoa: "Yago", status: "Pago", valor: 5.0 },
  { data: "2026-07-01", categoria: "Lazer", descricao: "sair de casa", pessoa: "Eu", status: "-", valor: 200.0 },
  { data: "2026-07-01", categoria: "Moradia", descricao: "Internet", pessoa: "Internet", status: "Pago", valor: 89.9 },
  { data: "2026-07-01", categoria: "Saúde", descricao: "Pag bank", pessoa: "academia", status: "Pago", valor: 150.0 },
  { data: "2026-07-01", categoria: "Outros", descricao: "pastor", pessoa: "carregador", status: "A pagar", valor: 30.0 },
  { data: "2026-07-01", categoria: "Dívidas/Cartão", descricao: "jeitto", pessoa: "cartão", status: "Pago", valor: 548.19 },
  { data: "2026-07-01", categoria: "Dívidas/Cartão", descricao: "cartão", pessoa: "embaixador", status: "A pagar", observacoes: "5/6 a pagar", valor: 82.63 },
  { data: "2026-07-01", categoria: "Outros", descricao: "felipe", pessoa: "premier", status: "Pago", valor: 15.0 },
].map((g) => ({ ...g, id: genId("seed") }));
const SEED_RENDAS_ANTIGAS = { "2026-06": 2000, "2026-07": 2000 };

/* ============================================================
   4. CONTEXT
   ============================================================ */
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

/* ============================================================
   5. COMPONENTES DE APOIO (UI)
   ============================================================ */
function Botao({ children, onClick, variante = "primario", type = "button", style = {}, title }) {
  const { cor, pal } = useApp();
  const base = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid transparent", transition: "opacity .15s" };
  const variantes = {
    primario: { background: cor, color: "#fff" },
    secundario: { background: "transparent", color: cor, borderColor: cor },
    perigo: { background: "transparent", color: VERMELHO, borderColor: VERMELHO },
    fantasma: { background: "transparent", color: pal.textoSuave },
  };
  return (
    <button type={type} title={title} onClick={onClick} style={{ ...base, ...variantes[variante], ...style }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.85)} onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}>
      {children}
    </button>
  );
}

function Cartao({ children, style = {}, className = "" }) {
  const { pal } = useApp();
  return <div className={className} style={{ background: pal.cartao, border: `1px solid ${pal.borda}`, borderRadius: 12, ...style }}>{children}</div>;
}

function Campo({ label, children }) {
  const { pal } = useApp();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: pal.textoSuave }}>
      {label}
      {children}
    </label>
  );
}
function estiloInput(pal) {
  return { padding: "8px 10px", borderRadius: 8, border: `1px solid ${pal.borda}`, fontSize: 14, background: pal.cartao, color: pal.texto };
}

function Modal({ titulo, onFechar, children, largura = 480 }) {
  const { pal } = useApp();
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: pal.cartao, borderRadius: 14, padding: 22, width: "100%", maxWidth: largura, maxHeight: "88vh", overflowY: "auto", border: `1px solid ${pal.borda}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="titulo-serif" style={{ fontSize: 18, fontWeight: 600, color: pal.texto }}>{titulo}</div>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: pal.textoSuave }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Confirmacao({ msg, onCancelar, onConfirmar }) {
  const { pal } = useApp();
  return (
    <Modal titulo="Confirmar" onFechar={onCancelar} largura={360}>
      <div style={{ fontSize: 14, color: pal.texto, marginBottom: 18, display: "flex", gap: 10 }}>
        <AlertTriangle size={18} color={VERMELHO} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{msg}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Botao variante="fantasma" onClick={onCancelar}>Cancelar</Botao>
        <Botao variante="perigo" onClick={onConfirmar}>Excluir</Botao>
      </div>
    </Modal>
  );
}

function Toast({ toast, onFechar }) {
  if (!toast) return null;
  const { msg, acao } = typeof toast === "string" ? { msg: toast, acao: null } : toast;
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#1B2A4A", color: "#fff", padding: "10px 12px 10px 18px", borderRadius: 999, fontSize: 13, zIndex: 200, boxShadow: "0 4px 14px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
      <Check size={14} /> {msg}
      {acao && (
        <button
          onClick={() => { acao.onClick(); onFechar(); }}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {acao.label}
        </button>
      )}
    </div>
  );
}

function Progresso({ valor, max, corBase }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  const estourou = valor > max;
  return (
    <div style={{ height: 8, borderRadius: 999, background: "#E4DFD333", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: estourou ? VERMELHO : corBase, transition: "width .3s" }} />
    </div>
  );
}

// Navegador de mês grande e visual — setas pra trocar de mês, mês/ano em destaque,
// e um atalho pra voltar rápido ao mês atual quando você estiver navegando por outros.
function NavegadorMes({ compacto = false }) {
  const { mesSelecionado, setMesSelecionado, pal, cor } = useApp();
  const mudarMes = (delta) => setMesSelecionado(addMeses(`${mesSelecionado}-01`, delta).slice(0, 7));
  const ehMesAtual = mesSelecionado === mesAtual();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: pal.cartao, border: `1px solid ${pal.borda}`, borderRadius: 10, padding: "6px 8px" }}>
      <button onClick={() => mudarMes(-1)} title="Mês anterior" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "none", background: "transparent", color: pal.texto, cursor: "pointer", borderRadius: 6 }}>
        <ChevronLeft size={18} />
      </button>
      <div style={{ minWidth: compacto ? 90 : 140, textAlign: "center" }}>
        <div className="titulo-serif" style={{ fontSize: compacto ? 14 : 17, fontWeight: 600, color: pal.texto, textTransform: "capitalize", lineHeight: 1.1 }}>
          {mesLabelCompleto(mesSelecionado)}
        </div>
        {!ehMesAtual && (
          <button onClick={() => setMesSelecionado(mesAtual())} style={{ fontSize: 10.5, color: cor, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            voltar para hoje
          </button>
        )}
      </div>
      <button onClick={() => mudarMes(1)} title="Próximo mês" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "none", background: "transparent", color: pal.texto, cursor: "pointer", borderRadius: 6 }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/* ============================================================
   6. SIDEBAR
   ============================================================ */
const ITENS_MENU = [
  { id: "dashboard", label: "Dashboard", icone: LayoutDashboard },
  { id: "lancamentos", label: "Lançamentos", icone: Receipt },
  { id: "calendario", label: "Calendário", icone: Calendar },
  { id: "contas", label: "Contas", icone: Landmark },
  { id: "cartoes", label: "Cartões", icone: CreditCard },
  { id: "recorrentes", label: "Recorrentes", icone: RefreshCw },
  { id: "dividas", label: "Dívidas", icone: Banknote },
  { id: "viagens", label: "Viagens", icone: Plane },
  { id: "estatisticas", label: "Estatísticas", icone: BarChart3 },
  { id: "metas", label: "Metas", icone: Target },
  { id: "favoritos", label: "Favoritos", icone: Star },
  { id: "backup", label: "Backup", icone: Archive },
  { id: "config", label: "Configurações", icone: Settings },
];

function Sidebar({ paginaAtiva, onNavegar, aberta, onFechar }) {
  const { pal, cor } = useApp();
  return (
    <>
      {aberta && <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 40, display: "none" }} className="overlay-mobile" />}
      <div className={`sidebar ${aberta ? "sidebar-aberta" : ""}`} style={{ background: pal.cartao, borderRight: `1px solid ${pal.borda}`, width: 210, flexShrink: 0, padding: "20px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 20 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: cor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Wallet size={17} color="#fff" />
          </div>
          <div className="titulo-serif" style={{ fontSize: 15, fontWeight: 600, color: pal.texto, lineHeight: 1.15 }}>Meu Financeiro</div>
        </div>
        {ITENS_MENU.map((item) => {
          const Icone = item.icone;
          const ativo = paginaAtiva === item.id;
          return (
            <button key={item.id} onClick={() => { onNavegar(item.id); onFechar(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none",
                background: ativo ? cor : "transparent", color: ativo ? "#fff" : pal.textoSuave, fontSize: 13.5,
                fontWeight: ativo ? 600 : 500, cursor: "pointer", textAlign: "left",
              }}>
              <Icone size={16} /> {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ============================================================
   7. DASHBOARD
   ============================================================ */
function CardMetrica({ icone: Icone, label, valor, cor, sub }) {
  const { pal } = useApp();
  return (
    <Cartao style={{ padding: 16, flex: "1 1 160px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${cor}1A`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone size={15} color={cor} />
        </div>
        <div style={{ fontSize: 11.5, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      </div>
      <div className="num-tab" style={{ fontSize: 21, fontWeight: 600, color: pal.texto }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: pal.textoSuave, marginTop: 3 }}>{sub}</div>}
    </Cartao>
  );
}

function PainelDashboard() {
  const { lancamentos, mesSelecionado, pal, cor, contas, categoriasDespesa, categoriasReceita, adicionarLancamento, setPagina, ultimoBackup, exportarBackupJSON } = useApp();
  const [lembreteBackupOculto, setLembreteBackupOculto] = useState(false);
  const [modalRendaAberto, setModalRendaAberto] = useState(false);
  const doMes = useMemo(() => lancamentos.filter((l) => l.data.slice(0, 7) === mesSelecionado), [lancamentos, mesSelecionado]);
  const receitasDoMes = useMemo(() => doMes.filter((l) => l.tipo === "receita").sort((a, b) => (a.data < b.data ? 1 : -1)), [doMes]);
  const receita = doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const gasto = doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
  const saldo = receita - gasto;
  const economiaPct = receita > 0 ? (saldo / receita) * 100 : 0;

  const hojeD = new Date();
  const ehMesAtual = mesSelecionado === mesAtual();
  const diaCorrente = ehMesAtual ? hojeD.getDate() : diasNoMes(mesSelecionado);
  const diasRestantes = ehMesAtual ? diasNoMes(mesSelecionado) - hojeD.getDate() : 0;
  const mediaDia = diaCorrente > 0 ? gasto / diaCorrente : 0;

  const porCategoria = useMemo(() => {
    const mapa = {};
    doMes.filter((l) => l.tipo === "despesa").forEach((l) => { mapa[l.categoria] = (mapa[l.categoria] || 0) + l.valor; });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [doMes]);
  const categoriaTopo = porCategoria[0];

  const timeline = useMemo(() => [...lancamentos].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 8), [lancamentos]);

  const vencidos = useMemo(
    () => lancamentos.filter((l) => l.tipo === "despesa" && l.status === "A pagar" && l.data < hojeISO()).sort((a, b) => (a.data < b.data ? -1 : 1)),
    [lancamentos]
  );

  const totalAPagar = useMemo(
    () => lancamentos.filter((l) => l.tipo === "despesa" && l.status === "A pagar").reduce((s, l) => s + l.valor, 0),
    [lancamentos]
  );
  const totalVencido = vencidos.reduce((s, l) => s + l.valor, 0);
  const totalAVencer = totalAPagar - totalVencido;

  const saldoAteHoje = useMemo(() => {
    if (!ehMesAtual) return null;
    const hj = hojeISO();
    const r = doMes.filter((l) => l.tipo === "receita" && l.data <= hj).reduce((s, l) => s + l.valor, 0);
    const g = doMes.filter((l) => l.tipo === "despesa" && l.data <= hj).reduce((s, l) => s + l.valor, 0);
    return r - g;
  }, [doMes, ehMesAtual]);

  const diasSemBackup = ultimoBackup ? Math.floor((new Date(hojeISO()) - new Date(ultimoBackup)) / 86400000) : null;
  const precisaLembrarBackup = !lembreteBackupOculto && ((diasSemBackup === null && lancamentos.length > 8) || (diasSemBackup !== null && diasSemBackup >= 14));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div className="titulo-serif" style={{ fontSize: 15, color: pal.textoSuave }}>Você está vendo:</div>
        <NavegadorMes />
      </div>
      {precisaLembrarBackup && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#2F5D8A1A", border: "1px solid #2F5D8A55", borderRadius: 10, padding: "12px 16px", marginBottom: 14, flexWrap: "wrap" }}>
          <Archive size={17} color="#2F5D8A" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13.5, color: pal.texto, flex: 1, minWidth: 200 }}>
            {diasSemBackup === null ? "Você ainda não exportou um backup." : `Já fazem ${diasSemBackup} dias que você não faz backup.`} Seus dados vivem só neste navegador — vale exportar de vez em quando.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Botao onClick={exportarBackupJSON} style={{ padding: "6px 12px" }}>Exportar agora</Botao>
            <Botao variante="fantasma" onClick={() => setLembreteBackupOculto(true)} style={{ padding: "6px 12px" }}>Agora não</Botao>
          </div>
        </div>
      )}
      {vencidos.length > 0 && (
        <div onClick={() => setPagina("lancamentos")} style={{ display: "flex", alignItems: "center", gap: 10, background: "#B4552F1A", border: `1px solid ${VERMELHO}55`, borderRadius: 10, padding: "12px 16px", marginBottom: 18, cursor: "pointer" }}>
          <AlertTriangle size={17} color={VERMELHO} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13.5, color: pal.texto }}>
            <strong>{vencidos.length}</strong> lançamento{vencidos.length > 1 ? "s" : ""} marcado{vencidos.length > 1 ? "s" : ""} como <strong>"A pagar"</strong> já {vencidos.length > 1 ? "venceram" : "venceu"} — total de <strong className="num-tab">{formatarMoeda(vencidos.reduce((s, l) => s + l.valor, 0))}</strong>. Toque pra ver.
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
        <CardMetrica icone={Wallet} label="Receita" valor={formatarMoeda(receita)} cor={VERDE} />
        <CardMetrica icone={Receipt} label="Gastos" valor={formatarMoeda(gasto)} cor={VERMELHO} />
        <CardMetrica icone={saldo >= 0 ? ArrowUp : ArrowDown} label={ehMesAtual ? "Saldo previsto" : "Saldo"} valor={formatarMoeda(saldo)} cor={saldo >= 0 ? VERDE : VERMELHO} sub={ehMesAtual ? `Até hoje: ${formatarMoeda(saldoAteHoje)}` : undefined} />
        <CardMetrica icone={Target} label="Economia" valor={`${economiaPct.toFixed(0)}%`} cor={economiaPct >= 0 ? VERDE : VERMELHO} />
      </div>

      {totalAPagar > 0 && (
        <Cartao style={{ padding: 18, marginBottom: 20, cursor: "pointer" }} className="" >
          <div onClick={() => setPagina("lancamentos")}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: pal.textoSuave, fontSize: 12, marginBottom: 6 }}>
              <Landmark size={14} /> VOCÊ AINDA DEVE (TUDO MARCADO COMO "A PAGAR")
            </div>
            <div className="num-tab" style={{ fontSize: 28, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>{formatarMoeda(totalAPagar)}</div>
            <div style={{ display: "flex", gap: 18, fontSize: 12.5, flexWrap: "wrap" }}>
              {totalVencido > 0 && <span style={{ color: VERMELHO }}>● {formatarMoeda(totalVencido)} já vencido</span>}
              {totalAVencer > 0 && <span style={{ color: pal.textoSuave }}>● {formatarMoeda(totalAVencer)} a vencer</span>}
            </div>
          </div>
        </Cartao>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
        <CardMetrica icone={BarChart3} label="Média/dia" valor={formatarMoeda(mediaDia)} cor={cor} />
        <CardMetrica icone={Calendar} label="Dias restantes" valor={ehMesAtual ? diasRestantes : "—"} cor={cor} sub={ehMesAtual ? "no mês" : "mês encerrado"} />
        <CardMetrica icone={Receipt} label="Lançamentos" valor={doMes.length} cor={cor} />
        <CardMetrica icone={Star} label="Categoria top" valor={categoriaTopo ? categoriaTopo[0] : "—"} cor={cor} sub={categoriaTopo ? formatarMoeda(categoriaTopo[1]) : ""} />
      </div>

      <Cartao style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Renda em {mesLabel(mesSelecionado)} — de onde entrou dinheiro
          </div>
          <Botao onClick={() => setModalRendaAberto(true)} style={{ padding: "7px 12px" }}><Plus size={14} /> Registrar renda</Botao>
        </div>
        {receitasDoMes.length === 0 ? (
          <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhuma renda registrada neste mês ainda. Clique em "Registrar renda" pra adicionar seu salário ou qualquer outra entrada de dinheiro.</div>
        ) : (
          receitasDoMes.map((r, i) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: pal.texto }}>{r.descricao}</div>
                <div style={{ fontSize: 11.5, color: pal.textoSuave }}>{r.categoria} · caiu em: <strong>{contas.find((c) => c.id === r.contaId)?.nome || "sem conta definida"}</strong> · {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {r.status && r.status !== "-" && (
                  <span className="badge" style={{ background: r.status === "Pago" ? "#3E6F5C22" : "#C98A3A22", color: r.status === "Pago" ? VERDE : "#C98A3A" }}>{rotuloStatus(r.status, r.tipo)}</span>
                )}
                <div className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: VERDE }}>+{formatarMoeda(r.valor)}</div>
              </div>
            </div>
          ))
        )}
      </Cartao>

      {modalRendaAberto && (
        <Modal titulo="Registrar renda" onFechar={() => setModalRendaAberto(false)} largura={560}>
          <FormularioLancamento
            inicial={{
              tipo: "receita", data: hojeISO(), categoria: categoriasReceita[0]?.nome || "Salário", descricao: "", pessoa: "",
              status: "Pago", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "", valor: "", observacoes: "", anexo: null,
              escopo: "pessoal", emprestimo: false, viagemId: "", parcelado: false, valorTotalParcelamento: "", qtdParcelas: "", parcelaAtual: "1",
            }}
            onSalvar={(f, valorNum) => { adicionarLancamento(f, valorNum); setModalRendaAberto(false); }}
            onFechar={() => setModalRendaAberto(false)}
          />
        </Modal>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }} className="grid-responsiva">
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Timeline recente</div>
          {timeline.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum lançamento ainda.</div>}
          {timeline.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${pal.bordaSuave}` }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: pal.texto }}>{l.descricao}</div>
                <div style={{ fontSize: 11.5, color: pal.textoSuave }}>{new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")} · {contas.find((c) => c.id === l.contaId)?.nome || "—"}</div>
              </div>
              <div className="num-tab" style={{ fontSize: 13.5, fontWeight: 600, color: l.tipo === "receita" ? VERDE : VERMELHO }}>
                {l.tipo === "receita" ? "+" : "-"}{formatarMoeda(l.valor)}
              </div>
            </div>
          ))}
        </Cartao>
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Por categoria</div>
          {porCategoria.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Sem despesas neste mês.</div>}
          <ResponsiveContainer width="100%" height={Math.max(140, porCategoria.length * 32)}>
            <BarChart data={porCategoria.map(([nome, valor]) => ({ nome, valor }))} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nome" width={95} tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatarMoeda(v)} />
              <Bar dataKey="valor" radius={[0, 5, 5, 0]} barSize={14}>
                {porCategoria.map(([nome], i) => <Cell key={i} fill={corCategoria(nome, categoriasDespesa)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Cartao>
      </div>
    </div>
  );
}

/* ============================================================
   8. FORMULÁRIO DE LANÇAMENTO (adicionar / editar)
   ============================================================ */
function FormularioLancamento({ inicial, onSalvar, onFechar, modoDuplicar = false, onSujoChange }) {
  const { pal, contas, cartoes, adicionarFavorito, categoriasDespesa, categoriasReceita, lancamentos, viagens } = useApp();
  const vazio = {
    tipo: "despesa", data: hojeISO(), categoria: categoriasDespesa[0].nome, descricao: "", pessoa: "",
    status: "-", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "", valor: "", observacoes: "", anexo: null,
    escopo: "pessoal", emprestimo: false, viagemId: "", parcelado: false, valorTotalParcelamento: "", qtdParcelas: "", parcelaAtual: "1",
  };
  const [f, setF] = useState(inicial || vazio);
  const [sugestaoAplicada, setSugestaoAplicada] = useState("");
  const [duplicataConfirmada, setDuplicataConfirmada] = useState(false);
  const [simuladorAberto, setSimuladorAberto] = useState(false);

  useEffect(() => {
    if (!onSujoChange) return;
    const base = inicial || vazio;
    const sujo = Object.keys(vazio).some((k) => k !== "parcelado" && String(f[k] ?? "") !== String(base[k] ?? ""));
    onSujoChange(sujo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  // Autocomplete: ao sair do campo descrição, procura o lançamento mais recente
  // com a mesma descrição e sugere categoria/conta/pessoa — só em lançamentos novos.
  const aoSairDescricao = () => {
    if (inicial && !modoDuplicar) return;
    const alvo = f.descricao.trim().toLowerCase();
    if (!alvo) return;
    const correspondente = [...lancamentos]
      .filter((l) => l.tipo === f.tipo && l.descricao.trim().toLowerCase() === alvo)
      .sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    if (correspondente) {
      setF((old) => ({
        ...old,
        categoria: correspondente.categoria || old.categoria,
        pessoa: old.pessoa || correspondente.pessoa || old.pessoa,
        contaId: old.contaId || correspondente.contaId || old.contaId,
        cartaoId: old.cartaoId || correspondente.cartaoId || old.cartaoId,
      }));
      setSugestaoAplicada(correspondente.descricao);
    }
  };

  const aoEscolherAnexo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) { alert("Escolha uma imagem menor (até ~1.5MB) para não pesar o armazenamento."); return; }
    const reader = new FileReader();
    reader.onload = () => setF((old) => ({ ...old, anexo: reader.result }));
    reader.readAsDataURL(file);
  };

  const [erroForm, setErroForm] = useState("");
  const [avisoDuplicata, setAvisoDuplicata] = useState(false);

  const possivelDuplicata = () => {
    if (inicial && !modoDuplicar) return null;
    if (f.parcelado) return null;
    const valorNum = parseFloat(String(f.valor).replace(",", "."));
    if (!valorNum) return null;
    return lancamentos.find(
      (l) => l.data === f.data && l.tipo === f.tipo && Math.abs(l.valor - valorNum) < 0.01 &&
        l.descricao.trim().toLowerCase() === f.descricao.trim().toLowerCase()
    );
  };

  const submeter = (e) => {
    e.preventDefault();
    setErroForm("");
    if (!f.descricao.trim()) { setErroForm("Preencha a descrição."); return; }
    if (!f.data) { setErroForm("Escolha uma data."); return; }
    if (f.parcelado) {
      const total = parseFloat(String(f.valorTotalParcelamento).replace(",", "."));
      const qtd = parseInt(f.qtdParcelas, 10);
      const atual = parseInt(f.parcelaAtual || "1", 10);
      if (!total || total <= 0) { setErroForm("Preencha o valor total do parcelamento."); return; }
      if (!qtd || qtd <= 0) { setErroForm("Preencha a quantidade de parcelas."); return; }
      if (atual > qtd) { setErroForm("A parcela atual não pode ser maior que a quantidade total."); return; }
      onSalvar(f, null);
      return;
    }
    const valorNum = parseFloat(String(f.valor).replace(",", "."));
    if (!valorNum || valorNum <= 0) { setErroForm("Preencha um valor válido."); return; }
    if (!duplicataConfirmada && possivelDuplicata()) { setAvisoDuplicata(true); return; }
    onSalvar(f, valorNum);
  };

  const salvarMesmoAssim = () => {
    setDuplicataConfirmada(true);
    setAvisoDuplicata(false);
    const valorNum = parseFloat(String(f.valor).replace(",", "."));
    onSalvar(f, valorNum);
  };

  const categorias = todasCategorias(f.tipo, categoriasDespesa, categoriasReceita);
  const podeParcelar = f.tipo === "despesa" && (!inicial || modoDuplicar);

  return (
    <form onSubmit={submeter} className="form-lancamento">
      <div className="span-2" style={{ display: "flex", gap: 8 }}>
        {["despesa", "receita"].map((t) => (
          <button key={t} type="button" onClick={() => setF({ ...f, tipo: t, categoria: todasCategorias(t, categoriasDespesa, categoriasReceita)[0].nome })}
            style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${f.tipo === t ? "transparent" : pal.borda}`, background: f.tipo === t ? (t === "despesa" ? VERMELHO : VERDE) : "transparent", color: f.tipo === t ? "#fff" : pal.texto, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {t === "despesa" ? "Despesa" : "Receita"}
          </button>
        ))}
      </div>
      <div className="span-2" style={{ display: "flex", gap: 8 }}>
        {["pessoal", "negocio"].map((esc) => (
          <button key={esc} type="button" onClick={() => setF({ ...f, escopo: esc })}
            style={{ flex: 1, padding: "6px", borderRadius: 8, border: `1px solid ${f.escopo === esc ? "transparent" : pal.borda}`, background: f.escopo === esc ? pal.texto : "transparent", color: f.escopo === esc ? pal.fundo : pal.textoSuave, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            {esc === "pessoal" ? "Pessoal" : "Negócio"}
          </button>
        ))}
      </div>
      <Campo label="Data"><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} style={estiloInput(pal)} /></Campo>
      <Campo label="Categoria">
        <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} style={estiloInput(pal)}>
          {categorias.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo label="Descrição">
        <input type="text" placeholder="Ex.: Mercado, Uber, aluguel..." value={f.descricao} onChange={(e) => { setF({ ...f, descricao: e.target.value }); setSugestaoAplicada(""); }} onBlur={aoSairDescricao} style={estiloInput(pal)} />
        {sugestaoAplicada && <div style={{ fontSize: 11, color: "#2F5D8A", marginTop: 3 }}>🔎 Categoria/conta preenchidas com base no último "{sugestaoAplicada}"</div>}
      </Campo>
      <Campo label="Pessoa / Para quem">
        <input type="text" placeholder="Opcional" value={f.pessoa} onChange={(e) => setF({ ...f, pessoa: e.target.value })} style={estiloInput(pal)} />
      </Campo>
      {f.tipo === "despesa" && f.pessoa.trim() && (
        <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: pal.texto, marginTop: -4 }}>
          <input type="checkbox" checked={!!f.emprestimo} onChange={(e) => setF({ ...f, emprestimo: e.target.checked })} />
          Isso foi um adiantamento — {f.pessoa.trim() || "essa pessoa"} vai te devolver
        </div>
      )}
      {viagens.length > 0 && f.tipo === "despesa" && (
        <Campo label="Viagem (opcional)">
          <select value={f.viagemId || ""} onChange={(e) => setF({ ...f, viagemId: e.target.value })} style={estiloInput(pal)}>
            <option value="">Nenhuma</option>
            {viagens.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </Campo>
      )}
      <Campo label="Conta">
        <select value={f.contaId} onChange={(e) => setF({ ...f, contaId: e.target.value })} style={estiloInput(pal)}>
          <option value="">Sem conta</option>
          {contas.filter((c) => !c.arquivada || c.id === f.contaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo label="Cartão (opcional)">
        <select value={f.cartaoId} onChange={(e) => setF({ ...f, cartaoId: e.target.value })} style={estiloInput(pal)}>
          <option value="">—</option>
          {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo label="Status">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={estiloInput(pal)}>
          <option value="-">—</option>
          <option value="Pago">{rotuloStatus("Pago", f.tipo)}</option>
          <option value="A pagar">{rotuloStatus("A pagar", f.tipo)}</option>
        </select>
      </Campo>
      {!f.parcelado && (
        <Campo label="Valor (R$)">
          <input type="text" inputMode="decimal" placeholder="0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} className="num-tab" style={estiloInput(pal)} />
        </Campo>
      )}

      {podeParcelar && (
        <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: pal.texto }}>
          <input type="checkbox" checked={f.parcelado} onChange={(e) => setF({ ...f, parcelado: e.target.checked })} /> Parcelado
        </div>
      )}
      {f.parcelado && (
        <>
          <Campo label="Valor total (R$)"><input type="text" inputMode="decimal" className="num-tab" value={f.valorTotalParcelamento} onChange={(e) => setF({ ...f, valorTotalParcelamento: e.target.value })} style={estiloInput(pal)} /></Campo>
          <Campo label="Qtd. de parcelas"><input type="number" min="1" value={f.qtdParcelas} onChange={(e) => setF({ ...f, qtdParcelas: e.target.value })} style={estiloInput(pal)} /></Campo>
          <Campo label="Parcela atual"><input type="number" min="1" value={f.parcelaAtual} onChange={(e) => setF({ ...f, parcelaAtual: e.target.value })} style={estiloInput(pal)} /></Campo>
          {f.valorTotalParcelamento && f.qtdParcelas && (
            <div className="span-2">
              <Botao variante="secundario" type="button" onClick={() => setSimuladorAberto(true)} style={{ padding: "7px 12px" }}>
                <BarChart3 size={14} /> Simular impacto nos próximos meses
              </Botao>
            </div>
          )}
        </>
      )}
      {inicial?.parcelaInfo && !modoDuplicar && (
        <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: pal.textoSuave, background: `${pal.borda}55`, padding: "8px 10px", borderRadius: 8 }}>
          <input type="checkbox" checked={!!f.aplicarGrupo} onChange={(e) => setF({ ...f, aplicarGrupo: e.target.checked })} />
          Aplicar categoria/descrição/conta a todas as parcelas futuras deste grupo ({inicial.parcelaInfo.atual}/{inicial.parcelaInfo.total})
        </div>
      )}

      <div className="span-2">
        <Campo label="Observações">
          <textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} style={{ ...estiloInput(pal), resize: "vertical", fontFamily: "inherit" }} />
        </Campo>
      </div>
      <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: pal.textoSuave, cursor: "pointer" }}>
          <Paperclip size={14} /> Anexar comprovante
          <input type="file" accept="image/*" onChange={aoEscolherAnexo} style={{ display: "none" }} />
        </label>
        {f.anexo && <img src={f.anexo} alt="comprovante" style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 6, cursor: "pointer" }} onClick={() => window.open(f.anexo, "_blank")} />}
      </div>

      {avisoDuplicata && (
        <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#C98A3A", background: "#C98A3A1A", padding: "10px 12px", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} /> Já existe um lançamento parecido nessa data, com a mesma descrição e valor. Duplicado sem querer?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Botao variante="fantasma" onClick={() => setAvisoDuplicata(false)} style={{ padding: "6px 10px" }}>Revisar</Botao>
            <Botao variante="secundario" onClick={salvarMesmoAssim} style={{ padding: "6px 10px" }}>Salvar mesmo assim</Botao>
          </div>
        </div>
      )}

      {erroForm && (
        <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: VERMELHO, background: "#B4552F1A", padding: "8px 10px", borderRadius: 8 }}>
          <AlertTriangle size={14} /> {erroForm}
        </div>
      )}

      <div className="span-2" style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
        <Botao variante="fantasma" onClick={() => { if (f.descricao) adicionarFavorito(f); }} title="Salvar como favorito">
          <Star size={14} /> Salvar como favorito
        </Botao>
        <div style={{ display: "flex", gap: 8 }}>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit"><Plus size={15} /> Salvar</Botao>
        </div>
      </div>

      {simuladorAberto && (
        <SimuladorParcelamento
          valorTotal={parseFloat(String(f.valorTotalParcelamento).replace(",", "."))}
          qtdParcelas={parseInt(f.qtdParcelas, 10)}
          dataInicial={f.data}
          onFechar={() => setSimuladorAberto(false)}
        />
      )}
    </form>
  );
}

function SimuladorParcelamento({ valorTotal, qtdParcelas, dataInicial, onFechar }) {
  const { lancamentos, pal } = useApp();
  if (!valorTotal || !qtdParcelas) return null;
  const valorParcela = valorTotal / qtdParcelas;

  const meses = useMemo(() => {
    const arr = [];
    for (let i = 0; i < qtdParcelas; i++) {
      const mesRef = addMeses(dataInicial, i).slice(0, 7);
      const jaComprometido = lancamentos.filter((l) => l.tipo === "despesa" && l.data.slice(0, 7) === mesRef).reduce((s, l) => s + l.valor, 0);
      arr.push({ mes: mesLabel(mesRef), jaComprometido, estaParcela: valorParcela });
    }
    return arr;
  }, [lancamentos, dataInicial, qtdParcelas, valorParcela]);

  return (
    <Modal titulo="Simulação de impacto" onFechar={onFechar} largura={480}>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 14 }}>
        Cada parcela de <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(valorParcela)}</strong> somada ao que você já tem comprometido em despesas naquele mês (incluindo outras parcelas e recorrentes já lançadas):
      </div>
      <ResponsiveContainer width="100%" height={Math.max(160, meses.length * 34)}>
        <BarChart data={meses} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="mes" width={60} tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => formatarMoeda(v)} />
          <Bar dataKey="jaComprometido" stackId="a" fill={pal.borda} radius={[0, 0, 0, 0]} barSize={16} />
          <Bar dataKey="estaParcela" stackId="a" fill="#C98A3A" radius={[0, 6, 6, 0]} barSize={16} name="Essa parcela" />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: pal.textoSuave, marginTop: 8 }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: pal.borda, marginRight: 4 }} />Já comprometido</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#C98A3A", marginRight: 4 }} />Essa parcela nova</span>
      </div>
    </Modal>
  );
}

/* ============================================================
   9. LANÇAMENTOS (lista, busca, filtros, editar)
   ============================================================ */
function PainelLancamentos() {
  const {
    lancamentos, contas, cartoes, mesSelecionado, mesesDisponiveis, setMesSelecionado,
    adicionarLancamento, editarLancamento, editarLancamentoGrupo, excluirLancamento, importarLancamentos,
    excluirLancamentosEmLote, editarLancamentosEmLote, pal, cor, mostrarToast,
    categoriasDespesa, categoriasReceita,
  } = useApp();

  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState({ status: "", contaId: "", categoria: "", escopo: "", valorMin: "", valorMax: "" });
  const [ordenacao, setOrdenacao] = useState("data_desc");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [duplicando, setDuplicando] = useState(null);
  const [excluirId, setExcluirId] = useState(null);
  const [formSujo, setFormSujo] = useState(false);
  const [confirmandoFechar, setConfirmandoFechar] = useState(false);
  const [importState, setImportState] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [categoriaLote, setCategoriaLote] = useState("");
  const buscaRef = useRef(null);
  const inputCSVRef = useRef(null);
  const inputOFXRef = useRef(null);

  useEffect(() => { setSelecionados(new Set()); }, [mesSelecionado]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "n" && !modalAberto && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") setModalAberto(true);
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); buscaRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalAberto]);

  const filtrados = useMemo(() => {
    const lista = lancamentos
      .filter((l) => l.data.slice(0, 7) === mesSelecionado)
      .filter((l) => {
        if (busca) {
          const alvo = `${l.descricao} ${l.pessoa} ${l.categoria} ${contas.find((c) => c.id === l.contaId)?.nome || ""} ${l.valor} ${l.status}`.toLowerCase();
          if (!alvo.includes(busca.toLowerCase())) return false;
        }
        if (filtros.status && l.status !== filtros.status) return false;
        if (filtros.contaId && l.contaId !== filtros.contaId) return false;
        if (filtros.categoria && l.categoria !== filtros.categoria) return false;
        if (filtros.escopo && (l.escopo || "pessoal") !== filtros.escopo) return false;
        if (filtros.valorMin && l.valor < parseFloat(filtros.valorMin)) return false;
        if (filtros.valorMax && l.valor > parseFloat(filtros.valorMax)) return false;
        return true;
      });
    const comparadores = {
      data_desc: (a, b) => (a.data < b.data ? 1 : -1),
      data_asc: (a, b) => (a.data > b.data ? 1 : -1),
      valor_desc: (a, b) => b.valor - a.valor,
      valor_asc: (a, b) => a.valor - b.valor,
    };
    return lista.sort(comparadores[ordenacao]);
  }, [lancamentos, mesSelecionado, busca, filtros, contas, ordenacao]);

  const salvar = (f, valorNum) => {
    if (editando) {
      const camposAtualizados = { ...f, valor: valorNum ?? parseFloat(String(f.valor).replace(",", ".")) };
      delete camposAtualizados.aplicarGrupo;
      if (f.aplicarGrupo && editando.parcelaInfo?.grupo) {
        editarLancamentoGrupo(editando.parcelaInfo.grupo, editando.data, {
          categoria: f.categoria, descricao: f.descricao.trim(), contaId: f.contaId,
        });
      }
      editarLancamento(editando.id, camposAtualizados);
    } else {
      adicionarLancamento(f, valorNum);
    }
    fecharModal();
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setDuplicando(null);
    setFormSujo(false);
    setConfirmandoFechar(false);
  };

  const pedirFechar = () => {
    if (formSujo) setConfirmandoFechar(true);
    else fecharModal();
  };

  const duplicar = (l) => {
    const preset = { ...l, data: hojeISO(), status: l.tipo === "despesa" ? "A pagar" : "Pago", parcelaInfo: null, anexo: null };
    delete preset.id;
    setEditando(null);
    setDuplicando(preset);
    setFormSujo(false);
    setModalAberto(true);
  };

  // ---------- Seleção múltipla ----------
  const alternarSelecao = (id) => {
    setSelecionados((old) => {
      const novo = new Set(old);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };
  const selecionarTodosVisiveis = () => {
    setSelecionados((old) => (old.size === filtrados.length ? new Set() : new Set(filtrados.map((l) => l.id))));
  };

  // ---------- Importação CSV (planilha original) ----------
  const aoSelecionarCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    let texto;
    try { texto = new TextDecoder("iso-8859-1").decode(buffer); } catch { texto = new TextDecoder("utf-8").decode(buffer); }
    const { mes, itens, salario } = parseCSVTexto(texto);
    const itensFinal = itens.map((it) => ({ ...it, tipo: "despesa" }));
    if (salario) itensFinal.push({ descricao: "Renda do mês", valor: salario, tipo: "receita", categoria: "Salário", pessoa: "", status: "Pago", observacoes: "", incluir: true });
    if (itensFinal.length === 0) {
      mostrarToast("Não consegui reconhecer lançamentos nesse arquivo.");
      e.target.value = ""; return;
    }
    setImportState({ nomeArquivo: file.name, formato: "csv", mes: mes || new Date().getMonth() + 1, ano: new Date().getFullYear(), itens: itensFinal });
    e.target.value = "";
  };

  // ---------- Importação OFX (extrato bancário) ----------
  const aoSelecionarOFX = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const texto = await file.text();
    const itens = parseOFXTexto(texto);
    if (itens.length === 0) {
      mostrarToast("Não consegui reconhecer transações nesse arquivo OFX.");
      e.target.value = ""; return;
    }
    setImportState({ nomeArquivo: file.name, formato: "ofx", itens });
    e.target.value = "";
  };

  const atualizarItemImport = (idx, campo, valor) => {
    setImportState((st) => {
      const itens = [...st.itens];
      itens[idx] = { ...itens[idx], [campo]: valor };
      return { ...st, itens };
    });
  };

  const confirmarImportacao = () => {
    if (!importState) return;
    const novos = importState.itens
      .filter((it) => it.incluir)
      .map((it) => ({
        id: genId("imp"),
        data: it.data || `${importState.ano}-${String(importState.mes).padStart(2, "0")}-01`,
        tipo: it.tipo || "despesa", categoria: it.categoria || "Outros", descricao: it.descricao,
        pessoa: it.pessoa || "", status: it.status || "-", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: null,
        valor: it.valor, escopo: "pessoal", observacoes: it.observacoes || "", anexo: null,
        parcelaInfo: null, recorrenteId: null,
      }));
    importarLancamentos(novos);
    if (novos[0]) setMesSelecionado(novos[0].data.slice(0, 7));
    setImportState(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <NavegadorMes compacto />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={inputCSVRef} type="file" accept=".csv" onChange={aoSelecionarCSV} style={{ display: "none" }} />
          <input ref={inputOFXRef} type="file" accept=".ofx" onChange={aoSelecionarOFX} style={{ display: "none" }} />
          <Botao variante="secundario" onClick={() => inputCSVRef.current?.click()}><Upload size={14} /> Planilha (.csv)</Botao>
          <Botao variante="secundario" onClick={() => inputOFXRef.current?.click()}><Upload size={14} /> Extrato (.ofx)</Botao>
          <Botao onClick={() => { setEditando(null); setDuplicando(null); setFormSujo(false); setModalAberto(true); }}><Plus size={15} /> Novo lançamento</Botao>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: pal.textoSuave }} />
          <input ref={buscaRef} type="text" placeholder="Buscar (nome, descrição, categoria...) — atalho: /" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...estiloInput(pal), width: "100%", paddingLeft: 30 }} />
        </div>
        <select value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })} style={estiloInput(pal)}>
          <option value="">Status: todos</option><option value="Pago">Pago</option><option value="A pagar">A pagar</option>
        </select>
        <select value={filtros.contaId} onChange={(e) => setFiltros({ ...filtros, contaId: e.target.value })} style={estiloInput(pal)}>
          <option value="">Conta: todas</option>
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })} style={estiloInput(pal)}>
          <option value="">Categoria: todas</option>
          {[...categoriasDespesa, ...categoriasReceita].map((c) => c.nome).filter((v, i, a) => a.indexOf(v) === i).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filtros.escopo} onChange={(e) => setFiltros({ ...filtros, escopo: e.target.value })} style={estiloInput(pal)}>
          <option value="">Escopo: todos</option><option value="pessoal">Pessoal</option><option value="negocio">Negócio</option>
        </select>
        <input type="number" placeholder="Valor mín." value={filtros.valorMin} onChange={(e) => setFiltros({ ...filtros, valorMin: e.target.value })} style={{ ...estiloInput(pal), width: 100 }} />
        <input type="number" placeholder="Valor máx." value={filtros.valorMax} onChange={(e) => setFiltros({ ...filtros, valorMax: e.target.value })} style={{ ...estiloInput(pal), width: 100 }} />
        <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} style={estiloInput(pal)}>
          <option value="data_desc">Mais recentes primeiro</option>
          <option value="data_asc">Mais antigos primeiro</option>
          <option value="valor_desc">Maior valor primeiro</option>
          <option value="valor_asc">Menor valor primeiro</option>
        </select>
      </div>

      {selecionados.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: `${cor}14`, border: `1px solid ${cor}55`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: pal.texto, fontWeight: 500 }}>{selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}</span>
          <Botao variante="secundario" style={{ padding: "6px 10px" }} onClick={() => editarLancamentosEmLote([...selecionados], { status: "Pago" })}>Marcar Pago</Botao>
          <Botao variante="secundario" style={{ padding: "6px 10px" }} onClick={() => editarLancamentosEmLote([...selecionados], { status: "A pagar" })}>Marcar A pagar</Botao>
          <select value={categoriaLote} onChange={(e) => setCategoriaLote(e.target.value)} style={{ ...estiloInput(pal), padding: "6px 8px", fontSize: 12.5 }}>
            <option value="">Mudar categoria para...</option>
            {categoriasDespesa.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
          </select>
          {categoriaLote && (
            <Botao variante="secundario" style={{ padding: "6px 10px" }} onClick={() => { editarLancamentosEmLote([...selecionados], { categoria: categoriaLote }); setCategoriaLote(""); }}>Aplicar</Botao>
          )}
          <Botao variante="perigo" style={{ padding: "6px 10px" }} onClick={() => setConfirmandoLote(true)}><Trash2 size={13} /> Excluir</Botao>
          <button onClick={() => setSelecionados(new Set())} style={{ marginLeft: "auto", border: "none", background: "none", color: pal.textoSuave, cursor: "pointer" }}><X size={15} /></button>
        </div>
      )}

      <Cartao style={{ overflow: "hidden" }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: pal.textoSuave }}>Nenhum lançamento encontrado com esses filtros.</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: `1px solid ${pal.bordaSuave}` }}>
              <input type="checkbox" checked={selecionados.size === filtrados.length} onChange={selecionarTodosVisiveis} />
              <span style={{ fontSize: 11.5, color: pal.textoSuave }}>Selecionar todos ({filtrados.length})</span>
            </div>
            {filtrados.map((l, i) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
                <input type="checkbox" checked={selecionados.has(l.id)} onChange={() => alternarSelecao(l.id)} style={{ flexShrink: 0 }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: corCategoria(l.categoria, l.tipo === "receita" ? categoriasReceita : categoriasDespesa), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: pal.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.descricao} {l.parcelaInfo && <span style={{ fontSize: 11, color: pal.textoSuave }}>({l.parcelaInfo.atual}/{l.parcelaInfo.total})</span>}
                  </div>
                  <div style={{ fontSize: 12, color: pal.textoSuave }}>
                    {l.categoria} · {new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")} · {contas.find((c) => c.id === l.contaId)?.nome || "—"}{l.pessoa ? ` · ${l.pessoa}` : ""}
                  </div>
                </div>
                {l.anexo && <Paperclip size={13} color={pal.textoSuave} style={{ cursor: "pointer" }} onClick={() => window.open(l.anexo, "_blank")} />}
                {l.escopo === "negocio" && <span className="badge" style={{ background: "#2F5D8A22", color: "#2F5D8A" }}>Negócio</span>}
                {l.status && l.status !== "-" && (
                  <span className="badge" style={{ background: l.status === "Pago" ? "#3E6F5C22" : "#C98A3A22", color: l.status === "Pago" ? VERDE : "#C98A3A" }}>{rotuloStatus(l.status, l.tipo)}</span>
                )}
                <div className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: l.tipo === "receita" ? VERDE : pal.texto, width: 92, textAlign: "right" }}>
                  {l.tipo === "receita" ? "+" : ""}{formatarMoeda(l.valor)}
                </div>
                <button onClick={() => duplicar(l)} title="Duplicar" style={{ border: "none", background: "transparent", color: pal.textoSuave, cursor: "pointer", padding: 5 }}><Copy size={14} /></button>
                <button onClick={() => { setEditando(l); setDuplicando(null); setFormSujo(false); setModalAberto(true); }} style={{ border: "none", background: "transparent", color: cor, cursor: "pointer", padding: 5 }}><Pencil size={14} /></button>
                <button onClick={() => setExcluirId(l.id)} style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer", padding: 5 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </>
        )}
      </Cartao>

      {importState && (
        <Modal titulo={`Importar "${importState.nomeArquivo}"`} onFechar={() => setImportState(null)} largura={560}>
          {importState.formato === "csv" && (
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <Campo label="Mês">
                <select value={importState.mes} onChange={(e) => setImportState({ ...importState, mes: parseInt(e.target.value, 10) })} style={estiloInput(pal)}>
                  {MESES_PT.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
                </select>
              </Campo>
              <Campo label="Ano">
                <input type="number" value={importState.ano} onChange={(e) => setImportState({ ...importState, ano: parseInt(e.target.value, 10) })} style={{ ...estiloInput(pal), width: 90 }} />
              </Campo>
            </div>
          )}
          <div style={{ fontSize: 12, color: pal.textoSuave, marginBottom: 8 }}>
            {importState.itens.filter((i) => i.incluir).length} de {importState.itens.length} lançamentos serão importados.
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${pal.bordaSuave}`, borderRadius: 8 }}>
            {importState.itens.map((it, idx) => {
              const dataDoItem = it.data || `${importState.ano}-${String(importState.mes).padStart(2, "0")}`;
              const possivelDuplicata = lancamentos.some((l) =>
                l.tipo === (it.tipo || "despesa") && Math.abs(l.valor - it.valor) < 0.01 &&
                l.descricao.trim().toLowerCase() === it.descricao.trim().toLowerCase() &&
                (it.data ? l.data === it.data : l.data.slice(0, 7) === dataDoItem)
              );
              return (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: idx === 0 ? "none" : `1px solid ${pal.bordaSuave}`, opacity: it.incluir ? 1 : 0.4 }}>
                  <input type="checkbox" checked={it.incluir} onChange={(e) => atualizarItemImport(idx, "incluir", e.target.checked)} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: pal.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.descricao}</div>
                    <div style={{ fontSize: 11, color: pal.textoSuave }}>
                      {it.tipo === "receita" ? "Receita" : "Despesa"}{it.data ? ` · ${new Date(it.data + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}{it.pessoa ? ` · ${it.pessoa}` : ""}
                    </div>
                    {possivelDuplicata && <div style={{ fontSize: 10.5, color: "#C98A3A", marginTop: 2 }}>⚠ possível duplicata — já existe algo parecido</div>}
                  </div>
                  <select value={it.categoria} onChange={(e) => atualizarItemImport(idx, "categoria", e.target.value)} style={{ fontSize: 12, padding: "5px 6px", borderRadius: 6, border: `1px solid ${pal.borda}`, flexShrink: 0 }}>
                    {todasCategorias(it.tipo, categoriasDespesa, categoriasReceita).map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
                  </select>
                  <div className="num-tab" style={{ fontSize: 13, fontWeight: 600, width: 80, textAlign: "right", flexShrink: 0, color: it.tipo === "receita" ? VERDE : pal.texto }}>{formatarMoeda(it.valor)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <Botao variante="fantasma" onClick={() => setImportState(null)}>Cancelar</Botao>
            <Botao onClick={confirmarImportacao}><Check size={15} /> Confirmar importação</Botao>
          </div>
        </Modal>
      )}

      {modalAberto && (
        <Modal titulo={editando ? "Editar lançamento" : duplicando ? "Duplicar lançamento" : "Novo lançamento"} onFechar={pedirFechar} largura={560}>
          <FormularioLancamento inicial={editando || duplicando} modoDuplicar={!!duplicando} onSalvar={salvar} onFechar={pedirFechar} onSujoChange={setFormSujo} />
        </Modal>
      )}
      {confirmandoFechar && (
        <Confirmacao msg="Você tem alterações não salvas nesse lançamento. Quer mesmo sair sem salvar?" onCancelar={() => setConfirmandoFechar(false)} onConfirmar={fecharModal} />
      )}
      {excluirId && (
        <Confirmacao msg="Excluir este lançamento? Essa ação não pode ser desfeita." onCancelar={() => setExcluirId(null)} onConfirmar={() => { excluirLancamento(excluirId); setExcluirId(null); }} />
      )}
      {confirmandoLote && (
        <Confirmacao
          msg={`Excluir ${selecionados.size} lançamento(s) selecionado(s)? Você pode desfazer logo em seguida.`}
          onCancelar={() => setConfirmandoLote(false)}
          onConfirmar={() => { excluirLancamentosEmLote([...selecionados]); setSelecionados(new Set()); setConfirmandoLote(false); }}
        />
      )}
    </div>
  );
}

/* ============================================================
   10. CALENDÁRIO
   ============================================================ */
function PainelCalendario() {
  const { lancamentos, mesSelecionado, pal, cor } = useApp();
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [ano, mes] = mesSelecionado.split("-").map(Number);
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDias = diasNoMes(mesSelecionado);

  const porDia = useMemo(() => {
    const mapa = {};
    lancamentos.filter((l) => l.data.slice(0, 7) === mesSelecionado && l.tipo === "despesa").forEach((l) => {
      const dia = parseInt(l.data.slice(8, 10), 10);
      if (!mapa[dia]) mapa[dia] = { total: 0, qtd: 0 };
      mapa[dia].total += l.valor; mapa[dia].qtd += 1;
    });
    return mapa;
  }, [lancamentos, mesSelecionado]);

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);

  const lancamentosDoDia = diaSelecionado ? lancamentos.filter((l) => l.data === `${mesSelecionado}-${String(diaSelecionado).padStart(2, "0")}`) : [];

  const totalMesCalendario = Object.values(porDia).reduce((s, d) => s + d.total, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11.5, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em" }}>Total gasto no mês</div>
          <div className="num-tab" style={{ fontSize: 22, fontWeight: 600, color: pal.texto }}>{formatarMoeda(totalMesCalendario)}</div>
        </div>
        <NavegadorMes />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 20 }}>
        {DIAS_SEMANA.map((d) => <div key={d} style={{ fontSize: 11, color: pal.textoSuave, textAlign: "center", textTransform: "uppercase" }}>{d}</div>)}
        {celulas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const info = porDia[d];
          const ehHoje = `${mesSelecionado}-${String(d).padStart(2, "0")}` === hojeISO();
          return (
            <div key={i} onClick={() => info && setDiaSelecionado(d)}
              style={{
                aspectRatio: "1", borderRadius: 8, border: `1px solid ${ehHoje ? cor : pal.borda}`, padding: 6,
                cursor: info ? "pointer" : "default", background: ehHoje ? `${cor}14` : pal.cartao, display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}>
              <div style={{
                fontSize: 11, color: ehHoje ? "#fff" : pal.textoSuave, fontWeight: ehHoje ? 700 : 400,
                background: ehHoje ? cor : "transparent", borderRadius: "50%", width: 18, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{d}</div>
              {info && (
                <div>
                  <div className="num-tab" style={{ fontSize: 10.5, color: VERMELHO, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatarMoeda(info.total)}</div>
                  <div style={{ fontSize: 9.5, color: pal.textoSuave }}>{info.qtd} lanç.</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {diaSelecionado && (
        <Modal titulo={`Gastos de ${diaSelecionado}/${MESES_ABREV[mes - 1]}`} onFechar={() => setDiaSelecionado(null)}>
          {lancamentosDoDia.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${pal.bordaSuave}` }}>
              <div style={{ fontSize: 13.5, color: pal.texto }}>{l.descricao}</div>
              <div className="num-tab" style={{ fontSize: 13.5, fontWeight: 600, color: l.tipo === "receita" ? VERDE : pal.texto }}>{formatarMoeda(l.valor)}</div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   11. CONTAS
   ============================================================ */
function PainelContas() {
  const { contas, lancamentos, adicionarConta, editarConta, excluirConta, definirContaPadrao, arquivarConta, adicionarTransferencia, ajustarSaldoConta, pal, cor } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState({ nome: "", tipo: "conta", saldoInicial: "", cor: "#1B2A4A", saldoMinimo: "", padrao: false });
  const [excluirId, setExcluirId] = useState(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [extratoAberto, setExtratoAberto] = useState(null);
  const [transferenciaAberta, setTransferenciaAberta] = useState(false);
  const [conferenciaAberta, setConferenciaAberta] = useState(null);

  const saldoConta = (contaId, saldoInicial) => {
    const dela = lancamentos.filter((l) => l.contaId === contaId);
    const receitas = dela.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
    const despesas = dela.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
    const transfSaida = dela.filter((l) => l.tipo === "transferencia" && l.direcao === "saida").reduce((s, l) => s + l.valor, 0);
    const transfEntrada = dela.filter((l) => l.tipo === "transferencia" && l.direcao === "entrada").reduce((s, l) => s + l.valor, 0);
    return (saldoInicial || 0) + receitas - despesas - transfSaida + transfEntrada;
  };

  const qtdLancamentosVinculados = (contaId) => lancamentos.filter((l) => l.contaId === contaId).length;

  const abrirNovo = () => { setEditando(null); setNovo({ nome: "", tipo: "conta", saldoInicial: "", cor: "#1B2A4A", saldoMinimo: "", padrao: contas.length === 0 }); setModalAberto(true); };
  const abrirEdicao = (c) => { setEditando(c); setNovo({ nome: c.nome, tipo: c.tipo, saldoInicial: String(c.saldoInicial ?? ""), cor: c.cor, saldoMinimo: String(c.saldoMinimo ?? ""), padrao: !!c.padrao }); setModalAberto(true); };

  const submeter = (e) => {
    e.preventDefault();
    if (!novo.nome.trim()) return;
    const dados = { ...novo, saldoInicial: parseFloat(novo.saldoInicial) || 0, saldoMinimo: novo.saldoMinimo ? parseFloat(novo.saldoMinimo) : null };
    if (editando) {
      editarConta(editando.id, dados);
      if (novo.padrao) definirContaPadrao(editando.id);
    } else {
      adicionarConta(dados);
    }
    setModalAberto(false);
    setEditando(null);
  };

  const contasVisiveis = contas.filter((c) => mostrarArquivadas || !c.arquivada);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>Suas contas</div>
        <div style={{ display: "flex", gap: 8 }}>
          {contas.length >= 2 && <Botao variante="secundario" onClick={() => setTransferenciaAberta(true)}>Transferir entre contas</Botao>}
          <Botao onClick={abrirNovo}><Plus size={15} /> Nova conta</Botao>
        </div>
      </div>
      {contas.some((c) => c.arquivada) && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: pal.textoSuave, cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={mostrarArquivadas} onChange={(e) => setMostrarArquivadas(e.target.checked)} /> Mostrar contas arquivadas
        </label>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
        {contasVisiveis.map((c) => {
          const saldo = saldoConta(c.id, c.saldoInicial);
          const saldoBaixo = c.saldoMinimo != null && saldo < c.saldoMinimo;
          return (
            <Cartao key={c.id} style={{ padding: 16, opacity: c.arquivada ? 0.55 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.cor }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: pal.texto }}>{c.nome}</div>
                  {c.padrao && <span className="badge" style={{ background: `${cor}22`, color: cor }}>Padrão</span>}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => abrirEdicao(c)} title="Editar" style={{ border: "none", background: "transparent", color: cor, cursor: "pointer" }}><Pencil size={13} /></button>
                  <button onClick={() => setExcluirId(c.id)} title="Excluir" style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer" }}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: pal.textoSuave, textTransform: "capitalize", marginBottom: 8 }}>{c.tipo}</div>
              <div className="num-tab" style={{ fontSize: 19, fontWeight: 600, color: saldo >= 0 ? VERDE : VERMELHO }}>
                {formatarMoeda(saldo)}
              </div>
              {saldoBaixo && <div style={{ fontSize: 11, color: VERMELHO, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> abaixo do mínimo ({formatarMoeda(c.saldoMinimo)})</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <Botao variante="fantasma" style={{ padding: "5px 8px", fontSize: 11.5 }} onClick={() => setExtratoAberto(c)}>Ver extrato</Botao>
                <Botao variante="fantasma" style={{ padding: "5px 8px", fontSize: 11.5 }} onClick={() => setConferenciaAberta(c)}>Conferir saldo</Botao>
                {!c.padrao && <Botao variante="fantasma" style={{ padding: "5px 8px", fontSize: 11.5 }} onClick={() => definirContaPadrao(c.id)}>Tornar padrão</Botao>}
                <Botao variante="fantasma" style={{ padding: "5px 8px", fontSize: 11.5 }} onClick={() => arquivarConta(c.id, !c.arquivada)}>{c.arquivada ? "Desarquivar" : "Arquivar"}</Botao>
              </div>
            </Cartao>
          );
        })}
      </div>
      {modalAberto && (
        <Modal titulo={editando ? "Editar conta" : "Nova conta"} onFechar={() => { setModalAberto(false); setEditando(null); }}>
          <form onSubmit={submeter} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Campo label="Nome"><input type="text" placeholder="Ex.: Nubank, Dinheiro, PIX..." value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={estiloInput(pal)} /></Campo>
            <Campo label="Tipo">
              <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })} style={estiloInput(pal)}>
                <option value="conta">Conta bancária</option><option value="dinheiro">Dinheiro</option><option value="carteira">Carteira digital</option>
              </select>
            </Campo>
            <Campo label="Saldo inicial (R$)"><input type="text" inputMode="decimal" value={novo.saldoInicial} onChange={(e) => setNovo({ ...novo, saldoInicial: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
            <Campo label="Alertar se o saldo cair abaixo de (R$, opcional)"><input type="text" inputMode="decimal" value={novo.saldoMinimo} onChange={(e) => setNovo({ ...novo, saldoMinimo: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
            <Campo label="Cor"><input type="color" value={novo.cor} onChange={(e) => setNovo({ ...novo, cor: e.target.value })} style={{ width: 60, height: 32, border: "none", background: "none" }} /></Campo>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: pal.texto }}>
              <input type="checkbox" checked={novo.padrao} onChange={(e) => setNovo({ ...novo, padrao: e.target.checked })} /> Usar como conta padrão nos formulários
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => { setModalAberto(false); setEditando(null); }}>Cancelar</Botao>
              <Botao type="submit">Salvar</Botao>
            </div>
          </form>
        </Modal>
      )}
      {excluirId && (
        <Confirmacao
          msg={qtdLancamentosVinculados(excluirId) > 0
            ? `Essa conta tem ${qtdLancamentosVinculados(excluirId)} lançamento(s) vinculado(s). Eles não serão apagados, só ficarão marcados como "Sem conta". Continuar?`
            : "Excluir esta conta?"}
          onCancelar={() => setExcluirId(null)}
          onConfirmar={() => { excluirConta(excluirId); setExcluirId(null); }}
        />
      )}
      {extratoAberto && <ExtratoConta conta={extratoAberto} onFechar={() => setExtratoAberto(null)} />}
      {transferenciaAberta && <ModalTransferencia contas={contas.filter((c) => !c.arquivada)} onFechar={() => setTransferenciaAberta(false)} onConfirmar={adicionarTransferencia} />}
      {conferenciaAberta && (
        <ModalConferenciaSaldo
          conta={conferenciaAberta}
          saldoCalculado={saldoConta(conferenciaAberta.id, conferenciaAberta.saldoInicial)}
          onFechar={() => setConferenciaAberta(null)}
          onAjustar={ajustarSaldoConta}
        />
      )}
    </div>
  );
}

function ExtratoConta({ conta, onFechar }) {
  const { lancamentos, pal } = useApp();
  const movimentos = useMemo(() => {
    const dela = lancamentos.filter((l) => l.contaId === conta.id).sort((a, b) => (a.data < b.data ? -1 : 1));
    let saldo = conta.saldoInicial || 0;
    return dela.map((l) => {
      const entrada = l.tipo === "receita" || (l.tipo === "transferencia" && l.direcao === "entrada");
      saldo += entrada ? l.valor : -l.valor;
      return { ...l, saldoAposMovimento: saldo, entrada };
    });
  }, [lancamentos, conta]);

  const evolucaoMensal = useMemo(() => {
    const porMes = {};
    movimentos.forEach((m) => { porMes[m.data.slice(0, 7)] = m.saldoAposMovimento; });
    const meses = Object.keys(porMes).sort().slice(-6);
    let ultimoSaldoConhecido = conta.saldoInicial || 0;
    return meses.map((m) => {
      ultimoSaldoConhecido = porMes[m];
      return { mes: mesLabel(m), saldo: ultimoSaldoConhecido };
    });
  }, [movimentos, conta]);

  const movimentosDesc = [...movimentos].reverse();

  return (
    <Modal titulo={`Extrato — ${conta.nome}`} onFechar={onFechar} largura={520}>
      {evolucaoMensal.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 6 }}>Evolução do saldo</div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={evolucaoMensal}>
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v) => formatarMoeda(v)} />
              <Line type="monotone" dataKey="saldo" stroke={conta.cor || "#1B2A4A"} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {movimentosDesc.length === 0 ? (
        <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum lançamento nessa conta ainda.</div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {movimentosDesc.map((m, i) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: pal.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.descricao}{m.tipo === "transferencia" && (m.direcao === "saida" ? " (saída p/ transferência)" : " (entrada de transferência)")}
                </div>
                <div style={{ fontSize: 11, color: pal.textoSuave }}>{new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div className="num-tab" style={{ fontSize: 13, fontWeight: 600, color: m.entrada ? VERDE : VERMELHO }}>{m.entrada ? "+" : "-"}{formatarMoeda(m.valor)}</div>
                <div className="num-tab" style={{ fontSize: 10.5, color: pal.textoSuave }}>saldo: {formatarMoeda(m.saldoAposMovimento)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ModalTransferencia({ contas, onFechar, onConfirmar }) {
  const { pal } = useApp();
  const [origemId, setOrigemId] = useState((contas.find((c) => c.padrao) || contas[0])?.id || "");
  const [destinoId, setDestinoId] = useState(contas[1]?.id || "");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");

  const confirmar = (e) => {
    e.preventDefault();
    const v = parseFloat(String(valor).replace(",", "."));
    if (!origemId || !destinoId) { setErro("Escolha as duas contas."); return; }
    if (origemId === destinoId) { setErro("Escolha contas diferentes."); return; }
    if (!v || v <= 0) { setErro("Preencha um valor válido."); return; }
    onConfirmar(origemId, destinoId, v, data, descricao);
    onFechar();
  };

  return (
    <Modal titulo="Transferir entre contas" onFechar={onFechar} largura={420}>
      <form onSubmit={confirmar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Campo label="De (conta de origem)">
          <select value={origemId} onChange={(e) => setOrigemId(e.target.value)} style={estiloInput(pal)}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Para (conta de destino)">
          <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} style={estiloInput(pal)}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Valor (R$)"><input type="text" inputMode="decimal" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} className="num-tab" style={estiloInput(pal)} /></Campo>
        <Campo label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} style={estiloInput(pal)} /></Campo>
        <Campo label="Descrição (opcional)"><input type="text" placeholder="Transferência entre contas" value={descricao} onChange={(e) => setDescricao(e.target.value)} style={estiloInput(pal)} /></Campo>
        {erro && <div style={{ fontSize: 12, color: VERMELHO }}>{erro}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit">Transferir</Botao>
        </div>
      </form>
    </Modal>
  );
}

function ModalConferenciaSaldo({ conta, saldoCalculado, onFechar, onAjustar }) {
  const { pal } = useApp();
  const [saldoReal, setSaldoReal] = useState("");
  const v = parseFloat(String(saldoReal).replace(",", "."));
  const diferenca = !isNaN(v) ? Math.round((v - saldoCalculado) * 100) / 100 : null;

  return (
    <Modal titulo={`Conferir saldo — ${conta.nome}`} onFechar={onFechar} largura={400}>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 12 }}>
        Segundo os lançamentos, o saldo dessa conta hoje é <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(saldoCalculado)}</strong>. Digite o saldo real do banco pra comparar.
      </div>
      <Campo label="Saldo real (extrato do banco)"><input type="text" inputMode="decimal" autoFocus value={saldoReal} onChange={(e) => setSaldoReal(e.target.value)} className="num-tab" style={estiloInput(pal)} /></Campo>
      {diferenca !== null && (
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: diferenca === 0 ? "#3E6F5C1A" : "#C98A3A1A", fontSize: 13 }}>
          {diferenca === 0 ? (
            <span style={{ color: VERDE }}>✓ Está batendo certinho!</span>
          ) : (
            <span style={{ color: pal.texto }}>
              Diferença de <strong className="num-tab">{formatarMoeda(Math.abs(diferenca))}</strong> {diferenca > 0 ? "a mais" : "a menos"} no banco em relação ao app.
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
        {diferenca !== null && diferenca !== 0 && (
          <Botao onClick={() => { onAjustar(conta.id, diferenca, hojeISO()); onFechar(); }}>Criar lançamento de ajuste</Botao>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================
   12. CARTÕES
   ============================================================ */
function PainelCartoes() {
  const { cartoes, lancamentos, mesSelecionado, adicionarCartao, editarCartao, excluirCartao, pal, cor } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState({ nome: "", limite: "", fechamento: "", vencimento: "", cor: "#8A3E5C" });
  const [excluirId, setExcluirId] = useState(null);
  const [faturaAberta, setFaturaAberta] = useState(null);

  const usoCartao = (cartao) => {
    const ciclo = cicloFatura(cartao, mesSelecionado);
    if (ciclo) {
      return lancamentos.filter((l) => l.cartaoId === cartao.id && l.tipo === "despesa" && l.data >= ciclo.inicio && l.data <= ciclo.fim).reduce((s, l) => s + l.valor, 0);
    }
    return lancamentos.filter((l) => l.cartaoId === cartao.id && l.data.slice(0, 7) === mesSelecionado && l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
  };
  const qtdLancamentosVinculados = (cartaoId) => lancamentos.filter((l) => l.cartaoId === cartaoId).length;

  const abrirNovo = () => { setEditando(null); setNovo({ nome: "", limite: "", fechamento: "", vencimento: "", cor: "#8A3E5C" }); setModalAberto(true); };
  const abrirEdicao = (c) => { setEditando(c); setNovo({ nome: c.nome, limite: String(c.limite ?? ""), fechamento: String(c.fechamento ?? ""), vencimento: String(c.vencimento ?? ""), cor: c.cor }); setModalAberto(true); };

  const submeter = (e) => {
    e.preventDefault();
    if (!novo.nome.trim() || !novo.limite) return;
    const dados = { ...novo, limite: parseFloat(novo.limite) || 0 };
    if (editando) editarCartao(editando.id, dados);
    else adicionarCartao(dados);
    setModalAberto(false);
    setEditando(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>Seus cartões</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <NavegadorMes compacto />
          <Botao onClick={abrirNovo}><Plus size={15} /> Novo cartão</Botao>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
        {cartoes.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum cartão cadastrado ainda.</div>}
        {cartoes.map((c) => {
          const usado = usoCartao(c);
          const pct = c.limite > 0 ? Math.min(100, (usado / c.limite) * 100) : 0;
          const ciclo = cicloFatura(c, mesSelecionado);
          return (
            <Cartao key={c.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: pal.texto }}>{c.nome}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => abrirEdicao(c)} style={{ border: "none", background: "transparent", color: cor, cursor: "pointer" }}><Pencil size={13} /></button>
                  <button onClick={() => setExcluirId(c.id)} style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer" }}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: pal.textoSuave, marginBottom: 10 }}>Fecha dia {c.fechamento || "—"} · Vence dia {c.vencimento || "—"}</div>
              <Progresso valor={usado} max={c.limite} corBase={c.cor} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11.5 }}>
                <span className="num-tab" style={{ color: pal.textoSuave }}>{formatarMoeda(usado)} usado</span>
                <span className="num-tab" style={{ color: pal.textoSuave }}>{formatarMoeda(Math.max(0, c.limite - usado))} livre</span>
              </div>
              <div style={{ fontSize: 11, color: pct >= 90 ? VERMELHO : pal.textoSuave, marginTop: 2 }}>
                {pct.toFixed(0)}% do limite utilizado{ciclo ? ` · fatura de ${new Date(ciclo.inicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(ciclo.fim + "T00:00:00").toLocaleDateString("pt-BR")}` : " (defina o dia de fechamento para calcular a fatura real)"}
              </div>
              <Botao variante="fantasma" style={{ marginTop: 10, padding: "5px 8px", fontSize: 11.5 }} onClick={() => setFaturaAberta(c)}>Ver fatura detalhada</Botao>
            </Cartao>
          );
        })}
      </div>
      {modalAberto && (
        <Modal titulo={editando ? "Editar cartão" : "Novo cartão"} onFechar={() => { setModalAberto(false); setEditando(null); }}>
          <form onSubmit={submeter} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Campo label="Nome"><input type="text" placeholder="Ex.: Nubank, Santander..." value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={estiloInput(pal)} /></Campo>
            <Campo label="Limite (R$)"><input type="text" inputMode="decimal" value={novo.limite} onChange={(e) => setNovo({ ...novo, limite: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
            <div style={{ display: "flex", gap: 10 }}>
              <Campo label="Dia de fechamento"><input type="number" min="1" max="31" value={novo.fechamento} onChange={(e) => setNovo({ ...novo, fechamento: e.target.value })} style={estiloInput(pal)} /></Campo>
              <Campo label="Dia de vencimento"><input type="number" min="1" max="31" value={novo.vencimento} onChange={(e) => setNovo({ ...novo, vencimento: e.target.value })} style={estiloInput(pal)} /></Campo>
            </div>
            <Campo label="Cor"><input type="color" value={novo.cor} onChange={(e) => setNovo({ ...novo, cor: e.target.value })} style={{ width: 60, height: 32, border: "none", background: "none" }} /></Campo>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => { setModalAberto(false); setEditando(null); }}>Cancelar</Botao>
              <Botao type="submit">Salvar</Botao>
            </div>
          </form>
        </Modal>
      )}
      {excluirId && (
        <Confirmacao
          msg={qtdLancamentosVinculados(excluirId) > 0
            ? `Esse cartão tem ${qtdLancamentosVinculados(excluirId)} lançamento(s) vinculado(s). Eles não serão apagados, só ficarão sem cartão associado. Continuar?`
            : "Excluir este cartão?"}
          onCancelar={() => setExcluirId(null)}
          onConfirmar={() => { excluirCartao(excluirId); setExcluirId(null); }}
        />
      )}
      {faturaAberta && <FaturaCartao cartao={faturaAberta} onFechar={() => setFaturaAberta(null)} />}
    </div>
  );
}

function FaturaCartao({ cartao, onFechar }) {
  const { lancamentos, pal } = useApp();

  const itensCicloAtual = useMemo(() => {
    const ciclo = cicloFatura(cartao, mesAtual());
    const lista = lancamentos.filter((l) => l.cartaoId === cartao.id && l.tipo === "despesa" &&
      (ciclo ? (l.data >= ciclo.inicio && l.data <= ciclo.fim) : l.data.slice(0, 7) === mesAtual()));
    return { ciclo, lista: lista.sort((a, b) => (a.data < b.data ? 1 : -1)) };
  }, [lancamentos, cartao]);

  const historicoFaturas = useMemo(() => {
    const meses = [];
    for (let i = 5; i >= 0; i--) meses.push(addMeses(`${mesAtual()}-01`, -i).slice(0, 7));
    return meses.map((m) => {
      const ciclo = cicloFatura(cartao, m);
      const total = lancamentos.filter((l) => l.cartaoId === cartao.id && l.tipo === "despesa" &&
        (ciclo ? (l.data >= ciclo.inicio && l.data <= ciclo.fim) : l.data.slice(0, 7) === m)
      ).reduce((s, l) => s + l.valor, 0);
      return { mes: mesLabel(m), total };
    });
  }, [lancamentos, cartao]);

  const parcelamentosFuturos = useMemo(() => {
    const grupos = {};
    lancamentos.filter((l) => l.cartaoId === cartao.id && l.tipo === "despesa" && l.parcelaInfo).forEach((l) => {
      const g = l.parcelaInfo.grupo;
      if (!grupos[g]) grupos[g] = { descricao: l.descricao, parcelas: [] };
      grupos[g].parcelas.push(l);
    });
    return Object.values(grupos)
      .map((g) => {
        const pendentes = g.parcelas.filter((p) => p.status !== "Pago");
        return { descricao: g.descricao, restante: pendentes.reduce((s, p) => s + p.valor, 0), qtdRestante: pendentes.length, total: g.parcelas[0]?.parcelaInfo?.total || g.parcelas.length };
      })
      .filter((g) => g.qtdRestante > 0);
  }, [lancamentos, cartao]);
  const totalParcelamentosFuturos = parcelamentosFuturos.reduce((s, g) => s + g.restante, 0);

  return (
    <Modal titulo={`Fatura — ${cartao.nome}`} onFechar={onFechar} largura={540}>
      <div style={{ fontSize: 11, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 6 }}>Histórico de faturas (6 meses)</div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={historicoFaturas}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip formatter={(v) => formatarMoeda(v)} />
          <Bar dataKey="total" fill={cartao.cor || "#8A3E5C"} radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 11, color: pal.textoSuave, textTransform: "uppercase", margin: "16px 0 6px" }}>
        Fatura atual{itensCicloAtual.ciclo ? ` (${new Date(itensCicloAtual.ciclo.inicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(itensCicloAtual.ciclo.fim + "T00:00:00").toLocaleDateString("pt-BR")})` : ""}
      </div>
      {itensCicloAtual.lista.length === 0 ? (
        <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum lançamento nessa fatura ainda.</div>
      ) : (
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {itensCicloAtual.lista.map((l, i) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
              <div style={{ fontSize: 13, color: pal.texto }}>{l.descricao}{l.parcelaInfo && <span style={{ fontSize: 11, color: pal.textoSuave }}> ({l.parcelaInfo.atual}/{l.parcelaInfo.total})</span>}</div>
              <div className="num-tab" style={{ fontSize: 13, fontWeight: 600, color: pal.texto }}>{formatarMoeda(l.valor)}</div>
            </div>
          ))}
        </div>
      )}

      {parcelamentosFuturos.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: pal.textoSuave, textTransform: "uppercase", margin: "16px 0 6px" }}>
            Parcelamentos futuros neste cartão — total restante: <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(totalParcelamentosFuturos)}</strong>
          </div>
          {parcelamentosFuturos.map((g, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}`, fontSize: 12.5 }}>
              <span style={{ color: pal.texto }}>{g.descricao} ({g.total - g.qtdRestante}/{g.total} pagas)</span>
              <span className="num-tab" style={{ color: pal.textoSuave }}>{formatarMoeda(g.restante)}</span>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

/* ============================================================
   12b. RECORRENTES
   ============================================================ */
function PainelRecorrentes() {
  const { recorrentes, contas, cartoes, lancamentos, adicionarRecorrente, editarRecorrente, excluirRecorrente, pal, cor, categoriasDespesa } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState({ descricao: "", categoria: categoriasDespesa[0].nome, valor: "", diaDoMes: "10", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "" });
  const [excluirId, setExcluirId] = useState(null);
  const [sugestoesIgnoradas, setSugestoesIgnoradas] = useState(new Set());

  const sugestoes = useMemo(() => {
    const nomesJaRecorrentes = new Set(recorrentes.map((r) => r.descricao.trim().toLowerCase()));
    const grupos = {};
    lancamentos.filter((l) => l.tipo === "despesa" && !l.recorrenteId && !l.parcelaInfo).forEach((l) => {
      const chave = l.descricao.trim().toLowerCase();
      if (!chave || nomesJaRecorrentes.has(chave)) return;
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(l);
    });
    return Object.entries(grupos)
      .map(([chave, itens]) => {
        const meses = new Set(itens.map((i) => i.data.slice(0, 7)));
        const valores = itens.map((i) => i.valor);
        const media = valores.reduce((s, v) => s + v, 0) / valores.length;
        const variacao = (Math.max(...valores) - Math.min(...valores)) / (media || 1);
        const dias = itens.map((i) => parseInt(i.data.slice(8, 10), 10));
        const diaMaisComum = dias.sort((a, b) => dias.filter((v) => v === a).length - dias.filter((v) => v === b).length).pop();
        const ultimo = [...itens].sort((a, b) => (a.data > b.data ? -1 : 1))[0];
        return { chave, descricao: ultimo.descricao, categoria: ultimo.categoria, contaId: ultimo.contaId, cartaoId: ultimo.cartaoId, valorMedio: media, diaComum: diaMaisComum, qtdMeses: meses.size, variacao };
      })
      .filter((s) => s.qtdMeses >= 3 && s.variacao < 0.15 && !sugestoesIgnoradas.has(s.chave));
  }, [lancamentos, recorrentes, sugestoesIgnoradas]);

  const aceitarSugestao = (s) => {
    adicionarRecorrente({ descricao: s.descricao, categoria: s.categoria, valor: Math.round(s.valorMedio * 100) / 100, diaDoMes: s.diaComum, contaId: s.contaId || "", cartaoId: s.cartaoId || "" });
    setSugestoesIgnoradas((old) => new Set([...old, s.chave]));
  };
  const ignorarSugestao = (chave) => setSugestoesIgnoradas((old) => new Set([...old, chave]));

  const abrirNovo = () => { setEditando(null); setNovo({ descricao: "", categoria: categoriasDespesa[0].nome, valor: "", diaDoMes: "10", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "" }); setModalAberto(true); };
  const abrirEdicao = (r) => { setEditando(r); setNovo({ descricao: r.descricao, categoria: r.categoria, valor: String(r.valor), diaDoMes: String(r.diaDoMes), contaId: r.contaId || "", cartaoId: r.cartaoId || "" }); setModalAberto(true); };

  const submeter = (e) => {
    e.preventDefault();
    if (!novo.descricao.trim() || !novo.valor || !novo.diaDoMes) return;
    const dados = { ...novo, valor: parseFloat(String(novo.valor).replace(",", ".")), diaDoMes: parseInt(novo.diaDoMes, 10) };
    if (editando) editarRecorrente(editando.id, dados);
    else adicionarRecorrente(dados);
    setModalAberto(false);
    setEditando(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>Despesas recorrentes</div>
        <Botao onClick={abrirNovo}><Plus size={15} /> Nova recorrente</Botao>
      </div>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 14 }}>
        Assim que você abrir o app num mês novo, o lançamento do mês é criado automaticamente na data escolhida.
      </div>

      {sugestoes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#C98A3A", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Parece uma assinatura — quer automatizar?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {sugestoes.map((s) => (
              <Cartao key={s.chave} style={{ padding: 14, border: "1px solid #C98A3A55" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto }}>{s.descricao}</div>
                <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 10 }}>
                  Apareceu em {s.qtdMeses} meses seguidos, ~{formatarMoeda(s.valorMedio)}, sempre perto do dia {s.diaComum}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Botao style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => aceitarSugestao(s)}>Transformar em recorrente</Botao>
                  <Botao variante="fantasma" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => ignorarSugestao(s.chave)}>Ignorar</Botao>
                </div>
              </Cartao>
            ))}
          </div>
        </div>
      )}

      <Cartao style={{ overflow: "hidden" }}>
        {recorrentes.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: pal.textoSuave }}>Nenhuma despesa recorrente cadastrada ainda. Ex.: Internet, Energia, Aluguel...</div>
        ) : recorrentes.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
            <RefreshCw size={15} color={cor} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: pal.texto }}>{r.descricao}</div>
              <div style={{ fontSize: 12, color: pal.textoSuave }}>
                {r.categoria} · todo dia {r.diaDoMes} · {contas.find((c) => c.id === r.contaId)?.nome || "—"}
                {r.ultimoMesGerado ? ` · último gerado: ${mesLabel(r.ultimoMesGerado)}` : ""}
              </div>
            </div>
            <div className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: pal.texto }}>{formatarMoeda(r.valor)}</div>
            <button onClick={() => abrirEdicao(r)} style={{ border: "none", background: "transparent", color: cor, cursor: "pointer", padding: 5 }}><Pencil size={14} /></button>
            <button onClick={() => setExcluirId(r.id)} style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer", padding: 5 }}><Trash2 size={14} /></button>
          </div>
        ))}
      </Cartao>
      {modalAberto && (
        <Modal titulo={editando ? "Editar recorrente" : "Nova despesa recorrente"} onFechar={() => { setModalAberto(false); setEditando(null); }}>
          <form onSubmit={submeter} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "span 2" }}>
              <Campo label="Descrição"><input type="text" placeholder="Ex.: Internet, Energia, Aluguel..." value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} style={estiloInput(pal)} /></Campo>
            </div>
            <Campo label="Categoria">
              <select value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })} style={estiloInput(pal)}>
                {categoriasDespesa.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Valor (R$)"><input type="text" inputMode="decimal" className="num-tab" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} style={estiloInput(pal)} /></Campo>
            <Campo label="Todo dia"><input type="number" min="1" max="31" value={novo.diaDoMes} onChange={(e) => setNovo({ ...novo, diaDoMes: e.target.value })} style={estiloInput(pal)} /></Campo>
            <Campo label="Conta">
              <select value={novo.contaId} onChange={(e) => setNovo({ ...novo, contaId: e.target.value })} style={estiloInput(pal)}>
                <option value="">Sem conta</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Cartão (opcional)">
              <select value={novo.cartaoId} onChange={(e) => setNovo({ ...novo, cartaoId: e.target.value })} style={estiloInput(pal)}>
                <option value="">—</option>
                {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => { setModalAberto(false); setEditando(null); }}>Cancelar</Botao>
              <Botao type="submit"><Plus size={15} /> Salvar</Botao>
            </div>
          </form>
        </Modal>
      )}
      {excluirId && (
        <Confirmacao msg="Excluir esta recorrência? Os lançamentos já gerados por ela continuam existindo, só não vai gerar mais no futuro." onCancelar={() => setExcluirId(null)} onConfirmar={() => { excluirRecorrente(excluirId); setExcluirId(null); }} />
      )}
    </div>
  );
}

/* ============================================================
   12c. DÍVIDAS POR CREDOR
   ============================================================ */
function PainelDividas() {
  const { lancamentos, editarLancamento, pal, cor } = useApp();
  const [mostrarQuitadas, setMostrarQuitadas] = useState(false);

  const emprestimos = useMemo(() => {
    const mapa = {};
    lancamentos.filter((l) => l.tipo === "despesa" && l.emprestimo).forEach((l) => {
      const chave = l.pessoa?.trim() || "Sem nome";
      if (!mapa[chave]) mapa[chave] = { nome: chave, itens: [] };
      mapa[chave].itens.push(l);
    });
    return Object.values(mapa)
      .map((m) => ({
        ...m,
        pendentes: m.itens.filter((i) => i.status !== "Pago"),
        totalPendente: m.itens.filter((i) => i.status !== "Pago").reduce((s, i) => s + i.valor, 0),
      }))
      .filter((m) => m.totalPendente > 0)
      .sort((a, b) => b.totalPendente - a.totalPendente);
  }, [lancamentos]);

  const parcelamentos = useMemo(() => {
    const grupos = {};
    lancamentos.forEach((l) => {
      if (l.tipo !== "despesa" || !l.parcelaInfo) return;
      const g = l.parcelaInfo.grupo;
      if (!grupos[g]) grupos[g] = { grupo: g, descricao: l.descricao, pessoa: l.pessoa, categoria: l.categoria, parcelas: [] };
      grupos[g].parcelas.push(l);
    });
    return Object.values(grupos)
      .map((g) => {
        const parcelas = [...g.parcelas].sort((a, b) => (a.data < b.data ? -1 : 1));
        const pendentes = parcelas.filter((p) => p.status !== "Pago");
        const totalParcelas = parcelas[0]?.parcelaInfo?.total || parcelas.length;
        return {
          ...g,
          totalParcelas,
          pagas: totalParcelas - pendentes.length,
          totalRestante: pendentes.reduce((s, p) => s + p.valor, 0),
          proximaData: pendentes[0]?.data,
          ultimaData: parcelas.at(-1)?.data,
          quitado: pendentes.length === 0,
        };
      })
      .filter((d) => mostrarQuitadas || !d.quitado)
      .sort((a, b) => (a.quitado === b.quitado ? b.totalRestante - a.totalRestante : a.quitado ? 1 : -1));
  }, [lancamentos, mostrarQuitadas]);

  const pendenciasAvulsas = useMemo(() => {
    const mapa = {};
    lancamentos.filter((l) => l.tipo === "despesa" && l.status === "A pagar" && !l.parcelaInfo).forEach((l) => {
      const chave = l.pessoa?.trim() || l.descricao;
      if (!mapa[chave]) mapa[chave] = { nome: chave, itens: [] };
      mapa[chave].itens.push(l);
    });
    return Object.values(mapa).map((m) => ({ ...m, total: m.itens.reduce((s, i) => s + i.valor, 0) })).sort((a, b) => b.total - a.total);
  }, [lancamentos]);

  const totalGeralDevido = parcelamentos.reduce((s, d) => s + d.totalRestante, 0) + pendenciasAvulsas.reduce((s, p) => s + p.total, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>Dívidas por credor</div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: pal.textoSuave, cursor: "pointer" }}>
          <input type="checkbox" checked={mostrarQuitadas} onChange={(e) => setMostrarQuitadas(e.target.checked)} /> Mostrar quitadas
        </label>
      </div>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 18 }}>
        Total geral em aberto: <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(totalGeralDevido)}</strong>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Parcelamentos</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14, marginBottom: 24 }}>
        {parcelamentos.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum parcelamento em andamento.</div>}
        {parcelamentos.map((d) => (
          <Cartao key={d.grupo} style={{ padding: 16, opacity: d.quitado ? 0.6 : 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto }}>{d.pessoa || d.descricao}</div>
            <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 10 }}>{d.descricao} · {d.categoria}</div>
            <Progresso valor={d.pagas} max={d.totalParcelas} corBase={d.quitado ? VERDE : cor} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
              <span style={{ color: pal.textoSuave }}>{d.pagas}/{d.totalParcelas} parcelas pagas</span>
              <span className="num-tab" style={{ color: d.quitado ? VERDE : VERMELHO, fontWeight: 600 }}>{d.quitado ? "Quitado" : formatarMoeda(d.totalRestante)}</span>
            </div>
            {!d.quitado && d.ultimaData && (
              <div style={{ fontSize: 11, color: pal.textoSuave, marginTop: 4 }}>Previsão de quitação: {new Date(d.ultimaData + "T00:00:00").toLocaleDateString("pt-BR")}</div>
            )}
          </Cartao>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Outras pendências (sem parcelamento)</div>
      <Cartao style={{ overflow: "hidden" }}>
        {pendenciasAvulsas.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: pal.textoSuave }}>Nenhuma pendência avulsa marcada como "A pagar".</div>
        ) : pendenciasAvulsas.map((p, i) => (
          <div key={p.nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: pal.texto }}>{p.nome}</div>
              <div style={{ fontSize: 11.5, color: pal.textoSuave }}>{p.itens.length} lançamento{p.itens.length > 1 ? "s" : ""}</div>
            </div>
            <div className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: VERMELHO }}>{formatarMoeda(p.total)}</div>
          </div>
        ))}
      </Cartao>

      {emprestimos.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em", margin: "24px 0 8px" }}>Quem me deve</div>
          <Cartao style={{ overflow: "hidden" }}>
            {emprestimos.map((m, i) => (
              <div key={m.nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: pal.texto }}>{m.nome}</div>
                  <div style={{ fontSize: 11.5, color: pal.textoSuave }}>{m.pendentes.length} adiantamento{m.pendentes.length > 1 ? "s" : ""} não devolvido{m.pendentes.length > 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: "#2F5D8A" }}>{formatarMoeda(m.totalPendente)}</div>
                  <Botao variante="secundario" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => m.pendentes.forEach((i) => editarLancamento(i.id, { status: "Pago" }))}>
                    Marcar devolvido
                  </Botao>
                </div>
              </div>
            ))}
          </Cartao>
        </>
      )}
    </div>
  );
}

/* ============================================================
   13. METAS
   ============================================================ */
/* ============================================================
   12d. VIAGENS (modo viagem)
   ============================================================ */
function PainelViagens() {
  const { viagens, lancamentos, adicionarViagem, editarViagem, excluirViagem, pal, cor } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState({ nome: "", dataInicio: hojeISO(), dataFim: hojeISO(), orcamento: "", cor: "#2F5D8A" });
  const [excluirId, setExcluirId] = useState(null);
  const [verDetalhes, setVerDetalhes] = useState(null);

  const gastoViagem = (viagemId) => lancamentos.filter((l) => l.viagemId === viagemId && l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);

  const abrirNovo = () => { setEditando(null); setNovo({ nome: "", dataInicio: hojeISO(), dataFim: hojeISO(), orcamento: "", cor: "#2F5D8A" }); setModalAberto(true); };
  const abrirEdicao = (v) => { setEditando(v); setNovo({ nome: v.nome, dataInicio: v.dataInicio, dataFim: v.dataFim, orcamento: String(v.orcamento ?? ""), cor: v.cor }); setModalAberto(true); };

  const submeter = (e) => {
    e.preventDefault();
    if (!novo.nome.trim() || !novo.dataInicio || !novo.dataFim) return;
    const dados = { ...novo, orcamento: parseFloat(novo.orcamento) || 0 };
    if (editando) editarViagem(editando.id, dados);
    else adicionarViagem(dados);
    setModalAberto(false);
    setEditando(null);
  };

  const viagensOrdenadas = [...viagens].sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1));
  const lancamentosDaViagem = verDetalhes ? lancamentos.filter((l) => l.viagemId === verDetalhes.id).sort((a, b) => (a.data < b.data ? 1 : -1)) : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>Viagens</div>
        <Botao onClick={abrirNovo}><Plus size={15} /> Nova viagem</Botao>
      </div>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 18 }}>
        Um orçamento separado do resto do mês — marque os gastos da viagem no formulário de lançamento pra eles caírem aqui.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 14 }}>
        {viagensOrdenadas.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhuma viagem cadastrada ainda.</div>}
        {viagensOrdenadas.map((v) => {
          const gasto = gastoViagem(v.id);
          const pct = v.orcamento > 0 ? Math.min(100, (gasto / v.orcamento) * 100) : 0;
          const estourou = gasto > v.orcamento && v.orcamento > 0;
          return (
            <Cartao key={v.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Plane size={15} color={v.cor} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: pal.texto }}>{v.nome}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => abrirEdicao(v)} style={{ border: "none", background: "transparent", color: cor, cursor: "pointer" }}><Pencil size={13} /></button>
                  <button onClick={() => setExcluirId(v.id)} style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer" }}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: pal.textoSuave, marginBottom: 10 }}>
                {new Date(v.dataInicio + "T00:00:00").toLocaleDateString("pt-BR")} — {new Date(v.dataFim + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
              {v.orcamento > 0 ? (
                <>
                  <Progresso valor={gasto} max={v.orcamento} corBase={v.cor} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                    <span className="num-tab" style={{ color: estourou ? VERMELHO : pal.texto, fontWeight: 600 }}>{formatarMoeda(gasto)}</span>
                    <span className="num-tab" style={{ color: pal.textoSuave }}>de {formatarMoeda(v.orcamento)}</span>
                  </div>
                  {estourou && <div style={{ fontSize: 11.5, color: VERMELHO, marginTop: 4 }}>Estourou o orçamento em {formatarMoeda(gasto - v.orcamento)}</div>}
                </>
              ) : (
                <div className="num-tab" style={{ fontSize: 18, fontWeight: 600, color: pal.texto }}>{formatarMoeda(gasto)}</div>
              )}
              <Botao variante="fantasma" style={{ marginTop: 10, padding: "5px 8px", fontSize: 12 }} onClick={() => setVerDetalhes(v)}>Ver lançamentos</Botao>
            </Cartao>
          );
        })}
      </div>

      {modalAberto && (
        <Modal titulo={editando ? "Editar viagem" : "Nova viagem"} onFechar={() => { setModalAberto(false); setEditando(null); }}>
          <form onSubmit={submeter} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Campo label="Nome"><input type="text" placeholder="Ex.: Praia em janeiro" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={estiloInput(pal)} /></Campo>
            <div style={{ display: "flex", gap: 10 }}>
              <Campo label="Data início"><input type="date" value={novo.dataInicio} onChange={(e) => setNovo({ ...novo, dataInicio: e.target.value })} style={estiloInput(pal)} /></Campo>
              <Campo label="Data fim"><input type="date" value={novo.dataFim} onChange={(e) => setNovo({ ...novo, dataFim: e.target.value })} style={estiloInput(pal)} /></Campo>
            </div>
            <Campo label="Orçamento da viagem (R$, opcional)"><input type="text" inputMode="decimal" value={novo.orcamento} onChange={(e) => setNovo({ ...novo, orcamento: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
            <Campo label="Cor"><input type="color" value={novo.cor} onChange={(e) => setNovo({ ...novo, cor: e.target.value })} style={{ width: 60, height: 32, border: "none", background: "none" }} /></Campo>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => { setModalAberto(false); setEditando(null); }}>Cancelar</Botao>
              <Botao type="submit">Salvar</Botao>
            </div>
          </form>
        </Modal>
      )}

      {verDetalhes && (
        <Modal titulo={`Gastos de "${verDetalhes.nome}"`} onFechar={() => setVerDetalhes(null)}>
          {lancamentosDaViagem.length === 0 ? (
            <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum lançamento marcado com essa viagem ainda.</div>
          ) : lancamentosDaViagem.map((l, i) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
              <div>
                <div style={{ fontSize: 13.5, color: pal.texto }}>{l.descricao}</div>
                <div style={{ fontSize: 11, color: pal.textoSuave }}>{new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")} · {l.categoria}</div>
              </div>
              <div className="num-tab" style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto }}>{formatarMoeda(l.valor)}</div>
            </div>
          ))}
        </Modal>
      )}
      {excluirId && (
        <Confirmacao msg="Excluir esta viagem? Os lançamentos ligados a ela não são apagados, só perdem a marcação." onCancelar={() => setExcluirId(null)} onConfirmar={() => { excluirViagem(excluirId); setExcluirId(null); }} />
      )}
    </div>
  );
}

/* ============================================================
   13. METAS
   ============================================================ */
function PainelMetas() {
  const { metas, lancamentos, mesSelecionado, definirMeta, pal, cor, categoriasDespesa, metasEconomia, adicionarMetaEconomia, excluirMetaEconomia, adicionarAporte } = useApp();
  const [aba, setAba] = useState("categoria");
  const [nova, setNova] = useState({ categoria: categoriasDespesa[0].nome, valor: "" });
  const [novaMeta, setNovaMeta] = useState({ nome: "", valorAlvo: "", cor: "#2F5D8A" });
  const [modalAporte, setModalAporte] = useState(null);
  const [valorAporte, setValorAporte] = useState("");
  const [excluirMetaId, setExcluirMetaId] = useState(null);

  const gastoPorCategoria = (cat) => lancamentos.filter((l) => l.categoria === cat && l.tipo === "despesa" && l.data.slice(0, 7) === mesSelecionado).reduce((s, l) => s + l.valor, 0);

  const submeter = (e) => {
    e.preventDefault();
    if (!nova.valor) return;
    definirMeta(nova.categoria, parseFloat(nova.valor));
    setNova({ ...nova, valor: "" });
  };

  const submeterMetaEconomia = (e) => {
    e.preventDefault();
    if (!novaMeta.nome.trim() || !novaMeta.valorAlvo) return;
    adicionarMetaEconomia(novaMeta.nome.trim(), parseFloat(novaMeta.valorAlvo), novaMeta.cor);
    setNovaMeta({ nome: "", valorAlvo: "", cor: "#2F5D8A" });
  };

  const confirmarAporte = () => {
    const v = parseFloat(String(valorAporte).replace(",", "."));
    if (!v || v <= 0) return;
    adicionarAporte(modalAporte.id, v, hojeISO());
    setValorAporte("");
    setModalAporte(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setAba("categoria")} style={{ padding: "7px 14px", borderRadius: 999, border: `1px solid ${aba === "categoria" ? "transparent" : pal.borda}`, background: aba === "categoria" ? cor : "transparent", color: aba === "categoria" ? "#fff" : pal.texto, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Orçamento por categoria</button>
          <button onClick={() => setAba("economia")} style={{ padding: "7px 14px", borderRadius: 999, border: `1px solid ${aba === "economia" ? "transparent" : pal.borda}`, background: aba === "economia" ? cor : "transparent", color: aba === "economia" ? "#fff" : pal.texto, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Metas de economia</button>
        </div>
        {aba === "categoria" && <NavegadorMes compacto />}
      </div>

      {aba === "categoria" ? (
        <>
          <Cartao style={{ padding: 18, marginBottom: 20 }}>
            <form onSubmit={submeter} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Campo label="Categoria">
                <select value={nova.categoria} onChange={(e) => setNova({ ...nova, categoria: e.target.value })} style={estiloInput(pal)}>
                  {categoriasDespesa.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Orçamento mensal (R$)"><input type="text" inputMode="decimal" value={nova.valor} onChange={(e) => setNova({ ...nova, valor: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
              <Botao type="submit"><Plus size={15} /> Definir meta</Botao>
            </form>
          </Cartao>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
            {Object.entries(metas).map(([cat, valorMeta]) => {
              const gasto = gastoPorCategoria(cat);
              const estourou = gasto > valorMeta;
              return (
                <Cartao key={cat} style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto }}>{cat}</div>
                    {estourou && <AlertTriangle size={14} color={VERMELHO} />}
                  </div>
                  <Progresso valor={gasto} max={valorMeta} corBase={corCategoria(cat, categoriasDespesa)} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                    <span className="num-tab" style={{ color: estourou ? VERMELHO : pal.textoSuave }}>{formatarMoeda(gasto)}</span>
                    <span className="num-tab" style={{ color: pal.textoSuave }}>de {formatarMoeda(valorMeta)}</span>
                  </div>
                  {estourou && <div style={{ fontSize: 11.5, color: VERMELHO, marginTop: 4 }}>Meta ultrapassada em {formatarMoeda(gasto - valorMeta)}</div>}
                </Cartao>
              );
            })}
            {Object.keys(metas).length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhuma meta definida ainda.</div>}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 14 }}>
            Diferente do orçamento por categoria (que limita gasto), aqui você acompanha quanto já guardou pra um objetivo — tipo uma viagem ou uma reserva.
          </div>
          <Cartao style={{ padding: 18, marginBottom: 20 }}>
            <form onSubmit={submeterMetaEconomia} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Campo label="Nome da meta"><input type="text" placeholder="Ex.: Viagem, Reserva de emergência..." value={novaMeta.nome} onChange={(e) => setNovaMeta({ ...novaMeta, nome: e.target.value })} style={estiloInput(pal)} /></Campo>
              <Campo label="Valor alvo (R$)"><input type="text" inputMode="decimal" value={novaMeta.valorAlvo} onChange={(e) => setNovaMeta({ ...novaMeta, valorAlvo: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
              <Campo label="Cor"><input type="color" value={novaMeta.cor} onChange={(e) => setNovaMeta({ ...novaMeta, cor: e.target.value })} style={{ width: 44, height: 34, border: "none", background: "none" }} /></Campo>
              <Botao type="submit"><Plus size={15} /> Criar meta</Botao>
            </form>
          </Cartao>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
            {metasEconomia.map((m) => {
              const valorAtual = m.aportes.reduce((s, a) => s + a.valor, 0);
              const completa = valorAtual >= m.valorAlvo;
              return (
                <Cartao key={m.id} style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto }}>{m.nome}</div>
                    <button onClick={() => setExcluirMetaId(m.id)} style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer" }}><Trash2 size={13} /></button>
                  </div>
                  <Progresso valor={valorAtual} max={m.valorAlvo} corBase={m.cor} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                    <span className="num-tab" style={{ color: completa ? VERDE : pal.texto, fontWeight: 600 }}>{formatarMoeda(valorAtual)}</span>
                    <span className="num-tab" style={{ color: pal.textoSuave }}>de {formatarMoeda(m.valorAlvo)}</span>
                  </div>
                  {completa ? (
                    <div style={{ fontSize: 11.5, color: VERDE, marginTop: 6 }}>🎉 Meta batida!</div>
                  ) : (
                    <Botao variante="secundario" style={{ marginTop: 10, padding: "6px 10px", fontSize: 12 }} onClick={() => setModalAporte(m)}>+ Adicionar aporte</Botao>
                  )}
                </Cartao>
              );
            })}
            {metasEconomia.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhuma meta de economia criada ainda.</div>}
          </div>
        </>
      )}

      {modalAporte && (
        <Modal titulo={`Aporte em "${modalAporte.nome}"`} onFechar={() => setModalAporte(null)} largura={360}>
          <Campo label="Valor do aporte (R$)">
            <input type="text" inputMode="decimal" autoFocus value={valorAporte} onChange={(e) => setValorAporte(e.target.value)} className="num-tab" style={estiloInput(pal)} />
          </Campo>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Botao variante="fantasma" onClick={() => setModalAporte(null)}>Cancelar</Botao>
            <Botao onClick={confirmarAporte}>Adicionar</Botao>
          </div>
        </Modal>
      )}
      {excluirMetaId && (
        <Confirmacao msg="Excluir esta meta de economia? Os aportes registrados nela também somem." onCancelar={() => setExcluirMetaId(null)} onConfirmar={() => { excluirMetaEconomia(excluirMetaId); setExcluirMetaId(null); }} />
      )}
    </div>
  );
}

/* ============================================================
   14. ESTATÍSTICAS
   ============================================================ */
function PainelEstatisticas() {
  const { lancamentos, mesesDisponiveis, mesSelecionado, pal, categoriasDespesa } = useApp();
  const [anoRelatorio, setAnoRelatorio] = useState(new Date().getFullYear());

  const ultimos6 = mesesDisponiveis.slice(0, 6).reverse();
  const comparativo = ultimos6.map((m) => {
    const gasto = lancamentos.filter((l) => l.data.slice(0, 7) === m && l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
    const receita = lancamentos.filter((l) => l.data.slice(0, 7) === m && l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
    return { mes: mesLabel(m), Gasto: gasto, Receita: receita, Saldo: receita - gasto };
  });

  let acumulado = 0;
  const saldoAcumulado = comparativo.map((c) => { acumulado += c.Saldo; return { mes: c.mes, Acumulado: acumulado }; });

  const doMes = lancamentos.filter((l) => l.data.slice(0, 7) === mesSelecionado && l.tipo === "despesa");
  const pizza = useMemo(() => {
    const mapa = {};
    doMes.forEach((l) => { mapa[l.categoria] = (mapa[l.categoria] || 0) + l.valor; });
    return Object.entries(mapa).map(([nome, valor]) => ({ nome, valor, cor: corCategoria(nome, categoriasDespesa) }));
  }, [doMes]);

  const receitaMesSankey = useMemo(
    () => lancamentos.filter((l) => l.tipo === "receita" && l.data.slice(0, 7) === mesSelecionado).reduce((s, l) => s + l.valor, 0),
    [lancamentos, mesSelecionado]
  );
  const dadosSankey = useMemo(() => {
    if (pizza.length === 0 || receitaMesSankey === 0) return null;
    const nodes = [{ name: "Renda" }, ...pizza.map((p) => ({ name: p.nome }))];
    const links = pizza.map((p, i) => ({ source: 0, target: i + 1, value: Math.round(p.valor * 100) / 100 }));
    const totalDespesas = pizza.reduce((s, p) => s + p.valor, 0);
    if (receitaMesSankey > totalDespesas) {
      nodes.push({ name: "Sobrou" });
      links.push({ source: 0, target: nodes.length - 1, value: Math.round((receitaMesSankey - totalDespesas) * 100) / 100 });
    }
    return { nodes, links };
  }, [pizza, receitaMesSankey]);

  const porAno = useMemo(() => {
    const mapa = {};
    lancamentos.filter((l) => l.tipo === "despesa").forEach((l) => { const a = l.data.slice(0, 4); mapa[a] = (mapa[a] || 0) + l.valor; });
    return Object.entries(mapa).sort().map(([ano, valor]) => ({ ano, valor }));
  }, [lancamentos]);

  const idxAtual = comparativo.length - 1;
  const variacao = idxAtual > 0 ? ((comparativo[idxAtual].Gasto - comparativo[idxAtual - 1].Gasto) / (comparativo[idxAtual - 1].Gasto || 1)) * 100 : null;

  const anosDisponiveis = useMemo(() => Array.from(new Set(lancamentos.map((l) => l.data.slice(0, 4)))).sort().reverse(), [lancamentos]);
  const relatorioAnual = useMemo(() => {
    const doAno = lancamentos.filter((l) => l.tipo === "despesa" && l.data.slice(0, 4) === String(anoRelatorio));
    const mapa = {};
    doAno.forEach((l) => { mapa[l.categoria] = (mapa[l.categoria] || 0) + l.valor; });
    return Object.entries(mapa).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  }, [lancamentos, anoRelatorio]);
  const totalAnoRelatorio = relatorioAnual.reduce((s, c) => s + c.valor, 0);
  const totalSaudeAno = relatorioAnual.find((c) => c.categoria === "Saúde")?.valor || 0;

  const exportarRelatorioAnualCSV = () => {
    const linhas = ["Categoria;Total"];
    relatorioAnual.forEach((c) => linhas.push(`${c.categoria};${c.valor.toFixed(2).replace(".", ",")}`));
    linhas.push(`Total geral;${totalAnoRelatorio.toFixed(2).replace(".", ",")}`);
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-anual-${anoRelatorio}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {variacao !== null && (
        <Cartao style={{ padding: 16, display: "flex", alignItems: "center", gap: 10 }}>
          {variacao <= 0 ? <ArrowDown size={18} color={VERDE} /> : <ArrowUp size={18} color={VERMELHO} />}
          <div style={{ fontSize: 13.5, color: pal.texto }}>
            Gasto de <strong>{comparativo[idxAtual].mes}</strong> {variacao <= 0 ? "caiu" : "subiu"} <strong className="num-tab" style={{ color: variacao <= 0 ? VERDE : VERMELHO }}>{Math.abs(variacao).toFixed(0)}%</strong> em relação a {comparativo[idxAtual - 1].mes}
          </div>
        </Cartao>
      )}

      <Cartao style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Receita x Despesa por mês</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={comparativo}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v) => formatarMoeda(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Receita" fill={VERDE} radius={[4, 4, 0, 0]} barSize={16} />
            <Bar dataKey="Gasto" fill={VERMELHO} radius={[4, 4, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </Cartao>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="grid-responsiva">
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Categorias — {mesLabel(mesSelecionado)}</div>
          {pizza.length === 0 ? <div style={{ fontSize: 13, color: pal.textoSuave }}>Sem dados.</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pizza} dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {pizza.map((p, i) => <Cell key={i} fill={p.cor} />)}
                </Pie>
                <Tooltip formatter={(v) => formatarMoeda(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Cartao>
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Evolução dos gastos</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={comparativo}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => formatarMoeda(v)} />
              <Line type="monotone" dataKey="Gasto" stroke={VERMELHO} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Cartao>
      </div>

      {dadosSankey && (
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>
            Pra onde foi cada real — {mesLabel(mesSelecionado)}
          </div>
          <ResponsiveContainer width="100%" height={Math.max(240, dadosSankey.nodes.length * 32)}>
            <Sankey
              data={dadosSankey}
              nodePadding={22}
              nodeWidth={10}
              margin={{ left: 10, right: 120, top: 10, bottom: 10 }}
              link={{ stroke: pal.borda, strokeOpacity: 0.5 }}
            >
              <Tooltip formatter={(v) => formatarMoeda(v)} />
            </Sankey>
          </ResponsiveContainer>
        </Cartao>
      )}

      <Cartao style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Saldo acumulado</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={saldoAcumulado}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} width={50} />
            <Tooltip formatter={(v) => formatarMoeda(v)} />
            <Area type="monotone" dataKey="Acumulado" stroke={VERDE} fill={`${VERDE}33`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Cartao>

      {porAno.length > 1 && (
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Comparação anual</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={porAno}>
              <XAxis dataKey="ano" tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => formatarMoeda(v)} />
              <Bar dataKey="valor" fill={pal.texto} radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>
      )}

      <Cartao style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase" }}>Relatório anual (Imposto de Renda)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={anoRelatorio} onChange={(e) => setAnoRelatorio(e.target.value)} style={{ ...estiloInput(pal), padding: "6px 8px", fontSize: 12.5 }}>
              {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Botao variante="secundario" style={{ padding: "6px 10px" }} onClick={exportarRelatorioAnualCSV}><Download size={13} /> CSV</Botao>
          </div>
        </div>
        {totalSaudeAno > 0 && (
          <div style={{ background: "#8A3E5C1A", border: "1px solid #8A3E5C55", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: pal.texto }}>
            💊 Gasto total com <strong>Saúde</strong> em {anoRelatorio}: <strong className="num-tab">{formatarMoeda(totalSaudeAno)}</strong> — categoria comumente dedutível na declaração de IR (confirme sempre com um contador).
          </div>
        )}
        {relatorioAnual.length === 0 ? (
          <div style={{ fontSize: 13, color: pal.textoSuave }}>Sem despesas registradas em {anoRelatorio}.</div>
        ) : (
          <>
            {relatorioAnual.map((c) => (
              <div key={c.categoria} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${pal.bordaSuave}` }}>
                <span style={{ fontSize: 13, color: pal.texto, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: corCategoria(c.categoria, categoriasDespesa) }} /> {c.categoria}
                </span>
                <span className="num-tab" style={{ fontSize: 13, fontWeight: 600, color: pal.texto }}>{formatarMoeda(c.valor)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 6, borderTop: `1px solid ${pal.borda}`, fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ color: pal.texto }}>Total do ano</span>
              <span className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(totalAnoRelatorio)}</span>
            </div>
          </>
        )}
      </Cartao>
    </div>
  );
}

/* ============================================================
   15. FAVORITOS
   ============================================================ */
function PainelFavoritos() {
  const { favoritos, excluirFavorito, adicionarLancamento, contas, pal, mostrarToast } = useApp();
  return (
    <div>
      <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto, marginBottom: 14 }}>Lançamentos favoritos</div>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 14 }}>Clique num favorito para lançar ele hoje com um clique.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
        {favoritos.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum favorito ainda — salve um lançamento como favorito ao criá-lo.</div>}
        {favoritos.map((f) => (
          <Cartao key={f.id} style={{ padding: 14, position: "relative" }}>
            <button onClick={() => excluirFavorito(f.id)} style={{ position: "absolute", top: 8, right: 8, border: "none", background: "none", color: pal.textoSuave, cursor: "pointer" }}><X size={13} /></button>
            <div onClick={() => { adicionarLancamento({ ...f, data: hojeISO() }, f.valor); mostrarToast(`"${f.descricao}" lançado hoje`); }} style={{ cursor: "pointer" }}>
              <Star size={16} color="#C98A3A" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto }}>{f.descricao}</div>
              <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 6 }}>{f.categoria}</div>
              <div className="num-tab" style={{ fontSize: 15, fontWeight: 600, color: pal.texto }}>{formatarMoeda(f.valor)}</div>
            </div>
          </Cartao>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   16. BACKUP
   ============================================================ */
function EspacoComprovantes() {
  const { lancamentos, mostrarToast, pal } = useApp();
  const LIMITE_BYTES = 4.5 * 1024 * 1024; // margem de segurança dentro do limite de 5MB por chave
  const bytesUsados = useMemo(() => lancamentos.reduce((s, l) => s + (l.anexo ? l.anexo.length : 0), 0), [lancamentos]);
  const qtdComprovantes = lancamentos.filter((l) => l.anexo).length;
  const pct = Math.min(100, (bytesUsados / LIMITE_BYTES) * 100);
  if (qtdComprovantes === 0) return null;

  const baixarTodos = () => {
    const comAnexo = lancamentos.filter((l) => l.anexo);
    comAnexo.forEach((l, i) => {
      setTimeout(() => {
        const ext = l.anexo.match(/^data:image\/(\w+);/)?.[1] || "jpg";
        const nomeBase = `${l.data}-${l.descricao}`.replace(/[^a-z0-9-]+/gi, "-").slice(0, 60);
        const a = document.createElement("a");
        a.href = l.anexo; a.download = `${nomeBase}.${ext}`; a.click();
      }, i * 400);
    });
    mostrarToast(`Baixando ${comAnexo.length} comprovante(s) — seu navegador pode pedir permissão pra downloads múltiplos`, null, 4500);
  };

  return (
    <Cartao style={{ padding: 18, maxWidth: 420, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>Espaço usado por comprovantes</div>
      <Progresso valor={bytesUsados} max={LIMITE_BYTES} corBase="#2F5D8A" />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
        <span style={{ color: pct >= 80 ? VERMELHO : pal.textoSuave }}>{(bytesUsados / 1024 / 1024).toFixed(2)} MB usados ({pct.toFixed(0)}%)</span>
        <span style={{ color: pal.textoSuave }}>{qtdComprovantes} comprovante{qtdComprovantes > 1 ? "s" : ""}</span>
      </div>
      {pct >= 80 && <div style={{ fontSize: 11.5, color: VERMELHO, marginTop: 6 }}>Chegando perto do limite — evite anexar fotos muito grandes.</div>}
      <Botao variante="secundario" style={{ marginTop: 12, padding: "7px 12px" }} onClick={baixarTodos}><Download size={14} /> Baixar todos os comprovantes</Botao>
    </Cartao>
  );
}

function PainelBackup() {
  const { lancamentos, contas, restaurarBackup, exportarBackupJSON, pal, mostrarToast } = useApp();
  const inputRef = useRef(null);

  const exportarCSV = () => {
    const linhas = ["Data;Tipo;Categoria;Descrição;Pessoa;Status;Conta;Escopo;Valor"];
    lancamentos.forEach((l) => {
      const conta = contas.find((c) => c.id === l.contaId)?.nome || "";
      linhas.push([l.data, l.tipo, l.categoria, l.descricao, l.pessoa, l.status, conta, l.escopo || "pessoal", l.valor.toFixed(2).replace(".", ",")].join(";"));
    });
    // O \uFEFF (BOM) é necessário pra o Excel do Windows reconhecer acentuação em UTF-8 corretamente.
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lancamentos-${hojeISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
    mostrarToast("CSV exportado (abre direto no Excel)");
  };

  const importarJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const texto = await file.text();
    try {
      const dados = JSON.parse(texto);
      restaurarBackup(dados);
      mostrarToast("Backup importado com sucesso");
    } catch (err) { alert("Arquivo inválido."); }
    e.target.value = "";
  };

  return (
    <div>
      <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto, marginBottom: 14 }}>Backup e exportação</div>
      <EspacoComprovantes />
      <Cartao style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto, marginBottom: 6 }}>Exportar tudo (JSON)</div>
          <div style={{ fontSize: 12, color: pal.textoSuave, marginBottom: 8 }}>Guarda contas, cartões, metas, favoritos e lançamentos — use pra restaurar depois.</div>
          <Botao onClick={exportarBackupJSON}><Download size={14} /> Exportar backup</Botao>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto, marginBottom: 6 }}>Restaurar backup</div>
          <input ref={inputRef} type="file" accept=".json" onChange={importarJSON} style={{ display: "none" }} />
          <Botao variante="secundario" onClick={() => inputRef.current?.click()}><Upload size={14} /> Importar backup (.json)</Botao>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto, marginBottom: 6 }}>Exportar lançamentos (CSV / Excel)</div>
          <Botao variante="secundario" onClick={exportarCSV}><Download size={14} /> Exportar CSV</Botao>
        </div>
        <div style={{ fontSize: 11.5, color: pal.textoSuave, borderTop: `1px dashed ${pal.borda}`, paddingTop: 10 }}>
          Exportação em PDF não está disponível neste ambiente — use o CSV (abre no Excel/Google Sheets) ou o backup em JSON.
        </div>
      </Cartao>
      <SincronizacaoDrive />
    </div>
  );
}

/* ============================================================
   16b. SINCRONIZAÇÃO COM GOOGLE DRIVE (opcional, avançado)
   ============================================================ */
function carregarScriptGIS() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
const NOME_ARQUIVO_DRIVE = "meu-financeiro-backup.json";
async function driveEncontrarArquivo(token) {
  const query = encodeURIComponent(`name='${NOME_ARQUIVO_DRIVE}' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.files?.[0] || null;
}
async function driveCriarArquivo(token, conteudoObj) {
  const metadata = { name: NOME_ARQUIVO_DRIVE, mimeType: "application/json" };
  const boundary = "-------meufinanceiro";
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(conteudoObj)}\r\n--${boundary}--`;
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}
async function driveAtualizarArquivo(token, fileId, conteudoObj) {
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(conteudoObj),
  });
}
async function driveBaixarArquivo(token, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

function SincronizacaoDrive() {
  const {
    lancamentos, contas, cartoes, metas, favoritos, recorrentes, categoriasDespesa, categoriasReceita, metasEconomia, viagens,
    restaurarBackup, clientIdDrive, salvarClientIdDrive, mostrarToast, pal,
  } = useApp();
  const [conectado, setConectado] = useState(false);
  const [carregando, setCarregando] = useState("");
  const [fileId, setFileId] = useState(() => { try { return localStorage.getItem("driveFileId") || null; } catch { return null; } });
  const tokenClientRef = useRef(null);
  const tokenRef = useRef(null);

  const inicializarTokenClient = async () => {
    await carregarScriptGIS();
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientIdDrive.trim(),
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: () => {},
    });
  };

  const conectar = async () => {
    if (!clientIdDrive.trim()) { mostrarToast("Cole o Client ID do Google antes de conectar"); return; }
    setCarregando("conectando");
    try {
      await inicializarTokenClient();
      tokenClientRef.current.callback = (resp) => {
        setCarregando("");
        if (resp.error) { mostrarToast("Não foi possível conectar ao Google"); return; }
        tokenRef.current = resp.access_token;
        setConectado(true);
        mostrarToast("Conectado ao Google Drive");
      };
      tokenClientRef.current.requestAccessToken();
    } catch (e) {
      setCarregando("");
      mostrarToast("Erro ao carregar o login do Google — confira sua internet");
    }
  };

  const salvarNoDrive = async () => {
    if (!tokenRef.current) return;
    setCarregando("salvando");
    const dados = { lancamentos, contas, cartoes, metas, favoritos, recorrentes, categoriasDespesa, categoriasReceita, metasEconomia, viagens, exportadoEm: new Date().toISOString() };
    try {
      let id = fileId;
      if (!id) id = (await driveEncontrarArquivo(tokenRef.current))?.id || null;
      if (id) await driveAtualizarArquivo(tokenRef.current, id, dados);
      else { const criado = await driveCriarArquivo(tokenRef.current, dados); id = criado.id; }
      setFileId(id);
      try { localStorage.setItem("driveFileId", id); } catch {}
      mostrarToast("Backup salvo no Google Drive");
    } catch (e) {
      mostrarToast("Erro ao salvar no Google Drive");
    }
    setCarregando("");
  };

  const restaurarDoDrive = async () => {
    if (!tokenRef.current) return;
    setCarregando("restaurando");
    try {
      let id = fileId;
      if (!id) id = (await driveEncontrarArquivo(tokenRef.current))?.id;
      if (!id) { mostrarToast("Nenhum backup encontrado no Drive ainda"); setCarregando(""); return; }
      const dados = await driveBaixarArquivo(tokenRef.current, id);
      restaurarBackup(dados);
      mostrarToast("Dados restaurados do Google Drive");
    } catch (e) {
      mostrarToast("Erro ao restaurar do Google Drive");
    }
    setCarregando("");
  };

  return (
    <Cartao style={{ padding: 18, maxWidth: 420, marginTop: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto, marginBottom: 6 }}>Sincronizar com Google Drive (opcional)</div>
      <div style={{ fontSize: 12, color: pal.textoSuave, marginBottom: 10 }}>
        Recurso avançado: precisa de uma configuração única sua no Google Cloud (veja o passo a passo no README). Depois de pronto, dá pra salvar e restaurar os dados de qualquer computador ou celular.
      </div>
      <Campo label="Client ID do Google (OAuth)">
        <input type="text" placeholder="xxxxxxxx.apps.googleusercontent.com" value={clientIdDrive} onChange={(e) => salvarClientIdDrive(e.target.value)} style={estiloInput(pal)} />
      </Campo>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {!conectado ? (
          <Botao onClick={conectar}>{carregando === "conectando" ? "Conectando..." : "Conectar ao Google Drive"}</Botao>
        ) : (
          <>
            <Botao variante="secundario" onClick={salvarNoDrive}>{carregando === "salvando" ? "Salvando..." : "Salvar no Drive agora"}</Botao>
            <Botao variante="fantasma" onClick={restaurarDoDrive}>{carregando === "restaurando" ? "Restaurando..." : "Restaurar do Drive"}</Botao>
          </>
        )}
      </div>
    </Cartao>
  );
}

/* ============================================================
   17. CONFIGURAÇÕES
   ============================================================ */
const CORES_DISPONIVEIS = ["#1B2A4A", "#3E6F5C", "#8A3E5C", "#2F5D8A", "#8A5A2F", "#6B4E9C"];

function GerenciadorCategorias({ tipo }) {
  const { categoriasDespesa, categoriasReceita, adicionarCategoria, editarCategoria, excluirCategoria, pal } = useApp();
  const lista = tipo === "receita" ? categoriasReceita : categoriasDespesa;
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState("#6B4E9C");
  const [renomeando, setRenomeando] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [excluirNome, setExcluirNome] = useState(null);

  const adicionar = (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    adicionarCategoria(tipo, novoNome, novaCor);
    setNovoNome("");
  };

  const salvarRenomeacao = (nomeAntigo) => {
    if (nomeEdicao.trim() && nomeEdicao.trim() !== nomeAntigo) editarCategoria(tipo, nomeAntigo, { nome: nomeEdicao.trim() });
    setRenomeando(null);
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>{tipo === "receita" ? "Categorias de receita" : "Categorias de despesa"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {lista.map((c) => (
          <div key={c.nome} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: `${pal.borda}33` }}>
            <input type="color" value={c.cor} onChange={(e) => editarCategoria(tipo, c.nome, { cor: e.target.value })} style={{ width: 22, height: 22, border: "none", background: "none", padding: 0, flexShrink: 0 }} />
            {renomeando === c.nome ? (
              <input autoFocus type="text" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)}
                onBlur={() => salvarRenomeacao(c.nome)} onKeyDown={(e) => e.key === "Enter" && salvarRenomeacao(c.nome)}
                style={{ ...estiloInput(pal), flex: 1, padding: "4px 8px", fontSize: 13 }} />
            ) : (
              <div onClick={() => { setRenomeando(c.nome); setNomeEdicao(c.nome); }} style={{ flex: 1, fontSize: 13, color: pal.texto, cursor: "text" }}>{c.nome}</div>
            )}
            {c.nome !== "Outros" && (
              <button onClick={() => setExcluirNome(c.nome)} style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer", padding: 3 }}><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={adicionar} style={{ display: "flex", gap: 6 }}>
        <input type="color" value={novaCor} onChange={(e) => setNovaCor(e.target.value)} style={{ width: 32, height: 32, border: "none", background: "none", flexShrink: 0 }} />
        <input type="text" placeholder="Nova categoria" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} style={{ ...estiloInput(pal), flex: 1 }} />
        <Botao type="submit" style={{ padding: "8px 10px" }}><Plus size={14} /></Botao>
      </form>
      {excluirNome && (
        <Confirmacao
          msg={`Excluir a categoria "${excluirNome}"? Os lançamentos que usam ela passam a ficar em "Outros".`}
          onCancelar={() => setExcluirNome(null)}
          onConfirmar={() => { excluirCategoria(tipo, excluirNome); setExcluirNome(null); }}
        />
      )}
    </div>
  );
}

function PainelConfiguracoes() {
  const { tema, setTema, cor, setCor, pal, notificacoesAtivas, ativarNotificacoes, desativarNotificacoes, pin, definirPin, historico } = useApp();
  const [novoPin, setNovoPin] = useState("");
  const [confirmaPin, setConfirmaPin] = useState("");
  const [erroPin, setErroPin] = useState("");

  const salvarNovoPin = () => {
    if (novoPin.length < 4) { setErroPin("O PIN precisa ter pelo menos 4 dígitos."); return; }
    if (novoPin !== confirmaPin) { setErroPin("Os dois PINs digitados são diferentes."); return; }
    definirPin(novoPin);
    setNovoPin(""); setConfirmaPin(""); setErroPin("");
  };

  return (
    <div>
      <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto, marginBottom: 14 }}>Configurações</div>
      <Cartao style={{ padding: 18, maxWidth: 420, display: "flex", flexDirection: "column", gap: 18, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>Tema</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Botao variante={tema === "claro" ? "primario" : "secundario"} onClick={() => setTema("claro")}><Sun size={14} /> Claro</Botao>
            <Botao variante={tema === "escuro" ? "primario" : "secundario"} onClick={() => setTema("escuro")}><Moon size={14} /> Escuro</Botao>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 4 }}>Lembretes de vencimento</div>
          <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 8 }}>Avisa quando alguma conta "A pagar" vence nos próximos 3 dias — só funciona enquanto o app está aberto no navegador.</div>
          <Botao variante={notificacoesAtivas ? "primario" : "secundario"} onClick={() => (notificacoesAtivas ? desativarNotificacoes() : ativarNotificacoes())}>
            <Bell size={14} /> {notificacoesAtivas ? "Ativado — clique para desativar" : "Ativar lembretes"}
          </Botao>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>Cor principal</div>
          <div style={{ display: "flex", gap: 8 }}>
            {CORES_DISPONIVEIS.map((c) => (
              <button key={c} onClick={() => setCor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: cor === c ? "2px solid #fff" : "none", boxShadow: cor === c ? `0 0 0 2px ${c}` : "none", cursor: "pointer" }} />
            ))}
          </div>
        </div>
      </Cartao>
      <Cartao style={{ padding: 18, maxWidth: 420, display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto }}>Segurança — trava por PIN</div>
        <div style={{ fontSize: 11.5, color: pal.textoSuave }}>
          É uma trava simples pra quem pegar seu computador/celular não abrir seus dados de primeira — não é criptografia de verdade, então não use pra dados extremamente sensíveis.
        </div>
        {pin ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12.5, color: VERDE }}>✓ PIN ativado</span>
            <Botao variante="perigo" style={{ padding: "6px 10px" }} onClick={() => definirPin("")}>Remover PIN</Botao>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Novo PIN (4-6 dígitos)" value={novoPin} onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ""))} style={{ ...estiloInput(pal), width: 170 }} />
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirmar PIN" value={confirmaPin} onChange={(e) => setConfirmaPin(e.target.value.replace(/\D/g, ""))} style={{ ...estiloInput(pal), width: 140 }} />
            </div>
            {erroPin && <div style={{ fontSize: 11.5, color: VERMELHO }}>{erroPin}</div>}
            <Botao onClick={salvarNovoPin} style={{ alignSelf: "flex-start" }}>Ativar PIN</Botao>
          </>
        )}
      </Cartao>
      <Cartao style={{ padding: 18, maxWidth: 420, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 12, color: pal.textoSuave }}>Clique no nome pra renomear, na bolinha pra trocar a cor.</div>
        <GerenciadorCategorias tipo="despesa" />
        <div style={{ borderTop: `1px dashed ${pal.borda}`, paddingTop: 16 }}>
          <GerenciadorCategorias tipo="receita" />
        </div>
      </Cartao>

      <Cartao style={{ padding: 18, maxWidth: 420, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 4 }}>Histórico de alterações</div>
        <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 10 }}>Últimas edições e exclusões de lançamentos, pra você entender o que mudou.</div>
        {historico.length === 0 ? (
          <div style={{ fontSize: 12.5, color: pal.textoSuave }}>Nenhuma alteração registrada ainda.</div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {historico.slice(0, 20).map((h, i) => (
              <div key={h.id} style={{ padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}`, fontSize: 12 }}>
                <div style={{ color: pal.texto }}>
                  {h.tipo === "excluido" ? "🗑 Excluído: " : "✏️ Editado: "}<strong>{h.descricaoLancamento}</strong>
                </div>
                <div style={{ color: pal.textoSuave, fontSize: 11 }}>{h.detalhes} — {new Date(h.quando).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        )}
      </Cartao>

    </div>
  );
}

/* ============================================================
   18. ENTRADA RÁPIDA (barra fixa no topo)
   ============================================================ */
/* ============================================================
   18b. TELA DE BLOQUEIO (PIN local)
   ============================================================ */
function TelaBloqueio({ pal, onDesbloquear }) {
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState(false);
  const [confirmandoReset, setConfirmandoReset] = useState(false);

  const digitar = (d) => {
    if (valor.length >= 6) return;
    const novo = valor + d;
    setValor(novo);
    setErro(false);
    if (novo.length >= 4) {
      setTimeout(() => {
        if (!onDesbloquear(novo)) { setErro(true); setValor(""); }
      }, 120);
    }
  };
  const apagar = () => setValor((v) => v.slice(0, -1));

  return (
    <div style={{ minHeight: "100vh", background: pal.fundo, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 20 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1B2A4A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Wallet size={20} color="#fff" />
      </div>
      <div style={{ fontSize: 15, color: pal.texto, marginBottom: 4, fontWeight: 600 }}>Digite seu PIN</div>
      <div style={{ fontSize: 12, color: erro ? VERMELHO : pal.textoSuave, marginBottom: 18, minHeight: 16 }}>{erro ? "PIN incorreto, tente de novo" : "Só você tem acesso aos seus dados"}</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${pal.borda}`, background: valor.length > i ? pal.texto : "transparent" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 60px)", gap: 12 }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button key={n} onClick={() => digitar(n)} style={{ width: 60, height: 60, borderRadius: "50%", border: `1px solid ${pal.borda}`, background: pal.cartao, color: pal.texto, fontSize: 20, cursor: "pointer" }}>{n}</button>
        ))}
        <div />
        <button onClick={() => digitar("0")} style={{ width: 60, height: 60, borderRadius: "50%", border: `1px solid ${pal.borda}`, background: pal.cartao, color: pal.texto, fontSize: 20, cursor: "pointer" }}>0</button>
        <button onClick={apagar} style={{ width: 60, height: 60, borderRadius: "50%", border: "none", background: "transparent", color: pal.textoSuave, fontSize: 13, cursor: "pointer" }}>Apagar</button>
      </div>
      <button onClick={() => setConfirmandoReset(true)} style={{ marginTop: 26, fontSize: 12, color: pal.textoSuave, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}>
        Esqueci meu PIN
      </button>
      {confirmandoReset && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: pal.cartao, borderRadius: 14, padding: 22, maxWidth: 340, border: `1px solid ${pal.borda}` }}>
            <div style={{ fontSize: 14, color: pal.texto, marginBottom: 16 }}>
              Isso remove a trava de PIN, mas <strong>não apaga nenhum dado</strong>. Como tudo fica só neste navegador, não existe um jeito de "recuperar" o PIN de outra forma. Quer mesmo remover a trava?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setConfirmandoReset(false)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${pal.borda}`, background: "transparent", color: pal.textoSuave, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button onClick={() => { onDesbloquear("__RESET__"); }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: VERMELHO, color: "#fff", cursor: "pointer", fontSize: 13 }}>Remover trava</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EntradaRapida() {
  const { adicionarLancamento, contas, pal, mostrarToast } = useApp();
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);

  const lancar = (e) => {
    e.preventDefault();
    const r = parseEntradaRapida(texto);
    if (!r.valor) { alert("Não consegui identificar um valor no texto. Tente algo como 'mercado 120'."); return; }
    adicionarLancamento({
      tipo: "despesa", data: r.data, categoria: r.categoria, descricao: r.descricao, pessoa: "",
      status: "-", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "", observacoes: "", anexo: null,
    }, r.valor);
    mostrarToast(`"${r.descricao}" — ${formatarMoeda(r.valor)} lançado`);
    setTexto(""); setAberto(false);
  };

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${pal.borda}`, color: pal.textoSuave, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
        <Zap size={14} /> Entrada rápida
      </button>
    );
  }
  return (
    <form onSubmit={lancar} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input autoFocus type="text" placeholder='Ex.: "mercado 120 hoje" ou "uber 32 ontem"' value={texto} onChange={(e) => setTexto(e.target.value)} style={{ ...estiloInput(pal), width: 260 }} />
      <Botao type="submit"><Zap size={14} /> Lançar</Botao>
      <button type="button" onClick={() => setAberto(false)} style={{ border: "none", background: "none", color: pal.textoSuave, cursor: "pointer" }}><X size={16} /></button>
    </form>
  );
}

/* ============================================================
   19. APP RAIZ (provider + estado + migração + geração automática)
   ============================================================ */
export default function App() {
  const [pronto, setPronto] = useState(false);
  const [lancamentos, setLancamentosState] = useState([]);
  const [contas, setContasState] = useState([]);
  const [cartoes, setCartoesState] = useState([]);
  const [metas, setMetasState] = useState({});
  const [favoritos, setFavoritosState] = useState([]);
  const [recorrentes, setRecorrentesState] = useState([]);
  const [categoriasDespesa, setCategoriasDespesaState] = useState(CATEGORIAS_DESPESA_PADRAO);
  const [categoriasReceita, setCategoriasReceitaState] = useState(CATEGORIAS_RECEITA_PADRAO);
  const [metasEconomia, setMetasEconomiaState] = useState([]);
  const [historico, setHistoricoState] = useState([]);
  const [viagens, setViagensState] = useState([]);
  const historicoRef = useRef([]);
  useEffect(() => { historicoRef.current = historico; }, [historico]);
  const [tema, setTemaState] = useState("claro");
  const [cor, setCorState] = useState("#1B2A4A");
  const [pagina, setPagina] = useState("dashboard");
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual());
  const [toast, setToast] = useState(null);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [ultimoBackup, setUltimoBackupState] = useState(null);
  const [notificacoesAtivas, setNotificacoesAtivasState] = useState(false);
  const [clientIdDrive, setClientIdDriveState] = useState("");
  const [pin, setPinState] = useState("");
  const [desbloqueado, setDesbloqueado] = useState(true);
  const toastTimeoutRef = useRef(null);
  const lancamentosRef = useRef([]);
  const contasRef = useRef([]);
  const cartoesRef = useRef([]);
  const recorrentesRef = useRef([]);
  const favoritosRef = useRef([]);
  useEffect(() => { lancamentosRef.current = lancamentos; }, [lancamentos]);
  useEffect(() => { contasRef.current = contas; }, [contas]);
  useEffect(() => { cartoesRef.current = cartoes; }, [cartoes]);
  useEffect(() => { recorrentesRef.current = recorrentes; }, [recorrentes]);
  useEffect(() => { favoritosRef.current = favoritos; }, [favoritos]);

  const mostrarToast = (msg, acao = null, duracaoMs = acao ? 5000 : 2600) => {
    clearTimeout(toastTimeoutRef.current);
    setToast({ msg, acao });
    toastTimeoutRef.current = setTimeout(() => setToast(null), duracaoMs);
  };

  const salvar = async (chave, valor, setter) => {
    setter(valor);
    try { await window.storage.set(chave, JSON.stringify(valor), false); } catch (e) {}
  };

  // ---------- Carregamento inicial + migração ----------
  useEffect(() => {
    (async () => {
      const ler = async (chave) => {
        try { const r = await window.storage.get(chave, false); return r && r.value ? JSON.parse(r.value) : null; }
        catch (e) { return null; }
      };
      let lanc = await ler("lancamentos");
      let cts = await ler("contas");
      const crt = (await ler("cartoes")) || [];
      const mts = (await ler("metas")) || {};
      const fav = (await ler("favoritos")) || [];
      const rec = (await ler("recorrentes")) || [];
      const cfg = (await ler("config")) || { tema: "claro", cor: "#1B2A4A" };
      let catDesp = await ler("categoriasDespesa");
      let catRec = await ler("categoriasReceita");
      if (catDesp === null) { catDesp = CATEGORIAS_DESPESA_PADRAO; await window.storage.set("categoriasDespesa", JSON.stringify(catDesp), false); }
      if (catRec === null) { catRec = CATEGORIAS_RECEITA_PADRAO; await window.storage.set("categoriasReceita", JSON.stringify(catRec), false); }

      if (lanc === null || cts === null) {
        // migração de versão anterior (gastos + rendas), ou seed inicial
        const gastosAntigos = await ler("gastos");
        const rendasAntigas = await ler("rendas");
        if (gastosAntigos) {
          const migrado = migrarDadosAntigos(gastosAntigos, rendasAntigas);
          lanc = migrado.lancamentos; cts = migrado.contas;
        } else {
          const migrado = migrarDadosAntigos(SEED_GASTOS_ANTIGOS, SEED_RENDAS_ANTIGAS);
          lanc = migrado.lancamentos; cts = migrado.contas;
        }
        await window.storage.set("lancamentos", JSON.stringify(lanc), false);
        await window.storage.set("contas", JSON.stringify(cts), false);
      }

      // geração automática de recorrentes — cobre também meses pendentes,
      // caso você tenha ficado um tempo sem abrir o app
      const mAtual = mesAtual();
      let lancFinal = lanc;
      const recAtualizados = rec.map((r) => {
        if (r.ultimoMesGerado === mAtual) return r;
        const mesesParaGerar = r.ultimoMesGerado ? mesesEntre(r.ultimoMesGerado, mAtual) : [mAtual];
        mesesParaGerar.forEach((m) => {
          const dia = String(Math.min(r.diaDoMes, diasNoMes(m))).padStart(2, "0");
          lancFinal = [{
            id: genId("rec"), data: `${m}-${dia}`, tipo: "despesa", categoria: r.categoria, descricao: r.descricao,
            pessoa: "", status: "-", contaId: r.contaId, cartaoId: r.cartaoId || null, valor: r.valor, escopo: "pessoal",
            observacoes: "Gerado automaticamente (recorrente)", anexo: null, parcelaInfo: null, recorrenteId: r.id,
          }, ...lancFinal];
        });
        return { ...r, ultimoMesGerado: mAtual };
      });
      if (recAtualizados.some((r, i) => r.ultimoMesGerado !== rec[i]?.ultimoMesGerado)) {
        await window.storage.set("lancamentos", JSON.stringify(lancFinal), false);
        await window.storage.set("recorrentes", JSON.stringify(recAtualizados), false);
      }

      setLancamentosState(lancFinal);
      setContasState(cts);
      setCartoesState(crt);
      setMetasState(mts);
      setFavoritosState(fav);
      setRecorrentesState(recAtualizados);
      setCategoriasDespesaState(catDesp);
      setCategoriasReceitaState(catRec);
      setTemaState(cfg.tema || "claro");
      setCorState(cfg.cor || "#1B2A4A");
      setNotificacoesAtivasState(!!cfg.notificacoesAtivas);
      setClientIdDriveState(cfg.clientIdDrive || "");
      setPinState(cfg.pin || "");
      setDesbloqueado(!cfg.pin);
      const ub = await ler("ultimoBackup");
      setUltimoBackupState(ub);
      const me = (await ler("metasEconomia")) || [];
      setMetasEconomiaState(me);
      const hist = (await ler("historico")) || [];
      setHistoricoState(hist);
      const vg = (await ler("viagens")) || [];
      setViagensState(vg);
      const mesesComDados = Array.from(new Set(lancFinal.map((x) => x.data.slice(0, 7)))).sort();
      if (mesesComDados.length > 0) setMesSelecionado(mesesComDados.at(-1));
      setPronto(true);
    })();
  }, []);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(lancamentos.map((l) => l.data.slice(0, 7)));
    set.add(mesAtual());
    return Array.from(set).sort().reverse();
  }, [lancamentos]);

  // Notificação local (só dispara enquanto o app está aberto) avisando sobre
  // contas "A pagar" que vencem nos próximos 3 dias — no máximo 1x por dia.
  useEffect(() => {
    if (!pronto || !notificacoesAtivas || !("Notification" in window) || Notification.permission !== "granted") return;
    (async () => {
      let ultimaNotif = null;
      try { const r = await window.storage.get("ultimaNotificacaoVencimento", false); ultimaNotif = r?.value; } catch (e) {}
      if (ultimaNotif === hojeISO()) return;
      const hj = hojeISO();
      const emTresDias = new Date(); emTresDias.setDate(emTresDias.getDate() + 3);
      const emTresDiasStr = emTresDias.toISOString().slice(0, 10);
      const proximos = lancamentos.filter((l) => l.tipo === "despesa" && l.status === "A pagar" && l.data >= hj && l.data <= emTresDiasStr);
      if (proximos.length > 0) {
        const total = proximos.reduce((s, l) => s + l.valor, 0);
        new Notification("Contas vencendo em breve", {
          body: `${proximos.length} lançamento(s) somando ${formatarMoeda(total)} vencem nos próximos 3 dias.`,
          icon: "/icon-192.png",
        });
      }
      window.storage.set("ultimaNotificacaoVencimento", hj, false).catch(() => {});
    })();
  }, [pronto, notificacoesAtivas, lancamentos]);

  // ---------- Ações: Lançamentos ----------
  const importarLancamentos = (novos) => {
    salvar("lancamentos", [...novos, ...lancamentos], setLancamentosState);
    mostrarToast(`${novos.length} lançamento${novos.length > 1 ? "s" : ""} importado${novos.length > 1 ? "s" : ""}`);
  };

  const adicionarLancamento = (f, valorNum) => {
    if (f.parcelado && f.valorTotalParcelamento && f.qtdParcelas) {
      const total = parseFloat(String(f.valorTotalParcelamento).replace(",", "."));
      const qtd = parseInt(f.qtdParcelas, 10);
      const atualInicio = parseInt(f.parcelaAtual || "1", 10);
      const valorParcela = Math.round((total / qtd) * 100) / 100;
      const grupo = genId("parc");
      const novos = [];
      for (let n = atualInicio; n <= qtd; n++) {
        novos.push({
          id: genId("l"), data: addMeses(f.data, n - atualInicio), tipo: "despesa", categoria: f.categoria,
          descricao: f.descricao.trim(), pessoa: f.pessoa.trim(), status: n === atualInicio ? f.status : "A pagar",
          contaId: f.contaId, cartaoId: f.cartaoId || null, valor: valorParcela, observacoes: f.observacoes,
          anexo: f.anexo, escopo: f.escopo || "pessoal", emprestimo: !!f.emprestimo, viagemId: f.viagemId || null, parcelaInfo: { atual: n, total: qtd, grupo }, recorrenteId: null,
        });
      }
      salvar("lancamentos", [...novos, ...lancamentos], setLancamentosState);
      setMesSelecionado(f.data.slice(0, 7));
      mostrarToast(`${novos.length} parcelas criadas`);
      return;
    }
    const novo = {
      id: genId("l"), data: f.data, tipo: f.tipo, categoria: f.categoria, descricao: f.descricao.trim(),
      pessoa: (f.pessoa || "").trim(), status: f.status, contaId: f.contaId, cartaoId: f.cartaoId || null,
      valor: valorNum, observacoes: f.observacoes || "", anexo: f.anexo || null, escopo: f.escopo || "pessoal", emprestimo: !!f.emprestimo, viagemId: f.viagemId || null, parcelaInfo: null, recorrenteId: null,
    };
    salvar("lancamentos", [novo, ...lancamentos], setLancamentosState);
    setMesSelecionado(f.data.slice(0, 7));
    mostrarToast("Lançamento adicionado");
  };

  const adicionarViagem = (dados) => salvar("viagens", [...viagens, { ...dados, id: genId("viagem") }], setViagensState);
  const editarViagem = (id, dados) => salvar("viagens", viagens.map((v) => (v.id === id ? { ...v, ...dados } : v)), setViagensState);
  const excluirViagem = (id) => {
    salvar("viagens", viagens.filter((v) => v.id !== id), setViagensState);
    salvar("lancamentos", lancamentos.map((l) => (l.viagemId === id ? { ...l, viagemId: null } : l)), setLancamentosState);
    mostrarToast("Viagem excluída — os lançamentos dela continuam existindo, só sem a marcação");
  };

  const registrarHistorico = (entrada) => {
    const novo = [{ id: genId("hist"), quando: new Date().toISOString(), ...entrada }, ...historicoRef.current].slice(0, 200);
    salvar("historico", novo, setHistoricoState);
  };

  const editarLancamento = (id, novosCampos) => {
    const antigo = lancamentos.find((l) => l.id === id);
    const atualizados = lancamentos.map((l) => (l.id === id ? { ...l, ...novosCampos } : l));
    salvar("lancamentos", atualizados, setLancamentosState);
    if (antigo) {
      const camposRelevantes = ["categoria", "descricao", "valor", "status", "data"];
      const mudancas = camposRelevantes.filter((k) => novosCampos[k] !== undefined && String(novosCampos[k]) !== String(antigo[k]));
      if (mudancas.length > 0) {
        const resumo = mudancas.map((k) => `${k}: "${antigo[k]}" → "${novosCampos[k]}"`).join(", ");
        registrarHistorico({ tipo: "editado", descricaoLancamento: antigo.descricao, detalhes: resumo });
      }
    }
    mostrarToast("Lançamento atualizado");
  };

  const editarLancamentoGrupo = (grupoId, dataApartirDe, campos) => {
    const atualizados = lancamentos.map((l) =>
      l.parcelaInfo?.grupo === grupoId && l.data >= dataApartirDe ? { ...l, ...campos } : l
    );
    salvar("lancamentos", atualizados, setLancamentosState);
  };

  const excluirLancamento = (id) => {
    const item = lancamentos.find((l) => l.id === id);
    salvar("lancamentos", lancamentos.filter((l) => l.id !== id), setLancamentosState);
    if (item) {
      registrarHistorico({ tipo: "excluido", descricaoLancamento: item.descricao, detalhes: `valor: ${formatarMoeda(item.valor)}, data: ${item.data}` });
      mostrarToast("Lançamento excluído", {
        label: "Desfazer",
        onClick: () => salvar("lancamentos", [item, ...lancamentosRef.current.filter((l) => l.id !== item.id)], setLancamentosState),
      });
    } else {
      mostrarToast("Lançamento excluído");
    }
  };

  const excluirLancamentosEmLote = (ids) => {
    const idsSet = new Set(ids);
    const removidos = lancamentos.filter((l) => idsSet.has(l.id));
    salvar("lancamentos", lancamentos.filter((l) => !idsSet.has(l.id)), setLancamentosState);
    mostrarToast(`${removidos.length} lançamento(s) excluído(s)`, {
      label: "Desfazer",
      onClick: () => salvar("lancamentos", [...removidos, ...lancamentosRef.current], setLancamentosState),
    });
  };

  const editarLancamentosEmLote = (ids, campos) => {
    const idsSet = new Set(ids);
    salvar("lancamentos", lancamentos.map((l) => (idsSet.has(l.id) ? { ...l, ...campos } : l)), setLancamentosState);
    mostrarToast(`${ids.length} lançamento(s) atualizado(s)`);
  };

  // ---------- Ações: Contas / Cartões / Metas / Favoritos ----------
  const adicionarConta = (c) => salvar("contas", [...contas, { ...c, id: genId("conta") }], setContasState);
  const editarConta = (id, dados) => salvar("contas", contas.map((c) => (c.id === id ? { ...c, ...dados } : c)), setContasState);
  const excluirConta = (id) => {
    const item = contas.find((c) => c.id === id);
    salvar("contas", contas.filter((c) => c.id !== id), setContasState);
    salvar("lancamentos", lancamentos.map((l) => (l.contaId === id ? { ...l, contaId: "" } : l)), setLancamentosState);
    if (item) mostrarToast("Conta excluída", { label: "Desfazer", onClick: () => salvar("contas", [...contasRef.current, item], setContasState) });
  };
  const definirContaPadrao = (id) => salvar("contas", contas.map((c) => ({ ...c, padrao: c.id === id })), setContasState);
  const arquivarConta = (id, arquivada) => salvar("contas", contas.map((c) => (c.id === id ? { ...c, arquivada } : c)), setContasState);
  const adicionarTransferencia = (origemId, destinoId, valor, data, descricao) => {
    const grupo = genId("transf");
    const saida = {
      id: genId("l"), data, tipo: "transferencia", direcao: "saida", categoria: "Transferência",
      descricao: descricao || "Transferência entre contas", pessoa: "", status: "Pago", contaId: origemId, cartaoId: null,
      valor, observacoes: "", anexo: null, escopo: "pessoal", emprestimo: false, viagemId: null, parcelaInfo: null, recorrenteId: null, transferenciaId: grupo,
    };
    const entrada = { ...saida, id: genId("l"), direcao: "entrada", contaId: destinoId };
    salvar("lancamentos", [saida, entrada, ...lancamentos], setLancamentosState);
    mostrarToast("Transferência registrada");
  };
  const ajustarSaldoConta = (contaId, diferenca, data) => {
    const novo = {
      id: genId("l"), data, tipo: diferenca >= 0 ? "receita" : "despesa", categoria: "Ajuste de saldo",
      descricao: "Ajuste de conciliação", pessoa: "", status: "Pago", contaId, cartaoId: null,
      valor: Math.abs(diferenca), observacoes: "Criado pela conferência de saldo", anexo: null, escopo: "pessoal",
      emprestimo: false, viagemId: null, parcelaInfo: null, recorrenteId: null,
    };
    salvar("lancamentos", [novo, ...lancamentos], setLancamentosState);
    mostrarToast("Ajuste registrado — saldo conferido");
  };
  const adicionarCartao = (c) => salvar("cartoes", [...cartoes, { ...c, id: genId("cartao") }], setCartoesState);
  const editarCartao = (id, dados) => salvar("cartoes", cartoes.map((c) => (c.id === id ? { ...c, ...dados } : c)), setCartoesState);
  const excluirCartao = (id) => {
    const item = cartoes.find((c) => c.id === id);
    salvar("cartoes", cartoes.filter((c) => c.id !== id), setCartoesState);
    salvar("lancamentos", lancamentos.map((l) => (l.cartaoId === id ? { ...l, cartaoId: null } : l)), setLancamentosState);
    if (item) mostrarToast("Cartão excluído", { label: "Desfazer", onClick: () => salvar("cartoes", [...cartoesRef.current, item], setCartoesState) });
  };
  const definirMeta = (categoria, valor) => salvar("metas", { ...metas, [categoria]: valor }, setMetasState);

  const adicionarMetaEconomia = (nome, valorAlvo, corMeta) => {
    salvar("metasEconomia", [...metasEconomia, { id: genId("metaec"), nome, valorAlvo, cor: corMeta, aportes: [] }], setMetasEconomiaState);
  };
  const excluirMetaEconomia = (id) => salvar("metasEconomia", metasEconomia.filter((m) => m.id !== id), setMetasEconomiaState);
  const adicionarAporte = (metaId, valor, data) => {
    salvar("metasEconomia", metasEconomia.map((m) => (m.id === metaId ? { ...m, aportes: [...m.aportes, { id: genId("aporte"), valor, data }] } : m)), setMetasEconomiaState);
    mostrarToast("Aporte registrado");
  };
  const adicionarFavorito = (f) => {
    salvar("favoritos", [...favoritos, { id: genId("fav"), descricao: f.descricao, categoria: f.categoria, valor: parseFloat(String(f.valor).replace(",", ".")) || 0, contaId: f.contaId, status: f.status, tipo: f.tipo, pessoa: f.pessoa, cartaoId: f.cartaoId }], setFavoritosState);
    mostrarToast("Salvo nos favoritos");
  };
  const excluirFavorito = (id) => {
    const item = favoritos.find((f) => f.id === id);
    salvar("favoritos", favoritos.filter((f) => f.id !== id), setFavoritosState);
    if (item) mostrarToast("Favorito removido", { label: "Desfazer", onClick: () => salvar("favoritos", [...favoritosRef.current, item], setFavoritosState) });
  };
  const adicionarRecorrente = (r) => {
    salvar("recorrentes", [...recorrentes, { ...r, id: genId("rec"), ultimoMesGerado: null }], setRecorrentesState);
    mostrarToast("Recorrente cadastrada — vai gerar o lançamento automaticamente todo mês");
  };
  const excluirRecorrente = (id) => {
    const item = recorrentes.find((r) => r.id === id);
    salvar("recorrentes", recorrentes.filter((r) => r.id !== id), setRecorrentesState);
    if (item) mostrarToast("Recorrente excluída", { label: "Desfazer", onClick: () => salvar("recorrentes", [...recorrentesRef.current, item], setRecorrentesState) });
  };
  const editarRecorrente = (id, dados) => salvar("recorrentes", recorrentes.map((r) => (r.id === id ? { ...r, ...dados } : r)), setRecorrentesState);

  // ---------- Ações: Categorias editáveis ----------
  const adicionarCategoria = (tipo, nome, corCat) => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return;
    if (tipo === "receita") {
      if (categoriasReceita.some((c) => c.nome === nomeLimpo)) return;
      salvar("categoriasReceita", [...categoriasReceita, { nome: nomeLimpo, cor: corCat }], setCategoriasReceitaState);
    } else {
      if (categoriasDespesa.some((c) => c.nome === nomeLimpo)) return;
      salvar("categoriasDespesa", [...categoriasDespesa, { nome: nomeLimpo, cor: corCat }], setCategoriasDespesaState);
    }
  };
  const editarCategoria = (tipo, nomeAntigo, novosDados) => {
    const lista = tipo === "receita" ? categoriasReceita : categoriasDespesa;
    const setter = tipo === "receita" ? setCategoriasReceitaState : setCategoriasDespesaState;
    const chave = tipo === "receita" ? "categoriasReceita" : "categoriasDespesa";
    const atualizada = lista.map((c) => (c.nome === nomeAntigo ? { ...c, ...novosDados } : c));
    salvar(chave, atualizada, setter);
    if (novosDados.nome && novosDados.nome !== nomeAntigo) {
      salvar("lancamentos", lancamentos.map((l) => (l.categoria === nomeAntigo && l.tipo === tipo ? { ...l, categoria: novosDados.nome } : l)), setLancamentosState);
      if (metas[nomeAntigo] !== undefined) {
        const novasMetas = { ...metas, [novosDados.nome]: metas[nomeAntigo] };
        delete novasMetas[nomeAntigo];
        salvar("metas", novasMetas, setMetasState);
      }
    }
  };
  const excluirCategoria = (tipo, nome) => {
    if (nome === "Outros") { mostrarToast("A categoria 'Outros' não pode ser excluída"); return; }
    const lista = tipo === "receita" ? categoriasReceita : categoriasDespesa;
    const setter = tipo === "receita" ? setCategoriasReceitaState : setCategoriasDespesaState;
    const chave = tipo === "receita" ? "categoriasReceita" : "categoriasDespesa";
    salvar(chave, lista.filter((c) => c.nome !== nome), setter);
    salvar("lancamentos", lancamentos.map((l) => (l.categoria === nome && l.tipo === tipo ? { ...l, categoria: "Outros" } : l)), setLancamentosState);
    if (metas[nome] !== undefined) {
      const novasMetas = { ...metas };
      delete novasMetas[nome];
      salvar("metas", novasMetas, setMetasState);
    }
  };


  const restaurarBackup = (dados) => {
    if (dados.lancamentos) salvar("lancamentos", dados.lancamentos, setLancamentosState);
    if (dados.contas) salvar("contas", dados.contas, setContasState);
    if (dados.cartoes) salvar("cartoes", dados.cartoes, setCartoesState);
    if (dados.metas) salvar("metas", dados.metas, setMetasState);
    if (dados.favoritos) salvar("favoritos", dados.favoritos, setFavoritosState);
    if (dados.recorrentes) salvar("recorrentes", dados.recorrentes, setRecorrentesState);
    if (dados.categoriasDespesa) salvar("categoriasDespesa", dados.categoriasDespesa, setCategoriasDespesaState);
    if (dados.categoriasReceita) salvar("categoriasReceita", dados.categoriasReceita, setCategoriasReceitaState);
    if (dados.metasEconomia) salvar("metasEconomia", dados.metasEconomia, setMetasEconomiaState);
    if (dados.viagens) salvar("viagens", dados.viagens, setViagensState);
  };

  const salvarConfig = (novosCampos) => {
    const cfg = { tema, cor, notificacoesAtivas, clientIdDrive, pin, ...novosCampos };
    window.storage.set("config", JSON.stringify(cfg), false).catch(() => {});
  };
  const setTema = (t) => { setTemaState(t); salvarConfig({ tema: t }); };
  const setCor = (c) => { setCorState(c); salvarConfig({ cor: c }); };
  const salvarClientIdDrive = (v) => { setClientIdDriveState(v); salvarConfig({ clientIdDrive: v }); };
  const definirPin = (novoPin) => { setPinState(novoPin); salvarConfig({ pin: novoPin }); mostrarToast(novoPin ? "PIN definido" : "PIN removido"); };
  const desbloquearComPin = (tentativa) => {
    if (tentativa === "__RESET__") { setPinState(""); salvarConfig({ pin: "" }); setDesbloqueado(true); return true; }
    if (tentativa === pin) { setDesbloqueado(true); return true; }
    return false;
  };
  const ativarNotificacoes = async () => {
    if (!("Notification" in window)) { mostrarToast("Seu navegador não suporta notificações"); return; }
    const permissao = await Notification.requestPermission();
    if (permissao === "granted") {
      setNotificacoesAtivasState(true);
      salvarConfig({ notificacoesAtivas: true });
      mostrarToast("Lembretes de vencimento ativados");
    } else {
      mostrarToast("Permissão de notificação negada pelo navegador");
    }
  };
  const desativarNotificacoes = () => { setNotificacoesAtivasState(false); salvarConfig({ notificacoesAtivas: false }); };

  const exportarBackupJSON = () => {
    const dados = { lancamentos, contas, cartoes, metas, favoritos, recorrentes, categoriasDespesa, categoriasReceita, metasEconomia, viagens, exportadoEm: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `backup-financeiro-${hojeISO()}.json`; a.click();
    URL.revokeObjectURL(url);
    salvar("ultimoBackup", hojeISO(), setUltimoBackupState);
    mostrarToast("Backup exportado");
  };

  const pal = PALETA[tema];

  const valorCtx = {
    lancamentos, contas, cartoes, metas, favoritos, recorrentes,
    categoriasDespesa, categoriasReceita, adicionarCategoria, editarCategoria, excluirCategoria,
    mesSelecionado, setMesSelecionado, mesesDisponiveis,
    adicionarLancamento, editarLancamento, editarLancamentoGrupo, excluirLancamento, importarLancamentos,
    excluirLancamentosEmLote, editarLancamentosEmLote,
    adicionarConta, editarConta, excluirConta, adicionarCartao, editarCartao, excluirCartao,
    definirContaPadrao, arquivarConta, adicionarTransferencia, ajustarSaldoConta,
    definirMeta, adicionarFavorito, excluirFavorito, restaurarBackup, exportarBackupJSON, ultimoBackup,
    metasEconomia, adicionarMetaEconomia, excluirMetaEconomia, adicionarAporte,
    adicionarRecorrente, editarRecorrente, excluirRecorrente,
    notificacoesAtivas, ativarNotificacoes, desativarNotificacoes,
    clientIdDrive, salvarClientIdDrive,
    pin, definirPin,
    historico,
    viagens, adicionarViagem, editarViagem, excluirViagem,
    tema, setTema,
    cor, setCor,
    pal, mostrarToast, setPagina,
  };

  if (!pronto) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B6459" }}>Carregando seu financeiro...</div>;
  }

  if (pin && !desbloqueado) {
    return <TelaBloqueio pal={pal} onDesbloquear={desbloquearComPin} />;
  }

  const paginas = {
    dashboard: PainelDashboard, lancamentos: PainelLancamentos, calendario: PainelCalendario,
    contas: PainelContas, cartoes: PainelCartoes, recorrentes: PainelRecorrentes, dividas: PainelDividas, viagens: PainelViagens, estatisticas: PainelEstatisticas,
    metas: PainelMetas, favoritos: PainelFavoritos, backup: PainelBackup, config: PainelConfiguracoes,
  };
  const PaginaAtual = paginas[pagina] || PainelDashboard;
  const tituloPagina = ITENS_MENU.find((i) => i.id === pagina)?.label || "Dashboard";

  return (
    <AppCtx.Provider value={valorCtx}>
      <div style={{ background: pal.fundo, minHeight: "100%", color: pal.texto, fontFamily: "'Inter', sans-serif", display: "flex" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
          .num-tab { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
          .titulo-serif { font-family: 'Fraunces', serif; }
          .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500; display: inline-block; }
          select, input, textarea, button { font-family: 'Inter', sans-serif; }
          .form-lancamento { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .form-lancamento .span-2 { grid-column: span 2; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-thumb { background: ${pal.borda}; border-radius: 4px; }
          @media (max-width: 760px) {
            .sidebar { position: fixed; left: -220px; top: 0; bottom: 0; z-index: 50; transition: left .2s; box-shadow: 4px 0 14px rgba(0,0,0,0.15); }
            .sidebar-aberta { left: 0 !important; }
            .overlay-mobile { display: block !important; }
            .grid-responsiva { grid-template-columns: 1fr !important; }
            .form-lancamento { grid-template-columns: 1fr !important; }
            .form-lancamento .span-2 { grid-column: span 1 !important; }
          }
          @media print {
            .sidebar, .no-print, .botao-menu-mobile { display: none !important; }
            body, #root { background: #fff !important; }
            #area-impressao { max-width: 100% !important; padding: 0 !important; }
          }
        `}</style>

        <Sidebar paginaAtiva={pagina} onNavegar={setPagina} aberta={sidebarAberta} onFechar={() => setSidebarAberta(false)} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${pal.borda}`, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="botao-menu-mobile" onClick={() => setSidebarAberta(true)} style={{ display: "none", border: "none", background: "none", color: pal.texto, cursor: "pointer" }}><Menu size={20} /></button>
              <div className="titulo-serif" style={{ fontSize: 19, fontWeight: 600 }}>{tituloPagina}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="no-print">
              <button onClick={() => window.print()} title="Imprimir ou salvar como PDF" style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${pal.borda}`, color: pal.textoSuave, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
                <Printer size={14} /> Imprimir / PDF
              </button>
              <EntradaRapida />
            </div>
          </div>
          <div style={{ padding: "20px 24px 60px", maxWidth: 1080 }} id="area-impressao">
            <PaginaAtual />
          </div>
        </div>
        <Toast toast={toast} onFechar={() => { clearTimeout(toastTimeoutRef.current); setToast(null); }} />
      </div>
    </AppCtx.Provider>
  );
}
