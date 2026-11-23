import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, RefreshCw } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Cartao, Campo, estiloInput, Modal, Confirmacao } from "../ui.jsx";
import { mesLabel } from "../lib/datas.js";
import { formatarMoeda } from "../lib/formato.js";

export function PainelRecorrentes() {
  const { recorrentes, contas, cartoes, lancamentos, adicionarRecorrente, editarRecorrente, excluirRecorrente, pal, cor, categoriasDespesa, categoriasReceita } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState({ descricao: "", categoria: categoriasDespesa[0].nome, valor: "", diaDoMes: "10", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "", tipo: "despesa", dataFim: "" });
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

  const abrirNovo = () => { setEditando(null); setNovo({ descricao: "", categoria: categoriasDespesa[0].nome, valor: "", diaDoMes: "10", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "", tipo: "despesa", dataFim: "" }); setModalAberto(true); };
  const abrirEdicao = (r) => { setEditando(r); setNovo({ descricao: r.descricao, categoria: r.categoria, valor: String(r.valor), diaDoMes: String(r.diaDoMes), contaId: r.contaId || "", cartaoId: r.cartaoId || "", tipo: r.tipo || "despesa", dataFim: r.dataFim || "" }); setModalAberto(true); };

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
        <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>Recorrentes (despesas e receitas)</div>
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
                {r.tipo === "receita" ? "Receita · " : ""}{r.categoria} · todo dia {r.diaDoMes} · {contas.find((c) => c.id === r.contaId)?.nome || "—"}
                {r.dataFim ? ` · até ${mesLabel(r.dataFim)}` : ""}
                {r.ultimoMesGerado ? ` · último gerado: ${mesLabel(r.ultimoMesGerado)}` : ""}
                {r.pausada ? " · PAUSADA" : ""}
              </div>
            </div>
            <div className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: r.tipo === "receita" ? VERDE : pal.texto, opacity: r.pausada ? 0.5 : 1 }}>{formatarMoeda(r.valor)}</div>
            <button onClick={() => editarRecorrente(r.id, { pausada: !r.pausada })} title={r.pausada ? "Retomar" : "Pausar"} style={{ border: "none", background: "transparent", color: pal.textoSuave, cursor: "pointer", padding: 5, fontSize: 11.5 }}>{r.pausada ? "Retomar" : "Pausar"}</button>
            <button onClick={() => abrirEdicao(r)} style={{ border: "none", background: "transparent", color: cor, cursor: "pointer", padding: 5 }}><Pencil size={14} /></button>
            <button onClick={() => setExcluirId(r.id)} style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer", padding: 5 }}><Trash2 size={14} /></button>
          </div>
        ))}
      </Cartao>
      {modalAberto && (
        <Modal titulo={editando ? "Editar recorrente" : "Nova recorrente"} onFechar={() => { setModalAberto(false); setEditando(null); }}>
          <form onSubmit={submeter} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "span 2" }}>
              <Campo label="Descrição"><input type="text" placeholder="Ex.: Internet, Energia, Aluguel..." value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} style={estiloInput(pal)} /></Campo>
            </div>
            <Campo label="Tipo">
              <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value, categoria: (e.target.value === "receita" ? categoriasReceita : categoriasDespesa)[0].nome })} style={estiloInput(pal)}>
                <option value="despesa">Despesa</option><option value="receita">Receita</option>
              </select>
            </Campo>
            <Campo label="Categoria">
              <select value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })} style={estiloInput(pal)}>
                {(novo.tipo === "receita" ? categoriasReceita : categoriasDespesa).map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Termina em (opcional)"><input type="month" value={novo.dataFim} onChange={(e) => setNovo({ ...novo, dataFim: e.target.value })} style={estiloInput(pal)} /></Campo>
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
