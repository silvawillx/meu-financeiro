# Meu Financeiro — rodando 100% local

Este é o mesmo sistema que você viu no chat, só que empacotado pra rodar
direto no seu computador, sem depender do Claude. Os dados ficam salvos
no armazenamento local do navegador (localStorage) — nada sai da sua máquina.

## 1. Pré-requisito: Node.js

Você precisa ter o Node.js instalado (versão 18 ou mais recente).
- Baixe em: https://nodejs.org (escolha a versão "LTS")
- Pra conferir se já tem: abra o terminal e rode `node -v`

## 2. Instalar as dependências

Abra o terminal **dentro desta pasta** (`meu-financeiro`) e rode:

```
npm install
```

Isso baixa o React, os gráficos (recharts) e os ícones (lucide-react).
Só precisa fazer isso uma vez.

## 3. Rodar o sistema

```
npm run dev
```

O terminal vai mostrar um endereço, algo como:

```
Local:   http://localhost:5173/
```

Abra esse endereço no navegador. Pronto, o sistema está rodando local.

## 4. Acessar de outros aparelhos na sua rede local (celular, notebook)

Se quiser abrir do celular ou outro computador na mesma rede Wi-Fi:

```
npm run dev -- --host
```

O terminal vai mostrar um segundo endereço tipo `http://192.168.0.X:5173/`.
Use esse endereço nos outros aparelhos (desde que estejam na mesma rede).

## 5. Onde ficam os dados

Tudo é salvo no localStorage do navegador que você usar para abrir o app.
Isso quer dizer:
- Sempre abra pelo **mesmo navegador** (ex.: sempre pelo Chrome) no **mesmo
  computador**, senão os dados não vão aparecer.
- Limpar o cache/dados de navegação do navegador apaga os lançamentos.
- Use a tela de **Backup** dentro do sistema pra exportar um arquivo `.json`
  de vez em quando — assim você tem uma cópia de segurança separada do
  navegador.

## 6. Instalar como app (PWA)

Depois de rodar `npm run build` e `npm run preview` (ou hospedar a pasta
`dist/` em algum lugar), o sistema pode ser **instalado como um app de
verdade** no celular ou computador — ícone na tela, abre em tela cheia,
sem barra de navegador:

- **Celular (Chrome/Android)**: abra o site, toque no menu (⋮) → "Instalar app" / "Adicionar à tela inicial"
- **iPhone (Safari)**: abra o site, toque em Compartilhar → "Adicionar à Tela de Início"
- **Computador (Chrome/Edge)**: um ícone de instalação aparece na barra de endereço

Importante: a instalação como PWA só funciona com `npm run build` +
`npm run preview` (ou outro servidor), **não** com `npm run dev`.

## 8. Sincronizar com Google Drive (opcional, avançado)

Isso permite salvar seus dados no Google Drive e restaurar de qualquer
computador ou celular. É opcional — o app funciona 100% sem isso.

Como é um app que roda só no seu navegador (sem servidor próprio), você
precisa criar uma credencial gratuita no Google Cloud pra ele poder pedir
sua permissão de acessar o Drive. É chato, mas só precisa fazer uma vez:

1. Acesse https://console.cloud.google.com/ (usando sua conta Google)
2. Crie um projeto novo (qualquer nome, ex.: "Meu Financeiro")
3. No menu, vá em **APIs e Serviços → Biblioteca**, procure por "Google Drive API" e clique em **Ativar**
4. Vá em **APIs e Serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**
   - Preencha nome do app e seu e-mail
   - Na aba "Usuários de teste", adicione o seu próprio e-mail do Google
5. Vá em **APIs e Serviços → Credenciais → Criar Credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**
   - Em "Origens JavaScript autorizadas", adicione: `http://localhost:5173`
   - Se um dia hospedar em outro endereço, adicione esse endereço também aqui
6. Copie o **Client ID** gerado (termina em `.apps.googleusercontent.com`)
7. No app, vá em **Backup** → cole o Client ID no campo "Client ID do Google (OAuth)" → clique em **Conectar ao Google Drive**

Depois de conectado, os botões "Salvar no Drive agora" e "Restaurar do
Drive" ficam disponíveis. O app só tem permissão de mexer no arquivo que
ele mesmo cria (`meu-financeiro-backup.json`) — não enxerga o resto do
seu Drive.

## 9. Deixar rodando sempre (opcional)

Se quiser gerar uma versão "de produção" (mais rápida, sem precisar do
terminal do `npm run dev` toda vez), rode:

```
npm run build
npm run preview
```

Isso cria uma pasta `dist/` com o site pronto, que dá pra hospedar em
qualquer servidor local ou até um Raspberry Pi na sua rede.

## 10. Publicar no GitHub Pages

O projeto já vem preparado pra isso (o `vite.config.js` já tem o
`base: "/meu-financeiro/"` configurado). Passo a passo:

1. Crie um repositório novo no GitHub chamado **exatamente** `meu-financeiro`
   (se usar outro nome, troque o `base` no `vite.config.js` pra bater com ele)
2. Suba o projeto pra esse repositório:
   ```
   git init
   git add .
   git commit -m "primeira versão"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/meu-financeiro.git
   git push -u origin main
   ```
3. Publique com um comando só:
   ```
   npm run deploy
   ```
   Isso builda o projeto e sobe automaticamente pra uma branch `gh-pages`
   (o pacote `gh-pages` já está incluído no projeto).
4. No GitHub, vá em **Settings → Pages** do repositório e confirme que a
   fonte está como branch `gh-pages`, pasta `/ (root)`.
5. Depois de 1-2 minutos, seu site estará em:
   `https://SEU-USUARIO.github.io/meu-financeiro/`

Pra publicar uma atualização depois, é só rodar `npm run deploy` de novo.

**Importante**: como o link fica público na internet, se você ainda não
tinha ativado a trava por PIN (Configurações → Segurança), esse é um bom
momento pra ativar.

## Estrutura do projeto

```
meu-financeiro/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx          -> ponto de entrada do React
    ├── App.jsx           -> todo o sistema financeiro (seu app)
    ├── storage-shim.js   -> faz os dados serem salvos no localStorage
    └── index.css
```
