# Meu Financeiro

App pessoal de controle financeiro. Funciona no navegador e pode ser instalado no celular (PWA).
Os dados ficam num banco na nuvem (Supabase) e só aparecem depois do login.

## O que ele faz

- **Lançamentos** por conta e por cartão (visão dobrável) ou em lista; recorrentes, parcelados, receitas por origem
- **Contas** (saldo só com o que já aconteceu + previsto até o fim do mês) e **Cartões** de crédito/débito, com limite real e botão *Pagar fatura*
- **Dashboard** com disponível para gastar, orçamento do mês e de onde veio o dinheiro
- **Projeção** dos próximos 6 meses, **Investimentos**, **Metas**, **Calendário**, **Estatísticas**
- **Importar** CSV/OFX, **backup** em JSON e assistente para **recomeçar do zero**

## Como rodar

Precisa do Node.js 18 ou mais novo.

```bash
npm install
npm run dev        # http://localhost:5173
```

Outros comandos:

```bash
npm test           # testes da lógica (Vitest)
npm run lint       # confere nomes e componentes indefinidos (ESLint)
npm run build      # gera a pasta dist/
```

## Como funciona por dentro

| Peça | Onde | O que faz |
|---|---|---|
| Estado e dados | `src/App.jsx` | Carrega e guarda os dados e entrega tudo às telas (contexto em `src/contexto.js`) |
| Telas | `src/telas/` | Uma por tela: Dashboard, Lançamentos, Contas, Cartões, Investimentos, Projeção, Metas, Backup... |
| Componentes | `src/componentes/`, `src/ui.jsx` | Formulário de lançamento, menu, visão por conta, botões e janelas comuns; tema em `src/tema.js` |
| Lógica | `src/lib/*.js` | Saldo, parcelas, recorrentes, fatura, projeção, importação... **tudo testado** (`*.test.js`) |
| Dados | `src/storage-shim.js` + `src/lib/armazenamento.js` | Grava na tabela `dados` do Supabase, com proteção contra dois aparelhos se sobrescrevendo |
| Login | `src/Auth.jsx` | E-mail e senha (Supabase Auth); o cadastro público fica desligado |
| PWA | `public/manifest.json`, `public/sw.js` | Instalar no celular e abrir sem internet (só leitura) |

O `App.jsx` conversa com o armazenamento por `window.storage` (`get`, `set`, `delete`, `list`), uma linha por tipo de dado
(`lancamentos`, `contas`, `cartoes`...). Cada usuário só enxerga as próprias linhas (RLS no Supabase).

### Banco (Supabase)

Uma tabela `public.dados(user_id, chave, valor, atualizado_em)` com RLS ligado e quatro políticas
(`auth.uid() = user_id`). A coluna `atualizado_em` é a *versão* da linha: uma gravação só vale se a linha ainda estiver
na versão que o aparelho carregou. Se outro aparelho salvou antes, o app avisa em vez de apagar o trabalho dele.

## Configuração

A URL e a chave **publicável** do Supabase ficam em `src/supabase.js` e podem ser trocadas por variáveis de ambiente:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_KEY=...
```

Nunca coloque a chave `service_role` no código. Quem protege os dados é o login + RLS, não o sigilo da chave publicável.

## Publicar (Vercel)

O projeto está ligado ao GitHub: cada push na `main` publica sozinho. A Vercel define `VERCEL=1` no build, e o
`vite.config.js` usa isso para servir o site na raiz (`/`). Fora da Vercel o caminho base continua `/meu-financeiro/`.

## Instalar no celular

- **iPhone (Safari):** abrir o site → Compartilhar → *Adicionar à Tela de Início*
- **Android (Chrome):** abrir o site → menu ⋮ → *Instalar app*

## Antes de mexer no código

```bash
npm test && npm run lint
```

Regras de negócio novas devem entrar em `src/lib/` com teste, não dentro de telas ou componentes.
Uma tela nova vira um arquivo em `src/telas/` e é registrada em `src/App.jsx` (mapa `paginas`) e no menu (`ITENS_MENU` em `src/componentes/Navegacao.jsx`).
