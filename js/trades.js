'use strict';

// Negociações, compra e troca (escambo com moedas virtuais)
let ratingTradeId = null;
let ratingTargetUserId = null;
let ratingStars = 0;
let tradeTargetItemId = null; // item que o usuário quer receber

/**
 * Compra com moedas virtuais (proposta)
 */
function buyWithCoins(itemId) {
    if (!currentUser) {
        openAuth('login');
        return;
    }

    const item = getItem(itemId);
    if (!item || item.status !== 'available' || item.ownerId === currentUser.id) {
        showToast('Item não disponível para aquisição.', 'error');
        return;
    }
    if (item.price <= 0 || item.type === 'trade') {
        showToast('Este item é somente para troca de item.', 'warning');
        return;
    }
    if (currentUser.coins < item.price) {
        showToast('Saldo insuficiente de moedas.', 'error');
        return;
    }

    askConfirm(
        'Propor aquisição',
        `Enviar proposta de ${fmt(item.price)} moedas por "${item.title}"?`,
        () => {
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
                    message: '',
                    status: 'pending',
                    createdAt: Date.now(),
                    completedAt: null,
                    ratedByProposer: false,
                    ratedByReceiver: false,
                    snapshots: [{ itemId: item.id, ownerId: item.ownerId }],
                    coinMoves: []
                };
                DB.trades.push(trade);
                notify(item.ownerId, `${currentUser.name} enviou proposta de ${fmt(item.price)} moedas por "${item.title}".`);
                save();
                closeModal('detailModal');
                renderAll();
                showToast('Proposta enviada.', 'info');
            } catch (error) {
                console.error('Erro ao propor compra:', error);
                showToast('Erro ao enviar proposta.', 'error');
            }
        }
    );
}

/**
 * Abre o modal de proposta de troca (escolher item próprio + moedas opcionais)
 * Chamado pelos cards e pelo detalhe do item.
 */
function openTradeProposal(receiverItemId) {
    if (!currentUser) {
        openAuth('login');
        return;
    }

    const targetItem = getItem(receiverItemId);
    if (!targetItem || targetItem.ownerId === currentUser.id || targetItem.status !== 'available') {
        showToast('Item não disponível para troca.', 'error');
        return;
    }
    if (!targetItem.acceptTrades) {
        showToast('Este item não aceita troca de item.', 'warning');
        return;
    }

    tradeTargetItemId = receiverItemId;

    const info = document.getElementById('tradeTargetInfo');
    if (info) {
        info.innerHTML = `Você está propondo troca pelo item: <strong>${esc(targetItem.title)}</strong>`;
    }

    const myAvailable = DB.items.filter(i =>
        i.ownerId === currentUser.id &&
        i.status === 'available' &&
        i.id !== receiverItemId
    );

    const select = document.getElementById('tradeOfferItem');
    if (select) {
        if (myAvailable.length === 0) {
            select.innerHTML = '<option value="">Você não tem itens disponíveis para oferecer</option>';
        } else {
            select.innerHTML =
                '<option value="">— Selecione um item seu (opcional se for só moedas) —</option>' +
                myAvailable.map(i =>
                    `<option value="${i.id}">${esc(i.title)}${i.price > 0 ? ` · 🪙 ${fmt(i.price)}` : ''}</option>`
                ).join('');
        }
    }

    const coinsInput = document.getElementById('tradeOfferCoins');
    if (coinsInput) coinsInput.value = 0;
    const msgInput = document.getElementById('tradeOfferMsg');
    if (msgInput) msgInput.value = '';

    openModal('tradeProposalModal');
}

/**
 * Envia a proposta de troca a partir do modal
 * (item ofertado e/ou moedas + mensagem)
 */
function submitTradeProposal() {
    if (!currentUser || !tradeTargetItemId) {
        // fallback antigo: se chamado com ID direto (compatibilidade)
        if (arguments.length === 1 && typeof arguments[0] === 'number') {
            openTradeProposal(arguments[0]);
            return;
        }
        showToast('Selecione o item desejado novamente.', 'warning');
        return;
    }

    const targetItem = getItem(tradeTargetItemId);
    if (!targetItem || targetItem.status !== 'available') {
        showToast('Item alvo indisponível.', 'error');
        closeModal('tradeProposalModal');
        return;
    }

    const offerItemIdRaw = document.getElementById('tradeOfferItem')?.value;
    const offerItemId = offerItemIdRaw ? parseInt(offerItemIdRaw, 10) : null;
    const offerCoins = parseInt(document.getElementById('tradeOfferCoins')?.value, 10) || 0;
    const message = (document.getElementById('tradeOfferMsg')?.value || '').trim();

    if (!offerItemId && offerCoins <= 0) {
        showToast('Escolha um item seu e/ou informe quantas moedas ofertar.', 'warning');
        return;
    }

    let myItem = null;
    if (offerItemId) {
        myItem = getItem(offerItemId);
        if (!myItem || myItem.ownerId !== currentUser.id || myItem.status !== 'available') {
            showToast('Item ofertado inválido.', 'error');
            return;
        }
    }

    if (offerCoins > 0 && currentUser.coins < offerCoins) {
        showToast(`Saldo insuficiente. Você tem ${fmt(currentUser.coins)} moedas.`, 'error');
        return;
    }

    // Evita proposta duplicada pendente para o mesmo item
    const already = DB.trades.some(t =>
        t.status === 'pending' &&
        t.proposerId === currentUser.id &&
        t.receiverItemId === tradeTargetItemId
    );
    if (already) {
        showToast('Você já tem uma proposta pendente para este item.', 'warning');
        closeModal('tradeProposalModal');
        return;
    }

    askConfirm(
        'Confirmar oferta',
        offerItemId
            ? `Oferecer "${myItem.title}"${offerCoins > 0 ? ` + ${fmt(offerCoins)} moedas` : ''} por "${targetItem.title}"?`
            : `Oferecer ${fmt(offerCoins)} moedas por "${targetItem.title}"?`,
        () => {
            try {
                // Modificar proposta existente (sem criar nova)
                if (window._editingTradeId) {
                    const existing = DB.trades.find(x => x.id === window._editingTradeId && x.status === 'pending');
                    if (existing && existing.proposerId === currentUser.id) {
                        // Liberar item antigo se mudou
                        if (existing.proposerItemId && existing.proposerItemId !== offerItemId) {
                            const oldItem = getItem(existing.proposerItemId);
                            if (oldItem && oldItem.status === 'reserved') oldItem.status = 'available';
                        }
                        if (offerItemId) {
                            const ni = getItem(offerItemId);
                            if (ni) ni.status = 'reserved';
                        }
                        existing.proposerItemId = offerItemId || null;
                        existing.coins = offerCoins;
                        existing.message = message;
                        existing.type = offerItemId ? 'trade' : 'purchase';
                        existing.updatedAt = Date.now();
                        existing.snapshots = [];
                        if (offerItemId) existing.snapshots.push({ itemId: offerItemId, ownerId: currentUser.id });
                        existing.snapshots.push({ itemId: targetItem.id, ownerId: targetItem.ownerId });

                        notify(targetItem.ownerId, `${currentUser.name} atualizou a proposta por "${targetItem.title}".`);
                        window._editingTradeId = null;
                        save();
                        closeModal('tradeProposalModal');
                        if (typeof renderChatContext === 'function') renderChatContext();
                        if (typeof renderTrades === 'function') renderTrades();
                        renderAll();
                        showToast('Oferta atualizada.', 'success');
                        return;
                    }
                    window._editingTradeId = null;
                }

                const trade = {
                    id: nextId(),
                    type: offerItemId ? 'trade' : 'purchase',
                    proposerId: currentUser.id,
                    receiverId: targetItem.ownerId,
                    proposerItemId: offerItemId || null,
                    receiverItemId: targetItem.id,
                    coins: offerCoins,
                    message: message,
                    status: 'pending',
                    createdAt: Date.now(),
                    completedAt: null,
                    ratedByProposer: false,
                    ratedByReceiver: false,
                    snapshots: [],
                    coinMoves: []
                };

                if (myItem) {
                    trade.snapshots.push({ itemId: myItem.id, ownerId: currentUser.id });
                    myItem.status = 'reserved';
                }
                trade.snapshots.push({ itemId: targetItem.id, ownerId: targetItem.ownerId });
                targetItem.status = 'reserved';

                DB.trades.push(trade);

                let notifText = `${currentUser.name} propôs `;
                if (myItem && offerCoins > 0) {
                    notifText += `troca: "${myItem.title}" + ${fmt(offerCoins)} moedas por "${targetItem.title}".`;
                } else if (myItem) {
                    notifText += `troca: "${myItem.title}" por "${targetItem.title}".`;
                } else {
                    notifText += `${fmt(offerCoins)} moedas por "${targetItem.title}".`;
                }
                if (message) notifText += ` Msg: "${message}"`;
                notify(targetItem.ownerId, notifText);

                save();
                closeModal('tradeProposalModal');
                closeModal('detailModal');
                renderAll();
                showToast('Oferta enviada! Aguarde a resposta.', 'success');
            } catch (error) {
                console.error('Erro ao propor troca:', error);
                showToast('Erro ao enviar proposta.', 'error');
            }
        }
    );
}

/**
 * Aceita uma negociação pendente (compra ou troca)
 */
function acceptTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t || t.status !== 'pending' || t.receiverId !== currentUser?.id) {
        showToast('Não foi possível aceitar a negociação.', 'error');
        return;
    }

    try {
        if (t.type === 'purchase' || (!t.proposerItemId && t.coins > 0)) {
            // Aquisição só com moedas
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
                notify(buyer.id, 'Proposta recusada: saldo insuficiente de moedas.');
                save();
                renderAll();
                return;
            }
            changeCoins(buyer, -t.coins, `Aquisição: ${item.title}`);
            changeCoins(currentUser, t.coins, `Cessão: ${item.title}`);
            item.ownerId = buyer.id;
            item.status = 'sold';
            t.coinMoves = [
                { userId: buyer.id, delta: -t.coins },
                { userId: currentUser.id, delta: t.coins }
            ];
            t.status = 'completed';
            t.completedAt = Date.now();
            if (!currentUser.stats) currentUser.stats = {};
            currentUser.stats.sales = (currentUser.stats.sales || 0) + 1;
            notify(buyer.id, `Aquisição de "${item.title}" confirmada!`);
            showToast('Negócio concluído.', 'success');
        } else if (t.type === 'trade') {
            const proposerItem = t.proposerItemId ? getItem(t.proposerItemId) : null;
            const receiverItem = getItem(t.receiverItemId);
            if (!receiverItem) {
                t.status = 'cancelled';
                save();
                renderAll();
                showToast('Item não encontrado. Negociação cancelada.', 'error');
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

            // Transferência de propriedade dos itens
            if (proposerItem) {
                proposerItem.ownerId = receiver.id;
                proposerItem.status = 'sold';
            }
            receiverItem.ownerId = proposer.id;
            receiverItem.status = 'sold';

            // Moedas extras na troca (se houver)
            if (t.coins > 0) {
                if (proposer.coins < t.coins) {
                    // Reverte reservas
                    if (proposerItem) proposerItem.status = 'available';
                    receiverItem.status = 'available';
                    if (proposerItem) proposerItem.ownerId = proposer.id;
                    receiverItem.ownerId = receiver.id;
                    t.status = 'rejected';
                    notify(proposer.id, 'Proposta recusada: saldo insuficiente de moedas.');
                    save();
                    renderAll();
                    return;
                }
                changeCoins(proposer, -t.coins, `Troca (complemento em moedas)`);
                changeCoins(receiver, t.coins, `Troca (complemento em moedas)`);
                t.coinMoves = [
                    { userId: proposer.id, delta: -t.coins },
                    { userId: receiver.id, delta: t.coins }
                ];
            }

            t.status = 'completed';
            t.completedAt = Date.now();
            if (!proposer.stats) proposer.stats = {};
            if (!receiver.stats) receiver.stats = {};
            proposer.stats.barters = (proposer.stats.barters || 0) + 1;
            receiver.stats.barters = (receiver.stats.barters || 0) + 1;

            const msg = proposerItem
                ? `Troca de "${proposerItem.title}" por "${receiverItem.title}" confirmada!`
                : `Troca por "${receiverItem.title}" confirmada!`;
            notify(proposer.id, msg);
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
 * Rejeita ou cancela uma negociação pendente
 */
function rejectTrade(tradeId) {
    const t = DB.trades.find(x => x.id === tradeId);
    if (!t || t.status !== 'pending') return;
    if (t.receiverId !== currentUser?.id && t.proposerId !== currentUser?.id) return;

    const wasReceiver = t.receiverId === currentUser.id;
    t.status = wasReceiver ? 'rejected' : 'cancelled';

    try {
        if (t.type === 'purchase' || !t.proposerItemId) {
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
 * Modal de avaliação
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
 * Envia avaliação + comentário
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
 * Lista de negociações do usuário
 */
function renderTrades() {
    if (!currentUser) return;

    const mine = DB.trades.filter(t =>
        t.proposerId === currentUser.id || t.receiverId === currentUser.id
    );
    const incoming = mine.filter(t => t.status === 'pending' && t.receiverId === currentUser.id).reverse();
    const outgoing = mine.filter(t => t.status === 'pending' && t.proposerId === currentUser.id).reverse();
    const done = mine.filter(t => t.status !== 'pending').reverse();

    const statusLabel = {
        pending: 'Pendente',
        completed: 'Concluído',
        rejected: 'Recusado',
        cancelled: 'Cancelado'
    };

    const renderRow = (t) => {
        const other = getUser(t.proposerId === currentUser.id ? t.receiverId : t.proposerId);
        const wanted = getItem(t.receiverItemId);
        const offered = t.proposerItemId ? getItem(t.proposerItemId) : null;

        let desc = '';
        if (t.type === 'purchase' || (!offered && t.coins > 0)) {
            desc = `🪙 ${fmt(t.coins)} moedas por "${wanted ? esc(wanted.title) : 'item removido'}"`;
        } else {
            desc = `"${offered ? esc(offered.title) : 'item'}"`;
            if (t.coins > 0) desc += ` + 🪙 ${fmt(t.coins)}`;
            desc += ` ⇄ "${wanted ? esc(wanted.title) : 'item removido'}"`;
        }
        if (t.message) {
            desc += `<br><em class="text-muted fs-sm">"${esc(t.message)}"</em>`;
        }

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
                btns += `<button type="button" class="btn btn-secondary" onclick="openRatingModal(${t.id}, ${otherId})">⭐ Avaliar</button>`;
            }
        }

        const otherName = other ? esc(other.name) : '?';
        const typeLabel = (t.type === 'purchase' || (!t.proposerItemId && t.coins > 0)) ? 'Moedas' : 'Troca';

        return `<li class="proposal-item">
            <div>
                <strong>#${t.id}</strong> · ${typeLabel} com <strong>${otherName}</strong><br>
                ${desc}<br>
                <small class="text-muted">${statusLabel[t.status] || t.status}</small>
            </div>
            <div class="mt-2">${btns}</div>
        </li>`;
    };

    const incomingEl = document.getElementById('incomingTrades');
    const outgoingEl = document.getElementById('outgoingTrades');
    const doneEl = document.getElementById('doneTrades');
    if (incomingEl) incomingEl.innerHTML = incoming.map(renderRow).join('') || '<li class="text-muted">Nenhuma proposta recebida.</li>';
    if (outgoingEl) outgoingEl.innerHTML = outgoing.map(renderRow).join('') || '<li class="text-muted">Nenhuma proposta enviada.</li>';
    if (doneEl) doneEl.innerHTML = done.map(renderRow).join('') || '<li class="text-muted">Nenhum negócio concluído.</li>';
}