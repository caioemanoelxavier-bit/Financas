/**
 * Finanças Pessoais API
 * Servidor Express + SQLite com Autenticação JWT
 * @version 2.1.0
 */

require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ==================== CONFIGURAÇÕES ====================
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'financas_pessoais_secret_key_2024';
const JWT_EXPIRES_IN = '7d';

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ==================== DATABASE ====================
const dbPath = process.env.DB_PATH || './financas.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco de dados SQLite');
});

// Promisify db methods
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
    });
});

// ==================== AUTENTICAÇÃO MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ erro: 'Token não fornecido', code: 'NO_TOKEN' });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ erro: 'Token mal formatado', code: 'INVALID_TOKEN' });
        }

        const token = parts[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const sessao = await dbGet(
            'SELECT * FROM sessoes WHERE token = ? AND ativa = 1 AND datetime(data_expiracao) > datetime("now")',
            [token]
        );

        if (!sessao) {
            return res.status(401).json({ erro: 'Sessão expirada', code: 'SESSION_EXPIRED' });
        }

        const usuario = await dbGet('SELECT * FROM usuarios WHERE id_usuario = ?', [decoded.id]);

        if (!usuario) {
            return res.status(401).json({ erro: 'Usuário não encontrado', code: 'USER_NOT_FOUND' });
        }

        req.usuario = { id: usuario.id_usuario, email: usuario.email, nome: usuario.nome };
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ erro: 'Token expirado', code: 'TOKEN_EXPIRED' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ erro: 'Token inválido', code: 'INVALID_TOKEN' });
        }
        console.error('Erro no middleware de auth:', error);
        return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
};

const getCpfUsuario = async (idUsuario) => {
    const pessoa = await dbGet('SELECT pk_cpf FROM pessoas WHERE fk_usuario = ? AND ativo = 1', [idUsuario]);
    return pessoa?.pk_cpf || null;
};

// ==================== ROTAS PÚBLICAS ====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== AUTENTICAÇÃO ====================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, cpf, data_nascimento } = req.body;

        if (!nome || !email || !senha || !cpf) {
            return res.status(400).json({ erro: 'Nome, email, senha e CPF são obrigatórios' });
        }

        if (senha.length < 6) {
            return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
        }

        const emailExiste = await dbGet('SELECT id_usuario FROM usuarios WHERE email = ?', [email]);
        if (emailExiste) {
            return res.status(400).json({ erro: 'Este email já está cadastrado' });
        }

        const cpfExiste = await dbGet('SELECT pk_cpf FROM pessoas WHERE pk_cpf = ?', [cpf]);
        if (cpfExiste) {
            return res.status(400).json({ erro: 'Este CPF já está cadastrado' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const usuarioResult = await dbRun(
            'INSERT INTO usuarios (email, senha_hash, nome) VALUES (?, ?, ?)',
            [email, senhaHash, nome]
        );

        await dbRun(
            'INSERT INTO pessoas (pk_cpf, fk_usuario, primeiro_nome, sobrenome, dt_nasc) VALUES (?, ?, ?, ?, ?)',
            [cpf, usuarioResult.id, nome.split(' ')[0], nome.split(' ').slice(1).join(' ') || '', data_nascimento || null]
        );

        res.status(201).json({
            message: 'Usuário cadastrado com sucesso',
            usuario: { id: usuarioResult.id, nome, email }
        });
    } catch (error) {
        console.error('Erro ao registrar:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }

        const usuario = await dbGet('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (!usuario) {
            return res.status(401).json({ erro: 'Email ou senha incorretos' });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Email ou senha incorretos' });
        }

        const token = jwt.sign(
            { id: usuario.id_usuario, email: usuario.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + 7);

        await dbRun(
            'INSERT INTO sessoes (fk_usuario, token, data_expiracao) VALUES (?, ?, ?)',
            [usuario.id_usuario, token, dataExpiracao.toISOString()]
        );

        await dbRun('UPDATE usuarios SET ultimo_acesso = datetime("now") WHERE id_usuario = ?', [usuario.id_usuario]);

        const pessoa = await dbGet('SELECT pk_cpf, primeiro_nome, sobrenome FROM pessoas WHERE fk_usuario = ?', [usuario.id_usuario]);

        res.json({
            token,
            usuario: { id: usuario.id_usuario, nome: usuario.nome, email: usuario.email },
            pessoa: pessoa ? { cpf: pessoa.pk_cpf, nomeCompleto: `${pessoa.primeiro_nome} ${pessoa.sobrenome}` } : null
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
    try {
        await dbRun('UPDATE sessoes SET ativa = 0 WHERE token = ?', [req.token]);
        res.json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

app.get('/api/auth/verify', authMiddleware, async (req, res) => {
    try {
        const pessoa = await dbGet('SELECT pk_cpf, primeiro_nome, sobrenome FROM pessoas WHERE fk_usuario = ?', [req.usuario.id]);
        res.json({
            valido: true,
            usuario: req.usuario,
            pessoa: pessoa ? { cpf: pessoa.pk_cpf, nomeCompleto: `${pessoa.primeiro_nome} ${pessoa.sobrenome}` } : null
        });
    } catch (error) {
        console.error('Erro ao verificar token:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ==================== USUÁRIO ====================

app.get('/api/usuario', authMiddleware, async (req, res) => {
    try {
        const usuario = await dbGet(`
            SELECT u.id_usuario, u.email, u.nome, u.criado_em,
                   p.pk_cpf, p.primeiro_nome, p.sobrenome, p.dt_nasc, p.sexo, p.cor
            FROM usuarios u
            LEFT JOIN pessoas p ON p.fk_usuario = u.id_usuario
            WHERE u.id_usuario = ?
        `, [req.usuario.id]);

        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        res.json({
            id: usuario.id_usuario,
            email: usuario.email,
            nome: usuario.nome,
            cpf: usuario.pk_cpf,
            primeiroNome: usuario.primeiro_nome,
            sobrenome: usuario.sobrenome,
            dataNascimento: usuario.dt_nasc,
            sexo: usuario.sexo,
            cor: usuario.cor,
            criadoEm: usuario.criado_em
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ==================== SALDOS E RESUMO ====================

app.get('/api/saldos', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const query = `
            SELECT b.pk_banco, b.nome_banco, b.codigo, c.nome_conta, c.tipo_conta, c.saldo, c.ativa
            FROM conta c
            JOIN bancos b ON c.pk_banco = b.pk_banco
            WHERE c.fk_cpf = ? AND c.ativa = 1
            ORDER BY c.saldo DESC
        `;

        const contas = await dbAll(query, [cpf]);
        res.json(contas);
    } catch (error) {
        console.error('Erro ao buscar saldos:', error);
        res.status(500).json({ erro: error.message });
    }
});

app.get('/api/resumo', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const saldos = await dbGet('SELECT COALESCE(SUM(saldo), 0) as total FROM conta WHERE fk_cpf = ? AND ativa = 1', [cpf]);

        const receitas = await dbGet(`
            SELECT COALESCE(SUM(t.valor), 0) as total
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            WHERE t.fk_cpf = ? AND c.tipo = 'Receita' AND t.excluido = 0
            AND strftime('%m', t.data_transacao) = strftime('%m', 'now')
        `, [cpf]);

        const despesas = await dbGet(`
            SELECT COALESCE(SUM(t.valor), 0) as total
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            WHERE t.fk_cpf = ? AND c.tipo = 'Despesa' AND t.excluido = 0
            AND strftime('%m', t.data_transacao) = strftime('%m', 'now')
        `, [cpf]);

        res.json({
            patrimonio_total: saldos.total || 0,
            receitas_mes: receitas.total || 0,
            despesas_mes: despesas.total || 0,
            saldo_mes: (receitas.total || 0) - (despesas.total || 0)
        });
    } catch (error) {
        console.error('Erro ao buscar resumo:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== TRANSAÇÕES ====================

app.get('/api/transacoes', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const limite = parseInt(req.query.limite) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const tipo = req.query.tipo;
        const categoria = req.query.categoria;
        const mes = req.query.mes;

        let whereClause = 'WHERE t.fk_cpf = ? AND t.excluido = 0';
        const params = [cpf];

        if (tipo) {
            whereClause += ' AND c.tipo = ?';
            params.push(tipo);
        }

        if (categoria) {
            whereClause += ' AND t.fk_categoria = ?';
            params.push(categoria);
        }

        if (mes) {
            whereClause += " AND strftime('%Y-%m', t.data_transacao) = ?";
            params.push(mes);
        }

        const query = `
            SELECT t.id_transacao, t.data_transacao, t.descricao, t.valor, t.tipo_pagto, t.parcelas,
                   c.nome_categoria, c.tipo as tipo_categoria, c.icone, c.cor, b.nome_banco
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            LEFT JOIN conta co ON t.fk_banco = co.pk_banco AND t.fk_agencia = co.pk_agencia AND t.fk_conta = co.pk_conta
            LEFT JOIN bancos b ON co.pk_banco = b.pk_banco
            ${whereClause}
            ORDER BY t.data_transacao DESC, t.id_transacao DESC
            LIMIT ? OFFSET ?
        `;

        params.push(limite, offset);
        const transacoes = await dbAll(query, params);
        res.json(transacoes);
    } catch (error) {
        console.error('Erro ao buscar transações:', error);
        res.status(500).json({ erro: error.message });
    }
});

app.post('/api/transacoes', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const { fk_categoria, fk_banco, fk_agencia, fk_conta, descricao, tipo_pagto, valor, parcelas, data_transacao } = req.body;

        if (!descricao || !valor || !fk_categoria || !tipo_pagto) {
            return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
        }

        const result = await dbRun(`
            INSERT INTO transacoes (fk_cpf, fk_categoria, fk_banco, fk_agencia, fk_conta, descricao, tipo_pagto, valor, parcelas, data_transacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [cpf, fk_categoria, fk_banco || null, fk_agencia || null, fk_conta || null, descricao, tipo_pagto, valor, parcelas || 1, data_transacao || null]);

        res.status(201).json({ id: result.id, message: 'Transação criada com sucesso' });
    } catch (error) {
        console.error('Erro ao criar transação:', error);
        res.status(500).json({ erro: error.message });
    }
});

app.delete('/api/transacoes/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun('UPDATE transacoes SET excluido = 1, data_exclusao = datetime("now") WHERE id_transacao = ?', [id]);
        res.json({ message: 'Transação excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir transação:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== DADOS SIMULADOS ====================

app.post('/api/gerar-dados-mock', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        // Buscar categorias
        const categoriasDespesa = await dbAll("SELECT id_categoria FROM categoria WHERE tipo = 'Despesa'");
        const categoriasReceita = await dbAll("SELECT id_categoria FROM categoria WHERE tipo = 'Receita'");

        // Buscar contas do usuário
        const contas = await dbAll('SELECT pk_banco, pk_agencia, pk_conta FROM conta WHERE fk_cpf = ? AND ativa = 1', [cpf]);

        if (contas.length === 0) {
            return res.status(400).json({ erro: 'Cadastre pelo menos uma conta antes de gerar dados' });
        }

        const descricoesDespesa = [
            'Supermercado Extra', 'Farmácia Drogasil', 'Posto Shell', 'Uber', '99 Pop',
            'Netflix', 'Spotify', 'Amazon Prime', 'iFood', 'Rappi',
            'Luz (CPFL)', 'Água', 'Internet Vivo', 'Telefone Claro', 'Aluguel',
            'Condomínio', 'Academia', 'Cinema', 'Restaurante', 'Bar',
            'Roupas Renner', 'C&A', 'Zara', 'Mercado Livre', 'Shopee',
            'Pet Shop', 'Veterinário', 'Manutenção Carro', 'Estacionamento', 'Pedágio'
        ];

        const descricoesReceita = [
            'Salário', 'Freelance', 'Venda Mercado Livre', 'Rendimento Poupança',
            'Bonus', 'Décimo Terceiro', 'Reembolso', 'Cashback', 'Dividendos',
            'Trabalho Extra', 'Consultoria', 'Aula Particular'
        ];

        const tiposPagto = ['Debito', 'Credito', 'PIX', 'Dinheiro'];

        // Gerar transações dos últimos 6 meses
        const transacoes = [];
        const hoje = new Date();

        for (let i = 0; i < 6; i++) {
            const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);

            // Receitas (2-4 por mês)
            const numReceitas = Math.floor(Math.random() * 3) + 2;
            for (let j = 0; j < numReceitas; j++) {
                const dia = Math.floor(Math.random() * 28) + 1;
                const conta = contas[Math.floor(Math.random() * contas.length)];
                const categoria = categoriasReceita[Math.floor(Math.random() * categoriasReceita.length)];
                transacoes.push({
                    data: `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
                    categoria: categoria.id_categoria,
                    banco: conta.pk_banco,
                    agencia: conta.pk_agencia,
                    conta: conta.pk_conta,
                    descricao: descricoesReceita[Math.floor(Math.random() * descricoesReceita.length)],
                    valor: Math.floor(Math.random() * 5000) + 2000 + Math.random() * 500,
                    tipo: 'PIX'
                });
            }

            // Despesas (15-30 por mês)
            const numDespesas = Math.floor(Math.random() * 16) + 15;
            for (let j = 0; j < numDespesas; j++) {
                const dia = Math.floor(Math.random() * 28) + 1;
                const conta = contas[Math.floor(Math.random() * contas.length)];
                const categoria = categoriasDespesa[Math.floor(Math.random() * categoriasDespesa.length)];
                transacoes.push({
                    data: `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
                    categoria: categoria.id_categoria,
                    banco: conta.pk_banco,
                    agencia: conta.pk_agencia,
                    conta: conta.pk_conta,
                    descricao: descricoesDespesa[Math.floor(Math.random() * descricoesDespesa.length)],
                    valor: Math.floor(Math.random() * 500) + 10 + Math.random() * 100,
                    tipo: tiposPagto[Math.floor(Math.random() * tiposPagto.length)]
                });
            }
        }

        // Inserir transações
        for (const t of transacoes) {
            await dbRun(`
                INSERT INTO transacoes (fk_cpf, fk_categoria, fk_banco, fk_agencia, fk_conta, descricao, tipo_pagto, valor, data_transacao)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [cpf, t.categoria, t.banco, t.agencia, t.conta, t.descricao, t.tipo, Math.round(t.valor * 100) / 100, t.data]);
        }

        res.json({ message: 'Dados gerados com sucesso', total: transacoes.length });
    } catch (error) {
        console.error('Erro ao gerar dados:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== CATEGORIAS ====================

app.get('/api/categorias', authMiddleware, async (req, res) => {
    try {
        const tipo = req.query.tipo;
        let query = 'SELECT * FROM categoria WHERE ativa = 1';
        const params = [];

        if (tipo) {
            query += ' AND tipo = ?';
            params.push(tipo);
        }

        query += ' ORDER BY tipo, nome_categoria';
        const categorias = await dbAll(query, params);
        res.json(categorias);
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== CONTAS ====================

app.get('/api/contas', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const contas = await dbAll(`
            SELECT c.pk_banco, c.pk_agencia, c.pk_conta, b.nome_banco, c.nome_conta, c.tipo_conta, c.saldo, c.ativa
            FROM conta c
            JOIN bancos b ON c.pk_banco = b.pk_banco
            WHERE c.fk_cpf = ?
            ORDER BY c.saldo DESC
        `, [cpf]);

        res.json(contas);
    } catch (error) {
        console.error('Erro ao buscar contas:', error);
        res.status(500).json({ erro: error.message });
    }
});

app.post('/api/contas', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const { pk_banco, pk_agencia, pk_conta, nome_conta, tipo_conta, saldo_inicial } = req.body;

        if (!pk_banco || !pk_agencia || !pk_conta) {
            return res.status(400).json({ erro: 'Banco, agência e conta são obrigatórios' });
        }

        await dbRun(`
            INSERT INTO conta (pk_banco, pk_agencia, pk_conta, fk_cpf, nome_conta, tipo_conta, saldo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [pk_banco, pk_agencia, pk_conta, cpf, nome_conta || 'Conta Principal', tipo_conta || 'Corrente', saldo_inicial || 0]);

        res.status(201).json({ message: 'Conta cadastrada com sucesso' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ erro: 'Esta conta já está cadastrada' });
        }
        console.error('Erro ao criar conta:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== METAS ====================

app.get('/api/metas', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const metas = await dbAll(`
            SELECT id_meta, nome_meta, valor_objetivo, valor_atual, data_inicio, data_objetivo, concluida,
                   ROUND((valor_atual * 100.0 / valor_objetivo), 2) as percentual
            FROM metas
            WHERE fk_cpf = ? AND concluida = 0
            ORDER BY data_objetivo ASC
        `, [cpf]);

        res.json(metas);
    } catch (error) {
        console.error('Erro ao buscar metas:', error);
        res.status(500).json({ erro: error.message });
    }
});

app.post('/api/metas', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const { nome_meta, valor_objetivo, data_objetivo } = req.body;

        if (!nome_meta || !valor_objetivo || !data_objetivo) {
            return res.status(400).json({ erro: 'Nome, valor e data objetivo são obrigatórios' });
        }

        const result = await dbRun(`
            INSERT INTO metas (fk_cpf, nome_meta, valor_objetivo, data_objetivo)
            VALUES (?, ?, ?, ?)
        `, [cpf, nome_meta, valor_objetivo, data_objetivo]);

        res.status(201).json({ id: result.id, message: 'Meta criada com sucesso' });
    } catch (error) {
        console.error('Erro ao criar meta:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== BANCOS ====================

app.get('/api/bancos', authMiddleware, async (req, res) => {
    try {
        const bancos = await dbAll('SELECT * FROM bancos ORDER BY nome_banco');
        res.json(bancos);
    } catch (error) {
        console.error('Erro ao buscar bancos:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== DASHBOARD AVANÇADO ====================

app.get('/api/dashboard', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        // Despesas por categoria (mês atual)
        const despesasPorCategoria = await dbAll(`
            SELECT c.nome_categoria, c.icone, c.cor, SUM(t.valor) as total
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            WHERE t.fk_cpf = ? AND c.tipo = 'Despesa' AND t.excluido = 0
            AND strftime('%m', t.data_transacao) = strftime('%m', 'now')
            GROUP BY c.id_categoria
            ORDER BY total DESC
        `, [cpf]);

        // Evolução mensal (últimos 12 meses)
        const evolucaoMensal = await dbAll(`
            SELECT strftime('%m/%Y', t.data_transacao) as mes,
                   strftime('%Y-%m', t.data_transacao) as mes_ordem,
                   SUM(CASE WHEN c.tipo = 'Receita' THEN t.valor ELSE 0 END) as receitas,
                   SUM(CASE WHEN c.tipo = 'Despesa' THEN t.valor ELSE 0 END) as despesas
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            WHERE t.fk_cpf = ? AND t.excluido = 0
            AND t.data_transacao >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', t.data_transacao)
            ORDER BY mes_ordem ASC
        `, [cpf]);

        // Despesas por forma de pagamento
        const despesasPorPagamento = await dbAll(`
            SELECT t.tipo_pagto, SUM(t.valor) as total
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            WHERE t.fk_cpf = ? AND c.tipo = 'Despesa' AND t.excluido = 0
            AND strftime('%m', t.data_transacao) = strftime('%m', 'now')
            GROUP BY t.tipo_pagto
            ORDER BY total DESC
        `, [cpf]);

        // Últimas transações
        const ultimasTransacoes = await dbAll(`
            SELECT t.id_transacao, t.data_transacao, t.descricao, t.valor, t.tipo_pagto,
                   c.nome_categoria, c.tipo as tipo_categoria, c.icone, c.cor, b.nome_banco
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            LEFT JOIN conta co ON t.fk_banco = co.pk_banco AND t.fk_agencia = co.pk_agencia AND t.fk_conta = co.pk_conta
            LEFT JOIN bancos b ON co.pk_banco = b.pk_banco
            WHERE t.fk_cpf = ? AND t.excluido = 0
            ORDER BY t.data_transacao DESC, t.id_transacao DESC
            LIMIT 10
        `, [cpf]);

        // Maiores despesas do mês
        const maioresDespesas = await dbAll(`
            SELECT t.descricao, SUM(t.valor) as total, c.nome_categoria, c.icone
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            WHERE t.fk_cpf = ? AND c.tipo = 'Despesa' AND t.excluido = 0
            AND strftime('%m', t.data_transacao) = strftime('%m', 'now')
            GROUP BY t.descricao
            ORDER BY total DESC
            LIMIT 5
        `, [cpf]);

        res.json({
            despesas_por_categoria: despesasPorCategoria,
            evolucao_mensal: evolucaoMensal,
            despesas_por_pagamento: despesasPorPagamento,
            ultimas_transacoes: ultimasTransacoes,
            maiores_despesas: maioresDespesas
        });
    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== ESTATÍSTICAS ====================

app.get('/api/estatisticas', authMiddleware, async (req, res) => {
    try {
        const cpf = await getCpfUsuario(req.usuario.id);
        if (!cpf) {
            return res.status(404).json({ erro: 'Cadastro pessoal não encontrado' });
        }

        const mes = req.query.mes || new Date().toISOString().slice(0, 7);

        // Total de transações
        const totalTransacoes = await dbGet(`
            SELECT COUNT(*) as total FROM transacoes WHERE fk_cpf = ? AND excluido = 0
            AND strftime('%Y-%m', data_transacao) = ?
        `, [cpf, mes]);

        // Média de gastos por dia
        const mediaDiaria = await dbGet(`
            SELECT AVG(total) as media FROM (
                SELECT SUM(t.valor) as total
                FROM transacoes t
                JOIN categoria c ON t.fk_categoria = c.id_categoria
                WHERE t.fk_cpf = ? AND c.tipo = 'Despesa' AND t.excluido = 0
                AND strftime('%Y-%m', t.data_transacao) = ?
                GROUP BY t.data_transacao
            )
        `, [cpf, mes]);

        // Dia com maior gasto
        const diaMaiorGasto = await dbGet(`
            SELECT t.data_transacao as data, SUM(t.valor) as total
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            WHERE t.fk_cpf = ? AND c.tipo = 'Despesa' AND t.excluido = 0
            AND strftime('%Y-%m', t.data_transacao) = ?
            GROUP BY t.data_transacao
            ORDER BY total DESC
            LIMIT 1
        `, [cpf, mes]);

        // Quantidade de transações por tipo
        const transacoesPorTipo = await dbAll(`
            SELECT c.tipo, COUNT(*) as quantidade, SUM(t.valor) as total
            FROM transacoes t
            JOIN categoria c ON t.fk_categoria = c.id_categoria
            WHERE t.fk_cpf = ? AND t.excluido = 0
            AND strftime('%Y-%m', t.data_transacao) = ?
            GROUP BY c.tipo
        `, [cpf, mes]);

        res.json({
            total_transacoes: totalTransacoes.total || 0,
            media_diaria: mediaDiaria.media || 0,
            dia_maior_gasto: diaMaiorGasto,
            transacoes_por_tipo: transacoesPorTipo
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== ERROR HANDLING ====================

app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║     🚀 Servidor iniciado com sucesso!      ║
║                                            ║
║     URL: http://localhost:${PORT}            ║
║     API: http://localhost:${PORT}/api        ║
║                                            ║
║     Login: /api/auth/login                 ║
║     Registro: /api/auth/register          ║
╚════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close(() => {
        console.log('📦 Conexão com banco fechada');
        process.exit(0);
    });
});

module.exports = { app, db };