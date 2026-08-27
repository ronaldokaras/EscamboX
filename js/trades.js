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
    if (!currentUser) { openAuth('login'); return; }
    const targetItem = getItem(receiverItemId);
    if (!targetItem || targetItem.ownerId === currentUser.id || targetItem.status !== 'available') return;
    const myAvailable = DB.items.filter(i => i.ownerId === currentUser.id && i.status === 'available' && i.acceptTrades);
    if (!myAvailable.length) {
        showToast('Você não tem itens disponíveis para troca.', 'warning');
        return;
    }
    const options = myAvailable.map((i, idx) => `${idx+1}. ${i.title}`).join('\n');
    const choice = prompt(`Selecione o item que deseja oferecer em troca:\n${options}`, '1');
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= myAvailable.length) return;
    const myItem = myAvailable[idx];
    askConfirm('Propor troca', `Deseja oferecer "${myItem.title}" em troca de "${targetItem.title}"?`, () => {
        const t = {
            id: nextId(),
            type: 'trade',
            proposerId: currentUser.id,
            receiverId: targetItem.ownerId,
            proposerItemId: myItem.id,
            receiverItemId: targetItem.id,
            coins: 0,
            status: 'pending',
            createdAt: Date.now(),
            completedAt: null,
            ratedByProposer: false,
            ratedByReceiver: false,
            snapshots: [
                { itemId: myItem.id, ownerId: currentUser.id },
                { itemId: targetItem.id, ownerId: targetItem.ownerId }
            ],
            coinMoves: []
        };
        DB.trades.push(t);
        myItem.status = 'reserved';
        targetItem.status = 'reserved';
        notify(targetItem.ownerId, `${currentUser.name} propôs troca: ${myItem.title} por ${targetItem.title}.`);
        save();
        closeModal('detailModal');
        renderAll();
        showToast('Proposta de troca enviada.', 'info');
    });
}

function acceptTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t || t.status !== 'pending' || t.receiverId !== currentUser.id) return;
    
    if (t.type === 'purchase') {
        const item = getItem(t.receiverItemId);
        const buyer = getUser(t.proposerId);
        if (!item || !buyer) return;
        if (buyer.coins < t.coins) {
            t.status = 'rejected';
            item.status = 'available';
            notify(buyer.id, 'Proposta recusada: saldo insuficiente.');
            save();
            renderAll();
            return;
        }
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
    } 
    else if (t.type === 'trade') {
        const proposerItem = getItem(t.proposerItemId);
        const receiverItem = getItem(t.receiverItemId);
        if (!proposerItem || !receiverItem) {
            t.status = 'cancelled';
            save();
            renderAll();
            showToast('Itens não encontrados, negociação cancelada.', 'error');
            return;
        }
        const proposer = getUser(t.proposerId);
        const receiver = currentUser;
        proposerItem.ownerId = proposer.id;
        receiverItem.ownerId = receiver.id;
        if (t.coins > 0) {
            if (proposer.coins < t.coins) {
                t.status = 'rejected';
                proposerItem.status = 'available';
                receiverItem.status = 'available';
                notify(proposer.id, 'Proposta recusada: saldo insuficiente.');
                save();
                renderAll();
                return;
            }
            changeCoins(proposer, -t.coins, `Troca: ${proposerItem.title} por ${receiverItem.title}`);
            changeCoins(receiver, t.coins, `Troca: ${proposerItem.title} por ${receiverItem.title}`);
        }
        proposerItem.status = 'sold';
        receiverItem.status = 'sold';
        t.status = 'completed';
        t.completedAt = Date.now();
        proposer.stats.barters++;
        receiver.stats.barters++;
        notify(proposer.id, `Troca de "${proposerItem.title}" por "${receiverItem.title}" confirmada!`);
        showToast('Troca concluída!', 'success');
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
    } else if (t.type === 'trade') {
        const myItem = getItem(wasReceiver ? t.receiverItemId : t.proposerItemId);
        const otherItem = getItem(wasReceiver ? t.proposerItemId : t.receiverItemId);
        if (myItem && myItem.status === 'reserved') myItem.status = 'available';
        if (otherItem && otherItem.status === 'reserved') otherItem.status = 'available';
    }
    const otherId = wasReceiver ? t.proposerId : t.receiverId;
    notify(otherId, wasReceiver ? 'Proposta recusada.' : 'Proposta cancelada.');
    save();
    renderAll();
}

function openRatingModal(tradeId, targetUserId) {
    if (!currentUser) return;
    window._ratingTradeId = tradeId;
    window._ratingTargetUserId = targetUserId;
    const target = getUser(targetUserId);
    document.getElementById('rtTarget').textContent = `Avaliar ${target ? target.name : 'contraparte'}`;
    document.getElementById('rtComment').value = '';
    const starRow = document.getElementById('starRow');
    starRow.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.dataset.value = i;
        star.className = 'rating-star';
        star.onclick = () => {
            window._ratingStars = i;
            starRow.querySelectorAll('.rating-star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= i);
            });
        };
        starRow.appendChild(star);
    }
    openModal('ratingModal');
}

function submitRating() {
    const tradeId = window._ratingTradeId;
    const targetUserId = window._ratingTargetUserId;
    const stars = window._ratingStars || 0;
    const comment = document.getElementById('rtComment').value.trim();
    if (stars < 1) {
        setAlert('rtAlert', 'Selecione de 1 a 5 estrelas.');
        return;
    }
    const trade = DB.trades.find(t => t.id === tradeId);
    if (!trade) return;
    const target = getUser(targetUserId);
    if (!target) return;
    target.ratings.push({ by: currentUser.id, stars, comment, ts: Date.now() });
    target.stats.ratingsReceived = (target.stats.ratingsReceived || 0) + 1;
    if (trade.proposerId === currentUser.id) trade.ratedByProposer = true;
    else trade.ratedByReceiver = true;
    save();
    closeModal('ratingModal');
    showToast('Avaliação enviada!', 'success');
    renderTrades();
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
        } else if (t.status === 'completed') {
            const canRate = (t.proposerId === currentUser.id && !t.ratedByProposer) || (t.receiverId === currentUser.id && !t.ratedByReceiver);
            if (canRate) {
                const otherId = t.proposerId === currentUser.id ? t.receiverId : t.proposerId;
                btns += ` <button class="btn btn-secondary" onclick="openRatingModal(${t.id}, ${otherId})">Avaliar</button>`;
            }
        }
        return `<li class="proposal-item"><strong>#${t.id}</strong> ${t.type} com ${other?.name || '?'}${item ? ` – ${item.title}` : ''}<br><small>${t.status}</small><div>${btns}</div></li>`;
    };
    document.getElementById('incomingTrades').innerHTML = inc.map(renderRow).join('') || '<li>Nenhuma proposta recebida.</li>';
    document.getElementById('outgoingTrades').innerHTML = out.map(renderRow).join('') || '<li>Nenhuma proposta enviada.</li>';
    document.getElementById('doneTrades').innerHTML = done.map(renderRow).join('') || '<li>Nenhum negócio concluído.</li>';
}