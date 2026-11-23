import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useApp } from "../contexto.js";
import { Cartao } from "../ui.jsx";
import { VERDE, VERMELHO } from "../tema.js";
import { formatarMoeda } from "../lib/formato.js";
import { agruparPorOrigem } from "../lib/agrupamento.js";

const dia = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Resumo do mês por conta e por cartão: cada um vira um cartão dobrável com o total e as categorias.
// A lista completa continua na aba "Lista".
export default function VisaoPorConta({ lista, onEditar }) {
  const { contas, cartoes, pal } = useApp();
  const grupos = useMemo(() => agruparPorOrigem(lista, { contas, cartoes }), [lista, contas, cartoes]);
  const [abertos, setAbertos] = useState(() => new Set());
  const [catsAbertas, setCatsAbertas] = useState(() => new Set());
  const [verTodas, setVerTodas] = useState(() => new Set());
  const alterna = (set, setter, chave) => setter((old) => { const n = new Set(old); n.has(chave) ? n.delete(chave) : n.add(chave); return n; });

  const totalGastos = grupos.reduce((s, g) => s + g.totalGastos, 0);
  const totalEntradas = grupos.reduce((s, g) => s + g.totalEntradas, 0);

  if (grupos.length === 0) {
    return <Cartao style={{ padding: 24, fontSize: 13, color: pal.textoSuave }}>Nenhum lançamento neste mês com esses filtros.</Cartao>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 18, fontSize: 13, color: pal.textoSuave, marginBottom: 12, flexWrap: "wrap" }}>
        <span>Saiu <strong className="num-tab" style={{ color: VERMELHO }}>{formatarMoeda(totalGastos)}</strong></span>
        <span>Entrou <strong className="num-tab" style={{ color: VERDE }}>{formatarMoeda(totalEntradas)}</strong></span>
      </div>
      {grupos.map((g) => {
        const aberto = abertos.has(g.chave);
        const despesas = g.categorias.filter((c) => c.tipo === "despesa");
        const outras = g.categorias.filter((c) => c.tipo !== "despesa");
        const todas = verTodas.has(g.chave);
        const visiveis = todas ? despesas : despesas.slice(0, 5);
        return (
          <Cartao key={g.chave} style={{ marginBottom: 10, overflow: "hidden" }}>
            <button onClick={() => alterna(abertos, setAbertos, g.chave)} aria-expanded={aberto}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", color: pal.texto }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: g.cor, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 600 }}>{g.nome}</span>
                <span style={{ display: "block", fontSize: 11.5, color: pal.textoSuave }}>{g.subtitulo} · {g.qtd} lançamento{g.qtd > 1 ? "s" : ""}</span>
              </span>
              <span className="num-tab" style={{ fontSize: 15, fontWeight: 600 }}>{formatarMoeda(g.totalGastos)}</span>
              {aberto ? <ChevronUp size={16} color={pal.textoSuave} /> : <ChevronDown size={16} color={pal.textoSuave} />}
            </button>
            {aberto && (
              <div style={{ padding: "0 14px 12px", borderTop: `1px solid ${pal.bordaSuave}` }}>
                {visiveis.map((c) => {
                  const k = `${g.chave}|${c.nome}`;
                  const catAberta = catsAbertas.has(k);
                  const pct = g.totalGastos > 0 ? (c.total / g.totalGastos) * 100 : 0;
                  return (
                    <div key={k}>
                      <button onClick={() => alterna(catsAbertas, setCatsAbertas, k)} style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: "9px 0 4px", textAlign: "left", color: pal.texto }}>
                        <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span>{c.nome} <span style={{ color: pal.textoSuave, fontSize: 11 }}>({c.itens.length})</span></span>
                          <span className="num-tab">{formatarMoeda(c.total)}</span>
                        </span>
                        <span style={{ display: "block", height: 5, borderRadius: 3, background: pal.bordaSuave, marginTop: 5 }}>
                          <span style={{ display: "block", height: "100%", width: `${Math.max(pct, 2)}%`, borderRadius: 3, background: g.cor }} />
                        </span>
                      </button>
                      {catAberta && c.itens.map((l) => (
                        <button key={l.id} onClick={() => onEditar(l)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", padding: "5px 0 5px 10px", textAlign: "left", color: pal.texto }}>
                          <span style={{ fontSize: 11, color: pal.textoSuave, width: 34, flexShrink: 0 }}>{dia(l.data)}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {l.descricao}{l.parcelaInfo ? ` (${l.parcelaInfo.atual}/${l.parcelaInfo.total})` : ""}
                          </span>
                          {l.status === "A pagar" && <span className="badge" style={{ background: "#C98A3A22", color: "#C98A3A" }}>a pagar</span>}
                          <span className="num-tab" style={{ fontSize: 12.5 }}>{formatarMoeda(l.valor)}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {despesas.length > 5 && (
                  <button onClick={() => alterna(verTodas, setVerTodas, g.chave)} style={{ border: "none", background: "transparent", cursor: "pointer", color: pal.textoSuave, fontSize: 12, padding: "8px 0 2px" }}>
                    {todas ? "mostrar menos" : `+ ${despesas.length - 5} categoria${despesas.length - 5 > 1 ? "s" : ""}`}
                  </button>
                )}
                {outras.map((c) => {
                  const k = `${g.chave}|${c.tipo}`;
                  return (
                    <div key={k}>
                      <button onClick={() => alterna(catsAbertas, setCatsAbertas, k)} style={{ width: "100%", display: "flex", justifyContent: "space-between", border: "none", background: "transparent", cursor: "pointer", padding: "8px 0 2px", fontSize: 12.5, color: pal.textoSuave, textAlign: "left" }}>
                        <span>{c.nome} ({c.itens.length})</span>
                        <span className="num-tab" style={{ color: c.tipo === "entrada" ? VERDE : pal.textoSuave }}>{c.tipo === "entrada" ? "+" : ""}{formatarMoeda(c.total)}</span>
                      </button>
                      {catsAbertas.has(k) && c.itens.map((l) => (
                        <button key={l.id} onClick={() => onEditar(l)} style={{ width: "100%", display: "flex", gap: 8, border: "none", background: "transparent", cursor: "pointer", padding: "4px 0 4px 10px", textAlign: "left", color: pal.texto }}>
                          <span style={{ fontSize: 11, color: pal.textoSuave, width: 34, flexShrink: 0 }}>{dia(l.data)}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</span>
                          <span className="num-tab" style={{ fontSize: 12.5 }}>{formatarMoeda(l.valor)}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </Cartao>
        );
      })}
    </div>
  );
}
