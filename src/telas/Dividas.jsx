import { useState, useMemo } from "react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Cartao, Progresso } from "../ui.jsx";
import { formatarMoeda } from "../lib/formato.js";

export function PainelDividas() {
  const { lancamentos, editarLancamento, pal, cor } = useApp();
  const [mostrarQuitadas, setMostrarQuitadas] = useState(false);

  const emprestimos = useMemo(() => {
    const mapa = {};
    lancamentos.filter((l) => l.tipo === "despesa" && l.emprestimo).forEach((l) => {
      const chave = l.pessoa?.trim() || "Sem nome";
      if (!mapa[chave]) mapa[chave] = { nome: chave, itens: [] };
      mapa[chave].itens.push(l);
    });
    return Object.values(mapa)
      .map((m) => ({
        ...m,
        pendentes: m.itens.filter((i) => i.status !== "Pago"),
        totalPendente: m.itens.filter((i) => i.status !== "Pago").reduce((s, i) => s + i.valor, 0),
      }))
      .filter((m) => m.totalPendente > 0)
      .sort((a, b) => b.totalPendente - a.totalPendente);
  }, [lancamentos]);

  const parcelamentos = useMemo(() => {
    const grupos = {};
    lancamentos.forEach((l) => {
      if (l.tipo !== "despesa" || !l.parcelaInfo) return;
      const g = l.parcelaInfo.grupo;
      if (!grupos[g]) grupos[g] = { grupo: g, descricao: l.descricao, pessoa: l.pessoa, categoria: l.categoria, parcelas: [] };
      grupos[g].parcelas.push(l);
    });
    return Object.values(grupos)
      .map((g) => {
        const parcelas = [...g.parcelas].sort((a, b) => (a.data < b.data ? -1 : 1));
        const pendentes = parcelas.filter((p) => p.status !== "Pago");
        const totalParcelas = parcelas[0]?.parcelaInfo?.total || parcelas.length;
        return {
          ...g,
          totalParcelas,
          pagas: totalParcelas - pendentes.length,
          totalRestante: pendentes.reduce((s, p) => s + p.valor, 0),
          proximaData: pendentes[0]?.data,
          ultimaData: parcelas.at(-1)?.data,
          quitado: pendentes.length === 0,
        };
      })
      .filter((d) => mostrarQuitadas || !d.quitado)
      .sort((a, b) => (a.quitado === b.quitado ? b.totalRestante - a.totalRestante : a.quitado ? 1 : -1));
  }, [lancamentos, mostrarQuitadas]);

  const pendenciasAvulsas = useMemo(() => {
    const mapa = {};
    lancamentos.filter((l) => l.tipo === "despesa" && l.status === "A pagar" && !l.parcelaInfo).forEach((l) => {
      const chave = l.pessoa?.trim() || l.descricao;
      if (!mapa[chave]) mapa[chave] = { nome: chave, itens: [] };
      mapa[chave].itens.push(l);
    });
    return Object.values(mapa).map((m) => ({ ...m, total: m.itens.reduce((s, i) => s + i.valor, 0) })).sort((a, b) => b.total - a.total);
  }, [lancamentos]);

  const totalGeralDevido = parcelamentos.reduce((s, d) => s + d.totalRestante, 0) + pendenciasAvulsas.reduce((s, p) => s + p.total, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto }}>Dívidas por credor</div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: pal.textoSuave, cursor: "pointer" }}>
          <input type="checkbox" checked={mostrarQuitadas} onChange={(e) => setMostrarQuitadas(e.target.checked)} /> Mostrar quitadas
        </label>
      </div>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 18 }}>
        Total geral em aberto: <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(totalGeralDevido)}</strong>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Parcelamentos</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14, marginBottom: 24 }}>
        {parcelamentos.length === 0 && <div style={{ fontSize: 13, color: pal.textoSuave }}>Nenhum parcelamento em andamento.</div>}
        {parcelamentos.map((d) => (
          <Cartao key={d.grupo} style={{ padding: 16, opacity: d.quitado ? 0.6 : 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto }}>{d.pessoa || d.descricao}</div>
            <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 10 }}>{d.descricao} · {d.categoria}</div>
            <Progresso valor={d.pagas} max={d.totalParcelas} corBase={d.quitado ? VERDE : cor} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
              <span style={{ color: pal.textoSuave }}>{d.pagas}/{d.totalParcelas} parcelas pagas</span>
              <span className="num-tab" style={{ color: d.quitado ? VERDE : VERMELHO, fontWeight: 600 }}>{d.quitado ? "Quitado" : formatarMoeda(d.totalRestante)}</span>
            </div>
            {!d.quitado && d.ultimaData && (
              <div style={{ fontSize: 11, color: pal.textoSuave, marginTop: 4 }}>Previsão de quitação: {new Date(d.ultimaData + "T00:00:00").toLocaleDateString("pt-BR")}</div>
            )}
          </Cartao>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Outras pendências (sem parcelamento)</div>
      <Cartao style={{ overflow: "hidden" }}>
        {pendenciasAvulsas.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: pal.textoSuave }}>Nenhuma pendência avulsa marcada como "A pagar".</div>
        ) : pendenciasAvulsas.map((p, i) => (
          <div key={p.nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: pal.texto }}>{p.nome}</div>
              <div style={{ fontSize: 11.5, color: pal.textoSuave }}>{p.itens.length} lançamento{p.itens.length > 1 ? "s" : ""}</div>
            </div>
            <div className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: VERMELHO }}>{formatarMoeda(p.total)}</div>
          </div>
        ))}
      </Cartao>

      {emprestimos.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em", margin: "24px 0 8px" }}>Quem me deve</div>
          <Cartao style={{ overflow: "hidden" }}>
            {emprestimos.map((m, i) => (
              <div key={m.nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: pal.texto }}>{m.nome}</div>
                  <div style={{ fontSize: 11.5, color: pal.textoSuave }}>{m.pendentes.length} adiantamento{m.pendentes.length > 1 ? "s" : ""} não devolvido{m.pendentes.length > 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: "#2F5D8A" }}>{formatarMoeda(m.totalPendente)}</div>
                  <Botao variante="secundario" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => m.pendentes.forEach((i) => editarLancamento(i.id, { status: "Pago" }))}>
                    Marcar devolvido
                  </Botao>
                </div>
              </div>
            ))}
          </Cartao>
        </>
      )}
    </div>
  );
}
