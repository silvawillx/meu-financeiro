import { useEffect } from "react";
import { mesAtual, mesLabelCompleto, addMeses } from "./lib/datas.js";
import { X, Check, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useApp } from "./contexto.js";
import { VERMELHO } from "./tema.js";

export function Botao({ children, onClick, variante = "primario", type = "button", style = {}, title }) {
  const { cor, pal } = useApp();
  const base = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid transparent", transition: "opacity .15s" };
  const variantes = {
    primario: { background: cor, color: "#fff" },
    secundario: { background: "transparent", color: cor, borderColor: cor },
    perigo: { background: "transparent", color: VERMELHO, borderColor: VERMELHO },
    fantasma: { background: "transparent", color: pal.textoSuave },
  };
  return (
    <button type={type} title={title} onClick={onClick} style={{ ...base, ...variantes[variante], ...style }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.85)} onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}>
      {children}
    </button>
  );
}

export function Cartao({ children, style = {}, className = "" }) {
  const { pal } = useApp();
  return <div className={className} style={{ background: pal.cartao, border: `1px solid ${pal.borda}`, borderRadius: 12, ...style }}>{children}</div>;
}

export function Campo({ label, children }) {
  const { pal } = useApp();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: pal.textoSuave }}>
      {label}
      {children}
    </label>
  );
}
export function estiloInput(pal) {
  return { padding: "8px 10px", borderRadius: 8, border: `1px solid ${pal.borda}`, fontSize: 14, background: pal.cartao, color: pal.texto };
}

export function Modal({ titulo, onFechar, children, largura = 480 }) {
  const { pal } = useApp();
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: pal.cartao, borderRadius: 14, padding: 22, width: "100%", maxWidth: largura, maxHeight: "88vh", overflowY: "auto", border: `1px solid ${pal.borda}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="titulo-serif" style={{ fontSize: 18, fontWeight: 600, color: pal.texto }}>{titulo}</div>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: pal.textoSuave }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirmacao({ msg, onCancelar, onConfirmar, rotuloConfirmar = "Excluir" }) {
  const { pal } = useApp();
  return (
    <Modal titulo="Confirmar" onFechar={onCancelar} largura={360}>
      <div style={{ fontSize: 14, color: pal.texto, marginBottom: 18, display: "flex", gap: 10 }}>
        <AlertTriangle size={18} color={VERMELHO} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{msg}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Botao variante="fantasma" onClick={onCancelar}>Cancelar</Botao>
        <Botao variante="perigo" onClick={onConfirmar}>{rotuloConfirmar}</Botao>
      </div>
    </Modal>
  );
}

export function Toast({ toast, onFechar }) {
  if (!toast) return null;
  const { msg, acao } = typeof toast === "string" ? { msg: toast, acao: null } : toast;
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#1B2A4A", color: "#fff", padding: "10px 12px 10px 18px", borderRadius: 999, fontSize: 13, zIndex: 200, boxShadow: "0 4px 14px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
      <Check size={14} /> {msg}
      {acao && (
        <button
          onClick={() => { acao.onClick(); onFechar(); }}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {acao.label}
        </button>
      )}
    </div>
  );
}

export function Progresso({ valor, max, corBase }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  const estourou = valor > max;
  return (
    <div style={{ height: 8, borderRadius: 999, background: "#E4DFD333", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: estourou ? VERMELHO : corBase, transition: "width .3s" }} />
    </div>
  );
}

// Navegador de mês grande e visual — setas pra trocar de mês, mês/ano em destaque,
// e um atalho pra voltar rápido ao mês atual quando você estiver navegando por outros.
export function NavegadorMes({ compacto = false }) {
  const { mesSelecionado, setMesSelecionado, pal, cor } = useApp();
  const mudarMes = (delta) => setMesSelecionado(addMeses(`${mesSelecionado}-01`, delta).slice(0, 7));
  const ehMesAtual = mesSelecionado === mesAtual();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: pal.cartao, border: `1px solid ${pal.borda}`, borderRadius: 10, padding: "6px 8px" }}>
      <button onClick={() => mudarMes(-1)} title="Mês anterior" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "none", background: "transparent", color: pal.texto, cursor: "pointer", borderRadius: 6 }}>
        <ChevronLeft size={18} />
      </button>
      <div style={{ minWidth: compacto ? 90 : 140, textAlign: "center" }}>
        <div className="titulo-serif" style={{ fontSize: compacto ? 14 : 17, fontWeight: 600, color: pal.texto, textTransform: "capitalize", lineHeight: 1.1 }}>
          {mesLabelCompleto(mesSelecionado)}
        </div>
        {!ehMesAtual && (
          <button onClick={() => setMesSelecionado(mesAtual())} style={{ fontSize: 10.5, color: cor, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            voltar para hoje
          </button>
        )}
      </div>
      <button onClick={() => mudarMes(1)} title="Próximo mês" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "none", background: "transparent", color: pal.texto, cursor: "pointer", borderRadius: 6 }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function CardMetrica({ icone: Icone, label, valor, cor, sub }) {
  const { pal } = useApp();
  return (
    <Cartao style={{ padding: 16, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${cor}1A`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone size={15} color={cor} />
        </div>
        <div style={{ fontSize: 11.5, color: pal.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      </div>
      <div className="num-tab kpi-valor" style={{ fontSize: 21, fontWeight: 600, color: pal.texto }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: pal.textoSuave, marginTop: 3 }}>{sub}</div>}
    </Cartao>
  );
}
