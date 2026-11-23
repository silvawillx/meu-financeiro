import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Receipt, Calendar, Landmark, BarChart3, Target, Star, Plus, Wallet, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Cartao, Modal, Progresso, NavegadorMes, CardMetrica } from "../ui.jsx";
import { calcularDisponivel } from "../lib/disponivel.js";
import { corCategoria, rotuloStatus } from "../lib/categorias.js";
import { hojeISO, mesAtual, mesLabel, diasNoMes } from "../lib/datas.js";
import { ORIGENS_RECEITA, ehAjusteSaldo, origemDe } from "../lib/lancamentos.js";
import { formatarMoeda } from "../lib/formato.js";
import { FormularioLancamento } from "../componentes/FormularioLancamento.jsx";

export function PainelDashboard() {
  const { lancamentos, mesSelecionado, pal, cor, contas, cartoes, metasEconomia, categoriasDespesa, categoriasReceita, adicionarLancamento, setPagina, metas } = useApp();
  const [modalRendaAberto, setModalRendaAberto] = useState(false);
  const doMes = useMemo(() => lancamentos.filter((l) => l.data.slice(0, 7) === mesSelecionado), [lancamentos, mesSelecionado]);
  const receitasDoMes = useMemo(() => doMes.filter((l) => l.tipo === "receita").sort((a, b) => (a.data < b.data ? 1 : -1)), [doMes]);
  const disp = useMemo(() => calcularDisponivel({ contas, lancamentos, cartoes, metasEconomia }), [contas, lancamentos, cartoes, metasEconomia]);
  const doMesOp = useMemo(() => doMes.filter((l) => !ehAjusteSaldo(l)), [doMes]); // sem ajustes de saldo
  const receita = doMesOp.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const gasto = doMesOp.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
  const saldo = receita - gasto;
  const economiaPct = receita > 0 ? (saldo / receita) * 100 : 0;
  const porOrigem = ORIGENS_RECEITA.map((o) => ({
    ...o, valor: doMesOp.filter((l) => l.tipo === "receita" && origemDe(l) === o.id).reduce((s, l) => s + l.valor, 0),
  }));
  const receitaTrabalho = porOrigem.filter((o) => o.trabalho).reduce((s, o) => s + o.valor, 0);
  const receitaClassificada = porOrigem.reduce((s, o) => s + o.valor, 0); // sem os "ajustes de saldo"
  const receitaFora = receitaClassificada - receitaTrabalho;

  const hojeD = new Date();
  const ehMesAtual = mesSelecionado === mesAtual();
  const diaCorrente = ehMesAtual ? hojeD.getDate() : diasNoMes(mesSelecionado);
  const diasRestantes = ehMesAtual ? diasNoMes(mesSelecionado) - hojeD.getDate() : 0;
  const mediaDia = diaCorrente > 0 ? gasto / diaCorrente : 0;

  const porCategoria = useMemo(() => {
    const mapa = {};
    doMesOp.filter((l) => l.tipo === "despesa").forEach((l) => { mapa[l.categoria] = (mapa[l.categoria] || 0) + l.valor; });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [doMesOp]);
  const categoriaTopo = porCategoria[0];
  // Orçamento: usa as metas por categoria já cadastradas em "Metas"
  const statusOrcamento = Object.entries(metas || {})
    .filter(([, limite]) => limite > 0)
    .map(([cat, limite]) => {
      const gasto = porCategoria.find(([c]) => c === cat)?.[1] || 0;
      return { cat, limite, gasto, pct: (gasto / limite) * 100 };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

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
    const r = doMesOp.filter((l) => l.tipo === "receita" && l.data <= hj).reduce((s, l) => s + l.valor, 0);
    const g = doMesOp.filter((l) => l.tipo === "despesa" && l.data <= hj).reduce((s, l) => s + l.valor, 0);
    return r - g;
  }, [doMesOp, ehMesAtual]);


  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div className="titulo-serif" style={{ fontSize: 15, color: pal.textoSuave }}>Você está vendo:</div>
        <NavegadorMes />
      </div>
      {vencidos.length > 0 && (
        <div onClick={() => setPagina("lancamentos")} style={{ display: "flex", alignItems: "center", gap: 10, background: "#B4552F1A", border: `1px solid ${VERMELHO}55`, borderRadius: 10, padding: "12px 16px", marginBottom: 18, cursor: "pointer" }}>
          <AlertTriangle size={17} color={VERMELHO} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13.5, color: pal.texto }}>
            <strong>{vencidos.length}</strong> lançamento{vencidos.length > 1 ? "s" : ""} marcado{vencidos.length > 1 ? "s" : ""} como <strong>"A pagar"</strong> já {vencidos.length > 1 ? "venceram" : "venceu"} — total de <strong className="num-tab">{formatarMoeda(vencidos.reduce((s, l) => s + l.valor, 0))}</strong>. Toque pra ver.
          </div>
        </div>
      )}
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <CardMetrica icone={Wallet} label="Receita" valor={formatarMoeda(receita)} cor={VERDE} />
        <CardMetrica icone={Receipt} label="Gastos" valor={formatarMoeda(gasto)} cor={VERMELHO} />
        <CardMetrica icone={saldo >= 0 ? ArrowUp : ArrowDown} label={ehMesAtual ? "Saldo previsto" : "Saldo"} valor={formatarMoeda(saldo)} cor={saldo >= 0 ? VERDE : VERMELHO} sub={ehMesAtual ? `Até hoje: ${formatarMoeda(saldoAteHoje)}` : undefined} />
        <CardMetrica icone={Target} label="Economia" valor={`${economiaPct.toFixed(0)}%`} cor={economiaPct >= 0 ? VERDE : VERMELHO} />
      </div>

      {mesSelecionado === mesAtual() && (
        <Cartao style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Disponível para gastar até o fim do mês</div>
          <div className="num-tab" style={{ fontSize: 26, fontWeight: 600, color: disp.disponivel >= 0 ? VERDE : VERMELHO }}>{formatarMoeda(disp.disponivel)}</div>
          <div style={{ fontSize: 12.5, color: pal.textoSuave, marginTop: 2, marginBottom: 10 }}>
            {disp.disponivel > 0 ? `≈ ${formatarMoeda(disp.porDia)} por dia, contando hoje (${disp.diasRestantes} dias)` : disp.disponivel < 0 ? "Faltam recursos para cobrir o que vence neste mês" : "Nada sobrando além da reserva e das contas do mês"}
          </div>
          {[["Saldo das contas", disp.saldoContas], ["Reservado (metas de economia)", -disp.reservado], ["A pagar até o fim do mês", -disp.aPagar], ["A receber até o fim do mês", disp.aReceber]].map(([rotulo, v]) => (
            <div key={rotulo} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: pal.textoSuave, padding: "2px 0" }}>
              <span>{rotulo}</span><span className="num-tab" style={{ color: pal.texto }}>{v < 0 ? "−" : ""}{formatarMoeda(Math.abs(v))}</span>
            </div>
          ))}
        </Cartao>
      )}

      {receitaClassificada > 0 && (
        <Cartao style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10 }}>De onde veio o dinheiro</div>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: pal.borda, marginBottom: 12 }}>
            {porOrigem.filter((o) => o.valor > 0).map((o) => <div key={o.id} title={o.nome} style={{ width: `${(o.valor / receitaClassificada) * 100}%`, background: o.cor }} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, fontSize: 12.5 }}>
            {porOrigem.map((o) => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, color: pal.texto }}>
                <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: o.cor, marginRight: 6 }} />{o.nome}</span>
                <span className="num-tab">{formatarMoeda(o.valor)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${pal.borda}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, fontSize: 12.5, color: pal.textoSuave }}>
            <span>Do trabalho: <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(receitaTrabalho)}</strong></span>
            <span>Fora do trabalho: <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(receitaFora)}</strong></span>
          </div>
        </Cartao>
      )}

      {statusOrcamento.length > 0 && (
        <Cartao style={{ padding: 16, marginBottom: 20, cursor: "pointer" }}>
          <div onClick={() => setPagina("metas")}>
            <div style={{ fontSize: 12, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10 }}>Orçamento do mês</div>
            {statusOrcamento.map((m) => {
              const cor100 = m.pct >= 100 ? VERMELHO : m.pct >= 80 ? "#C98A3A" : VERDE;
              return (
                <div key={m.cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, gap: 8 }}>
                    <span style={{ color: pal.texto }}>{m.cat}{m.pct > 100 ? " — passou do limite" : m.pct >= 100 ? " — no limite" : m.pct >= 80 ? " — perto do limite" : ""}</span>
                    <span className="num-tab" style={{ color: pal.textoSuave, whiteSpace: "nowrap" }}>{formatarMoeda(m.gasto)} / {formatarMoeda(m.limite)}</span>
                  </div>
                  <Progresso valor={m.gasto} max={m.limite} corBase={cor100} />
                </div>
              );
            })}
          </div>
        </Cartao>
      )}

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
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
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
