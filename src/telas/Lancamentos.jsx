import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Pencil, Search, X, Check, Upload, Paperclip, Copy, ClipboardPaste } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Cartao, Campo, estiloInput, Modal, Confirmacao, NavegadorMes } from "../ui.jsx";
import { interpretarTexto } from "../lib/textoBanco.js";
import { parseCSVTexto, parseCSVComCabecalho, parseOFXTexto } from "../lib/importacao.js";
import { todasCategorias, corCategoria, rotuloStatus } from "../lib/categorias.js";
import { MESES_PT, hojeISO } from "../lib/datas.js";
import { origemDe } from "../lib/lancamentos.js";
import { categorizar } from "../lib/regras.js";
import { genId, formatarMoeda } from "../lib/formato.js";
import { ehDuplicada } from "../lib/duplicadas.js";
import { FormularioLancamento } from "../componentes/FormularioLancamento.jsx";
import VisaoPorConta from "../componentes/VisaoPorConta.jsx";

export function PainelLancamentos() {
  const {
    lancamentos, contas, cartoes, mesSelecionado, mesesDisponiveis, setMesSelecionado,
    adicionarLancamento, editarLancamento, editarLancamentoGrupo, excluirLancamento, importarLancamentos,
    excluirLancamentosEmLote, editarLancamentosEmLote, pal, cor, mostrarToast,
    categoriasDespesa, categoriasReceita, pedidoNovoLanc, consumirPedidoNovoLanc,
    regras, aprenderRegras, textoRecebido, consumirTextoRecebido,
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
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [visao, setVisaoState] = useState(() => { try { return localStorage.getItem("visaoLancamentos") || "conta"; } catch (e) { return "conta"; } });
  const setVisao = (v) => { setVisaoState(v); try { localStorage.setItem("visaoLancamentos", v); } catch (e) { /* sem armazenamento local: tudo bem */ } };
  const [selecionados, setSelecionados] = useState(new Set());
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [categoriaLote, setCategoriaLote] = useState("");
  const buscaRef = useRef(null);
  const inputCSVRef = useRef(null);
  const inputOFXRef = useRef(null);

  useEffect(() => { setSelecionados(new Set()); }, [mesSelecionado]);

  // botão "+" da barra inferior: abre o formulário de novo lançamento
  useEffect(() => { if (pedidoNovoLanc) { setModalAberto(true); consumirPedidoNovoLanc(); } }, [pedidoNovoLanc]);

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
  // Antes de mostrar a prévia: sugere a categoria (regras suas + dicionário) e já desmarca o que parece duplicado.
  const prepararItens = (itens) => itens.map((it) => {
    const tipo = it.tipo || "despesa";
    const validas = todasCategorias(tipo, categoriasDespesa, categoriasReceita).map((c) => c.nome);
    const auto = categorizar(it.descricao, tipo, regras, validas);
    const categoria = it.categoria && it.categoria !== "Outros" && validas.includes(it.categoria) ? it.categoria : auto;
    const duplicada = it.data ? ehDuplicada({ ...it, tipo }, lancamentos) : null;
    return { ...it, tipo, categoria, categoriaAuto: categoria, duplicada, incluir: duplicada ? false : it.incluir !== false };
  });

  // Texto colado (ou vindo do link dos Atalhos do iPhone) -> prévia para conferir
  const lerTexto = (texto) => {
    const itens = interpretarTexto(texto);
    if (itens.length === 0) { mostrarToast("Não achei nenhum valor (R$) nesse texto.", null, 4000); return false; }
    setImportState({ nomeArquivo: "Texto colado", formato: "texto", itens: prepararItens(itens), origem: "auto" });
    return true;
  };
  const [colando, setColando] = useState(null); // { texto }
  const colarDoClipboard = async () => {
    try { const t = await navigator.clipboard.readText(); setColando((c) => ({ ...(c || {}), texto: t })); }
    catch (e) { mostrarToast("Não consegui acessar a área de transferência. Cole o texto na caixa.", null, 4000); }
  };
  useEffect(() => {
    if (textoRecebido) { lerTexto(textoRecebido); consumirTextoRecebido(); }
  }, [textoRecebido]);

  const aoSelecionarCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    let texto;
    // UTF-8 (formato que o próprio app exporta); se falhar, planilhas antigas em ISO-8859-1
    try { texto = new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { texto = new TextDecoder("iso-8859-1").decode(buffer); }
    const comCabecalho = parseCSVComCabecalho(texto);
    if (comCabecalho) {
      if (comCabecalho.itens.length === 0) {
        mostrarToast(comCabecalho.ignoradas > 0 ? "Nenhuma linha válida (confira data e valor)." : "O arquivo só tem o cabeçalho, sem lançamentos.", null, 4500);
        e.target.value = ""; return;
      }
      const catValida = (it) => todasCategorias(it.tipo, categoriasDespesa, categoriasReceita).some((c) => c.nome === it.categoria);
      const itensCab = comCabecalho.itens.map((it) => (catValida(it) ? it : { ...it, categoria: todasCategorias(it.tipo, categoriasDespesa, categoriasReceita).find((c) => c.nome === "Outros")?.nome || todasCategorias(it.tipo, categoriasDespesa, categoriasReceita)[0].nome }));
      setImportState({ nomeArquivo: file.name, formato: "csv-cab", ignoradas: comCabecalho.ignoradas, itens: prepararItens(itensCab), origem: "auto" });
      e.target.value = ""; return;
    }
    const { mes, itens, salario } = parseCSVTexto(texto);
    const itensFinal = itens.map((it) => ({ ...it, tipo: "despesa" }));
    if (salario) itensFinal.push({ descricao: "Renda do mês", valor: salario, tipo: "receita", categoria: "Salário", pessoa: "", status: "Pago", observacoes: "", incluir: true });
    if (itensFinal.length === 0) {
      mostrarToast("Não consegui reconhecer lançamentos nesse arquivo.");
      e.target.value = ""; return;
    }
    setImportState({ nomeArquivo: file.name, formato: "csv", mes: mes || new Date().getMonth() + 1, ano: new Date().getFullYear(), itens: prepararItens(itensFinal), origem: "auto" });
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
    setImportState({ nomeArquivo: file.name, formato: "ofx", itens: prepararItens(itens), origem: "auto" });
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
    const [oTipo, oId] = (importState.origem || "auto").split(":");
    const cartaoSel = oTipo === "cartao" ? cartoes.find((c) => c.id === oId) : null;
    const contaPadrao = (contas.find((c) => c.padrao) || contas[0])?.id || "";
    const escolhidos = importState.itens.filter((it) => it.incluir);
    const novos = escolhidos.map((it) => {
      const tipo = it.tipo || "despesa";
      const contaPorNome = it.contaNome && contas.find((c) => c.nome.trim().toLowerCase() === it.contaNome.trim().toLowerCase())?.id;
      let contaId = oTipo === "conta" ? oId : contaPorNome || contaPadrao, cartaoId = null, status = it.status || "-";
      if (cartaoSel) {
        contaId = cartaoSel.contaId || contaPadrao;
        if (tipo === "despesa") { // só gasto fica no cartão; entrada de dinheiro é da conta
          cartaoId = cartaoSel.id;
          // compra no crédito só sai da conta quando a fatura for paga
          if (cartaoSel.tipo !== "debito" && (status === "Pago" || status === "-")) status = "A pagar";
        }
      }
      return {
        id: genId("imp"),
        data: it.data || `${importState.ano}-${String(importState.mes).padStart(2, "0")}-01`,
        tipo, categoria: it.categoria || "Outros", descricao: it.descricao,
        pessoa: it.pessoa || "", status, contaId, cartaoId,
        valor: it.valor, escopo: it.escopo || "pessoal", observacoes: it.observacoes || "", anexo: null,
        parcelaInfo: null, recorrenteId: null,
        ...(tipo === "receita" ? { origem: origemDe({ categoria: it.categoria }) } : {}),
      };
    });
    importarLancamentos(novos);
    // o que você corrigiu na prévia vira regra para a próxima vez
    aprenderRegras(escolhidos.filter((it) => it.categoria !== it.categoriaAuto).map((it) => [it.descricao, it.categoria]));
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
          <Botao variante="secundario" onClick={() => setColando({ texto: "" })}><ClipboardPaste size={14} /> Colar texto do banco</Botao>
          <Botao onClick={() => { setEditando(null); setDuplicando(null); setFormSujo(false); setModalAberto(true); }}><Plus size={15} /> Novo lançamento</Botao>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["conta", "Por conta"], ["lista", "Lista"]].map(([v, rotulo]) => (
          <button key={v} onClick={() => setVisao(v)} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${visao === v ? "transparent" : pal.borda}`, background: visao === v ? cor : "transparent", color: visao === v ? "#fff" : pal.textoSuave, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{rotulo}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: pal.textoSuave }} />
          <input ref={buscaRef} type="text" placeholder="Buscar (nome, descrição, categoria...) — atalho: /" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...estiloInput(pal), width: "100%", paddingLeft: 30 }} />
        </div>
        <button onClick={() => setFiltrosAbertos((v) => !v)} aria-expanded={filtrosAbertos}
          style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${pal.borda}`, background: filtrosAbertos ? `${cor}14` : "transparent", color: pal.texto, fontSize: 13, cursor: "pointer" }}>
          Filtros{Object.values(filtros).filter(Boolean).length > 0 ? ` (${Object.values(filtros).filter(Boolean).length})` : ""} {filtrosAbertos ? "▴" : "▾"}
        </button>
        {filtrosAbertos && (<>
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
        </>)}
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

      {visao === "conta" ? (
        <VisaoPorConta lista={filtrados} onEditar={(l) => { setEditando(l); setDuplicando(null); setFormSujo(false); setModalAberto(true); }} />
      ) : (
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
      )}

      {colando && (
        <Modal titulo="Colar texto do banco" onFechar={() => setColando(null)} largura={520}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: pal.textoSuave }}>
              Cole a mensagem ou notificação do banco (ex.: <em>"Compra aprovada: R$ 28,90 em MC DONALDS"</em>). Pode colar várias de uma vez, uma por linha ou separadas por linha em branco.
              O app lê o valor e o estabelecimento, sugere a categoria e mostra uma prévia antes de salvar.
            </div>
            <textarea value={colando.texto} onChange={(e) => setColando({ ...colando, texto: e.target.value })} rows={6} placeholder="Cole aqui..." style={{ ...estiloInput(pal), width: "100%", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Botao variante="secundario" onClick={colarDoClipboard}><ClipboardPaste size={14} /> Colar da área de transferência</Botao>
              <Botao onClick={() => { if (lerTexto(colando.texto)) setColando(null); }}>Ler mensagens</Botao>
            </div>
            <details style={{ fontSize: 12.5, color: pal.textoSuave }}>
              <summary style={{ cursor: "pointer", color: pal.texto, fontWeight: 600 }}>Como lançar com um toque no iPhone (Atalhos)</summary>
              <ol style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
                <li>Abra o app <strong>Atalhos</strong> e crie um atalho novo.</li>
                <li>Nos detalhes do atalho, ative <strong>Mostrar na Folha de Compartilhamento</strong> (tipo de entrada: Texto).</li>
                <li>Adicione a ação <strong>Codificar URL</strong> (ou "URL Encode") usando a entrada do atalho.</li>
                <li>Adicione <strong>Abrir URLs</strong> com este endereço, e no fim o texto codificado:<br />
                  <code style={{ wordBreak: "break-all", background: pal.bordaSuave, padding: "2px 5px", borderRadius: 4 }}>{`${window.location.origin}${window.location.pathname}?lancar=`}</code></li>
                <li>Depois, em qualquer mensagem, e-mail ou anotação com o texto do banco: <strong>Compartilhar → seu atalho</strong>. O app abre já com o lançamento para você conferir e confirmar.</li>
              </ol>
              <div style={{ marginTop: 8 }}>Notificações de aplicativos (como a do Nubank) o iPhone não deixa outro app ler; nesses casos, copie o texto da notificação e use o botão acima. Os nomes das ações podem variar um pouco conforme a versão do iOS.</div>
            </details>
          </div>
        </Modal>
      )}

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
          <Campo label="Lançar em">
            <select value={importState.origem || "auto"} onChange={(e) => setImportState({ ...importState, origem: e.target.value })} style={estiloInput(pal)}>
              <option value="auto">Automático (conta do arquivo ou a principal)</option>
              <optgroup label="Contas">{contas.filter((c) => !c.arquivada).map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}</optgroup>
              {cartoes.length > 0 && <optgroup label="Cartões">{cartoes.map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}{c.tipo === "debito" ? " (débito)" : " (crédito)"}</option>)}</optgroup>}
            </select>
          </Campo>
          <div style={{ fontSize: 12, color: pal.textoSuave, margin: "10px 0 8px" }}>
            {importState.itens.filter((i) => i.incluir).length} de {importState.itens.length} lançamentos serão importados e somados aos que você já tem
            (gastos: <span className="num-tab">{formatarMoeda(importState.itens.filter((i) => i.incluir && i.tipo !== "receita").reduce((s, i) => s + i.valor, 0))}</span>).
            {importState.itens.filter((i) => i.duplicada).length > 0 ? ` ${importState.itens.filter((i) => i.duplicada).length} possível(is) duplicada(s) já vieram desmarcadas.` : ""}
            {importState.ignoradas > 0 ? ` ${importState.ignoradas} linha(s) ignorada(s) (sem data/valor válido ou transferência).` : ""}
            {" "}Se você trocar uma categoria, o app aprende para a próxima.
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${pal.bordaSuave}`, borderRadius: 8 }}>
            {importState.itens.map((it, idx) => {
              const dataDoItem = it.data || `${importState.ano}-${String(importState.mes).padStart(2, "0")}`;
              const possivelDuplicata = it.duplicada ?? lancamentos.some((l) =>
                l.tipo === (it.tipo || "despesa") && Math.abs(l.valor - it.valor) < 0.01 &&
                l.descricao.trim().toLowerCase() === it.descricao.trim().toLowerCase() &&
                (it.data ? l.data === it.data : l.data.slice(0, 7) === dataDoItem)
              );
              return (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderTop: idx === 0 ? "none" : `1px solid ${pal.bordaSuave}`, opacity: it.incluir ? 1 : 0.4 }}>
                  <input type="checkbox" checked={it.incluir} onChange={(e) => atualizarItemImport(idx, "incluir", e.target.checked)} style={{ flexShrink: 0, marginTop: 3 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: pal.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{it.descricao}</div>
                      <div className="num-tab" style={{ fontSize: 13, fontWeight: 600, flexShrink: 0, color: it.tipo === "receita" ? VERDE : pal.texto }}>{it.tipo === "receita" ? "+" : ""}{formatarMoeda(it.valor)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: pal.textoSuave }}>
                        {it.tipo === "receita" ? "Receita" : "Despesa"}{it.data ? ` · ${new Date(it.data + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}{it.pessoa ? ` · ${it.pessoa}` : ""}
                      </span>
                      <select value={it.categoria} onChange={(e) => atualizarItemImport(idx, "categoria", e.target.value)} style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: `1px solid ${pal.borda}` }}>
                        {todasCategorias(it.tipo, categoriasDespesa, categoriasReceita).map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
                      </select>
                    </div>
                    {possivelDuplicata && <div style={{ fontSize: 10.5, color: "#C98A3A", marginTop: 3 }}>⚠ possível duplicata — já existe algo parecido</div>}
                  </div>
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
