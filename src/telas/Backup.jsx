import { useState, useMemo, useRef } from "react";
import { Upload, Download } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERMELHO } from "../tema.js";
import { Botao, Cartao, Confirmacao, Progresso } from "../ui.jsx";
import { hojeISO } from "../lib/datas.js";
import Recomecar from "../componentes/Recomecar.jsx";

export function EspacoComprovantes() {
  const { lancamentos, mostrarToast, pal } = useApp();
  const LIMITE_BYTES = 4.5 * 1024 * 1024; // margem de segurança dentro do limite de 5MB por chave
  const bytesUsados = useMemo(() => lancamentos.reduce((s, l) => s + (l.anexo ? l.anexo.length : 0), 0), [lancamentos]);
  const qtdComprovantes = lancamentos.filter((l) => l.anexo).length;
  const pct = Math.min(100, (bytesUsados / LIMITE_BYTES) * 100);
  if (qtdComprovantes === 0) return null;

  const baixarTodos = () => {
    const comAnexo = lancamentos.filter((l) => l.anexo);
    comAnexo.forEach((l, i) => {
      setTimeout(() => {
        const ext = l.anexo.match(/^data:image\/(\w+);/)?.[1] || "jpg";
        const nomeBase = `${l.data}-${l.descricao}`.replace(/[^a-z0-9-]+/gi, "-").slice(0, 60);
        const a = document.createElement("a");
        a.href = l.anexo; a.download = `${nomeBase}.${ext}`; a.click();
      }, i * 400);
    });
    mostrarToast(`Baixando ${comAnexo.length} comprovante(s) — seu navegador pode pedir permissão pra downloads múltiplos`, null, 4500);
  };

  return (
    <Cartao style={{ padding: 18, maxWidth: 420, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: pal.texto, marginBottom: 8 }}>Espaço usado por comprovantes</div>
      <Progresso valor={bytesUsados} max={LIMITE_BYTES} corBase="#2F5D8A" />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
        <span style={{ color: pct >= 80 ? VERMELHO : pal.textoSuave }}>{(bytesUsados / 1024 / 1024).toFixed(2)} MB usados ({pct.toFixed(0)}%)</span>
        <span style={{ color: pal.textoSuave }}>{qtdComprovantes} comprovante{qtdComprovantes > 1 ? "s" : ""}</span>
      </div>
      {pct >= 80 && <div style={{ fontSize: 11.5, color: VERMELHO, marginTop: 6 }}>Chegando perto do limite — evite anexar fotos muito grandes.</div>}
      <Botao variante="secundario" style={{ marginTop: 12, padding: "7px 12px" }} onClick={baixarTodos}><Download size={14} /> Baixar todos os comprovantes</Botao>
    </Cartao>
  );
}


export function PainelBackup() {
  const { lancamentos, contas, restaurarBackup, exportarBackupJSON, pal, mostrarToast } = useApp();
  const inputRef = useRef(null);

  const exportarCSV = () => {
    const linhas = ["Data;Tipo;Categoria;Descrição;Pessoa;Status;Conta;Escopo;Valor"];
    lancamentos.forEach((l) => {
      const conta = contas.find((c) => c.id === l.contaId)?.nome || "";
      linhas.push([l.data, l.tipo, l.categoria, l.descricao, l.pessoa, l.status, conta, l.escopo || "pessoal", l.valor.toFixed(2).replace(".", ",")].join(";"));
    });
    // O \uFEFF (BOM) é necessário pra o Excel do Windows reconhecer acentuação em UTF-8 corretamente.
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lancamentos-${hojeISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
    mostrarToast("CSV exportado (abre direto no Excel)");
  };

  const [pendente, setPendente] = useState(null);
  const [recomecando, setRecomecando] = useState(false);
  const importarJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const texto = await file.text();
    e.target.value = "";
    try {
      const dados = JSON.parse(texto);
      if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error("formato");
      const listas = ["lancamentos", "contas", "cartoes", "recorrentes", "favoritos", "categoriasDespesa", "categoriasReceita", "metasEconomia", "viagens", "investimentos"];
      for (const k of listas) if (dados[k] !== undefined && !Array.isArray(dados[k])) throw new Error(k);
      const lancOk = (dados.lancamentos || []).every((l) => l && typeof l.data === "string" && /^\d{4}-\d{2}-\d{2}/.test(l.data) && (l.tipo === "despesa" || l.tipo === "receita" || l.tipo === "transferencia") && typeof l.valor === "number");
      if (!lancOk) throw new Error("lancamentos");
      if (!listas.some((k) => (dados[k] || []).length > 0)) throw new Error("vazio");
      setPendente({ dados, nome: file.name });
    } catch (err) {
      alert(err.message === "vazio" ? "O arquivo não tem dados para importar." : "Esse arquivo não parece um backup do Meu Financeiro (ou está com dados fora do formato). Nada foi alterado.");
    }
  };

  return (
    <div>
      <div className="titulo-serif" style={{ fontSize: 16, fontWeight: 600, color: pal.texto, marginBottom: 14 }}>Backup e exportação</div>
      <EspacoComprovantes />
      <Cartao style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto, marginBottom: 6 }}>Exportar tudo (JSON)</div>
          <div style={{ fontSize: 12, color: pal.textoSuave, marginBottom: 8 }}>Guarda contas, cartões, metas, favoritos e lançamentos — use pra restaurar depois.</div>
          <Botao onClick={exportarBackupJSON}><Download size={14} /> Exportar backup</Botao>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto, marginBottom: 6 }}>Restaurar backup</div>
          <input ref={inputRef} type="file" accept=".json" onChange={importarJSON} style={{ display: "none" }} />
          <Botao variante="secundario" onClick={() => inputRef.current?.click()}><Upload size={14} /> Importar backup (.json)</Botao>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto, marginBottom: 6 }}>Exportar lançamentos (CSV / Excel)</div>
          <Botao variante="secundario" onClick={exportarCSV}><Download size={14} /> Exportar CSV</Botao>
        </div>
        <div style={{ fontSize: 11.5, color: pal.textoSuave, borderTop: `1px dashed ${pal.borda}`, paddingTop: 10 }}>
          Exportação em PDF não está disponível neste ambiente — use o CSV (abre no Excel/Google Sheets) ou o backup em JSON.
        </div>
      </Cartao>
      <Cartao style={{ padding: 18, maxWidth: 420, marginTop: 14, border: "1px solid #B4552F55" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.texto, marginBottom: 6 }}>Recomeçar do zero</div>
        <div style={{ fontSize: 12, color: pal.textoSuave, marginBottom: 8 }}>Apaga os lançamentos para você reorganizar tudo. Baixa um backup antes e deixa você escolher o que manter.</div>
        <Botao variante="perigo" onClick={() => setRecomecando(true)}>Recomeçar do zero…</Botao>
      </Cartao>
      {recomecando && <Recomecar onFechar={() => setRecomecando(false)} />}
      {pendente && (
        <Confirmacao
          msg={`Importar "${pendente.nome}"? Isto SUBSTITUI os dados atuais pelos do arquivo: ${(pendente.dados.lancamentos || []).length} lançamentos (hoje você tem ${lancamentos.length}), ${(pendente.dados.contas || []).length} conta(s), ${(pendente.dados.cartoes || []).length} cartão(ões), ${(pendente.dados.recorrentes || []).length} recorrente(s). Se for o caso, exporte um backup antes.`}
          onCancelar={() => setPendente(null)}
          onConfirmar={() => { restaurarBackup(pendente.dados); setPendente(null); mostrarToast("Backup importado com sucesso"); }}
          rotuloConfirmar="Importar e substituir"
        />
      )}
    </div>
  );
}
