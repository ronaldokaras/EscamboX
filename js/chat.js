'use strict';

// Chat básico entre usuários (negociação)
let currentChatPartnerId = null;
let chatListenersReady = false;

/**
 * Retorna o chat entre o usuário logado e o parceiro atual.
 * @returns {Object|null}
 */
function getChatBetween() {
    if (!currentUser || !currentChatPartnerId) return null;
    if (!Array.isArray(DB.chats)) DB.chats = [];
    return DB.chats.find(c =>
        Array.isArray(c.participants) &&
        c.participants.includes(currentUser.id) &&
        c.participants.includes(currentChatPartnerId)
    ) || null;
}

/**
 * Abre o chat com outro usuário.
 * @param {number} otherUserId
 */
function openChat(otherUserId) {
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

    try {
        if (!Array.isArray(DB.chats)) DB.chats = [];

        let chat = getChatBetween();
        if (!chat) {
            chat = {
                id: nextId(),
                participants: [currentUser.id, otherId],
                messages: [],
                updatedAt: Date.now()
            };
            DB.chats.push(chat);
            save();
        }

        // Título do modal
        const titleEl = document.getElementById('chatTitle');
        if (titleEl) {
            titleEl.textContent = `Chat com ${partner.name}`;
        }

        renderChatMessages();
        openModal('chatModal');

        // Foca o campo de mensagem
        const input = document.getElementById('chatInput');
        if (input) setTimeout(() => input.focus(), 80);

        initChatListeners();
    } catch (error) {
        console.error('Erro ao abrir chat:', error);
        showToast('Erro ao abrir chat.', 'error');
    }
}

/**
 * Renderiza as mensagens do chat atual.
 */
function renderChatMessages() {
    const box = document.getElementById('chatMessages');
    if (!box) return;

    const chat = getChatBetween();
    if (!chat || !chat.messages || chat.messages.length === 0) {
        box.innerHTML = '<div class="chat-empty text-muted">Sem mensagens. Inicie a conversa sobre o item ou a troca!</div>';
        return;
    }

    const messages = [...chat.messages].sort((a, b) => (a.ts || 0) - (b.ts || 0));

    box.innerHTML = messages.map(m => {
        const isOwn = m.senderId === currentUser?.id;
        const senderName = isOwn
            ? 'Você'
            : esc(getUser(m.senderId)?.name || 'Usuário');
        const time = m.ts
            ? new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : '';
        return `
            <div class="chat-message ${isOwn ? 'own-message' : 'other-message'}">
                <div class="chat-message-header">
                    <span class="sender">${senderName}</span>
                    ${time ? `<span class="chat-time text-muted">${time}</span>` : ''}
                </div>
                <div class="chat-bubble">${esc(m.text)}</div>
            </div>
        `;
    }).join('');

    box.scrollTop = box.scrollHeight;
}

/**
 * Envia uma mensagem no chat atual.
 */
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
        showToast('Mensagem muito longa (máx. 200 caracteres).', 'warning');
        return;
    }

    let chat = getChatBetween();
    if (!chat) {
        // Recria se sumiu
        chat = {
            id: nextId(),
            participants: [currentUser.id, currentChatPartnerId],
            messages: [],
            updatedAt: Date.now()
        };
        if (!Array.isArray(DB.chats)) DB.chats = [];
        DB.chats.push(chat);
    }

    if (sendBtn) sendBtn.disabled = true;

    try {
        chat.messages.push({
            senderId: currentUser.id,
            text,
            ts: Date.now()
        });
        chat.updatedAt = Date.now();

        // Notifica o parceiro
        if (typeof notify === 'function') {
            notify(
                currentChatPartnerId,
                `${currentUser.name} enviou uma mensagem no chat.`
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

/**
 * Listeners do chat (Enter + botão). Só registra uma vez.
 */
function initChatListeners() {
    if (chatListenersReady) return;
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    if (!input || !sendBtn) return;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    sendBtn.addEventListener('click', sendChatMessage);
    chatListenersReady = true;
}