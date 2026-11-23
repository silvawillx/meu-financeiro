import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, Star, Plus, Paperclip, AlertTriangle } from "lucide-react";
import { useApp } from "../contexto.js";
import { VERDE, VERMELHO } from "../tema.js";
import { Botao, Campo, estiloInput, Modal } from "../ui.jsx";
import { todasCategorias, rotuloStatus } from "../lib/categorias.js";
import { hojeISO, mesLabel, addMeses } from "../lib/datas.js";
import { ORIGENS_RECEITA, origemDe } from "../lib/lancamentos.js";
import { formatarMoeda } from "../lib/formato.js";

export function FormularioLancamento({ inicial, onSalvar, onFechar, modoDuplicar = false, onSujoChange }) {
  const { pal, contas, cartoes, adicionarFavorito, categoriasDespesa, categoriasReceita, lancamentos, viagens } = useApp();
  const vazio = {
    tipo: "despesa", data: hojeISO(), categoria: categoriasDespesa[0].nome, descricao: "", pessoa: "",
    status: "-", contaId: (contas.find((c) => c.padrao) || contas[0])?.id || "", cartaoId: "", valor: "", observacoes: "", anexo: null,
    escopo: "pessoal", emprestimo: false, viagemId: "", parcelado: false, valorTotalParcelamento: "", qtdParcelas: "", parcelaAtual: "1",
    origem: "salario",
    recorrente: false, recorrenteFim: "",
  };
  const base0 = inicial ? { ...inicial, origem: inicial.origem || (inicial.tipo === "receita" ? (origemDe(inicial) === "ajuste" ? "outras" : origemDe(inicial)) : "salario") } : vazio;
  const [f, setF] = useState(base0);
  const [sugestaoAplicada, setSugestaoAplicada] = useState("");
  const [duplicataConfirmada, setDuplicataConfirmada] = useState(false);
  const [simuladorAberto, setSimuladorAberto] = useState(false);

  useEffect(() => {
    if (!onSujoChange) return;
    const base = base0;
    const sujo = Object.keys(vazio).some((k) => k !== "parcelado" && String(f[k] ?? "") !== String(base[k] ?? ""));
    onSujoChange(sujo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  // Autocomplete: ao sair do campo descrição, procura o lançamento mais recente
  // com a mesma descrição e sugere categoria/conta/pessoa — só em lançamentos novos.
  const aoSairDescricao = () => {
    if (inicial && !modoDuplicar) return;
    const alvo = f.descricao.trim().toLowerCase();
    if (!alvo) return;
    const correspondente = [...lancamentos]
      .filter((l) => l.tipo === f.tipo && l.descricao.trim().toLowerCase() === alvo)
      .sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    if (correspondente) {
      setF((old) => ({
        ...old,
        categoria: correspondente.categoria || old.categoria,
        pessoa: old.pessoa || correspondente.pessoa || old.pessoa,
        contaId: old.contaId || correspondente.contaId || old.contaId,
        cartaoId: old.cartaoId || correspondente.cartaoId || old.cartaoId,
      }));
      setSugestaoAplicada(correspondente.descricao);
    }
  };

  const aoEscolherAnexo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) { alert("Escolha uma imagem menor (até ~1.5MB) para não pesar o armazenamento."); return; }
    const reader = new FileReader();
    reader.onload = () => setF((old) => ({ ...old, anexo: reader.result }));
    reader.readAsDataURL(file);
  };

  const [erroForm, setErroForm] = useState("");
  const [avisoDuplicata, setAvisoDuplicata] = useState(false);

  const possivelDuplicata = () => {
    if (inicial && !modoDuplicar) return null;
    if (f.parcelado) return null;
    const valorNum = parseFloat(String(f.valor).replace(",", "."));
    if (!valorNum) return null;
    return lancamentos.find(
      (l) => l.data === f.data && l.tipo === f.tipo && Math.abs(l.valor - valorNum) < 0.01 &&
        l.descricao.trim().toLowerCase() === f.descricao.trim().toLowerCase()
    );
  };

  const submeter = (e) => {
    e.preventDefault();
    setErroForm("");
    if (!f.descricao.trim()) { setErroForm("Preencha a descrição."); return; }
    if (!f.data) { setErroForm("Escolha uma data."); return; }
    if (f.parcelado) {
      const total = parseFloat(String(f.valorTotalParcelamento).replace(",", "."));
      const qtd = parseInt(f.qtdParcelas, 10);
      const atual = parseInt(f.parcelaAtual || "1", 10);
      if (!total || total <= 0) { setErroForm("Preencha o valor total do parcelamento."); return; }
      if (!qtd || qtd <= 0) { setErroForm("Preencha a quantidade de parcelas."); return; }
      if (atual > qtd) { setErroForm("A parcela atual não pode ser maior que a quantidade total."); return; }
      onSalvar(f, null);
      return;
    }
    const valorNum = parseFloat(String(f.valor).replace(",", "."));
    if (!valorNum || valorNum <= 0) { setErroForm("Preencha um valor válido."); return; }
    if (!duplicataConfirmada && possivelDuplicata()) { setAvisoDuplicata(true); return; }
    onSalvar(f, valorNum);
  };

  const salvarMesmoAssim = () => {
    setDuplicataConfirmada(true);
    setAvisoDuplicata(false);
    const valorNum = parseFloat(String(f.valor).replace(",", "."));
    onSalvar(f, valorNum);
  };

  const categorias = todasCategorias(f.tipo, categoriasDespesa, categoriasReceita);
  const podeParcelar = f.tipo === "despesa" && (!inicial || modoDuplicar);
  const podeRepetir = !inicial || modoDuplicar;

  return (
    <form onSubmit={submeter} className="form-lancamento">
      <div className="span-2" style={{ display: "flex", gap: 8 }}>
        {["despesa", "receita"].map((t) => (
          <button key={t} type="button" onClick={() => setF({ ...f, tipo: t, categoria: todasCategorias(t, categoriasDespesa, categoriasReceita)[0].nome })}
            style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${f.tipo === t ? "transparent" : pal.borda}`, background: f.tipo === t ? (t === "despesa" ? VERMELHO : VERDE) : "transparent", color: f.tipo === t ? "#fff" : pal.texto, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {t === "despesa" ? "Despesa" : "Receita"}
          </button>
        ))}
      </div>
      <div className="span-2" style={{ display: "flex", gap: 8 }}>
        {["pessoal", "negocio"].map((esc) => (
          <button key={esc} type="button" onClick={() => setF({ ...f, escopo: esc })}
            style={{ flex: 1, padding: "6px", borderRadius: 8, border: `1px solid ${f.escopo === esc ? "transparent" : pal.borda}`, background: f.escopo === esc ? pal.texto : "transparent", color: f.escopo === esc ? pal.fundo : pal.textoSuave, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            {esc === "pessoal" ? "Pessoal" : "Negócio"}
          </button>
        ))}
      </div>
      <Campo label="Data"><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} style={estiloInput(pal)} /></Campo>
      <Campo label="Categoria">
        <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} style={estiloInput(pal)}>
          {categorias.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
        </select>
      </Campo>
      {f.tipo === "receita" && (
        <Campo label="Origem da receita">
          <select value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })} style={estiloInput(pal)}>
            {ORIGENS_RECEITA.map((o) => <option key={o.id} value={o.id}>{o.nome}{o.trabalho ? " (trabalho)" : ""}</option>)}
          </select>
        </Campo>
      )}
      <Campo label="Descrição">
        <input type="text" placeholder="Ex.: Mercado, Uber, aluguel..." value={f.descricao} onChange={(e) => { setF({ ...f, descricao: e.target.value }); setSugestaoAplicada(""); }} onBlur={aoSairDescricao} style={estiloInput(pal)} />
        {sugestaoAplicada && <div style={{ fontSize: 11, color: "#2F5D8A", marginTop: 3 }}>🔎 Categoria/conta preenchidas com base no último "{sugestaoAplicada}"</div>}
      </Campo>
      <Campo label="Pessoa / Para quem">
        <input type="text" placeholder="Opcional" value={f.pessoa} onChange={(e) => setF({ ...f, pessoa: e.target.value })} style={estiloInput(pal)} />
      </Campo>
      {f.tipo === "despesa" && f.pessoa.trim() && (
        <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: pal.texto, marginTop: -4 }}>
          <input type="checkbox" checked={!!f.emprestimo} onChange={(e) => setF({ ...f, emprestimo: e.target.checked })} />
          Isso foi um adiantamento — {f.pessoa.trim() || "essa pessoa"} vai te devolver
        </div>
      )}
      {viagens.length > 0 && f.tipo === "despesa" && (
        <Campo label="Viagem (opcional)">
          <select value={f.viagemId || ""} onChange={(e) => setF({ ...f, viagemId: e.target.value })} style={estiloInput(pal)}>
            <option value="">Nenhuma</option>
            {viagens.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </Campo>
      )}
      <Campo label="Pagou com">
        <select value={f.cartaoId ? `cartao:${f.cartaoId}` : `conta:${f.contaId}`} onChange={(e) => {
          const [tipo, id] = e.target.value.split(":");
          if (tipo === "conta") { setF({ ...f, contaId: id, cartaoId: "" }); return; }
          const cartao = cartoes.find((c) => c.id === id);
          // compra no crédito fica "A pagar" até a fatura ser paga
          setF({ ...f, cartaoId: id, contaId: cartao?.contaId || f.contaId, status: cartao?.tipo !== "debito" && f.status === "-" ? "A pagar" : f.status });
        }} style={estiloInput(pal)}>
          <optgroup label="Conta / Pix / dinheiro">
            <option value="conta:">Sem conta</option>
            {contas.filter((c) => !c.arquivada || c.id === f.contaId).map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}
          </optgroup>
          {cartoes.some((c) => c.tipo !== "debito") && (
            <optgroup label="Cartão de crédito">
              {cartoes.filter((c) => c.tipo !== "debito").map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)}
            </optgroup>
          )}
          {cartoes.some((c) => c.tipo === "debito") && (
            <optgroup label="Cartão de débito">
              {cartoes.filter((c) => c.tipo === "debito").map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)}
            </optgroup>
          )}
        </select>
      </Campo>
      <Campo label="Status">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={estiloInput(pal)}>
          <option value="-">—</option>
          <option value="Pago">{rotuloStatus("Pago", f.tipo)}</option>
          <option value="A pagar">{rotuloStatus("A pagar", f.tipo)}</option>
        </select>
      </Campo>
      {!f.parcelado && (
        <Campo label="Valor (R$)">
          <input type="text" inputMode="decimal" placeholder="0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} className="num-tab" style={estiloInput(pal)} />
        </Campo>
      )}

      {(podeParcelar || podeRepetir) && (
        <div className="span-2">
          <div style={{ fontSize: 12, color: pal.textoSuave, marginBottom: 6 }}>Como se repete?</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["unica", "Única"], ["parcelada", "Parcelada", !podeParcelar], ["mensal", "Todo mês"]].filter((o) => !o[2]).map(([v, rotulo]) => {
              const atual = f.parcelado ? "parcelada" : f.recorrente ? "mensal" : "unica";
              return (
                <button key={v} type="button" onClick={() => setF({ ...f, parcelado: v === "parcelada", recorrente: v === "mensal" })}
                  style={{ flex: 1, padding: "7px", borderRadius: 8, border: `1px solid ${atual === v ? "transparent" : pal.borda}`, background: atual === v ? pal.texto : "transparent", color: atual === v ? pal.fundo : pal.textoSuave, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>{rotulo}</button>
              );
            })}
          </div>
        </div>
      )}
      {f.recorrente && (
        <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: pal.textoSuave }}>
            Este lançamento será repetido todo dia {f.data ? parseInt(f.data.slice(8, 10), 10) : "—"} dos meses seguintes, automaticamente. Pode pausar ou encerrar depois em "Recorrentes".
          </div>
          <Campo label="Termina em (opcional)"><input type="month" value={f.recorrenteFim} min={f.data ? f.data.slice(0, 7) : undefined} onChange={(e) => setF({ ...f, recorrenteFim: e.target.value })} style={estiloInput(pal)} /></Campo>
        </div>
      )}
      {f.parcelado && (
        <>
          <Campo label="Valor total (R$)"><input type="text" inputMode="decimal" className="num-tab" value={f.valorTotalParcelamento} onChange={(e) => setF({ ...f, valorTotalParcelamento: e.target.value })} style={estiloInput(pal)} /></Campo>
          <Campo label="Qtd. de parcelas"><input type="number" min="1" value={f.qtdParcelas} onChange={(e) => setF({ ...f, qtdParcelas: e.target.value })} style={estiloInput(pal)} /></Campo>
          <Campo label="Parcela atual"><input type="number" min="1" value={f.parcelaAtual} onChange={(e) => setF({ ...f, parcelaAtual: e.target.value })} style={estiloInput(pal)} /></Campo>
          {f.valorTotalParcelamento && f.qtdParcelas && (
            <div className="span-2">
              <Botao variante="secundario" type="button" onClick={() => setSimuladorAberto(true)} style={{ padding: "7px 12px" }}>
                <BarChart3 size={14} /> Simular impacto nos próximos meses
              </Botao>
            </div>
          )}
        </>
      )}
      {inicial?.parcelaInfo && !modoDuplicar && (
        <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: pal.textoSuave, background: `${pal.borda}55`, padding: "8px 10px", borderRadius: 8 }}>
          <input type="checkbox" checked={!!f.aplicarGrupo} onChange={(e) => setF({ ...f, aplicarGrupo: e.target.checked })} />
          Aplicar categoria/descrição/conta a todas as parcelas futuras deste grupo ({inicial.parcelaInfo.atual}/{inicial.parcelaInfo.total})
        </div>
      )}

      <div className="span-2">
        <Campo label="Observações">
          <textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} style={{ ...estiloInput(pal), resize: "vertical", fontFamily: "inherit" }} />
        </Campo>
      </div>
      <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: pal.textoSuave, cursor: "pointer" }}>
          <Paperclip size={14} /> Anexar comprovante
          <input type="file" accept="image/*" onChange={aoEscolherAnexo} style={{ display: "none" }} />
        </label>
        {f.anexo && <img src={f.anexo} alt="comprovante" style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 6, cursor: "pointer" }} onClick={() => window.open(f.anexo, "_blank")} />}
      </div>

      {avisoDuplicata && (
        <div className="span-2" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#C98A3A", background: "#C98A3A1A", padding: "10px 12px", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} /> Já existe um lançamento parecido nessa data, com a mesma descrição e valor. Duplicado sem querer?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Botao variante="fantasma" onClick={() => setAvisoDuplicata(false)} style={{ padding: "6px 10px" }}>Revisar</Botao>
            <Botao variante="secundario" onClick={salvarMesmoAssim} style={{ padding: "6px 10px" }}>Salvar mesmo assim</Botao>
          </div>
        </div>
      )}

      {erroForm && (
        <div className="span-2" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: VERMELHO, background: "#B4552F1A", padding: "8px 10px", borderRadius: 8 }}>
          <AlertTriangle size={14} /> {erroForm}
        </div>
      )}

      <div className="span-2" style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
        <Botao variante="fantasma" onClick={() => { if (f.descricao) adicionarFavorito(f); }} title="Salvar como favorito">
          <Star size={14} /> Salvar como favorito
        </Botao>
        <div style={{ display: "flex", gap: 8 }}>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit"><Plus size={15} /> Salvar</Botao>
        </div>
      </div>

      {simuladorAberto && (
        <SimuladorParcelamento
          valorTotal={parseFloat(String(f.valorTotalParcelamento).replace(",", "."))}
          qtdParcelas={parseInt(f.qtdParcelas, 10)}
          dataInicial={f.data}
          onFechar={() => setSimuladorAberto(false)}
        />
      )}
    </form>
  );
}


export function SimuladorParcelamento({ valorTotal, qtdParcelas, dataInicial, onFechar }) {
  const { lancamentos, pal } = useApp();
  if (!valorTotal || !qtdParcelas) return null;
  const valorParcela = valorTotal / qtdParcelas;

  const meses = useMemo(() => {
    const arr = [];
    for (let i = 0; i < qtdParcelas; i++) {
      const mesRef = addMeses(dataInicial, i).slice(0, 7);
      const jaComprometido = lancamentos.filter((l) => l.tipo === "despesa" && l.data.slice(0, 7) === mesRef).reduce((s, l) => s + l.valor, 0);
      arr.push({ mes: mesLabel(mesRef), jaComprometido, estaParcela: valorParcela });
    }
    return arr;
  }, [lancamentos, dataInicial, qtdParcelas, valorParcela]);

  return (
    <Modal titulo="Simulação de impacto" onFechar={onFechar} largura={480}>
      <div style={{ fontSize: 12.5, color: pal.textoSuave, marginBottom: 14 }}>
        Cada parcela de <strong className="num-tab" style={{ color: pal.texto }}>{formatarMoeda(valorParcela)}</strong> somada ao que você já tem comprometido em despesas naquele mês (incluindo outras parcelas e recorrentes já lançadas):
      </div>
      <ResponsiveContainer width="100%" height={Math.max(160, meses.length * 34)}>
        <BarChart data={meses} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="mes" width={60} tick={{ fontSize: 11, fill: pal.texto }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => formatarMoeda(v)} />
          <Bar dataKey="jaComprometido" stackId="a" fill={pal.borda} radius={[0, 0, 0, 0]} barSize={16} />
          <Bar dataKey="estaParcela" stackId="a" fill="#C98A3A" radius={[0, 6, 6, 0]} barSize={16} name="Essa parcela" />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: pal.textoSuave, marginTop: 8 }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: pal.borda, marginRight: 4 }} />Já comprometido</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#C98A3A", marginRight: 4 }} />Essa parcela nova</span>
      </div>
    </Modal>
  );
}
