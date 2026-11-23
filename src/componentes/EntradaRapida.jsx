import { useState } from "react";
import { X, Zap } from "lucide-react";
import { useApp } from "../contexto.js";
import { Botao, estiloInput } from "../ui.jsx";
import { parseEntradaRapida } from "../lib/importacao.js";
import { formatarMoeda } from "../lib/formato.js";

export function EntradaRapida() {
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
