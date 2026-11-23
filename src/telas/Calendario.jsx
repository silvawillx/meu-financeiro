import { useState, useMemo } from "react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Modal, NavegadorMes } from "../ui.jsx";
import { MESES_ABREV, DIAS_SEMANA, hojeISO, diasNoMes } from "../lib/datas.js";
import { formatarMoeda } from "../lib/formato.js";

export function PainelCalendario() {
  const { lancamentos, mesSelecionado, pal, cor } = useApp();
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [ano, mes] = mesSelecionado.split("-").map(Number);
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDias = diasNoMes(mesSelecionado);

  const porDia = useMemo(() => {
    const mapa = {};
    lancamentos.filter((l) => l.data.slice(0, 7) === mesSelecionado && l.tipo === "despesa").forEach((l) => {
      const dia = parseInt(l.data.slice(8, 10), 10);
      if (!mapa[dia]) mapa[dia] = { total: 0, qtd: 0 };
      mapa[dia].total += l.valor; mapa[dia].qtd += 1;
    });
    return mapa;
  }, [lancamentos, mesSelecionado]);

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);

  const lancamentosDoDia = diaSelecionado ? lancamentos.filter((l) => l.data === `${mesSelecionado}-${String(diaSelecionado).padStart(2, "0")}`) : [];

  const totalMesCalendario = Object.values(porDia).reduce((s, d) => s + d.total, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11.5, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em" }}>Total gasto no mês</div>
          <div className="num-tab" style={{ fontSize: 22, fontWeight: 600, color: pal.texto }}>{formatarMoeda(totalMesCalendario)}</div>
        </div>
        <NavegadorMes />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 20 }}>
        {DIAS_SEMANA.map((d) => <div key={d} style={{ fontSize: 11, color: pal.textoSuave, textAlign: "center", textTransform: "uppercase" }}>{d}</div>)}
        {celulas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const info = porDia[d];
          const ehHoje = `${mesSelecionado}-${String(d).padStart(2, "0")}` === hojeISO();
          return (
            <div key={i} onClick={() => info && setDiaSelecionado(d)}
              style={{
                aspectRatio: "1", borderRadius: 8, border: `1px solid ${ehHoje ? cor : pal.borda}`, padding: 6,
                cursor: info ? "pointer" : "default", background: ehHoje ? `${cor}14` : pal.cartao, display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}>
              <div style={{
                fontSize: 11, color: ehHoje ? "#fff" : pal.textoSuave, fontWeight: ehHoje ? 700 : 400,
                background: ehHoje ? cor : "transparent", borderRadius: "50%", width: 18, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{d}</div>
              {info && (
                <div>
                  <div className="num-tab" style={{ fontSize: 10.5, color: VERMELHO, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatarMoeda(info.total)}</div>
                  <div style={{ fontSize: 9.5, color: pal.textoSuave }}>{info.qtd} lanç.</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {diaSelecionado && (
        <Modal titulo={`Gastos de ${diaSelecionado}/${MESES_ABREV[mes - 1]}`} onFechar={() => setDiaSelecionado(null)}>
          {lancamentosDoDia.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${pal.bordaSuave}` }}>
              <div style={{ fontSize: 13.5, color: pal.texto }}>{l.descricao}</div>
              <div className="num-tab" style={{ fontSize: 13.5, fontWeight: 600, color: l.tipo === "receita" ? VERDE : pal.texto }}>{formatarMoeda(l.valor)}</div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
