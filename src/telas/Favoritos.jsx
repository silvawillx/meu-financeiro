import { Star, X } from "lucide-react";
import { useApp } from "../contexto.js";
import { Cartao } from "../ui.jsx";
import { hojeISO } from "../lib/datas.js";
import { formatarMoeda } from "../lib/formato.js";

export function PainelFavoritos() {
  const { favoritos, excluirFavorito, adicionarLancamento, contas, pal, mostrarToast } = useApp();
  return (
    <div>
      <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto, marginBottom: 14 }}>Lançamentos favoritos</div>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 14 }}>Clique num favorito para lançar ele hoje com um clique.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
        {favoritos.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum favorito ainda — salve um lançamento como favorito ao criá-lo.</div>}
        {favoritos.map((f) => (
          <Cartao key={f.id} style={{ padding: 14, position: "relative" }}>
            <button onClick={() => excluirFavorito(f.id)} style={{ position: "absolute", top: 8, right: 8, border: "none", background: "none", color: pal.textoSuave, cursor: "pointer" }}><X size={13} /></button>
            <div onClick={() => { adicionarLancamento({ ...f, data: hojeISO() }, f.valor); mostrarToast(`"${f.descricao}" lançado hoje`); }} style={{ cursor: "pointer" }}>
              <Star size={16} color="#C98A3A" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto }}>{f.descricao}</div>
              <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 6 }}>{f.categoria}</div>
              <div className="num-tab" style={{ fontSize: 15, fontWeight: 600, color: pal.texto }}>{formatarMoeda(f.valor)}</div>
            </div>
          </Cartao>
        ))}
      </div>
    </div>
  );
}
