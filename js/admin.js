// Painel administrativo
function renderAdmin() {
    if (!isAdmin()) return;
    document.getElementById('admStats').innerHTML = `
        <div class="stat-card"><div class="stat-value">${DB.users.length}</div><div class="stat-label">Usuários</div></div>
        <div class="stat-card"><div class="stat-value">${DB.items.length}</div><div class="stat-label">Itens</div></div>
        <div class="stat-card"><div class="stat-value">${DB.trades.length}</div><div class="stat-label">Negócios</div></div>
    `;
    document.getElementById('admTradesTbody').innerHTML = DB.trades.map(t => `<tr><td>#${t.id}</td><td>${t.type}</td><td>${t.proposerId} → ${t.receiverId}</td><td>${t.status}</td><td>${t.status === 'pending' || t.status === 'completed' ? `<button class="btn btn-danger" onclick="adminCancelTrade(${t.id})">Estornar</button>` : ''}</td></tr>`).join('');
    document.getElementById('admUsersTbody').innerHTML = DB.users.map(u => `<tr><td>${u.id}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.coins}</td><td>${DB.items.filter(i => i.ownerId === u.id).length}</td><td>${u.role}</td><td>${u.role !== 'admin' ? `<button class="btn btn-danger" onclick="adminDeleteUser(${u.id})">Excluir</button>` : ''}</td></tr>`).join('');
    document.getElementById('admDenouncesTbody').innerHTML = DB.denounces.map(d => `<tr><td>#${d.id}</td><td>${d.itemId}</td><td>${d.reporterId}</td><td>${d.reason}</td><td>${fmtDate(d.createdAt)}</td><td><button class="btn btn-danger" onclick="adminRemoveItem(${d.itemId})">Remover item</button></td></tr>`).join('');
}

function adminCancelTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t) return;
    askConfirm('Estornar negócio', 'Deseja estornar este negócio e devolver itens/moedas?', () => {
        t.status = 'admin_cancelled';
        save();
        renderAdmin();
        showToast('Negócio estornado.', 'warning');
    });
}

function adminDeleteUser(userId) {
    const u = getUser(userId);
    if (!u || u.role === 'admin') return;
    askConfirm('Excluir usuário', `Excluir ${u.name}?`, () => {
        DB.users = DB.users.filter(x => x.id !== userId);
        DB.items = DB.items.filter(i => i.ownerId !== userId);
        save();
        renderAdmin();
        showToast('Usuário excluído.', 'warning');
    });
}

function adminRemoveItem(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    askConfirm('Remover item', `Remover "${item.title}"?`, () => {
        DB.items = DB.items.filter(i => i.id !== itemId);
        save();
        renderAdmin();
        showToast('Item removido.', 'warning');
    });
}
