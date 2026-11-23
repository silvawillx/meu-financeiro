import { useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Cartao, Campo, estiloInput, Modal, Confirmacao, Progresso, NavegadorMes } from "../ui.jsx";
import { corCategoria } from "../lib/categorias.js";
import { hojeISO } from "../lib/datas.js";
import { formatarMoeda } from "../lib/formato.js";

export function PainelMetas() {
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
