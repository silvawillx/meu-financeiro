import { useState, useEffect, useMemo } from "react";
import { CreditCard, Plus, Wallet, ArrowUp, ArrowDown, RefreshCw, Banknote } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Cartao, Campo, estiloInput, Modal, Confirmacao, CardMetrica } from "../ui.jsx";
import { TIPOS_INVEST, buscarCDI, buscarCotacao, calcularAtivo } from "../lib/investimentos.js";
import { hojeISO } from "../lib/datas.js";
import { genId, formatarMoeda } from "../lib/formato.js";

export function PainelInvestimentos() {
  const { investimentos, mercado, cartoes, contas, adicionarInvestimento, editarInvestimento, excluirInvestimento, movimentarInvestimento, atualizarMercado, adicionarLancamento, pal, cor, mostrarToast } = useApp();
  const [modal, setModal] = useState(null); // {ativo|null}
  const [mov, setMov] = useState(null); // {ativo}
  const [rend, setRend] = useState(null);
  const [mercadoAberto, setMercadoAberto] = useState(false);
  const [excluirId, setExcluirId] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const vazio = { tipo: "acao", nome: "", instituicao: "", ticker: "", quantidade: "", precoMedio: "", percCDI: "100", valorInicial: "", dataInicio: hojeISO(), vencimento: "", valorAtualManual: "", cartaoId: "", limiteGarantido: "" };
  const [f, setF] = useState(vazio);
  const [m, setM] = useState({ tipo: "aporte", valor: "", data: hojeISO(), quantidade: "", preco: "" });
  const [r, setR] = useState({ valor: "", data: hojeISO() });
  const [mk, setMk] = useState({ cdiAnual: "", brapiToken: "" });

  const num = (v) => parseFloat(String(v).replace(",", "."));

  const linhas = useMemo(() => investimentos.map((a) => ({ a, ...calcularAtivo(a, mercado) })), [investimentos, mercado]);
  const totalAtual = linhas.reduce((s, l) => s + l.atual, 0);
  const totalInvestido = linhas.reduce((s, l) => s + l.investido, 0);
  const rendimento = totalAtual - totalInvestido;
  const rendPct = totalInvestido > 0 ? (rendimento / totalInvestido) * 100 : 0;
  const totalGarantia = investimentos.reduce((s, a) => s + (num(a.limiteGarantido) || 0), 0);
  const porTipo = TIPOS_INVEST.map((t) => ({ ...t, valor: linhas.filter((l) => l.a.tipo === t.id).reduce((s, l) => s + l.atual, 0) })).filter((t) => t.valor > 0);

  const atualizar = async (silencioso = false) => {
    setCarregando(true);
    const novo = { ...mercado, cotacoes: { ...(mercado.cotacoes || {}) } };
    const falhas = [];
    try { novo.cdiAnual = await buscarCDI(); novo.cdiEm = hojeISO(); } catch (e) { falhas.push("CDI"); }
    const tickers = [...new Set(investimentos.filter((a) => a.tipo === "acao" && a.ticker).map((a) => a.ticker.toUpperCase()))];
    await Promise.all(tickers.map(async (t) => {
      try { novo.cotacoes[t] = { preco: await buscarCotacao(t, mercado.brapiToken), em: hojeISO() }; } catch (e) { falhas.push(t); }
    }));
    atualizarMercado(novo);
    setCarregando(false);
    if (!silencioso || falhas.length) mostrarToast(falhas.length ? `Não consegui atualizar: ${falhas.join(", ")} (use valores manuais ou o token)` : "Cotações e CDI atualizados", null, 4500);
  };

  // atualiza sozinho uma vez por dia ao abrir a aba
  useEffect(() => {
    if (investimentos.length > 0 && mercado?.cdiEm !== hojeISO()) atualizar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirNovo = () => { setF(vazio); setModal({ ativo: null }); };
  const abrirEdicao = (a) => {
    setF({ ...vazio, ...a, quantidade: String(a.quantidade ?? ""), precoMedio: String(a.precoMedio ?? ""), percCDI: String(a.percCDI ?? "100"), valorAtualManual: a.valorAtualManual ?? "", limiteGarantido: String(a.limiteGarantido ?? ""), cartaoId: a.cartaoId || "", ticker: a.ticker || "" });
    setModal({ ativo: a });
  };

  const salvarAtivo = (e) => {
    e.preventDefault();
    if (!f.nome.trim()) return;
    const dados = {
      tipo: f.tipo, nome: f.nome.trim(), instituicao: f.instituicao.trim(),
      cartaoId: f.cartaoId || "", limiteGarantido: f.cartaoId ? (num(f.limiteGarantido) || 0) : 0,
    };
    if (f.tipo === "acao") {
      Object.assign(dados, { ticker: f.ticker.trim().toUpperCase(), quantidade: num(f.quantidade) || 0, precoMedio: num(f.precoMedio) || 0 });
    } else {
      Object.assign(dados, { percCDI: num(f.percCDI) || 100, vencimento: f.vencimento || "", valorAtualManual: f.valorAtualManual === "" ? "" : num(f.valorAtualManual) });
    }
    if (modal.ativo) editarInvestimento(modal.ativo.id, dados);
    else {
      if (f.tipo !== "acao") {
        const v = num(f.valorInicial) || 0;
        dados.movimentos = v > 0 ? [{ id: genId("mov"), tipo: "aporte", valor: v, data: f.dataInicio || hojeISO() }] : [];
      }
      adicionarInvestimento(dados);
    }
    setModal(null);
  };

  const salvarMov = (e) => {
    e.preventDefault();
    const a = mov.ativo;
    if (a.tipo === "acao") {
      const q = num(m.quantidade), p = num(m.preco);
      if (!q || q <= 0) return;
      if (m.tipo === "aporte") {
        if (!p || p <= 0) return;
        const novaQtd = (a.quantidade || 0) + q;
        editarInvestimento(a.id, { quantidade: novaQtd, precoMedio: Math.round((((a.quantidade || 0) * (a.precoMedio || 0) + q * p) / novaQtd) * 100) / 100 });
      } else {
        if (q > (a.quantidade || 0)) { mostrarToast("Você não tem essa quantidade para vender"); return; }
        editarInvestimento(a.id, { quantidade: (a.quantidade || 0) - q });
      }
    } else {
      const v = num(m.valor);
      if (!v || v <= 0) return;
      movimentarInvestimento(a.id, { id: genId("mov"), tipo: m.tipo, valor: v, data: m.data });
    }
    setMov(null);
  };

  const salvarRend = (e) => {
    e.preventDefault();
    const v = num(r.valor);
    if (!v || v <= 0) return;
    adicionarLancamento({
      tipo: "receita", data: r.data, categoria: "Outros", descricao: `Rendimento ${rend.nome}`, pessoa: "", status: "Pago",
      contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "", observacoes: "", anexo: null, escopo: "pessoal", origem: "rendimentos",
    }, v);
    setRend(null);
  };

  const cartoesCredito = cartoes.filter((c) => c.tipo !== "debito");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>Seus investimentos</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Botao variante="secundario" onClick={() => atualizar(false)}><RefreshCw size={14} className={carregando ? "girando" : ""} /> {carregando ? "Atualizando..." : "Atualizar"}</Botao>
          <Botao variante="fantasma" onClick={() => { setMk({ cdiAnual: mercado?.cdiAnual ?? "", brapiToken: mercado?.brapiToken ?? "" }); setMercadoAberto(true); }}>Mercado</Botao>
          <Botao onClick={abrirNovo}><Plus size={15} /> Novo</Botao>
        </div>
      </div>

      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <CardMetrica icone={Wallet} label="Patrimônio" valor={formatarMoeda(totalAtual)} cor={cor} />
        <CardMetrica icone={Banknote} label="Investido" valor={formatarMoeda(totalInvestido)} cor={cor} />
        <CardMetrica icone={rendimento >= 0 ? ArrowUp : ArrowDown} label="Rendimento" valor={formatarMoeda(rendimento)} cor={rendimento >= 0 ? VERDE : VERMELHO} sub={`${rendPct.toFixed(1)}%`} />
        <CardMetrica icone={CreditCard} label="Garante limite" valor={formatarMoeda(totalGarantia)} cor="#C98A3A" sub="nos cartões" />
      </div>

      {porTipo.length > 0 && (
        <Cartao style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10 }}>Distribuição</div>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: pal.borda, marginBottom: 10 }}>
            {porTipo.map((t) => <div key={t.id} title={t.nome} style={{ width: `${(t.valor / totalAtual) * 100}%`, background: t.cor }} />)}
          </div>
          {porTipo.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: pal.texto, marginBottom: 4 }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: t.cor, marginRight: 6 }} />{t.nome} · {((t.valor / totalAtual) * 100).toFixed(0)}%</span>
              <span className="num-tab">{formatarMoeda(t.valor)}</span>
            </div>
          ))}
        </Cartao>
      )}

      <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 12 }}>
        {mercado?.cdiAnual ? `CDI ${Number(mercado.cdiAnual).toFixed(2)}% a.a.${mercado.cdiEm ? ` (${new Date(mercado.cdiEm + "T00:00:00").toLocaleDateString("pt-BR")})` : ""} · ` : "CDI não carregado · "}
        Valores de renda fixa são estimativas brutas (sem IR/IOF); informe o valor atual do seu extrato se quiser exato.
      </div>

      {investimentos.length === 0 ? (
        <Cartao style={{ padding: 24, fontSize: 13, color: pal.textoSuave }}>Nenhum investimento cadastrado. Toque em "Novo" para adicionar ações, CDB ou sua caixinha.</Cartao>
      ) : linhas.map(({ a, investido, atual, preco, semCotacao, semCDI, manual, estimado }) => {
        const lucro = atual - investido;
        const tipo = TIPOS_INVEST.find((t) => t.id === a.tipo);
        const cartao = cartoes.find((c) => c.id === a.cartaoId);
        return (
          <Cartao key={a.id} style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: pal.texto }}>{a.nome}{a.ticker ? ` · ${a.ticker}` : ""}</div>
                <div style={{ fontSize: 11.5, color: pal.textoSuave }}>
                  <span style={{ color: tipo?.cor, fontWeight: 600 }}>{tipo?.nome}</span>
                  {a.instituicao ? ` · ${a.instituicao}` : ""}
                  {a.tipo === "acao" ? ` · ${a.quantidade} cotas a PM ${formatarMoeda(a.precoMedio)}` : a.tipo !== "outro" ? ` · ${a.percCDI || 100}% do CDI` : ""}
                  {a.vencimento ? ` · vence ${new Date(a.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="num-tab" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>{formatarMoeda(atual)}</div>
                <div className="num-tab" style={{ fontSize: 11.5, color: lucro >= 0 ? VERDE : VERMELHO }}>{lucro >= 0 ? "+" : ""}{formatarMoeda(lucro)}{investido > 0 ? ` (${((lucro / investido) * 100).toFixed(1)}%)` : ""}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: pal.textoSuave, marginTop: 6 }}>
              {a.tipo === "acao" && (semCotacao ? "Sem cotação — usando o preço médio. Use Atualizar ou o token em Mercado." : `Cotação ${formatarMoeda(preco)}`)}
              {a.tipo !== "acao" && manual && "Valor informado por você"}
              {a.tipo !== "acao" && estimado && "Estimativa pelo CDI (bruta)"}
              {a.tipo !== "acao" && semCDI && !manual && "CDI não carregado — mostrando só o valor aplicado"}
              {cartao && ` · Garante ${formatarMoeda(num(a.limiteGarantido) || 0)} de limite no ${cartao.nome}`}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <Botao variante="secundario" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => { setM({ tipo: "aporte", valor: "", data: hojeISO(), quantidade: "", preco: "" }); setMov({ ativo: a }); }}>{a.tipo === "acao" ? "Comprar / vender" : "Aporte / resgate"}</Botao>
              <Botao variante="fantasma" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => { setR({ valor: "", data: hojeISO() }); setRend(a); }}>Lançar rendimento recebido</Botao>
              <Botao variante="fantasma" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => abrirEdicao(a)}>Editar</Botao>
              <Botao variante="perigo" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => setExcluirId(a.id)}>Excluir</Botao>
            </div>
          </Cartao>
        );
      })}

      {modal && (
        <Modal titulo={modal.ativo ? "Editar investimento" : "Novo investimento"} onFechar={() => setModal(null)}>
          <form onSubmit={salvarAtivo} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {!modal.ativo && (
              <Campo label="Tipo">
                <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} style={estiloInput(pal)}>
                  {TIPOS_INVEST.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </Campo>
            )}
            <Campo label="Nome"><input type="text" placeholder={f.tipo === "acao" ? "Ex.: Petrobras" : "Ex.: CDB Banco Inter 110% CDI"} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} style={estiloInput(pal)} required /></Campo>
            <Campo label="Instituição (opcional)"><input type="text" value={f.instituicao} onChange={(e) => setF({ ...f, instituicao: e.target.value })} style={estiloInput(pal)} /></Campo>
            {f.tipo === "acao" ? (
              <>
                <Campo label="Código (ticker)"><input type="text" placeholder="PETR4" value={f.ticker} onChange={(e) => setF({ ...f, ticker: e.target.value.toUpperCase() })} style={estiloInput(pal)} /></Campo>
                <div style={{ display: "flex", gap: 10 }}>
                  <Campo label="Quantidade"><input type="text" inputMode="decimal" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
                  <Campo label="Preço médio (R$)"><input type="text" inputMode="decimal" value={f.precoMedio} onChange={(e) => setF({ ...f, precoMedio: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
                </div>
              </>
            ) : (
              <>
                {f.tipo !== "outro" && <Campo label="Rende quantos % do CDI?"><input type="text" inputMode="decimal" value={f.percCDI} onChange={(e) => setF({ ...f, percCDI: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>}
                {!modal.ativo && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <Campo label="Valor aplicado (R$)"><input type="text" inputMode="decimal" value={f.valorInicial} onChange={(e) => setF({ ...f, valorInicial: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
                    <Campo label="Desde"><input type="date" value={f.dataInicio} onChange={(e) => setF({ ...f, dataInicio: e.target.value })} style={estiloInput(pal)} /></Campo>
                  </div>
                )}
                {f.tipo === "cdb" && <Campo label="Vencimento (opcional)"><input type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} style={estiloInput(pal)} /></Campo>}
                <Campo label={f.tipo === "outro" ? "Valor atual (R$)" : "Valor atual do extrato (opcional, substitui a estimativa)"}><input type="text" inputMode="decimal" value={f.valorAtualManual} onChange={(e) => setF({ ...f, valorAtualManual: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
              </>
            )}
            {cartoesCredito.length > 0 && (
              <>
                <Campo label="Garante limite de qual cartão? (opcional)">
                  <select value={f.cartaoId} onChange={(e) => setF({ ...f, cartaoId: e.target.value })} style={estiloInput(pal)}>
                    <option value="">Nenhum</option>
                    {cartoesCredito.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Campo>
                {f.cartaoId && <Campo label="Limite que ele libera (R$)"><input type="text" inputMode="decimal" value={f.limiteGarantido} onChange={(e) => setF({ ...f, limiteGarantido: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>}
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => setModal(null)}>Cancelar</Botao>
              <Botao type="submit">Salvar</Botao>
            </div>
          </form>
        </Modal>
      )}

      {mov && (
        <Modal titulo={`${mov.ativo.nome} — ${mov.ativo.tipo === "acao" ? "compra / venda" : "aporte / resgate"}`} onFechar={() => setMov(null)} largura={400}>
          <form onSubmit={salvarMov} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[["aporte", mov.ativo.tipo === "acao" ? "Compra" : "Aporte"], ["resgate", mov.ativo.tipo === "acao" ? "Venda" : "Resgate"]].map(([v, rotulo]) => (
                <button key={v} type="button" onClick={() => setM({ ...m, tipo: v })} style={{ flex: 1, padding: 8, borderRadius: 8, border: `1px solid ${m.tipo === v ? "transparent" : pal.borda}`, background: m.tipo === v ? cor : "transparent", color: m.tipo === v ? "#fff" : pal.texto, fontSize: 13, cursor: "pointer" }}>{rotulo}</button>
              ))}
            </div>
            {mov.ativo.tipo === "acao" ? (
              <div style={{ display: "flex", gap: 10 }}>
                <Campo label="Quantidade"><input type="text" inputMode="decimal" value={m.quantidade} onChange={(e) => setM({ ...m, quantidade: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
                {m.tipo === "aporte" && <Campo label="Preço (R$)"><input type="text" inputMode="decimal" value={m.preco} onChange={(e) => setM({ ...m, preco: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>}
              </div>
            ) : (
              <>
                <Campo label="Valor (R$)"><input type="text" inputMode="decimal" value={m.valor} onChange={(e) => setM({ ...m, valor: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
                <Campo label="Data"><input type="date" value={m.data} onChange={(e) => setM({ ...m, data: e.target.value })} style={estiloInput(pal)} /></Campo>
              </>
            )}
            <div style={{ fontSize: 11.5, color: pal.textoSuave }}>Isto atualiza só o investimento; o saldo das suas contas não muda.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => setMov(null)}>Cancelar</Botao>
              <Botao type="submit">Salvar</Botao>
            </div>
          </form>
        </Modal>
      )}

      {rend && (
        <Modal titulo={`Rendimento recebido — ${rend.nome}`} onFechar={() => setRend(null)} largura={400}>
          <form onSubmit={salvarRend} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: pal.textoSuave }}>Cria uma receita com origem "Rendimentos" (dividendo, juros, resgate de lucro) na sua conta principal.</div>
            <Campo label="Valor (R$)"><input type="text" inputMode="decimal" value={r.valor} onChange={(e) => setR({ ...r, valor: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
            <Campo label="Data"><input type="date" value={r.data} onChange={(e) => setR({ ...r, data: e.target.value })} style={estiloInput(pal)} /></Campo>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => setRend(null)}>Cancelar</Botao>
              <Botao type="submit">Lançar receita</Botao>
            </div>
          </form>
        </Modal>
      )}

      {mercadoAberto && (
        <Modal titulo="Dados de mercado" onFechar={() => setMercadoAberto(false)} largura={420}>
          <form onSubmit={(e) => { e.preventDefault(); atualizarMercado({ ...mercado, cdiAnual: mk.cdiAnual === "" ? undefined : num(mk.cdiAnual), brapiToken: mk.brapiToken.trim() }); setMercadoAberto(false); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: pal.textoSuave }}>O CDI vem do Banco Central e as cotações da brapi.dev ao tocar em "Atualizar". Se algo falhar, digite você mesmo.</div>
            <Campo label="CDI (% ao ano)"><input type="text" inputMode="decimal" value={mk.cdiAnual} onChange={(e) => setMk({ ...mk, cdiAnual: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
            <Campo label="Token da brapi.dev (opcional)"><input type="text" value={mk.brapiToken} onChange={(e) => setMk({ ...mk, brapiToken: e.target.value })} placeholder="Crie grátis em brapi.dev" style={estiloInput(pal)} /></Campo>
            <div style={{ fontSize: 11.5, color: pal.textoSuave }}>Sem token, a brapi só libera alguns papéis; os demais ficam com o preço médio até você informar um token.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => setMercadoAberto(false)}>Cancelar</Botao>
              <Botao type="submit">Salvar</Botao>
            </div>
          </form>
        </Modal>
      )}

      {excluirId && (
        <Confirmacao msg="Excluir este investimento? Os lançamentos de rendimento já criados continuam existindo." onCancelar={() => setExcluirId(null)} onConfirmar={() => { excluirInvestimento(excluirId); setExcluirId(null); }} />
      )}
    </div>
  );
}
