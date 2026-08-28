'use strict';

// Chat básico
let currentChatPartnerId = null;

/**
 * Retorna o chat entre o usuário logado e o parceiro atual.
 * @returns {Object|null} Chat ou null se não existir
 */
function getChatBetween() {
    if (!currentUser || !currentChatPartnerId) return null;
    return DB.chats.find(c =>
        c.participants.includes(currentUser.id) &&
        c.participants.includes(currentChatPartnerId)
    ) || null;
}

/**
 * Abre o chat com outro usuário.
 * @param {number} otherUserId - ID do outro usuário
 */
function openChat(otherUserId) {
    if (!currentUser) {
        openAuth('login');
        return;
    }

    if (!otherUserId || otherUserId === currentUser.id) {
        showToast('Não é possível abrir chat com este usuário.', 'error');
        return;
    }

    currentChatPartnerId = otherUserId;

    try {
        let chat = getChatBetween();
        if (!chat) {
            chat = {
                id: nextId(),
                participants: [currentUser.id, otherUserId],
                messages: []
            };
            DB.chats.push(chat);
            save();
        }

        renderChatMessages();
        openModal('chatModal');
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
        box.innerHTML = '<div class="chat-empty">Sem mensagens. Inicie a conversa!</div>';
        return;
    }

    // Ordena mensagens por timestamp (crescente)
    const messages = [...chat.messages].sort((a, b) => (a.ts || 0) - (b.ts || 0));

    box.innerHTML = messages.map(m => {
        const senderName = m.senderId === currentUser?.id
            ? 'Você'
            : esc(getUser(m.senderId)?.name || 'Usuário removido');
        const time = m.ts ? new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const isOwn = m.senderId === currentUser?.id;
        return `
            <div class="chat-message ${isOwn ? 'own-message' : 'other-message'}">
                <div class="chat-message-header">
                    <span class="sender">${senderName}</span>
                    ${time ? `<span class="chat-time">${time}</span>` : ''}
                </div>
                <div class="chat-bubble">${esc(m.text)}</div>
            </div>
        `;
    }).join('');

    // Auto-scroll para a última mensagem
    box.scrollTop = box.scrollHeight;
}

/**
 * Envia uma mensagem no chat atual.
 */
function sendChatMessage() {
    if (!currentUser || !currentChatPartnerId) {
        showToast('Sessão expirada. Faça login novamente.', 'error');
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

    const chat = getChatBetween();
    if (!chat) {
        showToast('Chat não encontrado.', 'error');
        return;
    }

    if (sendBtn) sendBtn.disabled = true;

    try {
        chat.messages.push({
            senderId: currentUser.id,
            text,
            ts: Date.now()
        });
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
 * Inicializa listeners do chat (chamado no init geral).
 */
function initChatListeners() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    if (!input || !sendBtn) return;

    // Enviar com Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // Enviar com clique no botão
    sendBtn.addEventListener('click', sendChatMessage);
}