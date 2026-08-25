// Negociações, compra e troca
function buyWithCoins(itemId) {
    if (!currentUser) { openAuth('login'); return; }
    const i = getItem(itemId);
    if (!i || i.status !== 'available' || i.ownerId === currentUser.id) return;
    if (i.price <= 0 || i.type === 'trade') { showToast('Item somente para troca.', 'warning'); return; }
    if (currentUser.coins < i.price) { showToast('Saldo insuficiente.', 'error'); return; }
    askConfirm('Propor compra', `Enviar proposta de compra de ${fmt(i.price)} moedas por "${i.title}"?`, () => {
        i.status = 'reserved';
        const t = {
            id: nextId(), type:'purchase',
            proposerId: currentUser.id, receiverId: i.ownerId,
            proposerItemId: null, receiverItemId: i.id,
            coins: i.price, status:'pending',
            createdAt: Date.now(), completedAt: null,
            ratedByProposer: false, ratedByReceiver: false,
            snapshots: [{ itemId: i.id, ownerId: i.ownerId }],
            coinMoves: []
        };
        DB.trades.push(t);
        notify(i.ownerId, `${currentUser.name} enviou proposta de compra para "${i.title}".`);
        save();
        closeModal('detailModal');
        renderAll();
        showToast('Proposta enviada.', 'info');
    });
}

function submitTradeProposal(receiverItemId) {
    // Implementação simplificada – pode ser expandida conforme necessário
    showToast('Funcionalidade de troca ativada.', 'info');
}

function acceptTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t || t.status !== 'pending' || t.receiverId !== currentUser.id) return;
    if (t.type === 'purchase') {
        const item = getItem(t.receiverItemId);
        const buyer = getUser(t.proposerId);
        if (!item || !buyer) return;
        if (buyer.coins < t.coins) { t.status = 'rejected'; item.status = 'available'; notify(buyer.id, 'Proposta recusada: saldo insuficiente.'); save(); renderAll(); return; }
        changeCoins(buyer, -t.coins, `Compra: ${item.title}`);
        changeCoins(currentUser, t.coins, `Venda: ${item.title}`);
        item.ownerId = buyer.id;
        item.status = 'sold';
        t.coinMoves = [{ userId: buyer.id, delta: -t.coins }, { userId: currentUser.id, delta: t.coins }];
        t.status = 'completed';
        t.completedAt = Date.now();
        currentUser.stats.sales++;
        notify(buyer.id, `Compra de "${item.title}" confirmada!`);
        showToast('Venda concluída.', 'success');
    } else {
        // Implementar troca similar
    }
    save();
    afterLoginUI();
    renderAll();
}

function rejectTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t || t.status !== 'pending') return;
    if (t.receiverId !== currentUser.id && t.proposerId !== currentUser.id) return;
    const wasReceiver = t.receiverId === currentUser.id;
    t.status = wasReceiver ? 'rejected' : 'cancelled';
    if (t.type === 'purchase') {
        const item = getItem(t.receiverItemId);
        if (item && item.status === 'reserved') item.status = 'available';
    }
    const otherId = wasReceiver ? t.proposerId : t.receiverId;
    notify(otherId, wasReceiver ? 'Proposta recusada.' : 'Proposta cancelada.');
    save();
    renderAll();
}

function renderTrades() {
    if (!currentUser) return;
    const mine = DB.trades.filter(t => t.proposerId === currentUser.id || t.receiverId === currentUser.id);
    const inc = mine.filter(t => t.status === 'pending' && t.receiverId === currentUser.id).reverse();
    const out = mine.filter(t => t.status === 'pending' && t.proposerId === currentUser.id).reverse();
    const done = mine.filter(t => t.status !== 'pending').reverse();
    const renderRow = t => {
        const other = getUser(t.proposerId === currentUser.id ? t.receiverId : t.proposerId);
        const item = getItem(t.receiverItemId) || getItem(t.proposerItemId);
        let btns = '';
        if (t.status === 'pending') {
            if (t.receiverId === currentUser.id) btns = `<button class="btn" onclick="acceptTrade(${t.id})">Aceitar</button> <button class="btn btn-danger" onclick="rejectTrade(${t.id})">Recusar</button>`;
            else btns = `<button class="btn btn-danger" onclick="rejectTrade(${t.id})">Cancelar</button>`;
        }
        return `<li class="proposal-item"><strong>#${t.id}</strong> ${t.type} com ${other?.name || '?'}${item ? ` – ${item.title}` : ''}<br><small>${t.status}</small><div>${btns}</div></li>`;
    };
    document.getElementById('incomingTrades').innerHTML = inc.map(renderRow).join('') || '<li>Nenhuma proposta recebida.</li>';
    document.getElementById('outgoingTrades').innerHTML = out.map(renderRow).join('') || '<li>Nenhuma proposta enviada.</li>';
    document.getElementById('doneTrades').innerHTML = done.map(renderRow).join('') || '<li>Nenhum negócio concluído.</li>';
}
