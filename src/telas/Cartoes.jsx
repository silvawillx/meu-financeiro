import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERMELHO } from "../tema.js";
import { Botao, Cartao, Campo, estiloInput, Modal, Confirmacao, Progresso, NavegadorMes } from "../ui.jsx";
import { totalFatura, limiteDoCartao } from "../lib/faturas.js";
import { hojeISO, mesAtual, mesLabel, mesLabelCompleto, addMeses, cicloFatura } from "../lib/datas.js";
import { formatarMoeda } from "../lib/formato.js";

export function PainelCartoes() {
  const { cartoes, contas, lancamentos, mesSelecionado, adicionarCartao, editarCartao, excluirCartao, pagarFaturaCartao, pal, cor, investimentos } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState({ nome: "", tipo: "credito", contaId: "", limite: "", fechamento: "", vencimento: "", cor: "#8A3E5C" });
  const [excluirId, setExcluirId] = useState(null);
  const [faturaAberta, setFaturaAberta] = useState(null);
  const [pagando, setPagando] = useState(null); // { cartao, mesRef, valor, contaId, data }
  const abrirPagamento = (c) => setPagando({
    cartao: c, mesRef: mesSelecionado, valor: String(totalFatura(lancamentos, c, mesSelecionado)).replace(".", ","),
    contaId: c.contaId || (contas.find((x) => x.padrao) || contas[0])?.id || "", data: hojeISO(),
  });
  const confirmarPagamento = (e) => {
    e.preventDefault();
    const v = parseFloat(String(pagando.valor).replace(",", "."));
    if (!v || v <= 0 || !pagando.contaId) return;
    pagarFaturaCartao(pagando.cartao, pagando.mesRef, pagando.contaId, v, pagando.data);
    setPagando(null);
  };

  const usoCartao = (cartao) => {
    const ciclo = cicloFatura(cartao, mesSelecionado);
    if (ciclo) {
      return lancamentos.filter((l) => l.cartaoId === cartao.id && l.tipo === "despesa" && l.data >= ciclo.inicio && l.data <= ciclo.fim).reduce((s, l) => s + l.valor, 0);
    }
    return lancamentos.filter((l) => l.cartaoId === cartao.id && l.data.slice(0, 7) === mesSelecionado && l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
  };
  const qtdLancamentosVinculados = (cartaoId) => lancamentos.filter((l) => l.cartaoId === cartaoId).length;

  const abrirNovo = () => { setEditando(null); setNovo({ nome: "", tipo: "credito", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", limite: "", fechamento: "", vencimento: "", cor: "#8A3E5C" }); setModalAberto(true); };
  const abrirEdicao = (c) => { setEditando(c); setNovo({ tipo: c.tipo || "credito", contaId: c.contaId || "", nome: c.nome, limite: String(c.limite ?? ""), fechamento: String(c.fechamento ?? ""), vencimento: String(c.vencimento ?? ""), cor: c.cor }); setModalAberto(true); };

  const submeter = (e) => {
    e.preventDefault();
    const debito = novo.tipo === "debito";
    if (!novo.nome.trim() || (!debito && !novo.limite) || (debito && !novo.contaId)) return;
    const dados = { ...novo, limite: debito ? 0 : parseFloat(novo.limite) || 0 };
    if (debito) { dados.fechamento = ""; dados.vencimento = ""; }
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
          const usado = usoCartao(c); // fatura do ciclo (e, no débito, gasto do mês)
          const ehDebito = c.tipo === "debito";
          const lim = limiteDoCartao(lancamentos, c); // limite comprometido: tudo que ainda não foi pago
          const pct = lim.pct;
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
              {ehDebito ? (
                <>
                  <div style={{ fontSize: 11, color: pal.textoSuave, marginBottom: 10 }}>Débito · {contas.find((x) => x.id === c.contaId)?.nome || "sem conta vinculada"}</div>
                  <div className="num-tab" style={{ fontSize: 18, fontWeight: 600, color: pal.texto }}>{formatarMoeda(usado)}</div>
                  <div style={{ fontSize: 11, color: pal.textoSuave, marginTop: 2 }}>gasto no mês (já sai do saldo da conta)</div>
                </>
              ) : (<>
              <div style={{ fontSize: 11, color: pal.textoSuave, marginBottom: 10 }}>Crédito · Fecha dia {c.fechamento || "—"} · Vence dia {c.vencimento || "—"}</div>
              <Progresso valor={lim.emAberto} max={c.limite} corBase={c.cor} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11.5 }}>
                <span className="num-tab" style={{ color: pal.textoSuave }}>{formatarMoeda(lim.emAberto)} em aberto</span>
                <span className="num-tab" style={{ color: pal.textoSuave }}>{formatarMoeda(lim.livre)} livre</span>
              </div>
              <div style={{ fontSize: 11, color: pal.textoSuave, marginTop: 2 }}>Fatura do ciclo: <span className="num-tab">{formatarMoeda(usado)}</span> · o limite inclui parcelas futuras</div>
              <div style={{ fontSize: 11, color: pct >= 90 ? VERMELHO : pal.textoSuave, marginTop: 2 }}>
                {(() => {
                  const garantias = investimentos.filter((a) => a.cartaoId === c.id && a.limiteGarantido > 0);
                  const total = garantias.reduce((s, a) => s + a.limiteGarantido, 0);
                  return total > 0 ? <div style={{ color: "#C98A3A", marginBottom: 2 }}>{formatarMoeda(total)} do limite é garantido por {garantias.map((a) => a.nome).join(", ")}</div> : null;
                })()}
                {pct.toFixed(0)}% do limite comprometido{lim.estourou ? " — passou do limite" : ""}{ciclo ? ` · fatura de ${new Date(ciclo.inicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(ciclo.fim + "T00:00:00").toLocaleDateString("pt-BR")}` : " (defina o dia de fechamento para calcular a fatura real)"}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <Botao variante="fantasma" style={{ padding: "5px 8px", fontSize: 11.5 }} onClick={() => setFaturaAberta(c)}>Ver fatura detalhada</Botao>
                <Botao variante="secundario" style={{ padding: "5px 8px", fontSize: 11.5 }} onClick={() => abrirPagamento(c)}>Pagar fatura</Botao>
              </div>
              </>)}
            </Cartao>
          );
        })}
      </div>
      {modalAberto && (
        <Modal titulo={editando ? "Editar cartão" : "Novo cartão"} onFechar={() => { setModalAberto(false); setEditando(null); }}>
          <form onSubmit={submeter} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Campo label="Nome"><input type="text" placeholder="Ex.: Nubank, Santander..." value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={estiloInput(pal)} /></Campo>
            <div style={{ display: "flex", gap: 8 }}>
              {[["credito", "Crédito"], ["debito", "Débito"]].map(([v, rotulo]) => (
                <button key={v} type="button" onClick={() => setNovo({ ...novo, tipo: v })}
                  style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${novo.tipo === v ? "transparent" : pal.borda}`, background: novo.tipo === v ? cor : "transparent", color: novo.tipo === v ? "#fff" : pal.texto, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{rotulo}</button>
              ))}
            </div>
            {novo.tipo === "debito" ? (
              <Campo label="Conta de onde o débito sai">
                <select value={novo.contaId} onChange={(e) => setNovo({ ...novo, contaId: e.target.value })} style={estiloInput(pal)} required>
                  <option value="">Escolha a conta</option>
                  {contas.filter((c) => !c.arquivada || c.id === novo.contaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
            ) : (
              <>
                <Campo label="Limite (R$)"><input type="text" inputMode="decimal" value={novo.limite} onChange={(e) => setNovo({ ...novo, limite: e.target.value })} className="num-tab" style={estiloInput(pal)} /></Campo>
                <div style={{ display: "flex", gap: 10 }}>
                  <Campo label="Dia de fechamento"><input type="number" min="1" max="31" value={novo.fechamento} onChange={(e) => setNovo({ ...novo, fechamento: e.target.value })} style={estiloInput(pal)} /></Campo>
                  <Campo label="Dia de vencimento"><input type="number" min="1" max="31" value={novo.vencimento} onChange={(e) => setNovo({ ...novo, vencimento: e.target.value })} style={estiloInput(pal)} /></Campo>
                </div>
                <Campo label="Conta que paga a fatura (opcional)">
                  <select value={novo.contaId} onChange={(e) => setNovo({ ...novo, contaId: e.target.value })} style={estiloInput(pal)}>
                    <option value="">Usar a conta escolhida em cada lançamento</option>
                    {contas.filter((c) => !c.arquivada || c.id === novo.contaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Campo>
              </>
            )}
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
      {pagando && (
        <Modal titulo={`Pagar fatura — ${pagando.cartao.nome}`} onFechar={() => setPagando(null)} largura={400}>
          <form onSubmit={confirmarPagamento} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: pal.textoSuave }}>
              O valor sai da conta escolhida uma vez só e as compras dessa fatura ficam marcadas como pagas. Não conta de novo como gasto.
            </div>
            <Campo label="Fatura de">
              <select value={pagando.mesRef} onChange={(e) => setPagando({ ...pagando, mesRef: e.target.value, valor: String(totalFatura(lancamentos, pagando.cartao, e.target.value)).replace(".", ",") })} style={estiloInput(pal)}>
                {[0, -1, -2, 1].map((d) => addMeses(`${mesAtual()}-01`, d).slice(0, 7)).map((m) => <option key={m} value={m}>{mesLabelCompleto(m)}</option>)}
              </select>
            </Campo>
            <Campo label="Valor pago (R$)"><input type="text" inputMode="decimal" className="num-tab" value={pagando.valor} onChange={(e) => setPagando({ ...pagando, valor: e.target.value })} style={estiloInput(pal)} /></Campo>
            <Campo label="Pagou com a conta">
              <select value={pagando.contaId} onChange={(e) => setPagando({ ...pagando, contaId: e.target.value })} style={estiloInput(pal)} required>
                <option value="">Escolha a conta</option>
                {contas.filter((c) => !c.arquivada).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Data do pagamento"><input type="date" value={pagando.data} onChange={(e) => setPagando({ ...pagando, data: e.target.value })} style={estiloInput(pal)} /></Campo>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Botao variante="fantasma" onClick={() => setPagando(null)}>Cancelar</Botao>
              <Botao type="submit">Registrar pagamento</Botao>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}


export function FaturaCartao({ cartao, onFechar }) {
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
