import { describe, it, expect } from "vitest";
import { criarArmazenamento } from "./armazenamento.js";

// Banco falso em memória que imita o que o app usa do Supabase (select / insert / update / delete com filtros).
function bancoFalso() {
  const linhas = new Map(); // chave -> { valor, atualizado_em }
  const cliente = {
    from() {
      const q = { op: "select", filtros: [], payload: null };
      const exec = () => {
        if (q.op === "select") return { data: [...linhas].map(([chave, l]) => ({ chave, ...l })), error: null };
        if (q.op === "insert") {
          if (linhas.has(q.payload.chave)) return { data: null, error: { code: "23505", message: "duplicate key" } };
          linhas.set(q.payload.chave, { valor: q.payload.valor, atualizado_em: q.payload.atualizado_em });
          return { data: [{ atualizado_em: q.payload.atualizado_em }], error: null };
        }
        if (q.op === "update") {
          const chave = q.filtros.find(([k]) => k === "chave")?.[1];
          const versao = q.filtros.find(([k]) => k === "atualizado_em")?.[1];
          const l = linhas.get(chave);
          if (!l || (versao !== undefined && l.atualizado_em !== versao)) return { data: [], error: null };
          linhas.set(chave, { valor: q.payload.valor, atualizado_em: q.payload.atualizado_em });
          return { data: [{ atualizado_em: q.payload.atualizado_em }], error: null };
        }
        if (q.op === "delete") { linhas.delete(q.filtros.find(([k]) => k === "chave")?.[1]); return { data: [], error: null }; }
      };
      const api = {
        select() { return api; },
        insert(p) { q.op = "insert"; q.payload = p; return api; },
        update(p) { q.op = "update"; q.payload = p; return api; },
        delete() { q.op = "delete"; return api; },
        eq(k, v) { q.filtros.push([k, v]); return api; },
        then(ok, err) { return Promise.resolve().then(exec).then(ok, err); },
      };
      // select() no começo é só leitura; depois de insert/update ele só pede o retorno
      api.select = () => api;
      return api;
    },
  };
  return { cliente, linhas };
}

let relogio = 0;
const agora = () => new Date(Date.UTC(2026, 10, 22, 12, 0, 0, ++relogio)).toISOString();
const aparelho = (banco) => {
  const eventos = [];
  const arm = criarArmazenamento(banco.cliente, { agora, emitir: (nome, d) => eventos.push([nome, d]) });
  return { arm, eventos };
};

describe("armazenamento entre aparelhos", () => {
  it("grava e lê o que gravou", async () => {
    const b = bancoFalso(); const { arm } = aparelho(b);
    await arm.carregarTudo();
    await arm.set("lancamentos", "[1]");
    expect((await arm.get("lancamentos")).value).toBe("[1]");
    expect(b.linhas.get("lancamentos").valor).toBe("[1]");
  });

  it("gravações seguidas do mesmo aparelho NÃO dão conflito (mesmo sem esperar uma pela outra)", async () => {
    const b = bancoFalso(); const { arm, eventos } = aparelho(b);
    await arm.carregarTudo();
    const rs = await Promise.all([arm.set("lancamentos", "a"), arm.set("lancamentos", "b"), arm.set("lancamentos", "c")]);
    expect(rs.every(Boolean)).toBe(true);
    expect(b.linhas.get("lancamentos").valor).toBe("c");
    expect(eventos).toEqual([]);
  });

  it("aparelho desatualizado NÃO apaga o que o outro salvou (e avisa)", async () => {
    const b = bancoFalso();
    const celular = aparelho(b), pc = aparelho(b);
    await celular.arm.set("lancamentos", "v0"); // já existia
    await celular.arm.carregarTudo(); await pc.arm.carregarTudo();

    await celular.arm.set("lancamentos", "v1-celular");
    const r = await pc.arm.set("lancamentos", "v1-pc"); // pc ainda tem a versão antiga na memória

    expect(r).toBeNull();
    expect(b.linhas.get("lancamentos").valor).toBe("v1-celular"); // nada foi sobrescrito
    expect(pc.eventos).toEqual([["storage-conflito", "lancamentos"]]);
  });

  it("depois de um conflito não grava mais nada até recarregar; recarregar libera", async () => {
    const b = bancoFalso();
    const a = aparelho(b), c = aparelho(b);
    await a.arm.set("x", "0"); await a.arm.carregarTudo(); await c.arm.carregarTudo();
    await a.arm.set("x", "1");
    expect(await c.arm.set("x", "2")).toBeNull();
    expect(await c.arm.set("outra", "z")).toBeNull(); // bloqueado
    await c.arm.carregarTudo();
    expect((await c.arm.get("x")).value).toBe("1"); // vê o dado novo
    expect(await c.arm.set("x", "2")).not.toBeNull(); // e volta a gravar
  });

  it("aparelhos mexendo em dados diferentes não se atrapalham", async () => {
    const b = bancoFalso();
    const a = aparelho(b), c = aparelho(b);
    await a.arm.set("lancamentos", "0"); await a.arm.set("metas", "0");
    await a.arm.carregarTudo(); await c.arm.carregarTudo();
    expect(await a.arm.set("lancamentos", "1")).not.toBeNull();
    expect(await c.arm.set("metas", "1")).not.toBeNull();
  });

  it("duas criações da mesma chave nova: a segunda é recusada", async () => {
    const b = bancoFalso();
    const a = aparelho(b), c = aparelho(b);
    await a.arm.carregarTudo(); await c.arm.carregarTudo();
    expect(await a.arm.set("investimentos", "[1]")).not.toBeNull();
    expect(await c.arm.set("investimentos", "[2]")).toBeNull();
    expect(c.eventos[0][0]).toBe("storage-conflito");
  });

  it("haNovidades detecta dado novo de outro aparelho e some depois de recarregar", async () => {
    const b = bancoFalso();
    const a = aparelho(b), c = aparelho(b);
    await a.arm.set("lancamentos", "0");
    await a.arm.carregarTudo(); await c.arm.carregarTudo();
    expect(await c.arm.haNovidades()).toBe(false);
    await a.arm.set("lancamentos", "1");
    expect(await c.arm.haNovidades()).toBe(true);
    await c.arm.carregarTudo();
    expect(await c.arm.haNovidades()).toBe(false);
  });

  it("as próprias gravações não aparecem como novidade", async () => {
    const b = bancoFalso(); const { arm } = aparelho(b);
    await arm.carregarTudo();
    await arm.set("lancamentos", "1");
    expect(await arm.haNovidades()).toBe(false);
  });

  it("list filtra por prefixo e delete remove", async () => {
    const b = bancoFalso(); const { arm } = aparelho(b);
    await arm.carregarTudo();
    await arm.set("cat1", "a"); await arm.set("cat2", "b"); await arm.set("outro", "c");
    expect((await arm.list("cat")).keys.sort()).toEqual(["cat1", "cat2"]);
    await arm.delete("cat1");
    expect(await arm.get("cat1")).toBeNull();
  });
});
