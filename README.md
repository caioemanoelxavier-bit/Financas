# 💰 Finanças Pessoais

Sistema de controle financeiro pessoal com autenticação de usuários.

## 📋 Pré-requisitos

- Node.js 18+
- npm

## 🚀 Instalação

```bash
# Entrar na pasta do projeto
cd SiteFinancas

# Instalar dependências
npm install

# Criar banco de dados
npm run setup

# Iniciar o servidor
npm start
```

Acesse: **http://localhost:3000**

## 👤 Sistema de Autenticação

### Registrar-se
1. Acesse http://localhost:3000
2. Clique em "Criar conta"
3. Preencha os dados:
   - Nome completo
   - Email
   - CPF (11 dígitos)
   - Data de nascimento (opcional)
   - Senha (mínimo 6 caracteres)
4. Clique em "Criar Conta"

### Login
1. Use o email e senha cadastrados
2. O token de sessão expira em 7 dias

## 📁 Estrutura do Projeto

```
SiteFinancas/
├── public/                 # Frontend
│   ├── index.html         # Página principal + Login
│   ├── styles.css         # Estilos modernos
│   └── app.js             # JavaScript com autenticação
├── schema.sql             # Schema do banco (SQLite)
├── queries.sql            # Dados de referência
├── server.js              # API Express + JWT
├── setup.js               # Script de setup
├── reset_db.js            # Reset do banco
└── package.json           # Dependências
```

## 🔌 API Endpoints

### Autenticação (Público)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Fazer login |
| POST | `/api/auth/logout` | Fazer logout |
| GET | `/api/auth/verify` | Verificar token |

### Dados Financeiros (Protegido - Requer Token)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/saldos` | Saldos das contas |
| GET | `/api/resumo` | Resumo financeiro |
| GET | `/api/transacoes` | Lista transações |
| POST | `/api/transacoes` | Nova transação |
| DELETE | `/api/transacoes/:id` | Excluir transação |
| GET | `/api/categorias` | Lista categorias |
| GET | `/api/contas` | Lista contas |
| POST | `/api/contas` | Criar conta |
| GET | `/api/metas` | Lista metas |
| POST | `/api/metas` | Criar meta |
| GET | `/api/bancos` | Lista bancos |
| GET | `/api/dashboard` | Dados do dashboard |

## 🔐 Autenticação

A API usa **JWT (JSON Web Token)** para autenticação. Inclua o token no header:

```
Authorization: Bearer <seu_token>
```

## 📊 Funcionalidades

- ✅ Sistema de login/registro com senha criptografada
- ✅ Dashboard com resumo financeiro
- ✅ Gestão de contas bancárias
- ✅ Registro de transações (receitas/despesas)
- ✅ Metas financeiras
- ✅ Gráfico de despesas por categoria
- ✅ Design responsivo (mobile-friendly)
- ✅ Sessões com expiração (7 dias)

## 🛠️ Comandos Úteis

```bash
npm start       # Iniciar servidor
npm run setup   # Criar/configurar banco
npm run reset   # Resetar banco completamente
```

## 📝 Licença

ISC