import { LayoutDashboard, Receipt, Calendar, Landmark, CreditCard, BarChart3, Target, Star, Archive, Settings, Plus, Wallet, Menu, RefreshCw, Banknote, Plane, TrendingUp, CalendarRange } from "lucide-react";
import { useApp } from "../contexto.js";

export const ITENS_MENU = [
  { id: "dashboard", label: "Dashboard", icone: LayoutDashboard },
  { id: "lancamentos", label: "Lançamentos", icone: Receipt },
  { id: "calendario", label: "Calendário", icone: Calendar },
  { id: "contas", label: "Contas", icone: Landmark },
  { id: "cartoes", label: "Cartões", icone: CreditCard },
  { id: "recorrentes", label: "Recorrentes", icone: RefreshCw },
  { id: "dividas", label: "Dívidas", icone: Banknote },
  { id: "investimentos", label: "Investimentos", icone: TrendingUp },
  { id: "projecao", label: "Projeção", icone: CalendarRange },
  { id: "viagens", label: "Viagens", icone: Plane },
  { id: "estatisticas", label: "Estatísticas", icone: BarChart3 },
  { id: "metas", label: "Metas", icone: Target },
  { id: "favoritos", label: "Favoritos", icone: Star },
  { id: "backup", label: "Backup", icone: Archive },
  { id: "config", label: "Configurações", icone: Settings },
];


export function Sidebar({ paginaAtiva, onNavegar, aberta, onFechar }) {
  const { pal, cor } = useApp();
  return (
    <>
      {aberta && <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 40, display: "none" }} className="overlay-mobile" />}
      <div className={`sidebar ${aberta ? "sidebar-aberta" : ""}`} style={{ background: pal.cartao, borderRight: `1px solid ${pal.borda}`, width: 210, flexShrink: 0, padding: "20px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 20 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: cor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Wallet size={17} color="#fff" />
          </div>
          <div className="titulo-serif" style={{ fontSize: 15, fontWeight: 600, color: pal.texto, lineHeight: 1.15 }}>Meu Financeiro</div>
        </div>
        {ITENS_MENU.map((item) => {
          const Icone = item.icone;
          const ativo = paginaAtiva === item.id;
          return (
            <button key={item.id} onClick={() => { onNavegar(item.id); onFechar(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none",
                background: ativo ? cor : "transparent", color: ativo ? "#fff" : pal.textoSuave, fontSize: 13.5,
                fontWeight: ativo ? 600 : 500, cursor: "pointer", textAlign: "left",
              }}>
              <Icone size={16} /> {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}


export function BarraInferior({ paginaAtiva, onNavegar, onNovo, onMais }) {
  const { pal, cor } = useApp();
  const item = (id, rotulo, Icone) => {
    const ativo = paginaAtiva === id;
    return (
      <button key={id} onClick={() => onNavegar(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "none", color: ativo ? cor : pal.textoSuave, fontSize: 10.5, fontWeight: ativo ? 600 : 500, cursor: "pointer", padding: "8px 0" }}>
        <Icone size={20} /> {rotulo}
      </button>
    );
  };
  return (
    <nav className="barra-inferior" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: pal.cartao, borderTop: `1px solid ${pal.borda}`, alignItems: "center", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {item("dashboard", "Início", LayoutDashboard)}
      {item("lancamentos", "Lançamentos", Receipt)}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <button onClick={onNovo} aria-label="Novo lançamento" style={{ width: 52, height: 52, marginTop: -22, borderRadius: "50%", border: `3px solid ${pal.cartao}`, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,.25)", cursor: "pointer" }}>
          <Plus size={24} />
        </button>
      </div>
      {item("cartoes", "Cartões", CreditCard)}
      <button onClick={onMais} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "none", color: pal.textoSuave, fontSize: 10.5, fontWeight: 500, cursor: "pointer", padding: "8px 0" }}>
        <Menu size={20} /> Mais
      </button>
    </nav>
  );
}
