'use strict';

// Interface geral, navegação, notificações, modais

/**
 * Navega para uma seção específica.
 * @param {string} name - Nome da seção
 */
function showSection(name) {
    if (name === 'admin' && !isAdmin()) {
        showToast('Acesso negado.', 'error');
        return;
    }
    if (['trades', 'profile'].includes(name) && !currentUser) {
        openAuth('login');
        return;
    }

    // Oculta todas as seções
    document.querySelectorAll('[id^="sec-"]').forEach(s => s.classList.add('hidden'));

    // Mostra a seção desejada
    const target = document.getElementById('sec-' + name);
    if (target) target.classList.remove('hidden');

    // Atualiza botões da navegação
    document.querySelectorAll('.subnav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === name);
    });

    // Renderiza conteúdo específico da seção
    switch (name) {
        case 'profile':
            renderProfile();
            break;
        case 'admin':
            renderAdmin();
            break;
        case 'trades':
            renderTrades();
            break;
        case 'ranking':
            renderRanking();
            break;
        case 'faq':
            renderFAQ();
            break;
        default:
            break;
    }
}

/**
 * Abre um modal.
 * @param {string} id - ID do modal
 */
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('aria-modal', 'true');
}

/**
 * Fecha um modal.
 * @param {string} id - ID do modal
 */
function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('aria-modal');
}

/**
 * Exibe uma notificação toast.
 * @param {string} msg - Mensagem a exibir
 * @param {string} type - Tipo ('info', 'success', 'error', 'warning')
 */
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    el.setAttribute('role', 'alert');
    container.appendChild(el);

    // Limita a 5 toasts simultâneos
    while (container.children.length > 5) {
        container.removeChild(container.firstChild);
    }

    setTimeout(() => el.remove(), 3000);
}

/**
 * Abre modal de confirmação.
 * @param {string} title - Título
 * @param {string} text - Texto explicativo
 * @param {Function} onOk - Callback ao confirmar
 */
function askConfirm(title, text, onOk) {
    const cfTitle = document.getElementById('cfTitle');
    const cfText = document.getElementById('cfText');
    const cfYesBtn = document.getElementById('cfYesBtn');
    if (!cfTitle || !cfText || !cfYesBtn) return;

    cfTitle.textContent = title;
    cfText.textContent = text;
    openModal('confirmModal');

    // Remove listeners antigos para evitar múltiplas execuções
    cfYesBtn.replaceWith(cfYesBtn.cloneNode(true));
    const newYesBtn = document.getElementById('cfYesBtn');
    newYesBtn.addEventListener('click', () => {
        closeModal('confirmModal');
        if (typeof onOk === 'function') onOk();
    }, { once: true });
}

/**
 * Fecha o modal de confirmação sem executar ação (botão Cancelar).
 */
function settleConfirm() {
    closeModal('confirmModal');
}

/**
 * Atualiza o badge de notificações não lidas.
 */
function renderNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (!currentUser) {
        badge.textContent = '0';
        badge.classList.add('hidden');
        return;
    }
    const count = currentUser.notifications.filter(n => !n.read).length;
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
}

/**
 * Abre o modal de notificações e marca todas como lidas.
 */
function toggleNotifications() {
    if (!currentUser) return;
    const list = document.getElementById('notifList');
    if (!list) return;

    list.innerHTML = currentUser.notifications
        .map(n => `<div>${esc(n.text)}</div>`)
        .join('') || '<p>Sem notificações.</p>';

    openModal('notifModal');

    currentUser.notifications.forEach(n => n.read = true);
    save();
    renderNotifBadge();
}

/**
 * Limpa todas as notificações do usuário.
 */
function clearNotifications() {
    if (!currentUser) return;
    currentUser.notifications = [];
    save();
    const list = document.getElementById('notifList');
    if (list) list.innerHTML = '<p>Sem notificações.</p>';
    renderNotifBadge();
    showToast('Notificações limpas.', 'info');
}

/**
 * Renderiza todas as áreas que dependem de dados do usuário e itens.
 */
function renderAll() {
    updateWalletUI();
    renderNotifBadge();
    renderGrid();
    if (currentUser) {
        renderTrades();
    }
}

/**
 * Aplica o tema (claro/escuro).
 * @param {string} t - 'light' ou 'dark'
 */
function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(KEYS.theme, t);
}

/**
 * Alterna entre tema claro e escuro.
 */
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(current);
}

/**
 * Renderiza o ranking de reputação.
 */
function renderRanking() {
    const users = DB.users.filter(u => u.role !== 'admin');
    const ranked = users.map(u => {
        const ratings = Array.isArray(u.ratings) ? u.ratings : [];
        const avg = ratings.length ? ratings.reduce((s, r) => s + (r.stars || 0), 0) / ratings.length : 0;
        const sales = (u.stats?.sales || 0) + (u.stats?.barters || 0);
        const score = avg * 10 + sales * 5;
        return { user: u, avg, sales, score };
    }).sort((a, b) => b.score - a.score);

    const rankingBody = document.getElementById('rankingBody');
    if (!rankingBody) return;

    rankingBody.innerHTML = ranked.map((r, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${esc(r.user.name)}</td>
            <td>${r.avg ? fmtAvg(r.avg) + ' ★' : '—'}</td>
            <td>${r.sales}</td>
            <td>${fmt(r.score)}</td>
        </tr>
    `).join('');
}

// FAQ
const FAQ_DATA = [
    { q: 'Como ganho moedas?', a: 'Ao se cadastrar você ganha 20 moedas de bônus. Você também pode ganhar moedas vendendo itens ou completando trocas.' },
    { q: 'O que é escambo?', a: 'Escambo é a troca de itens sem dinheiro. No EscamboX você também pode combinar troca com moedas virtuais.' },
    { q: 'Como funciona a geolocalização?', a: 'Os itens possuem localização aproximada. Use o filtro de raio para encontrar itens próximos a você.' },
    { q: 'Como avalio um usuário?', a: 'Após concluir um negócio, você pode avaliar a contraparte com 1 a 5 estrelas e um comentário.' },
    { q: 'Posso denunciar um anúncio?', a: 'Sim, em cada anúncio há a opção de denunciar. Nossa equipe analisará.' }
];

/**
 * Renderiza a lista de FAQ.
 */
function renderFAQ() {
    const faqList = document.getElementById('faqList');
    if (!faqList) return;

    faqList.innerHTML = FAQ_DATA.map(f => `
        <li class="faq-item">
            <strong>${esc(f.q)}</strong>
            <p>${esc(f.a)}</p>
        </li>
    `).join('');
}