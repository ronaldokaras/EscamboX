'use strict';

// Chat vinculado a item + proposta de troca
let currentChatPartnerId = null;
let currentChatItemId = null;
let currentChatTradeId = null;
let chatListenersReady = false;

function ensureChats() {
    if (!Array.isArray(DB.chats)) DB.chats = [];
}

function findChat(userA, userB, itemId) {
    ensureChats();
    return DB.chats.find(c => {
        if (!Array.isArray(c.participants)) return false;
        const pair = c.participants.includes(userA) && c.participants.includes(userB);
        if (!pair) return false;
        if (itemId != null) return c.itemId === itemId;
        return true;
    }) || null;
}

function getChatBetween() {
    if (!currentUser || !currentChatPartnerId) return null;
    return findChat(currentUser.id, currentChatPartnerId, currentChatItemId) ||
           findChat(currentUser.id, currentChatPartnerId, null);
}

function getRelatedPendingTrade() {
    if (!currentUser || !DB.trades) return null;
    return DB.trades.find(t =>
        t.status === 'pending' &&
        (
            (t.proposerId === currentUser.id && t.receiverId === currentChatPartnerId) ||
            (t.receiverId === currentUser.id && t.proposerId === currentChatPartnerId)
        ) &&
        (currentChatItemId == null || t.receiverItemId === currentChatItemId || t.proposerItemId === currentChatItemId)
    ) || null;
}

function openChat(otherUserId, itemId) {
    if (!currentUser) {
        openAuth('login');
        return;
    }

    const otherId = Number(otherUserId);
    if (!otherId || otherId === currentUser.id) {
        showToast('Não é possível abrir chat com este usuário.', 'error');
        return;
    }

    const partner = getUser(otherId);
    if (!partner) {
        showToast('Usuário não encontrado.', 'error');
        return;
    }
    if (partner.role === 'banned') {
        showToast('Este usuário está indisponível.', 'warning');
        return;
    }

    currentChatPartnerId = otherId;
    currentChatItemId = itemId != null ? Number(itemId) : null;
    currentChatTradeId = null;

    try {
        ensureChats();
        let chat = findChat(currentUser.id, otherId, currentChatItemId);
        if (!chat && currentChatItemId) {
            chat = findChat(currentUser.id, otherId, null);
        }
        if (!chat) {
            chat = {
                id: nextId(),
                participants: [currentUser.id, otherId],
                itemId: currentChatItemId,
                messages: [],
                updatedAt: Date.now()
            };
            DB.chats.push(chat);
            save();
        } else if (currentChatItemId && !chat.itemId) {
            chat.itemId = currentChatItemId;
            save();
        }

        const titleEl = document.getElementById('chatTitle');
        if (titleEl) titleEl.textContent = 'Chat com ' + partner.name;

        renderChatContext();
        renderChatMessages();
        openModal('chatModal');
        markChatRead();
        closeChatPanel();

        const input = document.getElementById('chatInput');
        if (input) setTimeout(function () { input.focus(); }, 80);

        initChatListeners();
    } catch (error) {
        console.error('Erro ao abrir chat:', error);
        showToast('Erro ao abrir chat.', 'error');
    }
}

function renderChatContext() {
    const ctx = document.getElementById('chatContext');
    if (!ctx) return;

    const item = currentChatItemId ? getItem(currentChatItemId) : null;
    const trade = getRelatedPendingTrade();
    if (trade) currentChatTradeId = trade.id;

    var html = '';

    if (item) {
        var price = item.price > 0
            ? '🪙 ' + fmt(item.price) + ' moedas'
            : '🔄 Troca de item';
        html += '<div class="chat-item-card">' +
            '<div class="chat-item-title">' + esc(item.title) + '</div>' +
            '<div class="chat-item-meta text-muted">' + price + (item.location ? ' · ' + esc(item.location) : '') + '</div>' +
            '</div>';
    }

    if (trade) {
        var wanted = getItem(trade.receiverItemId);
        var offered = trade.proposerItemId ? getItem(trade.proposerItemId) : null;
        var isReceiver = trade.receiverId === currentUser.id;
        var isProposer = trade.proposerId === currentUser.id;

        var offerTxt = '';
        if (offered && trade.coins > 0) {
            offerTxt = '"' + esc(offered.title) + '" + 🪙 ' + fmt(trade.coins);
        } else if (offered) {
            offerTxt = '"' + esc(offered.title) + '"';
        } else if (trade.coins > 0) {
            offerTxt = '🪙 ' + fmt(trade.coins) + ' moedas';
        } else {
            offerTxt = 'Oferta';
        }

        html += '<div class="chat-trade-card">' +
            '<div class="fw-bold mb-1">Proposta pendente #' + trade.id + '</div>' +
            '<div class="fs-sm">' + offerTxt + ' ⇄ "' + (wanted ? esc(wanted.title) : 'item') + '"</div>' +
            (trade.message ? '<div class="text-muted fs-sm mt-1">"' + esc(trade.message) + '"</div>' : '') +
            '<div class="chat-trade-actions mt-2">';

        if (isReceiver) {
            html += '<button type="button" class="btn" onclick="acceptTrade(' + trade.id + '); setTimeout(function(){ renderChatContext(); renderChatMessages(); }, 100);">Aceitar</button> ';
            html += '<button type="button" class="btn btn-danger" onclick="rejectTrade(' + trade.id + '); setTimeout(function(){ renderChatContext(); renderChatMessages(); }, 100);">Recusar</button>';
        }
        if (isProposer) {
            html += '<button type="button" class="btn btn-secondary" onclick="openModifyTradeOffer(' + trade.id + ')">Modificar oferta</button> ';
            html += '<button type="button" class="btn btn-danger" onclick="rejectTrade(' + trade.id + '); setTimeout(function(){ renderChatContext(); }, 100);">Cancelar proposta</button>';
        }
        html += '</div></div>';
    }

    ctx.innerHTML = html || '<p class="text-muted fs-sm">Conversa direta. Negocie a troca ou as moedas por aqui.</p>';
}

function renderChatMessages() {
    const box = document.getElementById('chatMessages');
    if (!box) return;

    const chat = getChatBetween();
    if (!chat || !chat.messages || chat.messages.length === 0) {
        box.innerHTML = '<div class="chat-empty text-muted">Sem mensagens. Escreva abaixo para iniciar.</div>';
        return;
    }

    const messages = chat.messages.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });

    box.innerHTML = messages.map(function (m) {
        var isOwn = m.senderId === (currentUser && currentUser.id);
        var senderName = isOwn ? 'Você' : esc((getUser(m.senderId) || {}).name || 'Usuário');
        var time = m.ts
            ? new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : '';
        return '<div class="chat-message ' + (isOwn ? 'own-message' : 'other-message') + '">' +
            '<div class="chat-message-header">' +
            '<span class="sender">' + senderName + '</span>' +
            (time ? '<span class="chat-time text-muted">' + time + '</span>' : '') +
            '</div>' +
            '<div class="chat-bubble">' + esc(m.text) + '</div>' +
            '</div>';
    }).join('');

    box.scrollTop = box.scrollHeight;
}

function sendChatMessage() {
    if (!currentUser || !currentChatPartnerId) {
        showToast('Faça login para conversar.', 'error');
        return;
    }

    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
        input.focus();
        return;
    }
    if (text.length > 200) {
        showToast('Mensagem muito longa (máx. 200).', 'warning');
        return;
    }

    ensureChats();
    var chat = getChatBetween();
    if (!chat) {
        chat = {
            id: nextId(),
            participants: [currentUser.id, currentChatPartnerId],
            itemId: currentChatItemId,
            messages: [],
            updatedAt: Date.now()
        };
        DB.chats.push(chat);
    }

    if (sendBtn) sendBtn.disabled = true;

    try {
        chat.messages.push({
            senderId: currentUser.id,
            text: text,
            ts: Date.now()
        });
        chat.updatedAt = Date.now();

        var item = currentChatItemId ? getItem(currentChatItemId) : null;
        var hint = item ? ' sobre "' + item.title + '"' : '';
        if (typeof notify === 'function') {
            notify(
                currentChatPartnerId,
                currentUser.name + ' enviou mensagem' + hint + '. Abra o chat para responder.'
            );
        }

        save();
        renderChatMessages();
        input.value = '';
        input.focus();
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        showToast('Erro ao enviar mensagem.', 'error');
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function openModifyTradeOffer(tradeId) {
    var t = DB.trades.find(function (x) { return x.id === tradeId; });
    if (!t || t.status !== 'pending' || t.proposerId !== (currentUser && currentUser.id)) {
        showToast('Só quem enviou a proposta pode modificá-la.', 'warning');
        return;
    }

    tradeTargetItemId = t.receiverItemId;
    window._editingTradeId = t.id;

    var target = getItem(t.receiverItemId);
    var info = document.getElementById('tradeTargetInfo');
    if (info && target) {
        info.innerHTML = 'Modificar oferta por: <strong>' + esc(target.title) + '</strong>';
    }

    var myAvailable = DB.items.filter(function (i) {
        return i.ownerId === currentUser.id &&
            (i.status === 'available' || i.id === t.proposerItemId) &&
            i.id !== t.receiverItemId;
    });

    var select = document.getElementById('tradeOfferItem');
    if (select) {
        select.innerHTML = '<option value="">— Sem item (só moedas) —</option>' +
            myAvailable.map(function (i) {
                return '<option value="' + i.id + '"' + (i.id === t.proposerItemId ? ' selected' : '') + '>' + esc(i.title) + '</option>';
            }).join('');
    }

    var coinsInput = document.getElementById('tradeOfferCoins');
    if (coinsInput) coinsInput.value = t.coins || 0;
    var msgInput = document.getElementById('tradeOfferMsg');
    if (msgInput) msgInput.value = t.message || '';

    openModal('tradeProposalModal');
}

function renderMyChatsList(containerId) {
    var el = document.getElementById(containerId || 'myChatsList');
    if (!el || !currentUser) return;
    ensureChats();

    var mine = DB.chats
        .filter(function (c) {
            return Array.isArray(c.participants) && c.participants.indexOf(currentUser.id) >= 0;
        })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

    if (!mine.length) {
        el.innerHTML = '<p class="text-muted fs-sm">Nenhuma conversa ainda.</p>';
        return;
    }

    el.innerHTML = mine.map(function (c) {
        var otherId = c.participants.filter(function (id) { return id !== currentUser.id; })[0];
        var other = getUser(otherId);
        var item = c.itemId ? getItem(c.itemId) : null;
        var last = c.messages && c.messages.length ? c.messages[c.messages.length - 1] : null;
        var preview = last ? esc(last.text.slice(0, 60)) : 'Sem mensagens';
        var when = last && typeof fmtRelative === 'function' ? fmtRelative(last.ts) : '';
        var onclick = 'openChat(' + otherId + (c.itemId ? ', ' + c.itemId : '') + ')';
        return '<button type="button" class="chat-list-item" onclick="' + onclick + '">' +
            '<div class="fw-bold">' + (other ? esc(other.name) : 'Usuário') + '</div>' +
            (item ? '<div class="fs-xs text-muted">' + esc(item.title) + '</div>' : '') +
            '<div class="fs-sm">' + preview + '</div>' +
            (when ? '<div class="fs-xs text-muted">' + when + '</div>' : '') +
            '</button>';
    }).join('');
}

function initChatListeners() {
    if (chatListenersReady) return;
    var input = document.getElementById('chatInput');
    var sendBtn = document.getElementById('sendChatBtn');
    if (!input || !sendBtn) return;

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    sendBtn.addEventListener('click', sendChatMessage);
    chatListenersReady = true;
}

/**
 * Abre/fecha painel de conversas (barra superior)
 */
function toggleChatPanel() {
    if (!currentUser) {
        openAuth('login');
        return;
    }
    const panel = document.getElementById('chatPanel');
    const backdrop = document.getElementById('chatPanelBackdrop');
    const btn = document.getElementById('chatBarBtn');
    if (!panel) return;

    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (backdrop) {
        backdrop.hidden = !open;
        backdrop.classList.toggle('visible', open);
    }
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (open) {
        renderMyChatsList('chatPanelList');
        renderChatBadge();
    }
}

function closeChatPanel() {
    const panel = document.getElementById('chatPanel');
    const backdrop = document.getElementById('chatPanelBackdrop');
    const btn = document.getElementById('chatBarBtn');
    if (panel) {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) {
        backdrop.hidden = true;
        backdrop.classList.remove('visible');
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

/**
 * Badge: conversas com última msg de outro usuário (não lidas simplificado)
 */
function renderChatBadge() {
    const badge = document.getElementById('chatBadge');
    const barBtn = document.getElementById('chatBarBtn');
    if (!badge) return;
    if (!currentUser) {
        badge.classList.add('hidden');
        if (barBtn) barBtn.classList.add('hidden');
        return;
    }
    if (barBtn) barBtn.classList.remove('hidden');
    if (!Array.isArray(DB.chats)) {
        badge.classList.add('hidden');
        return;
    }
    let unread = 0;
    DB.chats.forEach(c => {
        if (!Array.isArray(c.participants) || !c.participants.includes(currentUser.id)) return;
        if (!c.messages || !c.messages.length) return;
        const last = c.messages[c.messages.length - 1];
        if (last.senderId !== currentUser.id && !last.readByMe) unread++;
    });
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.classList.toggle('hidden', unread === 0);
}

// Ao abrir chat, marca mensagens do parceiro como lidas
function markChatRead() {
    const chat = getChatBetween();
    if (!chat || !currentUser || !chat.messages) return;
    let changed = false;
    chat.messages.forEach(m => {
        if (m.senderId !== currentUser.id && !m.readByMe) {
            m.readByMe = true;
            changed = true;
        }
    });
    if (changed) {
        save();
        renderChatBadge();
    }
}