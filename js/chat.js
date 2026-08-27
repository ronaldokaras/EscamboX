// Chat básico
let currentChatPartnerId = null;

function openChat(otherUserId) {
    if (!currentUser) { openAuth('login'); return; }
    currentChatPartnerId = otherUserId;
    let chat = DB.chats.find(c => c.participants.includes(currentUser.id) && c.participants.includes(otherUserId));
    if (!chat) {
        chat = { id: nextId(), participants: [currentUser.id, otherUserId], messages: [] };
        DB.chats.push(chat);
        save();
    }
    renderChatMessages();
    openModal('chatModal');
}

function renderChatMessages() {
    const chat = DB.chats.find(c => c.participants.includes(currentUser.id) && c.participants.includes(currentChatPartnerId));
    const box = document.getElementById('chatMessages');
    box.innerHTML = chat?.messages.map(m => `<div class="chat-message"><span class="sender">${m.senderId === currentUser.id ? 'Você' : getUser(m.senderId)?.name}:</span> ${esc(m.text)}</div>`).join('') || 'Sem mensagens.';
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    const chat = DB.chats.find(c => c.participants.includes(currentUser.id) && c.participants.includes(currentChatPartnerId));
    if (!chat) return;
    chat.messages.push({ senderId: currentUser.id, text, ts: Date.now() });
    save();
    renderChatMessages();
    input.value = '';
}