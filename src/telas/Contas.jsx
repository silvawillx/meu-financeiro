import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Cartao, Campo, estiloInput, Modal, Confirmacao } from "../ui.jsx";
import { hojeISO, mesAtual, mesLabel, diasNoMes } from "../lib/datas.js";
import { aconteceu, compraNoCredito, saldoConta, saldoConta as calcularSaldoConta } from "../lib/lancamentos.js";
import { formatarMoeda } from "../lib/formato.js";

export function PainelContas() {
  const { contas, lancamentos, cartoes, adicionarConta, editarConta, excluirConta, definirContaPadrao, arquivarConta, adicionarTransferencia, ajustarSaldoConta, pal, cor } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState({ nome: "", tipo: "conta", saldoInicial: "", cor: "#1B2A4A", saldoMinimo: "", padrao: false });
  const [excluirId, setExcluirId] = useState(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [extratoAberto, setExtratoAberto] = useState(null);
  const [transferenciaAberta, setTransferenciaAberta] = useState(false);
  const [conferenciaAberta, setConferenciaAberta] = useState(null);

  const fimDoMes = () => `${mesAtual()}-${String(diasNoMes(mesAtual())).padStart(2, "0")}`;
  const saldoConta = (contaId, saldoInicial, incluirFuturos = false) => calcularSaldoConta(lancamentos, { id: contaId, saldoInicial }, { incluirFuturos, cartoes, ate: incluirFuturos ? fimDoMes() : null });

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
              {Math.abs(saldoConta(c.id, c.saldoInicial, true) - saldo) >= 0.01 && (
                <div style={{ fontSize: 11, color: pal.textoSuave, marginTop: 2 }}>Previsto até o fim do mês: <span className="num-tab">{formatarMoeda(saldoConta(c.id, c.saldoInicial, true))}</span></div>
              )}
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


export function ExtratoConta({ conta, onFechar }) {
  const { lancamentos, cartoes, pal } = useApp();
  const movimentos = useMemo(() => {
    const dela = lancamentos.filter((l) => l.contaId === conta.id && aconteceu(l) && !compraNoCredito(l, cartoes)).sort((a, b) => (a.data < b.data ? -1 : 1));
    let saldo = conta.saldoInicial || 0;
    return dela.map((l) => {
      const entrada = l.tipo === "receita" || (l.tipo === "transferencia" && l.direcao === "entrada");
      saldo += entrada ? l.valor : -l.valor;
      return { ...l, saldoAposMovimento: saldo, entrada };
    });
  }, [lancamentos, cartoes, conta]);

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
                  {m.descricao}{m.tipo === "transferencia" && (m.faturaMes ? " (pagamento de fatura)" : m.direcao === "saida" ? " (saída p/ transferência)" : " (entrada de transferência)")}
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


export function ModalTransferencia({ contas, onFechar, onConfirmar }) {
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


export function ModalConferenciaSaldo({ conta, saldoCalculado, onFechar, onAjustar }) {
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
