'use strict';

// Painel administrativo (root) – usuários, itens, negócios e denúncias
let adminRefreshInterval = null;

/**
 * Inicia o auto-refresh do painel admin (a cada 5 segundos)
 */
function startAdminAutoRefresh() {
    if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
    }
    adminRefreshInterval = setInterval(() => {
        const adminSection = document.getElementById('sec-admin');
        if (adminSection && !adminSection.classList.contains('hidden')) {
            renderAdmin();
        } else {
            stopAdminAutoRefresh();
        }
    }, 5000);
}

function stopAdminAutoRefresh() {
    if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
    }
}

/**
 * Renderiza o painel administrativo completo
 */
function renderAdmin() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Acesso negado.', 'error');
        return;
    }

    try {
        const availableItems = DB.items.filter(i => i.status === 'available').length;
        const pendingTrades = DB.trades.filter(t => t.status === 'pending').length;
        const completedTrades = DB.trades.filter(t => t.status === 'completed').length;

        const statsEl = document.getElementById('admStats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-card"><div class="stat-value">${DB.users.length}</div><div class="stat-label">Usuários</div></div>
                <div class="stat-card"><div class="stat-value">${DB.items.length}</div><div class="stat-label">Itens (${availableItems} disp.)</div></div>
                <div class="stat-card"><div class="stat-value">${DB.trades.length}</div><div class="stat-label">Negócios (${pendingTrades} pend.)</div></div>
                <div class="stat-card"><div class="stat-value">${completedTrades}</div><div class="stat-label">Escambos concluídos</div></div>
                <div class="stat-card"><div class="stat-value">${DB.denounces.length}</div><div class="stat-label">Denúncias</div></div>
            `;
        }

        renderAdminTrades();
        renderAdminUsers();
        renderAdminItems();
        renderAdminDenounces();

        if (!adminRefreshInterval) {
            startAdminAutoRefresh();
        }
    } catch (error) {
        console.error('Erro ao renderizar painel admin:', error);
        showToast('Erro ao carregar dados administrativos.', 'error');
    }
}

/**
 * Tabela de todos os negócios / escambos
 */
function renderAdminTrades() {
    const tbody = document.getElementById('admTradesTbody');
    if (!tbody) return;

    if (!DB.trades.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Nenhum negócio registrado.</td></tr>';
        return;
    }

    const statusLabel = {
        pending: 'Pendente',
        completed: 'Concluído',
        rejected: 'Recusado',
        cancelled: 'Cancelado',
        admin_cancelled: 'Estornado'
    };

    // Mais recentes primeiro
    const sorted = [...DB.trades].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    tbody.innerHTML = sorted.map(t => {
        const proposer = getUser(t.proposerId);
        const receiver = getUser(t.receiverId);
        const wanted = getItem(t.receiverItemId);
        const offered = t.proposerItemId ? getItem(t.proposerItemId) : null;

        let typeLabel = 'Troca';
        let detail = '';
        if (t.type === 'purchase' || (!t.proposerItemId && t.coins > 0)) {
            typeLabel = 'Moedas';
            detail = `🪙 ${fmt(t.coins)} → "${wanted ? esc(wanted.title) : '?'}"`;
        } else {
            detail = `"${offered ? esc(offered.title) : '?'}"`;
            if (t.coins > 0) detail += ` + 🪙 ${fmt(t.coins)}`;
            detail += ` ⇄ "${wanted ? esc(wanted.title) : '?'}"`;
        }

        const canCancel = t.status === 'pending' || t.status === 'completed';
        const actionButton = canCancel
            ? `<button class="btn btn-danger" type="button" onclick="adminCancelTrade(${t.id})">Estornar</button>`
            : '—';

        return `
            <tr>
                <td>#${t.id}</td>
                <td>${typeLabel}</td>
                <td>${esc(proposer?.name || '?')} → ${esc(receiver?.name || '?')}</td>
                <td>${detail}</td>
                <td>${statusLabel[t.status] || t.status}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Tabela de usuários – excluir, banir, desbanir, ajustar moedas
 */
function renderAdminUsers() {
    const tbody = document.getElementById('admUsersTbody');
    if (!tbody) return;

    tbody.innerHTML = DB.users.map(u => {
        const roleLabel = { user: 'Usuário', admin: 'Admin', banned: 'Banido' }[u.role] || u.role;
        const itemCount = DB.items.filter(i => i.ownerId === u.id).length;
        const loc = u.location ? esc(u.location) : '—';

        let actionButtons = '';
        if (u.role !== 'admin') {
            actionButtons += `<button class="btn btn-danger" type="button" onclick="adminDeleteUser(${u.id})">Excluir</button> `;
            actionButtons += `<button class="btn btn-secondary" type="button" onclick="adminAdjustCoins(${u.id})">Moedas</button> `;
        }
        if (u.role === 'user') {
            actionButtons += `<button class="btn btn-warning" type="button" onclick="adminBanUser(${u.id})">Banir</button>`;
        } else if (u.role === 'banned') {
            actionButtons += `<button class="btn btn-secondary" type="button" onclick="adminUnbanUser(${u.id})">Desbanir</button>`;
        }

        return `
            <tr>
                <td>${u.id}</td>
                <td>${esc(u.name)}</td>
                <td>${esc(u.email)}<br><small class="text-muted">${loc}</small></td>
                <td>🪙 ${fmt(u.coins)}</td>
                <td>${itemCount}</td>
                <td>${roleLabel}</td>
                <td>${actionButtons || '—'}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Tabela de todos os anúncios – remover qualquer publicação
 */
function renderAdminItems() {
    const tbody = document.getElementById('admItemsTbody');
    if (!tbody) return;

    if (!DB.items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Nenhum anúncio.</td></tr>';
        return;
    }

    const statusLabel = {
        available: 'Disponível',
        reserved: 'Reservado',
        sold: 'Concluído',
        unavailable: 'Indisponível'
    };

    const sorted = [...DB.items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    tbody.innerHTML = sorted.map(i => {
        const owner = getUser(i.ownerId);
        const typeLabel = (i.price > 0 && i.type !== 'trade')
            ? (i.acceptTrades ? 'Moedas/Troca' : 'Moedas')
            : 'Troca';
        const price = i.price > 0 ? `🪙 ${fmt(i.price)}` : '—';

        return `
            <tr>
                <td>#${i.id}</td>
                <td>${esc(i.title)}</td>
                <td>${owner ? esc(owner.name) : '?'}</td>
                <td>${typeLabel}</td>
                <td>${price}</td>
                <td>${statusLabel[i.status] || i.status}</td>
                <td>
                    <button class="btn btn-danger" type="button" onclick="adminRemoveItem(${i.id})">Excluir</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Tabela de denúncias
 */
function renderAdminDenounces() {
    const tbody = document.getElementById('admDenouncesTbody');
    if (!tbody) return;

    if (!DB.denounces.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Nenhuma denúncia.</td></tr>';
        return;
    }

    tbody.innerHTML = DB.denounces.map(d => {
        const item = getItem(d.itemId);
        const reporter = getUser(d.reporterId);

        const removeButton = item
            ? `<button class="btn btn-danger" type="button" onclick="adminRemoveItem(${d.itemId})">Remover item</button>`
            : '';

        return `
            <tr>
                <td>#${d.id}</td>
                <td>${item ? esc(item.title) : 'Item removido'}</td>
                <td>${reporter ? esc(reporter.name) : 'Usuário removido'}</td>
                <td>${esc(d.reason)}${d.comment ? `<br><small class="text-muted">${esc(d.comment)}</small>` : ''}</td>
                <td>${typeof fmtDate === 'function' ? fmtDate(d.createdAt) : new Date(d.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>
                    ${removeButton}
                    <button class="btn btn-secondary" type="button" onclick="adminIgnoreDenounce(${d.id})">Ignorar</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Estorna negócio (devolve moedas e itens)
 */
function adminCancelTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t) {
        showToast('Negócio não encontrado.', 'error');
        return;
    }
    if (t.status === 'admin_cancelled' || t.status === 'cancelled') {
        showToast('Este negócio já foi cancelado.', 'warning');
        return;
    }

    askConfirm('Estornar negócio', 'Deseja estornar? Itens e moedas serão devolvidos aos donos originais.', () => {
        try {
            if (t.coinMoves && t.coinMoves.length) {
                t.coinMoves.forEach(move => {
                    const user = getUser(move.userId);
                    if (user) {
                        changeCoins(user, -move.delta, `Estorno de negócio #${t.id}`);
                    }
                });
            }

            if (t.snapshots && t.snapshots.length) {
                t.snapshots.forEach(snap => {
                    const item = getItem(snap.itemId);
                    if (item) {
                        item.ownerId = snap.ownerId;
                        item.status = 'available';
                    }
                });
            } else {
                // Fallback se não houver snapshot
                if (t.proposerItemId) {
                    const pi = getItem(t.proposerItemId);
                    if (pi) { pi.ownerId = t.proposerId; pi.status = 'available'; }
                }
                if (t.receiverItemId) {
                    const ri = getItem(t.receiverItemId);
                    if (ri) { ri.ownerId = t.receiverId; ri.status = 'available'; }
                }
            }

            t.status = 'admin_cancelled';
            save();
            renderAdmin();
            renderAll();
            showToast('Negócio estornado.', 'warning');
        } catch (error) {
            console.error('Erro ao estornar negócio:', error);
            showToast('Erro ao estornar negócio.', 'error');
        }
    });
}

/**
 * Ajusta saldo de moedas de um usuário (root)
 */
function adminAdjustCoins(userId) {
    const u = getUser(userId);
    if (!u || u.role === 'admin') {
        showToast('Não é possível alterar este usuário.', 'error');
        return;
    }
    const input = prompt(`Saldo atual de ${u.name}: ${u.coins} moedas.\nInforme o NOVO saldo:`, String(u.coins));
    if (input === null) return;
    const newBalance = parseInt(input, 10);
    if (isNaN(newBalance) || newBalance < 0) {
        showToast('Valor inválido.', 'error');
        return;
    }
    const delta = newBalance - u.coins;
    changeCoins(u, delta, `Ajuste administrativo`);
    save();
    renderAdmin();
    showToast(`Saldo de ${u.name} atualizado para ${fmt(newBalance)} moedas.`, 'success');
}

/**
 * Exclui usuário e dados associados
 */
function adminDeleteUser(userId) {
    const u = getUser(userId);
    if (!u || u.role === 'admin') {
        showToast('Não é possível excluir este usuário.', 'error');
        return;
    }

    askConfirm('Excluir usuário', `Excluir ${u.name}? Todos os dados relacionados serão removidos.`, () => {
        try {
            DB.items = DB.items.filter(i => i.ownerId !== userId);
            DB.trades = DB.trades.filter(t => t.proposerId !== userId && t.receiverId !== userId);
            if (DB.chats) DB.chats = DB.chats.filter(c => !(c.participants || []).includes(userId));
            DB.denounces = DB.denounces.filter(d => d.reporterId !== userId);
            if (DB.ledger) DB.ledger = DB.ledger.filter(l => l.userId !== userId);

            // Remove avaliações feitas por/para este usuário
            DB.users.forEach(usr => {
                if (Array.isArray(usr.ratings)) {
                    usr.ratings = usr.ratings.filter(r => r.by !== userId);
                }
                if (Array.isArray(usr.favs)) {
                    // favs são IDs de itens; limpeza de itens já removeu os dele
                }
            });

            DB.users = DB.users.filter(x => x.id !== userId);

            save();
            renderAdmin();
            renderAll();
            showToast('Usuário e dados associados excluídos.', 'warning');
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            showToast('Erro ao excluir usuário.', 'error');
        }
    });
}

/**
 * Bane usuário
 */
function adminBanUser(userId) {
    const u = getUser(userId);
    if (!u || u.role === 'admin' || u.role === 'banned') {
        showToast('Não é possível banir este usuário.', 'error');
        return;
    }

    askConfirm('Banir usuário', `Banir ${u.name}? Ele não poderá mais fazer login.`, () => {
        try {
            u.role = 'banned';
            DB.items.filter(i => i.ownerId === userId).forEach(i => {
                if (i.status === 'available') i.status = 'unavailable';
            });
            DB.trades
                .filter(t => (t.proposerId === userId || t.receiverId === userId) && t.status === 'pending')
                .forEach(t => {
                    t.status = 'cancelled';
                    if (t.proposerItemId) {
                        const pi = getItem(t.proposerItemId);
                        if (pi && pi.status === 'reserved') pi.status = 'available';
                    }
                    if (t.receiverItemId) {
                        const ri = getItem(t.receiverItemId);
                        if (ri && ri.status === 'reserved') ri.status = 'available';
                    }
                });
            save();
            renderAdmin();
            renderAll();
            showToast('Usuário banido.', 'warning');
        } catch (error) {
            console.error('Erro ao banir usuário:', error);
            showToast('Erro ao banir usuário.', 'error');
        }
    });
}

/**
 * Desbane usuário
 */
function adminUnbanUser(userId) {
    const u = getUser(userId);
    if (!u || u.role !== 'banned') {
        showToast('Usuário não está banido.', 'error');
        return;
    }

    askConfirm('Desbanir usuário', `Permitir que ${u.name} volte a usar a plataforma?`, () => {
        try {
            u.role = 'user';
            DB.items
                .filter(i => i.ownerId === userId && i.status === 'unavailable')
                .forEach(i => { i.status = 'available'; });
            save();
            renderAdmin();
            renderAll();
            showToast('Usuário desbanido.', 'success');
        } catch (error) {
            console.error('Erro ao desbanir usuário:', error);
            showToast('Erro ao desbanir usuário.', 'error');
        }
    });
}

/**
 * Remove anúncio e cancela negociações pendentes
 */
function adminRemoveItem(itemId) {
    const item = getItem(itemId);
    if (!item) {
        showToast('Item não encontrado.', 'error');
        return;
    }

    askConfirm('Remover item', `Remover "${item.title}"? Negociações pendentes serão canceladas.`, () => {
        try {
            DB.trades
                .filter(t => (t.receiverItemId === itemId || t.proposerItemId === itemId) && t.status === 'pending')
                .forEach(t => {
                    t.status = 'cancelled';
                    if (t.proposerItemId && t.proposerItemId !== itemId) {
                        const other = getItem(t.proposerItemId);
                        if (other && other.status === 'reserved') other.status = 'available';
                    }
                    if (t.receiverItemId && t.receiverItemId !== itemId) {
                        const other = getItem(t.receiverItemId);
                        if (other && other.status === 'reserved') other.status = 'available';
                    }
                });

            DB.items = DB.items.filter(i => i.id !== itemId);
            DB.denounces = DB.denounces.filter(d => d.itemId !== itemId);

            // Remove dos favoritos dos usuários
            DB.users.forEach(u => {
                if (Array.isArray(u.favs)) {
                    u.favs = u.favs.filter(fid => fid !== itemId);
                }
            });

            save();
            renderAdmin();
            renderAll();
            showToast('Item removido e negociações canceladas.', 'warning');
        } catch (error) {
            console.error('Erro ao remover item:', error);
            showToast('Erro ao remover item.', 'error');
        }
    });
}

/**
 * Ignora denúncia
 */
function adminIgnoreDenounce(denounceId) {
    const d = DB.denounces.find(x => x.id === denounceId);
    if (!d) {
        showToast('Denúncia não encontrada.', 'error');
        return;
    }

    askConfirm('Ignorar denúncia', 'Marcar esta denúncia como analisada e removê-la da lista?', () => {
        try {
            DB.denounces = DB.denounces.filter(x => x.id !== denounceId);
            save();
            renderAdmin();
            showToast('Denúncia ignorada.', 'info');
        } catch (error) {
            console.error('Erro ao ignorar denúncia:', error);
            showToast('Erro ao ignorar denúncia.', 'error');
        }
    });
}

window.addEventListener('beforeunload', function () {
    stopAdminAutoRefresh();
});