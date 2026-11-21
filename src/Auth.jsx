import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { carregarTudo, limpar } from "./storage-shim.js";

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

  if (estado === "pronto") return children;
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
