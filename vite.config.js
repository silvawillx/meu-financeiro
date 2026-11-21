import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Se o nome do seu repositório no GitHub for diferente de "meu-financeiro",
  // troque aqui também (precisa bater com o nome exato do repositório).
  // Na Vercel (que define VERCEL=1 no build) o site fica na raiz "/".
  // No GitHub Pages continua em "/meu-financeiro/".
  base: process.env.VERCEL ? "/" : "/meu-financeiro/",
  server: {
    port: 5173,
  },
});
