import { useState } from "react";
import { Plus, Trash2, Sun, Moon, Bell } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERMELHO } from "../tema.js";
import { Botao, Cartao, estiloInput, Confirmacao } from "../ui.jsx";

export const CORES_DISPONIVEIS = ["#1B2A4A", "#3E6F5C", "#8A3E5C", "#2F5D8A", "#8A5A2F", "#6B4E9C"];


export function GerenciadorCategorias({ tipo }) {
  const { categoriasDespesa, categoriasReceita, adicionarCategoria, editarCategoria, excluirCategoria, pal } = useApp();
  const lista = tipo === "receita" ? categoriasReceita : categoriasDespesa;
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState("#6B4E9C");
  const [renomeando, setRenomeando] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [excluirNome, setExcluirNome] = useState(null);

  const adicionar = (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    adicionarCategoria(tipo, novoNome, novaCor);
    setNovoNome("");
  };

  const salvarRenomeacao = (nomeAntigo) => {
    if (nomeEdicao.trim() && nomeEdicao.trim() !== nomeAntigo) editarCategoria(tipo, nomeAntigo, { nome: nomeEdicao.trim() });
    setRenomeando(null);
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>{tipo === "receita" ? "Categorias de receita" : "Categorias de despesa"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {lista.map((c) => (
          <div key={c.nome} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: `${pal.borda}33` }}>
            <input type="color" value={c.cor} onChange={(e) => editarCategoria(tipo, c.nome, { cor: e.target.value })} style={{ width: 22, height: 22, border: "none", background: "none", padding: 0, flexShrink: 0 }} />
            {renomeando === c.nome ? (
              <input autoFocus type="text" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)}
                onBlur={() => salvarRenomeacao(c.nome)} onKeyDown={(e) => e.key === "Enter" && salvarRenomeacao(c.nome)}
                style={{ ...estiloInput(pal), flex: 1, padding: "4px 8px", fontSize: 13 }} />
            ) : (
              <div onClick={() => { setRenomeando(c.nome); setNomeEdicao(c.nome); }} style={{ flex: 1, fontSize: 13, color: pal.texto, cursor: "text" }}>{c.nome}</div>
            )}
            {c.nome !== "Outros" && (
              <button onClick={() => setExcluirNome(c.nome)} style={{ border: "none", background: "transparent", color: VERMELHO, cursor: "pointer", padding: 3 }}><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={adicionar} style={{ display: "flex", gap: 6 }}>
        <input type="color" value={novaCor} onChange={(e) => setNovaCor(e.target.value)} style={{ width: 32, height: 32, border: "none", background: "none", flexShrink: 0 }} />
        <input type="text" placeholder="Nova categoria" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} style={{ ...estiloInput(pal), flex: 1 }} />
        <Botao type="submit" style={{ padding: "8px 10px" }}><Plus size={14} /></Botao>
      </form>
      {excluirNome && (
        <Confirmacao
          msg={`Excluir a categoria "${excluirNome}"? Os lançamentos que usam ela passam a ficar em "Outros".`}
          onCancelar={() => setExcluirNome(null)}
          onConfirmar={() => { excluirCategoria(tipo, excluirNome); setExcluirNome(null); }}
        />
      )}
    </div>
  );
}


export function PainelConfiguracoes() {
  const { tema, setTema, cor, setCor, pal, notificacoesAtivas, ativarNotificacoes, desativarNotificacoes, historico } = useApp();

  return (
    <div>
      <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto, marginBottom: 14 }}>Configurações</div>
      <Cartao style={{ padding: 18, maxWidth: 420, display: "flex", flexDirection: "column", gap: 18, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>Tema</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Botao variante={tema === "claro" ? "primario" : "secundario"} onClick={() => setTema("claro")}><Sun size={14} /> Claro</Botao>
            <Botao variante={tema === "escuro" ? "primario" : "secundario"} onClick={() => setTema("escuro")}><Moon size={14} /> Escuro</Botao>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 4 }}>Lembretes de vencimento</div>
          <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 8 }}>Avisa quando alguma conta "A pagar" vence nos próximos 3 dias — só funciona enquanto o app está aberto no navegador.</div>
          <Botao variante={notificacoesAtivas ? "primario" : "secundario"} onClick={() => (notificacoesAtivas ? desativarNotificacoes() : ativarNotificacoes())}>
            <Bell size={14} /> {notificacoesAtivas ? "Ativado — clique para desativar" : "Ativar lembretes"}
          </Botao>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>Cor principal</div>
          <div style={{ display: "flex", gap: 8 }}>
            {CORES_DISPONIVEIS.map((c) => (
              <button key={c} onClick={() => setCor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: cor === c ? "2px solid #fff" : "none", boxShadow: cor === c ? `0 0 0 2px ${c}` : "none", cursor: "pointer" }} />
            ))}
          </div>
        </div>
      </Cartao>
      <Cartao style={{ padding: 18, maxWidth: 420, display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto }}>Conta</div>
        <div style={{ fontSize: 11.5, color: pal.textoSuave }}>Seus dados ficam salvos na nuvem e só aparecem depois do login.</div>
        <Botao variante="secundario" style={{ alignSelf: "flex-start" }} onClick={() => window.storage.sair && window.storage.sair()}>Sair da conta</Botao>
      </Cartao>
      <Cartao style={{ padding: 18, maxWidth: 420, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 12, color: pal.textoSuave }}>Clique no nome pra renomear, na bolinha pra trocar a cor.</div>
        <GerenciadorCategorias tipo="despesa" />
        <div style={{ borderTop: `1px dashed ${pal.borda}`, paddingTop: 16 }}>
          <GerenciadorCategorias tipo="receita" />
        </div>
      </Cartao>

      <Cartao style={{ padding: 18, maxWidth: 420, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 4 }}>Histórico de alterações</div>
        <div style={{ fontSize: 11.5, color: pal.textoSuave, marginBottom: 10 }}>Últimas edições e exclusões de lançamentos, pra você entender o que mudou.</div>
        {historico.length === 0 ? (
          <div style={{ fontSize: 12.5, color: pal.textoSuave }}>Nenhuma alteração registrada ainda.</div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {historico.slice(0, 20).map((h, i) => (
              <div key={h.id} style={{ padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${pal.bordaSuave}`, fontSize: 12 }}>
                <div style={{ color: pal.texto }}>
                  {h.tipo === "excluido" ? "🗑 Excluído: " : "✏️ Editado: "}<strong>{h.descricaoLancamento}</strong>
                </div>
                <div style={{ color: pal.textoSuave, fontSize: 11 }}>{h.detalhes} — {new Date(h.quando).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        )}
      </Cartao>

    </div>
  );
}
