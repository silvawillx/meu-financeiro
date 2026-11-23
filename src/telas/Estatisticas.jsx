import { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Sankey, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Download, ArrowUp, ArrowDown } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Cartao, estiloInput } from "../ui.jsx";
import { corCategoria } from "../lib/categorias.js";
import { mesLabel } from "../lib/datas.js";
import { formatarMoeda } from "../lib/formato.js";

export function PainelEstatisticas() {
  const { lancamentos, mesesDisponiveis, mesSelecionado, pal, categoriasDespesa } = useApp();
  const [anoRelatorio, setAnoRelatorio] = useState(new Date().getFullYear());

  const ultimos6 = mesesDisponiveis.slice(0, 6).reverse();
  const comparativo = ultimos6.map((m) => {
    const gasto = lancamentos.filter((l) => l.data.slice(0, 7) === m && l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
    const receita = lancamentos.filter((l) => l.data.slice(0, 7) === m && l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
    return { mes: mesLabel(m), Gasto: gasto, Receita: receita, Saldo: receita - gasto };
  });

  let acumulado = 0;
  const saldoAcumulado = comparativo.map((c) => { acumulado += c.Saldo; return { mes: c.mes, Acumulado: acumulado }; });

  const doMes = lancamentos.filter((l) => l.data.slice(0, 7) === mesSelecionado && l.tipo === "despesa");
  const pizza = useMemo(() => {
    const mapa = {};
    doMes.forEach((l) => { mapa[l.categoria] = (mapa[l.categoria] || 0) + l.valor; });
    return Object.entries(mapa).map(([nome, valor]) => ({ nome, valor, cor: corCategoria(nome, categoriasDespesa) }));
  }, [doMes]);

  const receitaMesSankey = useMemo(
    () => lancamentos.filter((l) => l.tipo === "receita" && l.data.slice(0, 7) === mesSelecionado).reduce((s, l) => s + l.valor, 0),
    [lancamentos, mesSelecionado]
  );
  const dadosSankey = useMemo(() => {
    if (pizza.length === 0 || receitaMesSankey === 0) return null;
    const nodes = [{ name: "Renda" }, ...pizza.map((p) => ({ name: p.nome }))];
    const links = pizza.map((p, i) => ({ source: 0, target: i + 1, value: Math.round(p.valor * 100) / 100 }));
    const totalDespesas = pizza.reduce((s, p) => s + p.valor, 0);
    if (receitaMesSankey > totalDespesas) {
      nodes.push({ name: "Sobrou" });
      links.push({ source: 0, target: nodes.length - 1, value: Math.round((receitaMesSankey - totalDespesas) * 100) / 100 });
    }
    return { nodes, links };
  }, [pizza, receitaMesSankey]);

  const porAno = useMemo(() => {
    const mapa = {};
    lancamentos.filter((l) => l.tipo === "despesa").forEach((l) => { const a = l.data.slice(0, 4); mapa[a] = (mapa[a] || 0) + l.valor; });
    return Object.entries(mapa).sort().map(([ano, valor]) => ({ ano, valor }));
  }, [lancamentos]);

  const idxAtual = comparativo.length - 1;
  const variacao = idxAtual > 0 ? ((comparativo[idxAtual].Gasto - comparativo[idxAtual - 1].Gasto) / (comparativo[idxAtual - 1].Gasto || 1)) * 100 : null;

  const anosDisponiveis = useMemo(() => Array.from(new Set(lancamentos.map((l) => l.data.slice(0, 4)))).sort().reverse(), [lancamentos]);
  const relatorioAnual = useMemo(() => {
    const doAno = lancamentos.filter((l) => l.tipo === "despesa" && l.data.slice(0, 4) === String(anoRelatorio));
    const mapa = {};
    doAno.forEach((l) => { mapa[l.categoria] = (mapa[l.categoria] || 0) + l.valor; });
    return Object.entries(mapa).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  }, [lancamentos, anoRelatorio]);
  const totalAnoRelatorio = relatorioAnual.reduce((s, c) => s + c.valor, 0);
  const totalSaudeAno = relatorioAnual.find((c) => c.categoria === "Saúde")?.valor || 0;

  const exportarRelatorioAnualCSV = () => {
    const linhas = ["Categoria;Total"];
    relatorioAnual.forEach((c) => linhas.push(`${c.categoria};${c.valor.toFixed(2).replace(".", ",")}`));
    linhas.push(`Total geral;${totalAnoRelatorio.toFixed(2).replace(".", ",")}`);
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-anual-${anoRelatorio}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {variacao !== null && (
        <Cartao style={{ padding: 16, display: "flex", alignItems: "center", gap: 10 }}>
          {variacao <= 0 ? <ArrowDown size={18} color={VERDE} /> : <ArrowUp size={18} color={VERMELHO} />}
          <div style={{ fontSize: 13.5, color: pal.texto }}>
            Gasto de <strong>{comparativo[idxAtual].mes}</strong> {variacao <= 0 ? "caiu" : "subiu"} <strong className="num-tab" style={{ color: variacao <= 0 ? VERDE : VERMELHO }}>{Math.abs(variacao).toFixed(0)}%</strong> em relação a {comparativo[idxAtual - 1].mes}
          </div>
        </Cartao>
      )}

      <Cartao style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Receita x Despesa por mês</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={comparativo}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v) => formatarMoeda(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Receita" fill={VERDE} radius={[4, 4, 0, 0]} barSize={16} />
            <Bar dataKey="Gasto" fill={VERMELHO} radius={[4, 4, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </Cartao>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="grid-responsiva">
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Categorias — {mesLabel(mesSelecionado)}</div>
          {pizza.length === 0 ? <div style={{ fontSize: 13, color: pal.textoSuave }}>Sem dados.</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pizza} dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {pizza.map((p, i) => <Cell key={i} fill={p.cor} />)}
                </Pie>
                <Tooltip formatter={(v) => formatarMoeda(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Cartao>
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Evolução dos gastos</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={comparativo}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => formatarMoeda(v)} />
              <Line type="monotone" dataKey="Gasto" stroke={VERMELHO} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Cartao>
      </div>

      {dadosSankey && (
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>
            Pra onde foi cada real — {mesLabel(mesSelecionado)}
          </div>
          <ResponsiveContainer width="100%" height={Math.max(240, dadosSankey.nodes.length * 32)}>
            <Sankey
              data={dadosSankey}
              nodePadding={22}
              nodeWidth={10}
              margin={{ left: 10, right: 120, top: 10, bottom: 10 }}
              link={{ stroke: pal.borda, strokeOpacity: 0.5 }}
            >
              <Tooltip formatter={(v) => formatarMoeda(v)} />
            </Sankey>
          </ResponsiveContainer>
        </Cartao>
      )}

      <Cartao style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Saldo acumulado</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={saldoAcumulado}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} width={50} />
            <Tooltip formatter={(v) => formatarMoeda(v)} />
            <Area type="monotone" dataKey="Acumulado" stroke={VERDE} fill={`${VERDE}33`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Cartao>

      {porAno.length > 1 && (
        <Cartao style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase", marginBottom: 10 }}>Comparação anual</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={porAno}>
              <XAxis dataKey="ano" tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: pal.textoSuave }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => formatarMoeda(v)} />
              <Bar dataKey="valor" fill={pal.texto} radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>
      )}

      <Cartao style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.textoSuave, textTransform: "uppercase" }}>Relatório anual (Imposto de Renda)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={anoRelatorio} onChange={(e) => setAnoRelatorio(e.target.value)} style={{ ...estiloInput(pal), padding: "6px 8px", fontSize: 12.5 }}>
              {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Botao variante="secundario" style={{ padding: "6px 10px" }} onClick={exportarRelatorioAnualCSV}><Download size={13} /> CSV</Botao>
          </div>
        </div>
        {totalSaudeAno > 0 && (
          <div style={{ background: "#8A3E5C1A", border: "1px solid #8A3E5C55", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: pal.texto }}>
            💊 Gasto total com <strong>Saúde</strong> em {anoRelatorio}: <strong className="num-tab">{formatarMoeda(totalSaudeAno)}</strong> — categoria comumente dedutível na declaração de IR (confirme sempre com um contador).
          </div>
        )}
        {relatorioAnual.length === 0 ? (
          <div style={{ fontSize: 13, color: pal.textoSuave }}>Sem despesas registradas em {anoRelatorio}.</div>
        ) : (
          <>
            {relatorioAnual.map((c) => (
              <div key={c.categoria} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${pal.bordaSuave}` }}>
                <span style={{ fontSize: 13, color: pal.texto, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: corCategoria(c.categoria, categoriasDespesa) }} /> {c.categoria}
                </span>
                <span className="num-tab" style={{ fontSize: 13, fontWeight: 600, color: pal.texto }}>{formatarMoeda(c.valor)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 6, borderTop: `1px solid ${pal.borda}`, fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ color: pal.texto }}>Total do ano</span>
              <span className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(totalAnoRelatorio)}</span>
            </div>
          </>
        )}
      </Cartao>
    </div>
  );
}
