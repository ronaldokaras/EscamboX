'use strict';

// Negociações, compra e troca
let ratingTradeId = null;
let ratingTargetUserId = null;
let ratingStars = 0;

/**
 * Envia proposta de compra de um item com moedas.
 * @param {number} itemId - ID do item
 */
function buyWithCoins(itemId) {
    if (!currentUser) {
        openAuth('login');
        return;
    }

    const item = getItem(itemId);
    if (!item || item.status !== 'available' || item.ownerId === currentUser.id) {
        showToast('Item não disponível para compra.', 'error');
        return;
    }
    if (item.price <= 0 || item.type === 'trade') {
        showToast('Item somente para troca.', 'warning');
        return;
    }
    if (currentUser.coins < item.price) {
        showToast('Saldo insuficiente.', 'error');
        return;
    }

    askConfirm('Propor compra', `Enviar proposta de compra de ${fmt(item.price)} moedas por "${item.title}"?`, () => {
        try {
            item.status = 'reserved';
            const trade = {
                id: nextId(),
                type: 'purchase',
                proposerId: currentUser.id,
                receiverId: item.ownerId,
                proposerItemId: null,
                receiverItemId: item.id,
                coins: item.price,
                status: 'pending',
                createdAt: Date.now(),
                completedAt: null,
                ratedByProposer: false,
                ratedByReceiver: false,
                snapshots: [{ itemId: item.id, ownerId: item.ownerId }],
                coinMoves: []
            };
            DB.trades.push(trade);
            notify(item.ownerId, `${currentUser.name} enviou proposta de compra para "${item.title}".`);
            save();
            closeModal('detailModal');
            renderAll();
            showToast('Proposta enviada.', 'info');
        } catch (error) {
            console.error('Erro ao propor compra:', error);
            showToast('Erro ao enviar proposta.', 'error');
        }
    });
}

/**
 * Envia proposta de troca de um item por outro.
 * @param {number} receiverItemId - ID do item desejado
 */
function submitTradeProposal(receiverItemId) {
    if (!currentUser) {
        openAuth('login');
        return;
    }

    const targetItem = getItem(receiverItemId);
    if (!targetItem || targetItem.ownerId === currentUser.id || targetItem.status !== 'available') {
        showToast('Item não disponível para troca.', 'error');
        return;
    }

    const myAvailable = DB.items.filter(i =>
        i.ownerId === currentUser.id &&
        i.status === 'available' &&
        i.acceptTrades
    );
    if (myAvailable.length === 0) {
        showToast('Você não tem itens disponíveis para troca.', 'warning');
        return;
    }

    // Monta lista numerada para o prompt
    const options = myAvailable.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n');
    const choice = prompt(`Selecione o item que deseja oferecer em troca:\n${options}`, '1');
    if (!choice) return;

    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= myAvailable.length) {
        showToast('Seleção inválida.', 'error');
        return;
    }

    const myItem = myAvailable[idx];
    askConfirm('Propor troca', `Deseja oferecer "${myItem.title}" em troca de "${targetItem.title}"?`, () => {
        try {
            const trade = {
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
            DB.trades.push(trade);
            myItem.status = 'reserved';
            targetItem.status = 'reserved';
            notify(targetItem.ownerId, `${currentUser.name} propôs troca: ${myItem.title} por ${targetItem.title}.`);
            save();
            closeModal('detailModal');
            renderAll();
            showToast('Proposta de troca enviada.', 'info');
        } catch (error) {
            console.error('Erro ao propor troca:', error);
            showToast('Erro ao enviar proposta de troca.', 'error');
        }
    });
}

/**
 * Aceita uma negociação pendente (compra ou troca).
 * @param {number} tradeId - ID da negociação
 */
function acceptTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t || t.status !== 'pending' || t.receiverId !== currentUser?.id) {
        showToast('Não foi possível aceitar a negociação.', 'error');
        return;
    }

    try {
        if (t.type === 'purchase') {
            const item = getItem(t.receiverItemId);
            const buyer = getUser(t.proposerId);
            if (!item || !buyer) {
                t.status = 'cancelled';
                save();
                renderAll();
                showToast('Item ou comprador não encontrado. Negociação cancelada.', 'error');
                return;
            }
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
            t.coinMoves = [
                { userId: buyer.id, delta: -t.coins },
                { userId: currentUser.id, delta: t.coins }
            ];
            t.status = 'completed';
            t.completedAt = Date.now();
            currentUser.stats.sales = (currentUser.stats.sales || 0) + 1;
            notify(buyer.id, `Compra de "${item.title}" confirmada!`);
            showToast('Venda concluída.', 'success');
        } else if (t.type === 'trade') {
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
            if (!proposer || !receiver) {
                t.status = 'cancelled';
                save();
                renderAll();
                showToast('Participantes não encontrados.', 'error');
                return;
            }

            // Transferência de propriedade: troca os donos
            proposerItem.ownerId = receiver.id; // vai para o receiver
            receiverItem.ownerId = proposer.id; // vai para o proposer

            // Se houver compensação em moedas (não usado atualmente, mas preparado)
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
                t.coinMoves = [
                    { userId: proposer.id, delta: -t.coins },
                    { userId: receiver.id, delta: t.coins }
                ];
            }

            proposerItem.status = 'sold';
            receiverItem.status = 'sold';
            t.status = 'completed';
            t.completedAt = Date.now();
            proposer.stats.barters = (proposer.stats.barters || 0) + 1;
            receiver.stats.barters = (receiver.stats.barters || 0) + 1;
            notify(proposer.id, `Troca de "${proposerItem.title}" por "${receiverItem.title}" confirmada!`);
            showToast('Troca concluída!', 'success');
        }
        save();
        afterLoginUI();
        renderAll();
    } catch (error) {
        console.error('Erro ao aceitar negociação:', error);
        showToast('Erro ao processar negociação.', 'error');
    }
}

/**
 * Rejeita ou cancela uma negociação pendente.
 * @param {number} tradeId - ID da negociação
 */
function rejectTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t || t.status !== 'pending') return;
    if (t.receiverId !== currentUser?.id && t.proposerId !== currentUser?.id) return;

    const wasReceiver = t.receiverId === currentUser.id;
    t.status = wasReceiver ? 'rejected' : 'cancelled';

    try {
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
    } catch (error) {
        console.error('Erro ao rejeitar negociação:', error);
        showToast('Erro ao processar ação.', 'error');
    }
}

/**
 * Abre o modal de avaliação para um negócio concluído.
 * @param {number} tradeId - ID da negociação
 * @param {number} targetUserId - ID do usuário a avaliar
 */
function openRatingModal(tradeId, targetUserId) {
    if (!currentUser) return;
    ratingTradeId = tradeId;
    ratingTargetUserId = targetUserId;
    const target = getUser(targetUserId);
    const rtTarget = document.getElementById('rtTarget');
    if (rtTarget) rtTarget.textContent = `Avaliar ${target ? target.name : 'contraparte'}`;
    const rtComment = document.getElementById('rtComment');
    if (rtComment) rtComment.value = '';

    const starRow = document.getElementById('starRow');
    if (!starRow) return;
    starRow.innerHTML = '';
    ratingStars = 0;
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.dataset.value = i;
        star.className = 'rating-star';
        star.setAttribute('role', 'button');
        star.setAttribute('aria-label', `${i} estrela${i > 1 ? 's' : ''}`);
        star.onclick = () => {
            ratingStars = i;
            starRow.querySelectorAll('.rating-star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= i);
            });
        };
        starRow.appendChild(star);
    }
    openModal('ratingModal');
}

/**
 * Envia a avaliação da contraparte.
 */
function submitRating() {
    const tradeId = ratingTradeId;
    const targetUserId = ratingTargetUserId;
    const stars = ratingStars || 0;
    const commentInput = document.getElementById('rtComment');
    const comment = commentInput ? commentInput.value.trim() : '';

    if (stars < 1) {
        setAlert('rtAlert', 'Selecione de 1 a 5 estrelas.');
        return;
    }
    const trade = DB.trades.find(t => t.id === tradeId);
    if (!trade) return;
    const target = getUser(targetUserId);
    if (!target) return;

    try {
        if (!Array.isArray(target.ratings)) target.ratings = [];
        target.ratings.push({ by: currentUser.id, stars, comment, ts: Date.now() });
        if (!target.stats) target.stats = {};
        target.stats.ratingsReceived = (target.stats.ratingsReceived || 0) + 1;
        if (trade.proposerId === currentUser.id) trade.ratedByProposer = true;
        else trade.ratedByReceiver = true;
        save();
        closeModal('ratingModal');
        showToast('Avaliação enviada!', 'success');
        renderTrades();
    } catch (error) {
        console.error('Erro ao enviar avaliação:', error);
        showToast('Erro ao enviar avaliação.', 'error');
    }
}

/**
 * Renderiza as listas de negociações do usuário.
 */
function renderTrades() {
    if (!currentUser) return;

    const mine = DB.trades.filter(t =>
        t.proposerId === currentUser.id || t.receiverId === currentUser.id
    );
    const incoming = mine.filter(t => t.status === 'pending' && t.receiverId === currentUser.id).reverse();
    const outgoing = mine.filter(t => t.status === 'pending' && t.proposerId === currentUser.id).reverse();
    const done = mine.filter(t => t.status !== 'pending').reverse();

    const renderRow = (t) => {
        const other = getUser(t.proposerId === currentUser.id ? t.receiverId : t.proposerId);
        const item = getItem(t.receiverItemId) || getItem(t.proposerItemId);
        const itemLabel = item ? ` – ${esc(item.title)}` : ' – Item removido';
        let btns = '';

        if (t.status === 'pending') {
            if (t.receiverId === currentUser.id) {
                btns = `<button type="button" class="btn" onclick="acceptTrade(${t.id})">Aceitar</button> 
                        <button type="button" class="btn btn-danger" onclick="rejectTrade(${t.id})">Recusar</button>`;
            } else {
                btns = `<button type="button" class="btn btn-danger" onclick="rejectTrade(${t.id})">Cancelar</button>`;
            }
        } else if (t.status === 'completed') {
            const canRate = (t.proposerId === currentUser.id && !t.ratedByProposer) ||
                            (t.receiverId === currentUser.id && !t.ratedByReceiver);
            if (canRate) {
                const otherId = t.proposerId === currentUser.id ? t.receiverId : t.proposerId;
                btns += `<button type="button" class="btn btn-secondary" onclick="openRatingModal(${t.id}, ${otherId})">Avaliar</button>`;
            }
        }

        const otherName = other ? esc(other.name) : '?';
        return `<li class="proposal-item">
            <strong>#${t.id}</strong> ${t.type === 'purchase' ? 'Compra' : 'Troca'} com ${otherName}${itemLabel}<br>
            <small>${t.status}</small>
            <div>${btns}</div>
        </li>`;
    };

    const incomingEl = document.getElementById('incomingTrades');
    const outgoingEl = document.getElementById('outgoingTrades');
    const doneEl = document.getElementById('doneTrades');
    if (incomingEl) incomingEl.innerHTML = incoming.map(renderRow).join('') || '<li>Nenhuma proposta recebida.</li>';
    if (outgoingEl) outgoingEl.innerHTML = outgoing.map(renderRow).join('') || '<li>Nenhuma proposta enviada.</li>';
    if (doneEl) doneEl.innerHTML = done.map(renderRow).join('') || '<li>Nenhum negócio concluído.</li>';
}