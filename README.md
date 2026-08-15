# Catálogo B2B — projeto pronto para publicar

Este é o mesmo sistema que construímos no chat (login, vitrine, carrinho,
painel ADM, Painel Central, etc.), agora reorganizado como um projeto real
que a Vercel sabe publicar, e conectado ao **Supabase** para os dados
ficarem salvos de verdade na nuvem.

## O que muda em relação à versão anterior

Só uma coisa: onde antes o app salvava dados na "gaveta" interna do Claude,
agora ele salva no Supabase. Todo o resto — telas, funcionalidades, visual —
é exatamente o que já testamos.

---

## Passo 1 — Criar o projeto no Supabase

1. Acesse **supabase.com** e crie uma conta gratuita (pode usar login do Google).
2. Clique em **New Project**. Escolha:
   - Um nome (ex: `catalogo-b2b`)
   - Uma senha forte para o banco (guarde-a em local seguro — raramente será usada diretamente)
   - Região: **South America (São Paulo)**
3. Aguarde 1-2 minutos até o projeto ficar pronto.

## Passo 2 — Criar a tabela do banco de dados

1. No menu lateral do Supabase, clique em **SQL Editor** → **New query**.
2. Abra o arquivo `supabase_schema.sql` (está junto com este projeto), copie
   todo o conteúdo, cole no editor e clique em **Run**.
3. Pronto — a tabela `app_data` foi criada. É nela que tudo fica salvo
   (produtos, logins, clientes, pedidos, banners, configurações).

## Passo 3 — Copiar as chaves do projeto

1. No menu lateral, vá em **Project Settings** (ícone de engrenagem) → **API**.
2. Copie dois valores:
   - **Project URL**
   - **anon public** (a chave pública)
3. Guarde os dois — vamos usar no Passo 5.

## Passo 4 — Subir o código para o GitHub

Sem precisar de linha de comando:

1. Crie uma conta gratuita em **github.com**, se ainda não tiver.
2. Clique em **New repository**, dê um nome (ex: `catalogo-b2b`) e deixe como
   **Private** (só você e quem convidar vê o código). Clique em **Create repository**.
3. Na página do repositório recém-criado, clique no link **uploading an
   existing file**.
4. Arraste **todos os arquivos e pastas deste projeto** (inclusive a pasta
   `src`) para a área de upload. Não envie a pasta `node_modules` (ela nem
   deve existir ainda) nem o arquivo `.env`, se você chegar a criar um local.
5. Clique em **Commit changes** no final da página.

## Passo 5 — Publicar na Vercel

1. Acesse **vercel.com** e crie a conta usando **login do GitHub** (mais simples).
2. Clique em **Add New... → Project**.
3. Selecione o repositório `catalogo-b2b` que você acabou de criar.
4. Antes de clicar em Deploy, abra **Environment Variables** e adicione:
   - `VITE_SUPABASE_URL` → cole a Project URL do Passo 3
   - `VITE_SUPABASE_ANON_KEY` → cole a chave anon public do Passo 3
5. Clique em **Deploy**. Em 1-2 minutos a Vercel te dá um link do tipo
   `catalogo-b2b.vercel.app`, já publicado com HTTPS automático.

## Passo 6 — Testar

Abra o link gerado, entre com `admincentral` / `central123` (ou `admin` /
`admin123`), cadastre um produto de teste, feche a aba, abra de novo e
confirme que o produto continua lá — isso confirma que os dados estão
salvando de verdade no Supabase, e não vão mais se perder.

**Troque as senhas padrão (`admincentral` e `admin`) assim que possível**,
pelo Painel Central / Painel ADM, antes de usar com dados reais.

## Passo 7 — Domínio próprio

Compre o domínio onde preferir (Registro.br para `.com.br`, GoDaddy,
Namecheap, etc.). Na Vercel, vá em **Settings → Domains** do seu projeto,
adicione o domínio comprado e siga as instruções de DNS mostradas na tela.
O certificado SSL é emitido automaticamente pela Vercel assim que o domínio
for reconhecido — não precisa fazer nada manualmente para isso.

---

## Sobre segurança (leia antes de operar com clientes reais)

Este projeto guarda logins e senhas como texto simples no banco, e as regras
do Supabase (arquivo `supabase_schema.sql`) estão propositalmente abertas
para facilitar os primeiros testes — qualquer pessoa com a chave pública do
seu projeto consegue ler e escrever nessa tabela. Isso é comum em protótipos,
mas **antes de colocar dados reais de clientes**, o ideal é evoluir para:

- Autenticação de verdade via **Supabase Auth** (com senhas criptografadas)
- Políticas de acesso (Row Level Security) restritas por usuário
- Mover as fotos (hoje guardadas como texto longo/base64) para o
  **Supabase Storage**, o que deixa o banco mais leve e rápido

Posso te ajudar com qualquer um desses passos quando você estiver pronto —
é só pedir.

## Rodando localmente (opcional, para quem tiver Node.js instalado)

```bash
npm install
cp .env.example .env   # depois edite o .env com suas chaves do Supabase
npm run dev
```
