import { useState } from "react";
import { useApp } from "../contexto.js";
import { Modal, Campo, Botao, estiloInput } from "../ui.jsx";
import { formatarMoeda } from "../lib/formato.js";
import { saldoConta } from "../lib/lancamentos.js";

// Assistente para limpar os lançamentos e recomeçar organizado.
// Baixa um backup antes e deixa cada conta com o saldo que você tem de verdade hoje.
export default function Recomecar({ onFechar }) {
  const { contas, cartoes, lancamentos, recorrentes, pal, cor, exportarBackupJSON, recomecarDoZero } = useApp();
  const [manter, setManter] = useState({ contasCartoes: true, recorrentes: true, metas: true, categorias: true });
  const ativas = contas.filter((c) => !c.arquivada);
  const [saldos, setSaldos] = useState(() => Object.fromEntries(ativas.map((c) => [c.id, String(saldoConta(lancamentos, c, { cartoes })).replace(".", ",")])));
  const [confirma, setConfirma] = useState("");
  const pronto = confirma.trim().toUpperCase() === "RECOMEÇAR" || confirma.trim().toUpperCase() === "RECOMECAR";

  const opcao = (chave, rotulo, detalhe) => (
    <label key={chave} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 13, color: pal.texto }}>
      <input type="checkbox" checked={manter[chave]} onChange={(e) => setManter({ ...manter, [chave]: e.target.checked })} style={{ marginTop: 3 }} />
      <span>{rotulo}<span style={{ display: "block", fontSize: 11.5, color: pal.textoSuave }}>{detalhe}</span></span>
    </label>
  );

  const confirmar = (e) => {
    e.preventDefault();
    if (!pronto) return;
    exportarBackupJSON(); // cópia de segurança antes de apagar
    const numeros = Object.fromEntries(Object.entries(saldos).map(([id, v]) => [id, parseFloat(String(v).replace(",", ".")) || 0]));
    recomecarDoZero({ manter, saldos: numeros });
    onFechar();
  };

  return (
    <Modal titulo="Recomeçar do zero" onFechar={onFechar} largura={460}>
      <form onSubmit={confirmar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: pal.textoSuave }}>
          Apaga os <strong style={{ color: pal.texto }}>{lancamentos.length} lançamentos</strong> e o histórico de edições para você lançar do jeito certo.
          Um backup é baixado antes, para você poder voltar atrás.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ fontSize: 12, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em" }}>O que manter</div>
          {opcao("contasCartoes", `Contas e cartões (${contas.length} conta(s), ${cartoes.length} cartão(ões))`, "Se desmarcar, fica só uma 'Conta principal' e nenhum cartão.")}
          {opcao("recorrentes", `Recorrentes (${recorrentes.length})`, "Os lançamentos deste mês são criados de novo.")}
          {opcao("metas", "Reserva (metas de economia) e investimentos", "Se desmarcar, são apagados.")}
          {opcao("categorias", "Categorias, metas por categoria e favoritos", "Se desmarcar, voltam ao padrão.")}
        </div>

        {manter.contasCartoes && ativas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em" }}>Quanto você tem hoje em cada conta?</div>
            {ativas.map((c) => (
              <Campo key={c.id} label={`${c.nome} (hoje o app mostra ${formatarMoeda(saldoConta(lancamentos, c, { cartoes }))})`}>
                <input type="text" inputMode="decimal" className="num-tab" value={saldos[c.id] ?? ""} onChange={(e) => setSaldos({ ...saldos, [c.id]: e.target.value })} style={estiloInput(pal)} />
              </Campo>
            ))}
            <div style={{ fontSize: 11.5, color: pal.textoSuave }}>Esse valor vira o saldo inicial, e dali em diante o app soma o que você lançar.</div>
          </div>
        )}

        <Campo label='Para confirmar, digite RECOMEÇAR'>
          <input type="text" value={confirma} onChange={(e) => setConfirma(e.target.value)} placeholder="RECOMEÇAR" style={estiloInput(pal)} autoCapitalize="characters" />
        </Campo>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <button type="submit" disabled={!pronto} style={{ padding: "9px 14px", borderRadius: 8, border: 0, background: pronto ? "#B4552F" : pal.borda, color: "#fff", fontSize: 13, fontWeight: 600, cursor: pronto ? "pointer" : "not-allowed" }}>
            Baixar backup e recomeçar
          </button>
        </div>
      </form>
    </Modal>
  );
}
