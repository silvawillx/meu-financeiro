import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { AlertTriangle } from "lucide-react";
import { useApp } from "../contexto.js";
import { Cartao } from "../ui.jsx";
import { VERDE, VERMELHO } from "../tema.js";
import { formatarMoeda } from "../lib/formato.js";
import { mesLabel, mesLabelCompleto } from "../lib/datas.js";
import { projetar, mediaGastoVariavel } from "../lib/projecao.js";

// Para onde o saldo vai nos próximos 6 meses, com o que já está combinado (contas, parcelas, recorrentes).
export default function PainelProjecao() {
  const { contas, lancamentos, cartoes, recorrentes, metasEconomia, pal } = useApp();
  const media = useMemo(() => mediaGastoVariavel(lancamentos), [lancamentos]);
  const [comVariavel, setComVariavel] = useState(false);
  const r = useMemo(
    () => projetar({ contas, lancamentos, cartoes, recorrentes, metasEconomia, gastoVariavelMensal: comVariavel ? media : 0 }),
    [contas, lancamentos, cartoes, recorrentes, metasEconomia, comVariavel, media],
  );
  const dados = r.meses.map((m) => ({ ...m, rotulo: mesLabel(m.mes) }));

  return (
    <div>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 12 }}>
        Começa pelo saldo livre de hoje (saldo das contas menos a reserva: <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(r.saldoInicial)}</strong>)
        e soma o que ainda vai entrar e sair: contas a pagar, parcelas e recorrentes ativas.
      </div>

      {r.primeiroNegativo ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#B4552F14", border: "1px solid #B4552F55", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <AlertTriangle size={18} color={VERMELHO} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13.5, color: pal.texto }}>
            Em <strong>{mesLabelCompleto(r.primeiroNegativo.mes)}</strong> o saldo previsto fica negativo
            (<strong className="num-tab">{formatarMoeda(r.primeiroNegativo.saldoFinal)}</strong>). Vale adiantar receitas ou segurar gastos antes disso.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13.5, color: VERDE, marginBottom: 14 }}>✓ Nos próximos 6 meses o saldo previsto não fica negativo.</div>
      )}

      <Cartao style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Saldo previsto no fim de cada mês</div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={dados} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: pal.textoSuave }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <ReferenceLine y={0} stroke={pal.borda} />
            <Tooltip formatter={(v) => formatarMoeda(v)} labelFormatter={(l) => l} />
            <Bar dataKey="saldoFinal" name="Saldo previsto" radius={[4, 4, 0, 0]}>
              {dados.map((d) => <Cell key={d.mes} fill={d.negativo ? VERMELHO : VERDE} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Cartao>

      <Cartao style={{ overflow: "hidden", marginBottom: 12 }}>
        {r.meses.map((m, i) => (
          <div key={m.mes} style={{ padding: "11px 14px", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: pal.texto }}>{mesLabelCompleto(m.mes)}</span>
              <span className="num-tab" style={{ fontSize: 14, fontWeight: 600, color: m.negativo ? VERMELHO : pal.texto }}>{formatarMoeda(m.saldoFinal)}</span>
            </div>
            <div style={{ fontSize: 12, color: pal.textoSuave, marginTop: 2 }}>
              Entra <span className="num-tab">{formatarMoeda(m.entradas)}</span> · Sai <span className="num-tab">{formatarMoeda(m.saidas)}</span>
              {m.variavel > 0 && <> · Gasto variável <span className="num-tab">{formatarMoeda(m.variavel)}</span></>}
            </div>
          </div>
        ))}
      </Cartao>

      {media > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: pal.texto, cursor: "pointer", marginBottom: 8 }}>
          <input type="checkbox" checked={comVariavel} onChange={(e) => setComVariavel(e.target.checked)} />
          Incluir meu gasto variável médio ({formatarMoeda(media)} por mês, dos últimos meses)
        </label>
      )}
      <div style={{ fontSize: 11.5, color: pal.textoSuave }}>
        Sem essa opção, a projeção só conta o que já está combinado e não inclui gastos do dia a dia que você ainda não lançou.
      </div>
    </div>
  );
}
