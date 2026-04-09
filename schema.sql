-- ============================================================
--  Banco de dados: financas (SQLite)
--  Sistema de Controle Financeiro Pessoal com Autenticação
-- ============================================================

-- Tabela de usuários (autenticação)
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario    INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    senha_hash    TEXT NOT NULL,
    nome          TEXT NOT NULL,
    criado_em     TEXT DEFAULT (datetime('now')),
    ultimo_acesso TEXT
);

-- Tabela de pessoas/dados pessoais
CREATE TABLE IF NOT EXISTS pessoas (
    pk_cpf         TEXT PRIMARY KEY,
    fk_usuario     INTEGER NOT NULL,
    primeiro_nome  TEXT NOT NULL,
    sobrenome      TEXT NOT NULL,
    email          TEXT,
    telefone       TEXT,
    dt_nasc        TEXT,
    sexo           TEXT DEFAULT 'Outro',
    cor            TEXT DEFAULT 'Parda',
    ativo          INTEGER DEFAULT 1,
    criado_em      TEXT DEFAULT (datetime('now')),
    atualizado_em  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (fk_usuario) REFERENCES usuarios(id_usuario)
);

-- Tabela de sessões (controle de login)
CREATE TABLE IF NOT EXISTS sessoes (
    id_sessao     INTEGER PRIMARY KEY AUTOINCREMENT,
    fk_usuario    INTEGER NOT NULL,
    token         TEXT UNIQUE NOT NULL,
    data_criacao  TEXT DEFAULT (datetime('now')),
    data_expiracao TEXT NOT NULL,
    ativa         INTEGER DEFAULT 1,
    FOREIGN KEY (fk_usuario) REFERENCES usuarios(id_usuario)
);

-- Tabela de bancos
CREATE TABLE IF NOT EXISTS bancos (
    pk_banco   INTEGER PRIMARY KEY,
    nome_banco TEXT NOT NULL,
    codigo     TEXT UNIQUE NOT NULL
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categoria (
    id_categoria   INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_categoria TEXT NOT NULL,
    tipo           TEXT NOT NULL CHECK (tipo IN ('Despesa', 'Receita', 'Transferencia')),
    icone          TEXT DEFAULT '📌',
    cor            TEXT DEFAULT '#808080',
    ativa          INTEGER DEFAULT 1
);

-- Tabela de contas bancárias
CREATE TABLE IF NOT EXISTS conta (
    pk_banco    INTEGER NOT NULL,
    pk_agencia  INTEGER NOT NULL,
    pk_conta    INTEGER NOT NULL,
    fk_cpf      TEXT NOT NULL,
    nome_conta  TEXT DEFAULT 'Conta Principal',
    saldo       REAL DEFAULT 0.00,
    tipo_conta  TEXT DEFAULT 'Corrente' CHECK (tipo_conta IN ('Corrente', 'Poupanca', 'Investimento')),
    ativa       INTEGER DEFAULT 1,
    criada_em   TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (pk_banco, pk_agencia, pk_conta),
    FOREIGN KEY (fk_cpf) REFERENCES pessoas(pk_cpf),
    FOREIGN KEY (pk_banco) REFERENCES bancos(pk_banco)
);

-- Tabela de cartões de crédito
CREATE TABLE IF NOT EXISTS cartao_credito (
    id_cartao      INTEGER PRIMARY KEY AUTOINCREMENT,
    fk_cpf         TEXT NOT NULL,
    fk_banco       INTEGER NOT NULL,
    numero_cartao  TEXT NOT NULL,
    limite         REAL DEFAULT 0.00,
    dia_fechamento INTEGER DEFAULT 15,
    dia_vencimento INTEGER DEFAULT 25,
    ativo          INTEGER DEFAULT 1,
    FOREIGN KEY (fk_cpf) REFERENCES pessoas(pk_cpf),
    FOREIGN KEY (fk_banco) REFERENCES bancos(pk_banco)
);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS transacoes (
    id_transacao   INTEGER PRIMARY KEY AUTOINCREMENT,
    data_transacao TEXT DEFAULT (date('now')),
    fk_cpf         TEXT NOT NULL,
    fk_categoria   INTEGER NOT NULL,
    fk_banco       INTEGER,
    fk_agencia     INTEGER,
    fk_conta       INTEGER,
    fk_cartao      INTEGER,
    descricao      TEXT NOT NULL,
    tipo_pagto     TEXT NOT NULL CHECK (tipo_pagto IN ('Debito', 'Dinheiro', 'Credito', 'PIX', 'Transferencia')),
    valor          REAL NOT NULL CHECK (valor > 0),
    parcelas       INTEGER DEFAULT 1,
    parcela_atual  INTEGER DEFAULT 1,
    excluido       INTEGER DEFAULT 0,
    data_exclusao  TEXT,
    criado_em      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (fk_cpf) REFERENCES pessoas(pk_cpf),
    FOREIGN KEY (fk_categoria) REFERENCES categoria(id_categoria),
    FOREIGN KEY (fk_cartao) REFERENCES cartao_credito(id_cartao),
    FOREIGN KEY (fk_banco, fk_agencia, fk_conta) REFERENCES conta(pk_banco, pk_agencia, pk_conta)
);

-- Tabela de metas financeiras
CREATE TABLE IF NOT EXISTS metas (
    id_meta        INTEGER PRIMARY KEY AUTOINCREMENT,
    fk_cpf         TEXT NOT NULL,
    nome_meta      TEXT NOT NULL,
    valor_objetivo REAL NOT NULL CHECK (valor_objetivo > 0),
    valor_atual    REAL DEFAULT 0.00,
    data_inicio    TEXT DEFAULT (date('now')),
    data_objetivo  TEXT NOT NULL,
    concluida      INTEGER DEFAULT 0,
    FOREIGN KEY (fk_cpf) REFERENCES pessoas(pk_cpf)
);

-- Tabela de log de auditoria
CREATE TABLE IF NOT EXISTS log_auditoria (
    id_log          INTEGER PRIMARY KEY AUTOINCREMENT,
    tabela_afetada  TEXT NOT NULL,
    operacao        TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
    registro_id     INTEGER NOT NULL,
    fk_usuario      INTEGER,
    dados_anteriores TEXT,
    dados_novos     TEXT,
    data_operacao   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (fk_usuario) REFERENCES usuarios(id_usuario)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes(data_transacao);
CREATE INDEX IF NOT EXISTS idx_transacoes_pessoa ON transacoes(fk_cpf);
CREATE INDEX IF NOT EXISTS idx_transacoes_categoria ON transacoes(fk_categoria);
CREATE INDEX IF NOT EXISTS idx_conta_pessoa ON conta(fk_cpf);
CREATE INDEX IF NOT EXISTS idx_conta_banco ON conta(pk_banco);
CREATE INDEX IF NOT EXISTS idx_pessoas_usuario ON pessoas(fk_usuario);
CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(fk_usuario);