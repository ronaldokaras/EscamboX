// Interface geral, navegação, notificações, modais
function showSection(name) {
    if (name === 'admin' && !isAdmin()) return showToast('Acesso negado.', 'error');
    if (['trades','missions','profile'].includes(name) && !currentUser) return openAuth('login');
    document.querySelectorAll('[id^="sec-"]').forEach(s => s.classList.add('hidden'));
    document.getElementById('sec-' + name)?.classList.remove('hidden');
    document.querySelectorAll('.subnav a').forEach(a => a.classList.toggle('active', a.dataset.section === name));
    if (name === 'profile') renderProfile();
    if (name === 'admin') renderAdmin();
    if (name === 'trades') renderTrades();
    if (name === 'missions') renderMissions();
    if (name === 'ranking') renderRanking();
    if (name === 'faq') renderFAQ();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function askConfirm(title, text, onOk) {
    document.getElementById('cfTitle').textContent = title;
    document.getElementById('cfText').textContent = text;
    openModal('confirmModal');
    document.getElementById('cfYesBtn').onclick = () => { closeModal('confirmModal'); onOk(); };
}

function settleConfirm() { closeModal('confirmModal'); }

function renderNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!currentUser) return;
    const count = currentUser.notifications.filter(n => !n.read).length;
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
}

function toggleNotifications() {
    const list = document.getElementById('notifList');
    list.innerHTML = currentUser.notifications.map(n => `<div>${esc(n.text)}</div>`).join('') || 'Sem notificações.';
    openModal('notifModal');
}

function clearNotifications() {
    if (!currentUser) return;
    currentUser.notifications = [];
    save();
    toggleNotifications();
    renderNotifBadge();
}

function renderAll() {
    updateWalletUI();
    renderNotifBadge();
    renderGrid();
    renderTrades();
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(KEYS.theme, t);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(current);
}

const MISSIONS = [
    { id:'login', type:'daily', desc:'Fazer login hoje', reward: 5, check: u => u.lastLoginDate === todayStr(), claimedKey: 'mission_login_' + todayStr() },
    { id:'publish', type:'daily', desc:'Publicar um anúncio hoje', reward: 10, check: u => DB.items.some(i => i.ownerId === u.id && new Date(i.createdAt).toDateString() === new Date().toDateString()), claimedKey: 'mission_publish_' + todayStr() },
    { id:'trade_complete', type:'achievement', desc:'Concluir 1 negociação (troca ou compra)', reward: 50, check: u => (u.stats.sales + u.stats.barters) >= 1, claimedKey: 'ach_trade_1' },
    { id:'trade_5', type:'achievement', desc:'Concluir 5 negociações', reward: 200, check: u => (u.stats.sales + u.stats.barters) >= 5, claimedKey: 'ach_trade_5' },
    { id:'publish_10', type:'achievement', desc:'Publicar 10 anúncios', reward: 150, check: u => u.stats.itemsPublished >= 10, claimedKey: 'ach_publish_10' }
];

function renderMissions() {
    if (!currentUser) return;
    const missionsList = document.getElementById('missionsList');
    missionsList.innerHTML = MISSIONS.map(m => {
        const done = m.check(currentUser);
        const claimed = currentUser.claimed && currentUser.claimed[m.claimedKey];
        let status = 'Pendente';
        if (done && !claimed) status = 'Disponível para resgate';
        if (claimed) status = 'Resgatada';
        const canClaim = done && !claimed;
        return `<div class="mission-card ${done && !claimed ? 'mission-available' : ''}">
            <div class="mission-info">
                <strong>${m.desc}</strong>
                <span>Recompensa: ${m.reward} moedas</span>
                <small>${status}</small>
            </div>
            ${canClaim ? `<button class="btn" onclick="claimMission('${m.id}')">Resgatar</button>` : ''}
        </div>`;
    }).join('');
}

function claimMission(missionId) {
    if (!currentUser) return;
    const mission = MISSIONS.find(m => m.id === missionId);
    if (!mission || !mission.check(currentUser) || (currentUser.claimed && currentUser.claimed[mission.claimedKey])) return;
    if (!currentUser.claimed) currentUser.claimed = {};
    currentUser.claimed[mission.claimedKey] = true;
    changeCoins(currentUser, mission.reward, `Missão: ${mission.desc}`);
    notify(currentUser.id, `Missão concluída! +${mission.reward} moedas.`);
    save();
    renderMissions();
    updateWalletUI();
    showToast(`+${mission.reward} moedas!`, 'success');
}

function renderRanking() {
    const users = DB.users.filter(u => u.role !== 'admin');
    const ranked = users.map(u => {
        const avg = u.ratings.length ? u.ratings.reduce((s, r) => s + r.stars, 0) / u.ratings.length : 0;
        const score = avg * 10 + (u.stats.sales + u.stats.barters) * 5;
        return { user: u, avg, score };
    }).sort((a,b) => b.score - a.score);
    document.getElementById('rankingBody').innerHTML = ranked.map((r, idx) => {
        return `<tr>
            <td>${idx + 1}</td>
            <td>${esc(r.user.name)}</td>
            <td>${r.avg ? fmtAvg(r.avg) + ' ★' : '—'}</td>
            <td>${r.user.stats.sales + r.user.stats.barters}</td>
            <td>${fmt(r.score)}</td>
        </tr>`;
    }).join('');
}

const FAQ_DATA = [
    { q: 'Como ganho moedas?', a: 'Ao se cadastrar você ganha 20 moedas. Além disso, pode ganhar moedas completando missões diárias e conquistas.' },
    { q: 'O que é escambo?', a: 'Escambo é a troca de itens sem dinheiro. No EscamboX você também pode combinar troca com moedas virtuais.' },
    { q: 'Como funciona a geolocalização?', a: 'Os itens possuem localização aproximada. Use o filtro de raio para encontrar itens próximos a você.' },
    { q: 'Como avalio um usuário?', a: 'Após concluir um negócio, você pode avaliar a contraparte com 1 a 5 estrelas e um comentário.' },
    { q: 'Posso denunciar um anúncio?', a: 'Sim, em cada anúncio há a opção de denunciar. Nossa equipe analisará.' }
];

function renderFAQ() {
    document.getElementById('faqList').innerHTML = FAQ_DATA.map(f => `
        <li class="faq-item">
            <strong>${esc(f.q)}</strong>
            <p>${esc(f.a)}</p>
        </li>
    `).join('');
}