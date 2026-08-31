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

    // Sai do admin → para auto-refresh
    if (typeof stopAdminAutoRefresh === 'function') {
        const adminSection = document.getElementById('sec-admin');
        if (name !== 'admin' && adminSection && !adminSection.classList.contains('hidden')) {
            stopAdminAutoRefresh();
        }
    }

    document.querySelectorAll('[id^="sec-"]').forEach(s => s.classList.add('hidden'));

    const target = document.getElementById('sec-' + name);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.subnav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === name);
    });

    switch (name) {
        case 'profile':
            if (typeof renderProfile === 'function') renderProfile();
            break;
        case 'admin':
            if (typeof renderAdmin === 'function') renderAdmin();
            break;
        case 'trades':
            if (typeof renderTrades === 'function') renderTrades();
            if (typeof renderMyChatsList === 'function') renderMyChatsList('myChatsList');
            break;
        case 'ranking':
            renderRanking();
            break;
        case 'faq':
            renderFAQ();
            break;
        case 'home':
            if (typeof renderGrid === 'function') renderGrid();
            break;
        default:
            break;
    }

    // Volta ao topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // Foco no primeiro botão/input útil
    const focusable = modal.querySelector('button, [href], input, select, textarea');
    if (focusable) {
        setTimeout(() => focusable.focus(), 50);
    }
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
 * Fecha painel/dropdown de notificações (se houver UI solta)
 */
function closeNotifications() {
    // Modal de notif é fechado via closeModal; esta função existe para o app.js
    const notifModal = document.getElementById('notifModal');
    if (notifModal && notifModal.classList.contains('active')) {
        // não fecha automaticamente no click fora do botão — só Escape/backdrop
    }
}

/**
 * Exibe uma notificação toast.
 * @param {string} msg - Mensagem
 * @param {string} type - 'info' | 'success' | 'error' | 'warning'
 */
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    el.setAttribute('role', 'alert');
    container.appendChild(el);

    while (container.children.length > 5) {
        container.removeChild(container.firstChild);
    }

    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s';
        setTimeout(() => el.remove(), 300);
    }, 3200);
}

/**
 * Modal de confirmação.
 */
function askConfirm(title, text, onOk) {
    const cfTitle = document.getElementById('cfTitle');
    const cfText = document.getElementById('cfText');
    const cfYesBtn = document.getElementById('cfYesBtn');
    if (!cfTitle || !cfText || !cfYesBtn) return;

    cfTitle.textContent = title;
    cfText.textContent = text;
    openModal('confirmModal');

    cfYesBtn.replaceWith(cfYesBtn.cloneNode(true));
    const newYesBtn = document.getElementById('cfYesBtn');
    newYesBtn.addEventListener('click', () => {
        closeModal('confirmModal');
        if (typeof onOk === 'function') onOk();
    }, { once: true });
}

function settleConfirm() {
    closeModal('confirmModal');
}

/**
 * Badge de notificações não lidas.
 */
function renderNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (!currentUser) {
        badge.textContent = '0';
        badge.classList.add('hidden');
        return;
    }
    if (!Array.isArray(currentUser.notifications)) currentUser.notifications = [];
    const count = currentUser.notifications.filter(n => !n.read).length;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
}

/**
 * Abre modal de notificações e marca como lidas.
 */
function toggleNotifications() {
    if (!currentUser) {
        openAuth('login');
        return;
    }
    if (!Array.isArray(currentUser.notifications)) currentUser.notifications = [];

    const list = document.getElementById('notifList');
    if (!list) return;

    list.innerHTML = currentUser.notifications.length
        ? currentUser.notifications.map(n => {
            const when = n.ts && typeof fmtRelative === 'function'
                ? fmtRelative(n.ts)
                : (n.ts && typeof fmtDateTime === 'function' ? fmtDateTime(n.ts) : '');
            return `<div class="notif-item ${n.read ? '' : 'unread'}">
                <div>${esc(n.text)}</div>
                ${when ? `<small class="text-muted">${when}</small>` : ''}
            </div>`;
        }).join('')
        : '<p class="text-muted">Sem notificações.</p>';

    openModal('notifModal');

    currentUser.notifications.forEach(n => { n.read = true; });
    save();
    renderNotifBadge();
}

function clearNotifications() {
    if (!currentUser) return;
    currentUser.notifications = [];
    save();
    const list = document.getElementById('notifList');
    if (list) list.innerHTML = '<p class="text-muted">Sem notificações.</p>';
    renderNotifBadge();
    showToast('Notificações limpas.', 'info');
}

/**
 * Atualiza áreas dependentes de dados.
 */
function renderAll() {
    if (typeof updateWalletUI === 'function') updateWalletUI();
    renderNotifBadge();
    if (typeof renderChatBadge === 'function') renderChatBadge();
    if (typeof renderGrid === 'function') renderGrid();
    if (currentUser && typeof renderTrades === 'function') {
        const tradesSection = document.getElementById('sec-trades');
        if (tradesSection && !tradesSection.classList.contains('hidden')) {
            renderTrades();
        }
    }
}

function applyTheme(t) {
    const theme = t === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEYS.theme, theme);
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
        btn.title = theme === 'dark' ? 'Tema claro' : 'Tema escuro';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(current);
}

/**
 * Ranking de reputação (estrelas + escambos).
 */
function renderRanking() {
    const users = DB.users.filter(u => u.role !== 'admin' && u.role !== 'banned');
    const ranked = users.map(u => {
        const ratings = Array.isArray(u.ratings) ? u.ratings : [];
        const avg = ratings.length ? ratings.reduce((s, r) => s + (r.stars || 0), 0) / ratings.length : 0;
        const sales = (u.stats?.sales || 0) + (u.stats?.barters || 0);
        const score = avg * 10 + sales * 5;
        return { user: u, avg, sales, score, count: ratings.length };
    }).sort((a, b) => b.score - a.score);

    const rankingBody = document.getElementById('rankingBody');
    if (!rankingBody) return;

    rankingBody.innerHTML = ranked.length
        ? ranked.map((r, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${esc(r.user.name)}${r.user.location ? ` <small class="text-muted">· ${esc(r.user.location)}</small>` : ''}</td>
                <td>${r.count ? fmtAvg(r.avg) + ' ★ (' + r.count + ')' : '—'}</td>
                <td>${r.sales}</td>
                <td>${fmt(Math.round(r.score))}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" class="text-muted">Nenhum usuário no ranking.</td></tr>';
}

// FAQ alinhado ao modelo de escambo (só moedas virtuais)
const FAQ_DATA = [
    {
        q: 'Como ganho moedas?',
        a: 'Ao se cadastrar você recebe 20 moedas virtuais de bônus. Também ganha moedas quando alguém adquire seus itens com moedas, ou quando recebe complemento em moedas numa troca.'
    },
    {
        q: 'O que é o EscamboX?',
        a: 'É uma plataforma de escambo: você troca itens por outros itens e/ou por moedas virtuais. Não há dinheiro real — apenas as moedas da plataforma.'
    },
    {
        q: 'Como propor uma troca de item?',
        a: 'Abra o anúncio, clique em “Propor troca de item”, escolha um dos seus anúncios disponíveis e, se quiser, adicione moedas e uma mensagem. O outro usuário aceita ou recusa em Negócios.'
    },
    {
        q: 'Posso usar só moedas, sem trocar item?',
        a: 'Sim. Se o anúncio aceitar moedas, use “Adquirir por X moedas”. Isso envia uma proposta que o dono precisa aceitar.'
    },
    {
        q: 'Como funciona a localização?',
        a: 'No cadastro você informa onde mora. Os anúncios também têm localização. Use o filtro de raio (km) para achar itens perto de você.'
    },
    {
        q: 'Como avalio alguém?',
        a: 'Depois que um negócio é concluído, em Negócios aparece o botão “Avaliar”. Dê de 1 a 5 estrelas e, se quiser, um comentário.'
    },
    {
        q: 'Posso denunciar um anúncio?',
        a: 'Sim. No detalhe do item use “Denunciar”. O administrador analisa e pode remover o anúncio ou ignorar a denúncia.'
    }
];

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