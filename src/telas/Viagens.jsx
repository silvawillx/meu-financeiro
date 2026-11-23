import { useState } from "react";
import { Plus, Trash2, Pencil, Plane } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERMELHO } from "../tema.js";
import { Botao, Cartao, Campo, estiloInput, Modal, Confirmacao, Progresso } from "../ui.jsx";
import { hojeISO } from "../lib/datas.js";
import { formatarMoeda } from "../lib/formato.js";

export function PainelViagens() {
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
