/**
 * Finanças Pessoais - Frontend Application v2.1
 */

const API_URL = 'http://localhost:3000/api';

// Utility Functions
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => { if (!dateStr) return '-'; const date = new Date(dateStr + 'T00:00:00'); return date.toLocaleDateString('pt-BR'); };
const showToast = (message, type = 'success') => { const toast = document.getElementById('toast'); toast.querySelector('.toast-message').textContent = message; toast.className = `toast ${type} show`; setTimeout(() => toast.classList.remove('show'), 3000); };
const getToken = () => localStorage.getItem('fin_token');
const setToken = (token) => localStorage.setItem('fin_token', token);
const removeToken = () => localStorage.removeItem('fin_token');
const getInitials = (name) => { if (!name) return '--'; const parts = name.split(' '); return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase(); };

// API
const api = {
    async get(endpoint) { const token = getToken(); const response = await fetch(`${API_URL}${endpoint}`, { headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) { const error = await response.json(); throw error; } return response.json(); },
    async post(endpoint, data, auth = true) { const headers = { 'Content-Type': 'application/json' }; if (auth) { const token = getToken(); headers['Authorization'] = `Bearer ${token}`; } const response = await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(data) }); if (!response.ok) { const error = await response.json(); throw error; } return response.json(); },
    async delete(endpoint) { const token = getToken(); const response = await fetch(`${API_URL}${endpoint}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) { const error = await response.json(); throw error; } return response.json(); }
};

let store = { usuario: null, contas: [], transacoes: [], categorias: [], metas: [], dashboard: null };

// Auth Functions
const checkAuth = async () => {
    const token = getToken();
    if (!token) { showAuthScreen(); return false; }
    try {
        const data = await api.get('/auth/verify');
        store.usuario = data.usuario;
        showApp();
        return true;
    } catch (error) {
        if (error.code === 'TOKEN_EXPIRED' || error.code === 'SESSION_EXPIRED' || error.code === 'INVALID_TOKEN') {
            removeToken();
            showAuthScreen();
            showToast('Sessão expirada. Faça login novamente.', 'error');
        }
        return false;
    }
};

const showAuthScreen = () => { document.getElementById('authScreen').classList.remove('hidden'); document.getElementById('appContainer').classList.add('hidden'); };
const showApp = () => {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    if (store.usuario) {
        document.getElementById('userName').textContent = store.usuario.nome;
        document.getElementById('userEmail').textContent = store.usuario.email;
        document.getElementById('userAvatar').textContent = getInitials(store.usuario.nome);
    }
};

const login = async (email, senha) => {
    try {
        const data = await api.post('/auth/login', { email, senha }, false);
        setToken(data.token);
        store.usuario = data.usuario;
        showApp();
        await loadAllData();
        showToast('Login realizado com sucesso!');
    } catch (error) {
        showToast(error.erro || 'Erro ao fazer login', 'error');
        throw error;
    }
};

const register = async (userData) => {
    try {
        await api.post('/auth/register', userData, false);
        showToast('Conta criada com sucesso! Faça login.');
        showLoginForm();
    } catch (error) {
        showToast(error.erro || 'Erro ao criar conta', 'error');
        throw error;
    }
};

const logout = async () => {
    try { await api.post('/auth/logout', {}); } catch (error) { console.error('Erro ao fazer logout:', error); }
    removeToken();
    store = { usuario: null, contas: [], transacoes: [], categorias: [], metas: [], dashboard: null };
    showAuthScreen();
};

// Auth Form Handlers
const initAuthForms = () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const senha = document.getElementById('loginSenha').value;
        try { await login(email, senha); } catch (error) { }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('regNome').value;
        const email = document.getElementById('regEmail').value;
        const cpf = document.getElementById('regCpf').value.replace(/\D/g, '');
        const dataNascimento = document.getElementById('regDataNasc').value;
        const senha = document.getElementById('regSenha').value;
        const senhaConf = document.getElementById('regSenhaConf').value;

        if (senha !== senhaConf) { showToast('As senhas não coincidem', 'error'); return; }
        if (cpf.length !== 11) { showToast('CPF deve ter 11 dígitos', 'error'); return; }

        try { await register({ nome, email, cpf, senha, data_nascimento: dataNascimento }); } catch (error) { }
    });

    showRegister.addEventListener('click', (e) => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
    showLogin.addEventListener('click', (e) => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });
    document.getElementById('btnLogout').addEventListener('click', logout);
};

const showLoginForm = () => { document.getElementById('registerForm').classList.add('hidden'); document.getElementById('loginForm').classList.remove('hidden'); };

// Navigation
const initNavigation = () => {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const titles = { dashboard: { title: 'Dashboard', subtitle: 'Visão geral das suas finanças' }, transacoes: { title: 'Transações', subtitle: 'Gerencie suas receitas e despesas' }, contas: { title: 'Contas', subtitle: 'Suas contas bancárias' }, metas: { title: 'Metas', subtitle: 'Acompanhe seus objetivos financeiros' }, relatorios: { title: 'Relatórios', subtitle: 'Análise detalhada' } };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = item.dataset.page;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(`page-${pageName}`).classList.add('active');
            document.getElementById('pageTitle').textContent = titles[pageName].title;
            document.getElementById('pageSubtitle').textContent = titles[pageName].subtitle;
            document.getElementById('sidebar').classList.remove('active');
        });
    });

    document.getElementById('menuToggle').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('active'); });
};

// Load Functions
const loadAllData = async () => {
    try {
        await Promise.all([loadResumo(), loadContas(), loadCategorias(), loadDashboard(), loadBancos()]);
        await loadAllTransacoes();
        await loadMetas();
        await loadEstatisticas();
    } catch (error) { console.error('Erro ao carregar dados:', error); }
};

const loadResumo = async () => {
    try {
        const resumo = await api.get('/resumo');
        document.getElementById('patrimonioTotal').textContent = formatCurrency(resumo.patrimonio_total);
        document.getElementById('receitasMes').textContent = formatCurrency(resumo.receitas_mes);
        document.getElementById('despesasMes').textContent = formatCurrency(resumo.despesas_mes);
        const saldoMesEl = document.getElementById('saldoMes');
        saldoMesEl.textContent = formatCurrency(resumo.saldo_mes);
        saldoMesEl.style.color = resumo.saldo_mes >= 0 ? 'var(--success)' : 'var(--danger)';
    } catch (error) { console.error('Erro ao carregar resumo:', error); }
};

const loadContas = async () => {
    try {
        const contas = await api.get('/contas');
        store.contas = contas;

        // Mini accounts
        const miniContainer = document.getElementById('accountsMini');
        const fullGrid = document.getElementById('accountsFullGrid');

        if (contas.length === 0) {
            const emptyHtml = '<div class="empty-state"><span class="empty-icon">🏦</span><p>Nenhuma conta cadastrada</p><button class="btn btn-secondary" onclick="openModal(\'modalConta\')">Adicionar Conta</button></div>';
            miniContainer.innerHTML = emptyHtml;
            fullGrid.innerHTML = emptyHtml;
        } else {
            const html = contas.map(c => `
                <div class="account-mini">
                    <div class="account-mini-info">
                        <span class="account-mini-name">${c.nome_conta}</span>
                        <span class="account-mini-bank">${c.nome_banco}</span>
                    </div>
                    <span class="account-mini-balance">${formatCurrency(c.saldo)}</span>
                </div>
            `).join('');
            miniContainer.innerHTML = html;

            const fullHtml = contas.map(c => `
                <div class="account-card">
                    <div class="account-bank">${c.nome_banco} (${c.codigo})</div>
                    <div class="account-name">${c.nome_conta}</div>
                    <div class="account-balance">${formatCurrency(c.saldo)}</div>
                    <span class="account-type">${c.tipo_conta}</span>
                </div>
            `).join('');
            fullGrid.innerHTML = fullHtml;
        }

        const selectConta = document.getElementById('transConta');
        selectConta.innerHTML = '<option value="">Selecione...</option>' + contas.map(c => `<option value="${c.pk_banco}-${c.pk_agencia}-${c.pk_conta}">${c.nome_banco} - ${c.nome_conta}</option>`).join('');
    } catch (error) { console.error('Erro ao carregar contas:', error); }
};

const loadCategorias = async () => {
    try {
        const categorias = await api.get('/categorias');
        store.categorias = categorias;

        const filterCategoria = document.getElementById('filterCategoria');
        filterCategoria.innerHTML = '<option value="">Todas Categorias</option>' + categorias.map(c => `<option value="${c.id_categoria}">${c.icone} ${c.nome_categoria}</option>`).join('');

        const transCategoria = document.getElementById('transCategoria');
        transCategoria.innerHTML = '<option value="">Selecione...</option>' + categorias.map(c => `<option value="${c.id_categoria}" data-tipo="${c.tipo}">${c.icone} ${c.nome_categoria}</option>`).join('');
    } catch (error) { console.error('Erro ao carregar categorias:', error); }
};

const loadBancos = async () => {
    try {
        const bancos = await api.get('/bancos');
        const select = document.getElementById('contaBanco');
        select.innerHTML = '<option value="">Selecione o banco...</option>' + bancos.map(b => `<option value="${b.pk_banco}">${b.nome_banco} (${b.codigo})</option>`).join('');
    } catch (error) { console.error('Erro ao carregar bancos:', error); }
};

const loadDashboard = async () => {
    try {
        const data = await api.get('/dashboard');
        store.dashboard = data;

        renderExpenseChart(data.despesas_por_categoria);
        renderEvolutionChart(data.evolucao_mensal);
        renderPaymentChart(data.despesas_por_pagamento);
        renderTopExpenses(data.maiores_despesas);
        renderRecentTransactions(data.ultimas_transacoes);

        // Check if should show welcome card
        if (store.contas.length === 0) {
            document.getElementById('welcomeCard').classList.remove('hidden');
        } else {
            document.getElementById('welcomeCard').classList.add('hidden');
        }
    } catch (error) { console.error('Erro ao carregar dashboard:', error); }
};

const loadAllTransacoes = async () => {
    try {
        const transacoes = await api.get('/transacoes?limite=500');
        store.transacoes = transacoes;

        const tbody = document.getElementById('transactionsBody');
        if (transacoes.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8" class="empty-cell"><div class="empty-state"><span class="empty-icon">💳</span><p>Nenhuma transação encontrada</p></div></td></tr>';
        } else {
            tbody.innerHTML = transacoes.map(t => `
                <tr>
                    <td>${formatDate(t.data_transacao)}</td>
                    <td>${t.descricao}</td>
                    <td><span class="category-badge" style="background-color: ${t.cor}20; color: ${t.cor}">${t.icone} ${t.nome_categoria}</span></td>
                    <td>${t.nome_banco || '-'}</td>
                    <td><span class="type-badge ${t.tipo_categoria.toLowerCase()}">${t.tipo_categoria}</span></td>
                    <td><span class="payment-badge">${t.tipo_pagto}</span></td>
                    <td style="font-weight: 600; color: ${t.tipo_categoria === 'Receita' ? 'var(--success)' : 'var(--danger)'}">${t.tipo_categoria === 'Receita' ? '+' : '-'}${formatCurrency(t.valor)}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="deleteTransacao(${t.id_transacao})">Excluir</button></td>
                </tr>
            `).join('');
        }
    } catch (error) { console.error('Erro ao carregar transações:', error); }
};

const loadMetas = async () => {
    try {
        const metas = await api.get('/metas');
        store.metas = metas;
        const grid = document.getElementById('goalsGrid');

        if (metas.length === 0) {
            grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🎯</span><p>Nenhuma meta cadastrada</p></div>';
        } else {
            grid.innerHTML = metas.map(m => `
                <div class="goal-card">
                    <div class="goal-header">
                        <div><div class="goal-name">${m.nome_meta}</div><div class="goal-deadline">Prazo: ${formatDate(m.data_objetivo)}</div></div>
                        <span class="goal-percent">${m.percentual}%</span>
                    </div>
                    <div class="goal-progress"><div class="goal-progress-bar" style="width: ${Math.min(m.percentual, 100)}%"></div></div>
                    <div class="goal-values"><span class="goal-current">${formatCurrency(m.valor_atual)}</span><span class="goal-target">de ${formatCurrency(m.valor_objetivo)}</span></div>
                </div>
            `).join('');
        }
    } catch (error) { console.error('Erro ao carregar metas:', error); }
};

const loadEstatisticas = async () => {
    try {
        const mes = new Date().toISOString().slice(0, 7);
        const stats = await api.get(`/estatisticas?mes=${mes}`);

        document.getElementById('statTotal').textContent = stats.total_transacoes || 0;
        document.getElementById('statMedia').textContent = formatCurrency(stats.media_diaria || 0);

        if (stats.dia_maior_gasto) {
            document.getElementById('statMaior').textContent = formatCurrency(stats.dia_maior_gasto.total);
            document.getElementById('statDia').textContent = formatDate(stats.dia_maior_gasto.data);
        }
    } catch (error) { console.error('Erro ao carregar estatísticas:', error); }
};

// Chart Renders
const renderExpenseChart = (data) => {
    const container = document.getElementById('expensesChart');
    if (!data || data.length === 0) { container.innerHTML = '<div class="empty-state"><span class="empty-icon">📊</span><p>Sem despesas este mês</p></div>'; return; }
    const maxValue = Math.max(...data.map(d => d.total));
    container.innerHTML = data.map(item => `
        <div class="expense-chart-item">
            <div class="expense-icon" style="background: ${item.cor}20">${item.icone}</div>
            <div class="expense-bar-container">
                <div class="expense-name">${item.nome_categoria}</div>
                <div class="expense-bar"><div class="expense-bar-fill" style="width: ${(item.total / maxValue) * 100}%; background: ${item.cor}"></div></div>
            </div>
            <span class="expense-amount">${formatCurrency(item.total)}</span>
        </div>
    `).join('');
};

const renderEvolutionChart = (data) => {
    const container = document.getElementById('evolucaoChart');
    if (!data || data.length === 0) { container.innerHTML = '<div class="empty-state"><span class="empty-icon">📊</span><p>Sem dados para exibir</p></div>'; return; }
    const maxValue = Math.max(...data.flatMap(d => [d.receitas || 0, d.despesas || 0])) || 1;

    container.innerHTML = `
        <div class="evolution-chart">
            ${data.map(item => `
                <div class="evolution-bar">
                    <div class="evolution-label">${item.mes}</div>
                    <div class="evolution-bars">
                        <div class="evolution-income" style="height: ${Math.max((item.receitas / maxValue) * 100, 4)}px"></div>
                        <div class="evolution-expense" style="height: ${Math.max((item.despesas / maxValue) * 100, 4)}px"></div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="evolution-legend">
            <span><span class="dot income"></span> Receitas</span>
            <span><span class="dot expense"></span> Despesas</span>
        </div>
    `;
};

const renderPaymentChart = (data) => {
    const container = document.getElementById('paymentChart');
    if (!data || data.length === 0) { container.innerHTML = '<div class="empty-state"><span class="empty-icon">💳</span><p>Sem dados</p></div>'; return; }
    const icons = { 'Debito': '💳', 'Credito': '🎫', 'PIX': '📱', 'Dinheiro': '💵', 'Transferencia': '🔄' };
    container.innerHTML = data.map(item => `
        <div class="payment-item">
            <span class="payment-icon">${icons[item.tipo_pagto] || '💰'}</span>
            <span>${item.tipo_pagto}</span>
            <span class="payment-value">${formatCurrency(item.total)}</span>
        </div>
    `).join('');
};

const renderTopExpenses = (data) => {
    const container = document.getElementById('topExpenses');
    if (!data || data.length === 0) { container.innerHTML = '<div class="empty-state"><span class="empty-icon">📊</span><p>Sem despesas</p></div>'; return; }
    container.innerHTML = `<div class="top-expenses">${data.map(item => `
        <div class="top-expense-item">
            <div><div class="top-expense-desc">${item.descricao}</div><div class="top-expense-cat">${item.icone} ${item.nome_categoria}</div></div>
            <div class="top-expense-value">${formatCurrency(item.total)}</div>
        </div>
    `).join('')}</div>`;
};

const renderRecentTransactions = (data) => {
    const container = document.getElementById('recentTransactions');
    if (!data || data.length === 0) { container.innerHTML = '<div class="empty-state"><span class="empty-icon">💳</span><p>Nenhuma transação registrada</p></div>'; return; }
    container.innerHTML = data.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <span class="transaction-desc">${t.descricao}</span>
                <span class="transaction-date">${formatDate(t.data_transacao)} • ${t.icone} ${t.nome_categoria}</span>
            </div>
            <span class="transaction-amount ${t.tipo_categoria === 'Receita' ? 'income' : 'expense'}">${t.tipo_categoria === 'Receita' ? '+' : '-'}${formatCurrency(t.valor)}</span>
        </div>
    `).join('');
};

// Modal Functions
const openModal = (modalId) => { document.getElementById(modalId).classList.add('active'); };
const closeModal = (modalId) => { document.getElementById(modalId).classList.remove('active'); };

const initModals = () => {
    // Transaction Modal
    document.getElementById('btnNovaTransacao').addEventListener('click', () => { openModal('modalTransacao'); document.getElementById('transData').valueAsDate = new Date(); });
    document.getElementById('btnCancelarTrans').addEventListener('click', () => closeModal('modalTransacao'));
    document.getElementById('modalTransacaoClose').addEventListener('click', () => closeModal('modalTransacao'));
    document.getElementById('modalTransacao').addEventListener('click', (e) => { if (e.target.id === 'modalTransacao') closeModal('modalTransacao'); });

    // Account Modal
    ['btnAddContaWelcome', 'btnAddContaPage'].forEach(id => { document.getElementById(id)?.addEventListener('click', () => openModal('modalConta')); });
    document.getElementById('btnCancelarConta').addEventListener('click', () => closeModal('modalConta'));
    document.getElementById('modalContaClose').addEventListener('click', () => closeModal('modalConta'));
    document.getElementById('modalConta').addEventListener('click', (e) => { if (e.target.id === 'modalConta') closeModal('modalConta'); });

    // Goal Modal
    document.getElementById('btnAddMeta').addEventListener('click', () => openModal('modalMeta'));
    document.getElementById('btnCancelarMeta').addEventListener('click', () => closeModal('modalMeta'));
    document.getElementById('modalMetaClose').addEventListener('click', () => closeModal('modalMeta'));
    document.getElementById('modalMeta').addEventListener('click', (e) => { if (e.target.id === 'modalMeta') closeModal('modalMeta'); });

    // Filter categories by type
    document.getElementById('transTipo').addEventListener('change', (e) => {
        const tipo = e.target.value;
        const options = document.querySelectorAll('#transCategoria option');
        options.forEach(opt => { if (opt.value) { const optTipo = opt.dataset.tipo; opt.style.display = (!tipo || optTipo === tipo) ? '' : 'none'; } });
    });
};

// Form Handlers
const initForms = () => {
    // Transaction Form
    document.getElementById('formTransacao').addEventListener('submit', async (e) => {
        e.preventDefault();
        const contaValues = document.getElementById('transConta').value.split('-');
        const data = {
            fk_categoria: parseInt(document.getElementById('transCategoria').value),
            descricao: document.getElementById('transDescricao').value,
            valor: parseFloat(document.getElementById('transValor').value),
            tipo_pagto: document.getElementById('transPagto').value,
            data_transacao: document.getElementById('transData').value,
            fk_banco: contaValues[0] ? parseInt(contaValues[0]) : null,
            fk_agencia: contaValues[1] ? parseInt(contaValues[1]) : null,
            fk_conta: contaValues[2] ? parseInt(contaValues[2]) : null
        };
        try { await api.post('/transacoes', data); showToast('Transação salva com sucesso!'); closeModal('modalTransacao'); e.target.reset(); await loadAllData(); }
        catch (error) { showToast(error.erro || 'Erro ao salvar transação', 'error'); }
    });

    // Account Form
    document.getElementById('formConta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            pk_banco: parseInt(document.getElementById('contaBanco').value),
            pk_agencia: parseInt(document.getElementById('contaAgencia').value),
            pk_conta: parseInt(document.getElementById('contaNumero').value),
            nome_conta: document.getElementById('contaNome').value || 'Conta Principal',
            tipo_conta: document.getElementById('contaTipo').value,
            saldo_inicial: parseFloat(document.getElementById('contaSaldo').value) || 0
        };
        try { await api.post('/contas', data); showToast('Conta cadastrada com sucesso!'); closeModal('modalConta'); e.target.reset(); await loadContas(); await loadResumo(); }
        catch (error) { showToast(error.erro || 'Erro ao cadastrar conta', 'error'); }
    });

    // Goal Form
    document.getElementById('formMeta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { nome_meta: document.getElementById('metaNome').value, valor_objetivo: parseFloat(document.getElementById('metaValor').value), data_objetivo: document.getElementById('metaData').value };
        try { await api.post('/metas', data); showToast('Meta criada com sucesso!'); closeModal('modalMeta'); e.target.reset(); await loadMetas(); }
        catch (error) { showToast(error.erro || 'Erro ao criar meta', 'error'); }
    });

    // Generate Mock Data
    document.getElementById('btnGerarDados').addEventListener('click', async () => {
        if (store.contas.length === 0) {
            showToast('Cadastre pelo menos uma conta antes de gerar dados', 'error');
            return;
        }
        if (!confirm('Isso vai gerar transações simuladas dos últimos 6 meses. Continuar?')) return;

        try {
            const result = await api.post('/gerar-dados-mock', {});
            showToast(`${result.total} transações geradas com sucesso!`);
            await loadAllData();
        } catch (error) {
            showToast(error.erro || 'Erro ao gerar dados', 'error');
        }
    });
};

// Delete Transaction
window.deleteTransacao = async (id) => {
    if (!confirm('Deseja realmente excluir esta transação?')) return;
    try { await api.delete(`/transacoes/${id}`); showToast('Transação excluída!'); await loadAllData(); }
    catch (error) { showToast(error.erro || 'Erro ao excluir transação', 'error'); }
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicação...');
    initAuthForms();
    initNavigation();
    initModals();
    initForms();
    const isAuth = await checkAuth();
    if (isAuth) { await loadAllData(); }
    console.log('✅ Aplicação carregada!');
});