-- Execute este script inteiro no Supabase: painel do projeto > SQL Editor > New query > Run.
-- Ele cria UMA tabela (app_data) que guarda todos os dados do catálogo
-- (produtos, usuários/logins, clientes, pedidos, banners, configurações),
-- cada "gaveta" identificada por uma chave (key) e o conteúdo em JSON (value).
-- Isso espelha exatamente a forma como o app já organiza os dados, então
-- nenhuma outra mudança de estrutura é necessária.

create table if not exists app_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Ativa Row Level Security (recomendado pelo Supabase por padrão)
alter table app_data enable row level security;

-- ATENÇÃO — políticas de teste (permissivas):
-- Como o app ainda não usa login do Supabase (Auth), estas políticas liberam
-- leitura e escrita para qualquer pessoa que tenha a chave "anon" do projeto
-- (a mesma chave pública usada pelo próprio site). Isso é aceitável para os
-- primeiros testes, mas antes de operar com dados reais de clientes vale a
-- pena evoluir para Supabase Auth + políticas restritas por usuário.
create policy "app_data_select_publico_teste"
  on app_data for select
  using (true);

create policy "app_data_insert_publico_teste"
  on app_data for insert
  with check (true);

create policy "app_data_update_publico_teste"
  on app_data for update
  using (true);
