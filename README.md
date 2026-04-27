# FATFIT - Aplicativo de Desafios Fitness

Aplicativo web progressivo para grupos de desafios fitness com registro diário de atividades, sistema de pontuação e premiação.

## 📱 Funcionalidades

- ✅ Autenticação completa (login, cadastro, recuperação de senha)
- ✅ Criação e gerenciamento de grupos com código de convite único
- ✅ Busca pública de grupos por nome
- ✅ Criação de desafios com valor por pessoa (apenas admin)
- ✅ Confirmação de participação antes do início do desafio
- ✅ Registro diário de atividades com foto obrigatória da câmera
- ✅ Geolocalização opcional
- ✅ Sistema de pontuação (1 ponto por dia)
- ✅ Ranking em tempo real
- ✅ Sistema de denúncias e moderação pelo admin
- ✅ Cálculo automático de premiação
- ✅ Declaração de vencedores em caso de empate
- ✅ Histórico completo de vitórias
- ✅ Perfil editável com foto de avatar
- ✅ Troca de senha
- ✅ Interface responsiva mobile-first

## 🚀 Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Supabase (Auth, Database, Storage)
- **Hospedagem:** GitHub Pages

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com) (gratuita)
- Conta no [GitHub](https://github.com) (para deploy)
- Navegador moderno com suporte a câmera e geolocalização

## 🔧 Passo a Passo para Configuração

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **"New Project"**
3. Preencha:
   - **Name:** `fatfit`
   - **Database Password:** crie uma senha forte (guarde-a)
   - **Region:** escolha a mais próxima (ex: South America - São Paulo)
4. Clique em **"Create new project"**
5. Aguarde 1-2 minutos até o projeto ser criado

### 2. Executar o Script SQL

1. No painel do Supabase, vá em **SQL Editor** no menu lateral
2. Clique em **"New query"**
3. Execute as partes do SQL na seguinte ordem:

**Parte 1 - Extensões e Profiles:**
```sql
-- Copie e cole aqui o conteúdo da PARTE 1 do SQL