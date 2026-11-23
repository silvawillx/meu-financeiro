import { useState, useEffect, useMemo, useRef } from "react";
import { Menu, Printer } from "lucide-react";
import { AppCtx } from "./contexto.js";
import { PALETA } from "./tema.js";
import { Toast } from "./ui.jsx";
import { pagarFatura } from "./lib/faturas.js";
import { CATEGORIAS_DESPESA_PADRAO, CATEGORIAS_RECEITA_PADRAO } from "./lib/categorias.js";
import { gerarParcelas } from "./lib/parcelas.js";
import { dataLocalISO, hojeISO, mesAtual, addMeses } from "./lib/datas.js";
import { gerarRecorrentes } from "./lib/recorrentes.js";
import { aprenderRegra } from "./lib/regras.js";
import { genId, formatarMoeda } from "./lib/formato.js";
import { CONTA_PADRAO_ID, migrarDadosAntigos } from "./lib/migracao.js";
import { ITENS_MENU, Sidebar, BarraInferior } from "./componentes/Navegacao.jsx";
import { PainelDashboard } from "./telas/Dashboard.jsx";
import { PainelLancamentos } from "./telas/Lancamentos.jsx";
import { PainelCalendario } from "./telas/Calendario.jsx";
import { PainelContas } from "./telas/Contas.jsx";
import { PainelCartoes } from "./telas/Cartoes.jsx";
import { PainelInvestimentos } from "./telas/Investimentos.jsx";
import { PainelRecorrentes } from "./telas/Recorrentes.jsx";
import { PainelDividas } from "./telas/Dividas.jsx";
import { PainelViagens } from "./telas/Viagens.jsx";
import { PainelMetas } from "./telas/Metas.jsx";
import { PainelEstatisticas } from "./telas/Estatisticas.jsx";
import { PainelFavoritos } from "./telas/Favoritos.jsx";
import { PainelBackup } from "./telas/Backup.jsx";
import { EntradaRapida } from "./componentes/EntradaRapida.jsx";
import { PainelConfiguracoes } from "./telas/Configuracoes.jsx";
import PainelProjecao from "./telas/Projecao.jsx";
import Recomecar from "./componentes/Recomecar.jsx";

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
  const [investimentos, setInvestimentosState] = useState([]);
  const [regras, setRegrasState] = useState({}); // "uber" -> "Transporte": o que o app aprendeu com você
  const [textoRecebido, setTextoRecebido] = useState(""); // texto vindo do link ?lancar= (Atalhos do iPhone)
  const [mercado, setMercadoState] = useState({});
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
  const [pedidoNovoLanc, setPedidoNovoLanc] = useState(false);
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

  const pedirNovoLancamento = () => { setPagina("lancamentos"); setPedidoNovoLanc(true); };
  const consumirPedidoNovoLanc = () => setPedidoNovoLanc(false);

  const mostrarToast = (msg, acao = null, duracaoMs = acao ? 5000 : 2600) => {
    clearTimeout(toastTimeoutRef.current);
    setToast({ msg, acao });
    toastTimeoutRef.current = setTimeout(() => setToast(null), duracaoMs);
  };

  // Link do tipo https://seu-site/?lancar=TEXTO: abre a prévia do lançamento (nada é salvo sem você confirmar).
  useEffect(() => {
    if (!pronto) return;
    try {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("lancar");
      if (!t) return;
      u.searchParams.delete("lancar");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
      setPagina("lancamentos");
      setTextoRecebido(t);
    } catch (e) { /* link inválido: ignora */ }
  }, [pronto]);

  // Se o Supabase recusar uma gravação (sem internet, sessão expirada...), avisa.
  useEffect(() => {
    const aviso = () => mostrarToast("Não consegui salvar na nuvem. Confira a internet e tente de novo.", null, 6000);
    window.addEventListener("storage-erro", aviso);
    return () => window.removeEventListener("storage-erro", aviso);
  }, []);

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
          const migrado = migrarDadosAntigos([], {}); // conta nova começa vazia, só com a "Conta principal"
          lanc = migrado.lancamentos; cts = migrado.contas;
        }
        await window.storage.set("lancamentos", JSON.stringify(lanc), false);
        await window.storage.set("contas", JSON.stringify(cts), false);
      }

      // geração automática de recorrentes — cobre também meses pendentes,
      // caso você tenha ficado um tempo sem abrir o app
      const gerado = gerarRecorrentes({ recorrentes: rec, lancamentos: lanc, mesAlvo: mesAtual() });
      const lancFinal = gerado.lancamentos;
      const recAtualizados = gerado.recorrentes;
      if (gerado.alterou) {
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
      const ub = await ler("ultimoBackup");
      setUltimoBackupState(ub);
      const me = (await ler("metasEconomia")) || [];
      setMetasEconomiaState(me);
      const hist = (await ler("historico")) || [];
      setHistoricoState(hist);
      const vg = (await ler("viagens")) || [];
      setViagensState(vg);
      setInvestimentosState((await ler("investimentos")) || []);
      setRegrasState((await ler("regrasCategoria")) || {});
      setMercadoState((await ler("mercado")) || {});
      const mesesComDados = Array.from(new Set(lancFinal.map((x) => x.data.slice(0, 7)))).sort();
      // abre no mês atual; se ele não tem dados, no mais recente que já passou (parcelas/recorrências futuras não contam)
      const hojeMes = mesAtual();
      setMesSelecionado(mesesComDados.includes(hojeMes) ? hojeMes : (mesesComDados.filter((m) => m <= hojeMes).at(-1) || hojeMes));
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
      const emTresDiasStr = dataLocalISO(emTresDias);
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
      const novos = gerarParcelas(f);
      salvar("lancamentos", [...novos, ...lancamentos], setLancamentosState);
      setMesSelecionado(f.data.slice(0, 7));
      mostrarToast(`${novos.length} parcelas criadas`);
      return;
    }
    const recId = f.recorrente ? genId("rec") : null;
    const novo = {
      id: genId("l"), data: f.data, tipo: f.tipo, categoria: f.categoria, descricao: f.descricao.trim(),
      pessoa: (f.pessoa || "").trim(), status: f.status, contaId: f.contaId, cartaoId: f.cartaoId || null,
      valor: valorNum, observacoes: f.observacoes || "", anexo: f.anexo || null, escopo: f.escopo || "pessoal", emprestimo: !!f.emprestimo, viagemId: f.viagemId || null, parcelaInfo: null, recorrenteId: recId,
      ...(f.tipo === "receita" ? { origem: f.origem || "salario" } : {}),
    };
    salvar("lancamentos", [novo, ...lancamentos], setLancamentosState);
    if (recId) {
      salvar("recorrentes", [...recorrentes, {
        id: recId, tipo: f.tipo, descricao: novo.descricao, categoria: f.categoria, valor: valorNum,
        diaDoMes: parseInt(f.data.slice(8, 10), 10), contaId: f.contaId, cartaoId: f.cartaoId || "",
        origem: f.tipo === "receita" ? (f.origem || "salario") : undefined,
        dataFim: f.recorrenteFim || "", pausada: false, ultimoMesGerado: f.data.slice(0, 7),
      }], setRecorrentesState);
    }
    setMesSelecionado(f.data.slice(0, 7));
    let aviso = "";
    const limiteCat = f.tipo === "despesa" ? metas[f.categoria] : 0;
    if (limiteCat > 0) {
      const mes = f.data.slice(0, 7);
      const antes = lancamentos.filter((l) => l.tipo === "despesa" && l.categoria === f.categoria && l.data.slice(0, 7) === mes).reduce((s, l) => s + l.valor, 0);
      const antesPct = (antes / limiteCat) * 100, depoisPct = ((antes + valorNum) / limiteCat) * 100;
      if (antesPct < 100 && depoisPct >= 100) aviso = ` ⚠ ${f.categoria} passou do limite do mês (${formatarMoeda(limiteCat)})`;
      else if (antesPct < 80 && depoisPct >= 80) aviso = ` ⚠ ${f.categoria}: já usou ${depoisPct.toFixed(0)}% do limite`;
    }
    mostrarToast((recId ? "Lançamento criado e programado para todo mês" : "Lançamento adicionado") + aviso, null, aviso ? 5000 : undefined);
  };

  // ---------- Ações: Investimentos ----------
  const adicionarInvestimento = (dados) => { salvar("investimentos", [...investimentos, { ...dados, id: genId("inv") }], setInvestimentosState); mostrarToast("Investimento adicionado"); };
  const editarInvestimento = (id, dados) => salvar("investimentos", investimentos.map((a) => (a.id === id ? { ...a, ...dados } : a)), setInvestimentosState);
  const excluirInvestimento = (id) => { salvar("investimentos", investimentos.filter((a) => a.id !== id), setInvestimentosState); mostrarToast("Investimento excluído"); };
  const movimentarInvestimento = (id, movimento) => salvar("investimentos", investimentos.map((a) => (a.id === id ? { ...a, movimentos: [...(a.movimentos || []), movimento] } : a)), setInvestimentosState);
  const aprenderRegras = (pares) => {
    const novas = pares.reduce((acc, [desc, cat]) => aprenderRegra(acc, desc, cat), regras);
    if (novas !== regras) salvar("regrasCategoria", novas, setRegrasState);
  };
  const consumirTextoRecebido = () => setTextoRecebido("");
  const atualizarMercado = (novo) => salvar("mercado", novo, setMercadoState);

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
  const pagarFaturaCartao = (cartao, mesRef, contaId, valor, data) => {
    salvar("lancamentos", pagarFatura({ lancamentos, cartao, mesRef, contaId, valor, data }), setLancamentosState);
    mostrarToast(`Fatura ${cartao.nome} paga: ${formatarMoeda(valor)}`);
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


  // Limpa os lançamentos e deixa tudo pronto para lançar do zero (ver componentes/Recomecar.jsx).
  const recomecarDoZero = ({ manter, saldos }) => {
    salvar("historico", [], setHistoricoState);
    if (manter.contasCartoes) {
      salvar("contas", contas.map((c) => (saldos[c.id] !== undefined ? { ...c, saldoInicial: saldos[c.id] } : c)), setContasState);
    } else {
      salvar("contas", [{ id: CONTA_PADRAO_ID, nome: "Conta principal", tipo: "conta", saldoInicial: 0, cor: "#1B2A4A", padrao: true }], setContasState);
      salvar("cartoes", [], setCartoesState);
    }
    if (!manter.metas) { salvar("metasEconomia", [], setMetasEconomiaState); salvar("investimentos", [], setInvestimentosState); }
    if (!manter.categorias) {
      salvar("categoriasDespesa", CATEGORIAS_DESPESA_PADRAO, setCategoriasDespesaState);
      salvar("categoriasReceita", CATEGORIAS_RECEITA_PADRAO, setCategoriasReceitaState);
      salvar("metas", {}, setMetasState);
      salvar("favoritos", [], setFavoritosState);
    }
    // recorrentes mantidas: volta um mês para recriar os lançamentos deste mês; senão, apaga
    const anterior = addMeses(`${mesAtual()}-01`, -1).slice(0, 7);
    const recs = manter.recorrentes ? recorrentes.map((r) => ({ ...r, ultimoMesGerado: anterior, mesesIgnorados: [] })) : [];
    const gerado = gerarRecorrentes({ recorrentes: recs, lancamentos: [], mesAlvo: mesAtual() });
    salvar("lancamentos", gerado.lancamentos, setLancamentosState);
    salvar("recorrentes", gerado.recorrentes, setRecorrentesState);
    setMesSelecionado(mesAtual());
    mostrarToast("Tudo limpo. Pode lançar do zero!");
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
    if (dados.investimentos) salvar("investimentos", dados.investimentos, setInvestimentosState);
    if (dados.regrasCategoria && typeof dados.regrasCategoria === "object") salvar("regrasCategoria", dados.regrasCategoria, setRegrasState);
  };

  const salvarConfig = (novosCampos) => {
    const cfg = { tema, cor, notificacoesAtivas, ...novosCampos };
    window.storage.set("config", JSON.stringify(cfg), false).catch(() => {});
  };
  const setTema = (t) => { setTemaState(t); salvarConfig({ tema: t }); };
  const setCor = (c) => { setCorState(c); salvarConfig({ cor: c }); };
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
    const dados = { lancamentos, contas, cartoes, metas, favoritos, recorrentes, categoriasDespesa, categoriasReceita, metasEconomia, viagens, investimentos, regrasCategoria: regras, exportadoEm: new Date().toISOString() };
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
    historico,
    viagens, adicionarViagem, editarViagem, excluirViagem,
    tema, setTema,
    cor, setCor,
    pal, mostrarToast, setPagina,
    pedidoNovoLanc, consumirPedidoNovoLanc,
    pagarFaturaCartao, recomecarDoZero,
    regras, aprenderRegras, textoRecebido, consumirTextoRecebido,
    investimentos, mercado, adicionarInvestimento, editarInvestimento, excluirInvestimento, movimentarInvestimento, atualizarMercado,
  };

  if (!pronto) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B6459" }}>Carregando seu financeiro...</div>;
  }

  const paginas = {
    dashboard: PainelDashboard, lancamentos: PainelLancamentos, calendario: PainelCalendario,
    contas: PainelContas, cartoes: PainelCartoes, recorrentes: PainelRecorrentes, dividas: PainelDividas, investimentos: PainelInvestimentos, projecao: PainelProjecao, viagens: PainelViagens, estatisticas: PainelEstatisticas,
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
          @keyframes girar { to { transform: rotate(360deg); } }
          .girando { animation: girar 1s linear infinite; }
          .grid-kpi { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
          .botao-menu-mobile, .barra-inferior { display: none; }
          .cabecalho { padding-top: calc(18px + env(safe-area-inset-top)) !important; }
          @media (max-width: 760px) {
            .grid-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
            .kpi-valor { font-size: 17px !important; }
            .botao-menu-mobile { display: flex !important; }
            .so-desktop { display: none !important; }
            .cabecalho { padding-left: 14px !important; padding-right: 14px !important; }
            .conteudo { padding: 16px 14px calc(96px + env(safe-area-inset-bottom)) !important; }
            .barra-inferior { display: flex !important; }
            .sidebar { position: fixed; left: -220px; top: 0; bottom: 0; z-index: 50; transition: left .2s; box-shadow: 4px 0 14px rgba(0,0,0,0.15); }
            .sidebar-aberta { left: 0 !important; }
            .overlay-mobile { display: block !important; }
            .grid-responsiva { grid-template-columns: 1fr !important; }
            .form-lancamento { grid-template-columns: 1fr !important; }
            .form-lancamento .span-2 { grid-column: span 1 !important; }
          }
          @media print {
            .sidebar, .no-print, .botao-menu-mobile, .barra-inferior { display: none !important; }
            body, #root { background: #fff !important; }
            #area-impressao { max-width: 100% !important; padding: 0 !important; }
          }
        `}</style>

        <Sidebar paginaAtiva={pagina} onNavegar={setPagina} aberta={sidebarAberta} onFechar={() => setSidebarAberta(false)} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cabecalho" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${pal.borda}`, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="botao-menu-mobile" aria-label="Abrir menu" onClick={() => setSidebarAberta(true)} style={{ border: "none", background: "none", color: pal.texto, cursor: "pointer", padding: 4 }}><Menu size={22} /></button>
              <div className="titulo-serif" style={{ fontSize: 19, fontWeight: 600 }}>{tituloPagina}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="no-print">
              <button className="so-desktop" onClick={() => window.print()} title="Imprimir ou salvar como PDF" style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${pal.borda}`, color: pal.textoSuave, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
                <Printer size={14} /> Imprimir / PDF
              </button>
              <EntradaRapida />
            </div>
          </div>
          <div className="conteudo" style={{ padding: "20px 24px 60px", maxWidth: 1080 }} id="area-impressao">
            <PaginaAtual />
          </div>
        </div>
        <BarraInferior paginaAtiva={pagina} onNavegar={setPagina} onNovo={pedirNovoLancamento} onMais={() => setSidebarAberta(true)} />
        <Toast toast={toast} onFechar={() => { clearTimeout(toastTimeoutRef.current); setToast(null); }} />
      </div>
    </AppCtx.Provider>
  );
}
