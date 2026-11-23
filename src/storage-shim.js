// Faz o window.storage (a API que o App.jsx usa) gravar no Supabase.
// A lógica fica em lib/armazenamento.js (testada); aqui só ligamos ao banco e ao navegador.
import { supabase } from "./supabase.js";
import { criarArmazenamento } from "./lib/armazenamento.js";

const armazenamento = criarArmazenamento(supabase, {
  emitir: (nome, detalhe) => window.dispatchEvent(new CustomEvent(nome, { detail: detalhe })),
});

window.storage = armazenamento;

export const { carregarTudo, limpar, haNovidades } = armazenamento;
