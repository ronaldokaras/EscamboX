// Painel administrativo

/**
 * Renderiza o painel administrativo.
 * Só executa se o usuário logado for admin e não estiver banido.
 */
function renderAdmin() {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin' || currentUser.role === 'banned') {
        showToast('Acesso negado.', 'error');
        return;
    }

    try {
        // Estatísticas gerais
        document.getElementById('admStats').innerHTML = `
            <div class="stat-card"><div class="stat-value">${DB.users.length}</div><div class="stat-label">Usuários</div></div>
            <div class="stat-card"><div class="stat-value">${DB.items.length}</div><div class="stat-label">Itens</div></div>
            <div class="stat-card"><div class="stat-value">${DB.trades.length}</div><div class="stat-label">Negócios</div></div>
            <div class="stat-card"><div class="stat-value">${DB.denounces.length}</div><div class="stat-label">Denúncias</div></div>
        `;

        renderAdminTrades();
        renderAdminUsers();
        renderAdminDenounces();
    } catch (error) {
        console.error('Erro ao renderizar painel admin:', error);
        showToast('Erro ao carregar dados administrativos.', 'error');
    }
}

/**
 * Renderiza a tabela de negócios no admin.
 */
function renderAdminTrades() {
    const tbody = document.getElementById('admTradesTbody');
    if (!tbody) return;

    tbody.innerHTML = DB.trades.map(t => {
        const proposer = getUser(t.proposerId);
        const receiver = getUser(t.receiverId);
        const item = getItem(t.receiverItemId) || getItem(t.proposerItemId);
        const statusLabel = {
            pending: 'Pendente',
            completed: 'Concluído',
            rejected: 'Recusado',
            cancelled: 'Cancelado',
            admin_cancelled: 'Estornado'
        }[t.status] || t.status;

        // Botão de estorno só para negócios pendentes ou concluídos
        const canCancel = (t.status === 'pending' || t.status === 'completed');
        const actionButton = canCancel
            ? `<button class="btn btn-danger" onclick="adminCancelTrade(${t.id})" data-action="cancel-trade">Estornar</button>`
            : '';

        return `
            <tr>
                <td>#${t.id}</td>
                <td>${t.type === 'purchase' ? 'Compra' : 'Troca'}</td>
                <td>${esc(proposer?.name || '?')} → ${esc(receiver?.name || '?')}</td>
                <td>${esc(item?.title || 'Item removido')}</td>
                <td>${statusLabel}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Renderiza a tabela de usuários no admin.
 */
function renderAdminUsers() {
    const tbody = document.getElementById('admUsersTbody');
    if (!tbody) return;

    tbody.innerHTML = DB.users.map(u => {
        const roleLabel = { user: 'Usuário', admin: 'Admin', banned: 'Banido' }[u.role] || u.role;
        const itemCount = DB.items.filter(i => i.ownerId === u.id).length;

        // Ações possíveis
        let actionButtons = '';
        if (u.role !== 'admin') {
            actionButtons += `<button class="btn btn-danger" onclick="adminDeleteUser(${u.id})" data-action="delete-user">Excluir</button> `;
        }
        if (u.role === 'user') {
            actionButtons += `<button class="btn btn-warning" onclick="adminBanUser(${u.id})" data-action="ban-user">Banir</button>`;
        } else if (u.role === 'banned') {
            actionButtons += `<button class="btn btn-secondary" onclick="adminUnbanUser(${u.id})" data-action="unban-user">Desbanir</button>`;
        }

        return `
            <tr>
                <td>${u.id}</td>
                <td>${esc(u.name)}</td>
                <td>${esc(u.email)}</td>
                <td>${fmt(u.coins)}</td>
                <td>${itemCount}</td>
                <td>${roleLabel}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Renderiza a tabela de denúncias no admin.
 */
function renderAdminDenounces() {
    const tbody = document.getElementById('admDenouncesTbody');
    if (!tbody) return;

    tbody.innerHTML = DB.denounces.map(d => {
        const item = getItem(d.itemId);
        const reporter = getUser(d.reporterId);

        const removeButton = item
            ? `<button class="btn btn-danger" onclick="adminRemoveItem(${d.itemId})" data-action="remove-item">Remover item</button>`
            : '';

        return `
            <tr>
                <td>#${d.id}</td>
                <td>${item ? esc(item.title) : 'Item removido'}</td>
                <td>${reporter ? esc(reporter.name) : 'Usuário removido'}</td>
                <td>${esc(d.reason)}</td>
                <td>${fmtDate(d.createdAt)}</td>
                <td>
                    ${removeButton}
                    <button class="btn btn-secondary" onclick="adminIgnoreDenounce(${d.id})" data-action="ignore-denounce">Ignorar</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Estorna um negócio, devolvendo moedas e itens.
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

    askConfirm('Estornar negócio', 'Deseja realmente estornar este negócio? Itens e moedas serão devolvidos.', () => {
        try {
            // Reverter moedas (se houver)
            if (t.coinMoves && t.coinMoves.length) {
                t.coinMoves.forEach(move => {
                    const user = getUser(move.userId);
                    if (user) {
                        // Inverte o delta: se foi +X, agora -X; se foi -X, agora +X
                        changeCoins(user, -move.delta, `Estorno de negócio #${t.id}`);
                    }
                });
            }

            // Devolver itens aos donos originais (snapshots)
            if (t.snapshots && t.snapshots.length) {
                t.snapshots.forEach(snap => {
                    const item = getItem(snap.itemId);
                    if (item) {
                        item.ownerId = snap.ownerId;
                        item.status = 'available';
                    }
                });
            }

            t.status = 'admin_cancelled';
            save();
            renderAdmin();
            renderAll();
            showToast('Negócio estornado com sucesso.', 'warning');
        } catch (error) {
            console.error('Erro ao estornar negócio:', error);
            showToast('Erro ao estornar negócio.', 'error');
        }
    });
}

/**
 * Exclui um usuário e todos os dados associados.
 */
function adminDeleteUser(userId) {
    const u = getUser(userId);
    if (!u || u.role === 'admin') {
        showToast('Não é possível excluir este usuário.', 'error');
        return;
    }

    askConfirm('Excluir usuário', `Excluir ${u.name}? Todos os dados relacionados serão removidos.`, () => {
        try {
            // Remover itens do usuário
            DB.items = DB.items.filter(i => i.ownerId !== userId);

            // Remover negociações do usuário
            DB.trades = DB.trades.filter(t => t.proposerId !== userId && t.receiverId !== userId);

            // Remover mensagens de chat envolvendo o usuário
            DB.chats = DB.chats.filter(c => !c.participants.includes(userId));

            // Remover denúncias feitas pelo usuário
            DB.denounces = DB.denounces.filter(d => d.reporterId !== userId);

            // Remover entradas do ledger
            DB.ledger = DB.ledger.filter(l => l.userId !== userId);

            // Remover favoritos que referenciam este usuário (se houver)
            if (DB.favorites) {
                DB.favorites = DB.favorites.filter(f => f.userId !== userId);
            }

            // Remover avaliações feitas ou recebidas pelo usuário (se existirem)
            if (DB.reviews) {
                DB.reviews = DB.reviews.filter(r => r.fromUserId !== userId && r.toUserId !== userId);
            }

            // Remover usuário
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
 * Bane um usuário, impedindo login e ocultando seus itens.
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

            // Ocultar itens do usuário
            DB.items.filter(i => i.ownerId === userId).forEach(i => i.status = 'unavailable');

            // Cancelar negociações pendentes envolvendo o usuário
            DB.trades.filter(t => (t.proposerId === userId || t.receiverId === userId) && t.status === 'pending')
                .forEach(t => {
                    t.status = 'cancelled';
                    // Liberar itens reservados
                    if (t.type === 'trade') {
                        const otherItemId = t.proposerId === userId ? t.receiverItemId : t.proposerItemId;
                        const otherItem = getItem(otherItemId);
                        if (otherItem && otherItem.status === 'reserved') {
                            otherItem.status = 'available';
                        }
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
 * Desbane um usuário, restaurando seu acesso e itens.
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

            // Reativar itens do usuário que estavam indisponíveis por banimento
            DB.items.filter(i => i.ownerId === userId && i.status === 'unavailable')
                .forEach(i => i.status = 'available');

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
 * Remove um item e cancela negociações pendentes relacionadas.
 */
function adminRemoveItem(itemId) {
    const item = getItem(itemId);
    if (!item) {
        showToast('Item não encontrado.', 'error');
        return;
    }

    askConfirm('Remover item', `Remover "${item.title}"? Negociações pendentes serão canceladas.`, () => {
        try {
            // Cancelar negociações pendentes envolvendo este item
            DB.trades.filter(t => (t.receiverItemId === itemId || t.proposerItemId === itemId) && t.status === 'pending')
                .forEach(t => {
                    t.status = 'cancelled';
                    // Liberar o outro item se for troca
                    if (t.type === 'trade') {
                        const otherItemId = t.receiverItemId === itemId ? t.proposerItemId : t.receiverItemId;
                        const otherItem = getItem(otherItemId);
                        if (otherItem && otherItem.status === 'reserved') {
                            otherItem.status = 'available';
                        }
                    }
                });

            // Remover item
            DB.items = DB.items.filter(i => i.id !== itemId);

            // Remover denúncias associadas
            DB.denounces = DB.denounces.filter(d => d.itemId !== itemId);

            // Remover favoritos associados ao item (se houver)
            if (DB.favorites) {
                DB.favorites = DB.favorites.filter(f => f.itemId !== itemId);
            }

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
 * Ignora uma denúncia, removendo-a da lista.
 */
function adminIgnoreDenounce(denounceId) {
    const d = DB.denounces.find(x => x.id === denounceId);
    if (!d) {
        showToast('Denúncia não encontrada.', 'error');
        return;
    }

    askConfirm('Ignorar denúncia', 'Deseja marcar esta denúncia como analisada e removê-la da lista?', () => {
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