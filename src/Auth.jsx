import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { carregarTudo, limpar, haNovidades } from "./storage-shim.js";

// Faixa fixa no topo quando o aparelho fica sem internet: dá pra ler os dados,
// mas alterações não são salvas na nuvem até a conexão voltar.
function AvisoOffline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div role="status" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, padding: "calc(6px + env(safe-area-inset-top)) 12px 6px", background: "#B3261E", color: "#fff", fontSize: 12.5, textAlign: "center", fontFamily: "Inter, sans-serif" }}>
      Sem internet — você pode consultar, mas alterações não serão salvas.
    </div>
  );
}

// Dois aparelhos usando o app ao mesmo tempo: avisa quando o outro salvou algo novo e,
// se uma gravação for recusada (porque o outro salvou antes), explica o que aconteceu.
function AvisoSincronizacao() {
  const [conflito, setConflito] = useState(false);
  const [novidade, setNovidade] = useState(false);
  useEffect(() => {
    const aoConflito = () => setConflito(true);
    window.addEventListener("storage-conflito", aoConflito);
    let vivo = true;
    const checar = async () => {
      if (document.visibilityState !== "visible") return;
      try { if ((await haNovidades()) && vivo) setNovidade(true); } catch (e) { /* sem internet: tenta depois */ }
    };
    document.addEventListener("visibilitychange", checar);
    window.addEventListener("focus", checar);
    const id = setInterval(checar, 120000);
    return () => {
      vivo = false;
      window.removeEventListener("storage-conflito", aoConflito);
      document.removeEventListener("visibilitychange", checar);
      window.removeEventListener("focus", checar);
      clearInterval(id);
    };
  }, []);

  const botao = { padding: "9px 14px", borderRadius: 8, border: 0, background: "#1B2A4A", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  if (conflito) {
    return (
      <div role="alertdialog" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Inter, sans-serif" }}>
        <div style={{ background: "#fff", color: "#1B2A4A", borderRadius: 14, padding: 22, maxWidth: 380 }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Seus dados mudaram em outro aparelho</div>
          <p style={{ fontSize: 14, lineHeight: 1.45, margin: "0 0 14px" }}>
            Outro aparelho salvou dados mais novos. Para não apagar o que foi feito lá, <strong>a sua última alteração não foi salva</strong>.
            Atualize para ver os dados atuais e refaça a alteração, se precisar.
          </p>
          <button onClick={() => window.location.reload()} style={botao}>Atualizar agora</button>
        </div>
      </div>
    );
  }
  if (novidade) {
    return (
      <div role="status" style={{ position: "fixed", left: 12, right: 12, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 1000, background: "#1B2A4A", color: "#fff", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(0,0,0,.25)" }}>
        <span style={{ flex: 1 }}>Há dados novos salvos em outro aparelho.</span>
        <button onClick={() => window.location.reload()} style={{ ...botao, background: "#fff", color: "#1B2A4A", padding: "6px 12px" }}>Atualizar</button>
      </div>
    );
  }
  return null;
}

// Só login (e-mail + senha). O cadastro público fica desligado no Supabase:
// a única conta é a que você criou em Authentication > Users.
export default function Auth({ children }) {
  const [estado, setEstado] = useState("carregando"); // carregando | deslogado | pronto | erro
  const [erroCarga, setErroCarga] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const aoTerSessao = async (sessao) => {
    if (!sessao) { limpar(); setEstado("deslogado"); return; }
    try {
      await carregarTudo();
      setEstado("pronto");
    } catch (e) {
      setErroCarga(e.message || "Não foi possível carregar seus dados.");
      setEstado("erro");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => aoTerSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "SIGNED_OUT") aoTerSessao(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // permite o App chamar window.storage.sair()
  useEffect(() => {
    window.storage.sair = async () => { await supabase.auth.signOut(); };
  }, []);

  const entrar = async (e) => {
    e.preventDefault();
    setErro(""); setEnviando(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) { setErro("E-mail ou senha incorretos."); return; }
    setSenha("");
    setEstado("carregando");
    aoTerSessao(data.session);
  };

  const caixa = { minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#F7F5F0", fontFamily: "Inter, sans-serif", color: "#1B2A4A" };
  const input = { width: "100%", padding: "11px 12px", fontSize: 16, border: "1px solid #D9D4C7", borderRadius: 8, marginBottom: 10, background: "#fff" };

  if (estado === "pronto") return <>{children}<AvisoOffline /><AvisoSincronizacao /></>;
  if (estado === "carregando") return <div style={caixa}>Carregando seu financeiro...</div>;
  if (estado === "erro") {
    return (
      <div style={caixa}>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <p>Não consegui carregar seus dados.</p>
          <p style={{ fontSize: 12, color: "#8A5A5A" }}>{erroCarga}</p>
          <button onClick={() => window.location.reload()} style={{ ...input, cursor: "pointer", background: "#1B2A4A", color: "#fff", border: 0 }}>Tentar de novo</button>
          <button onClick={() => supabase.auth.signOut()} style={{ ...input, cursor: "pointer" }}>Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div style={caixa}>
      <form onSubmit={entrar} style={{ width: "100%", maxWidth: 340 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, margin: "0 0 4px" }}>Meu Financeiro</h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6B6459" }}>Entre para ver suas finanças.</p>
        <input type="email" autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} />
        <input type="password" autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required style={input} />
        <div style={{ minHeight: 18, fontSize: 12.5, color: "#B3261E", marginBottom: 8 }}>{erro}</div>
        <button type="submit" disabled={enviando} style={{ ...input, marginBottom: 0, cursor: "pointer", background: "#1B2A4A", color: "#fff", border: 0, fontWeight: 600 }}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
