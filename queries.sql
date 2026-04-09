-- ============================================================
-- 1. CADASTRO INICIAL (TESTES DE CRUD)
-- ============================================================

INSERT INTO pessoas (pk_cpf, primeiro_nome, sobrenome, email, telefone, dt_nasc, sexo, cor)
VALUES ('12345678900', 'Caio', 'Silva', 'caio@email.com', '11999999999', '2000-01-01', 'Masculino', 'Parda');

-- Cadastrando Conta Nubank (pk_banco = 6)
INSERT INTO conta (pk_banco, pk_agencia, pk_conta, fk_cpf, nome_conta, saldo, tipo_conta)
VALUES (6, 1, 123456, '12345678900', 'Conta Principal Nubank', 2000.00, 'Corrente');

-- Cadastrando Conta Itaú (pk_banco = 2)
INSERT INTO conta (pk_banco, pk_agencia, pk_conta, fk_cpf, nome_conta, saldo, tipo_conta)
VALUES (2, 3300, 987654, '12345678900', 'Conta Reserva Itaú', 500.00, 'Poupança');

-- Cadastrando Cartão de Crédito Nubank
INSERT INTO cartao_credito (fk_cpf, fk_banco, numero_cartao, limite, dia_fechamento, dia_vencimento)
VALUES ('12345678900', 6, '5555444433332222', 4500.00, 15, 25);

-- Criando a Meta Financeira
INSERT INTO metas (fk_cpf, nome_meta, valor_objetivo, valor_atual, data_objetivo)
VALUES ('12345678900', 'iPhone 16 Pro', 7500.00, 1500.00, '2026-08-15');


-- ============================================================
-- 2. OPERAÇÕES DO DIA A DIA E TESTE DAS TRIGGERS
-- ============================================================

-- A. Recebimento de Salário (ID Categoria 7 é Salário baseada nos inserts acima)
-- A Trigger `trg_atualiza_saldo_ins` somará 3500 ao saldo do Nubank
INSERT INTO transacoes (fk_cpf, fk_categoria, fk_conta_banco, fk_conta_agencia, fk_conta_numero, descricao, tipo_pagto, valor)
VALUES ('12345678900', 7, 6, 1, 123456, 'Salário Mensal', 'PIX', 3500.00);

-- B. Compra no Crédito (Não afeta saldo direto da conta)
INSERT INTO transacoes (fk_cpf, fk_categoria, fk_cartao, descricao, tipo_pagto, valor, parcelas)
VALUES ('12345678900', 1, 1, 'Supermercado Atacadão', 'Crédito', 450.75, 1);

-- C. Pagamento de Conta de Luz debitado da conta (Categoria 3 = Moradia)
-- A Trigger subtrairá 180.50 do saldo do Nubank
INSERT INTO transacoes (fk_cpf, fk_categoria, fk_conta_banco, fk_conta_agencia, fk_conta_numero, descricao, tipo_pagto, valor)
VALUES ('12345678900', 3, 6, 1, 123456, 'Conta de Luz', 'Débito', 180.50);

-- D. Transferência de Nubank para Itaú
INSERT INTO transferencias (fk_cpf, banco_origem, agencia_origem, conta_origem, banco_destino, agencia_destino, conta_destino, valor, descricao)
VALUES ('12345678900', 6, 1, 123456, 2, 3300, 987654, 300.00, 'Guardando dinheiro reserva');

UPDATE conta SET saldo = saldo - 300.00 WHERE pk_banco = 6 AND pk_conta = 123456;
UPDATE conta SET saldo = saldo + 300.00 WHERE pk_banco = 2 AND pk_conta = 987654;

-- ============================================================
-- 3. TESTANDO SOFT DELETE NO SQLITE
-- ============================================================

-- Usuário apagou a compra no supermercado (id = 2)
UPDATE transacoes SET excluido = 1 WHERE id_transacao = 2;
-- A coluna `data_exclusao` será preenchida automaticamente pela trigger `trg_transacoes_soft_delete`


-- ============================================================
-- 4. RELATÓRIOS E CONSULTAS ANALÍTICAS (Adaptadas para funções SQLite)
-- ============================================================

-- Verificando saldo das contas do usuário
SELECT 
    b.nome_banco,
    c.nome_conta,
    c.tipo_conta,
    c.saldo
FROM conta c
JOIN bancos b ON c.pk_banco = b.pk_banco
WHERE c.fk_cpf = '12345678900' AND c.ativa = 1;

-- Resumo de Despesas do Mês Atual (Ignorando excluídas) usando o strftime() do SQLite
SELECT 
    cat.nome_categoria,
    cat.icone,
    SUM(t.valor) as total_gasto
FROM transacoes t
JOIN categoria cat ON t.fk_categoria = cat.id_categoria
WHERE t.fk_cpf = '12345678900' 
  AND t.excluido = 0
  AND cat.tipo = 'Despesa'
  AND strftime('%Y-%m', t.data_transacao) = strftime('%Y-%m', 'now')
GROUP BY cat.id_categoria
ORDER BY total_gasto DESC;

-- Acompanhamento de Metas Financeiras (Cálculo de datas e %. adaptados para SQLite)
SELECT 
    nome_meta,
    valor_objetivo,
    valor_atual,
    ROUND((valor_atual / valor_objetivo) * 100, 2) AS percentual_concluido,
    CAST(julianday(data_objetivo) - julianday('now') AS INTEGER) AS dias_restantes
FROM metas
WHERE fk_cpf = '12345678900' AND concluida = 0;