'use strict';

// Inicialização da aplicação EscamboX
let infiniteScrollObserver;

/**
 * Configura o IntersectionObserver para carregar mais itens
 * quando o sentinela de scroll infinito entrar na viewport.
 */
function setupInfiniteScroll() {
    if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect();
    }

    const sentinel = document.getElementById('loadMoreSentinel');
    if (!sentinel) return;

    infiniteScrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && typeof loadMore === 'function') {
            loadMore();
        }
    }, { rootMargin: '200px' });

    infiniteScrollObserver.observe(sentinel);
}

/**
 * Inicializa a aplicação.
 */
async function init() {
    try {
        // 1. Dados persistentes (seed se versão nova)
        loadData();

        // 2. Senhas dos usuários de demonstração
        await initPasswords();
        save();

        // 3. Tema
        const savedTheme = localStorage.getItem(KEYS.theme) || 'light';
        if (typeof applyTheme === 'function') {
            applyTheme(savedTheme);
        } else {
            document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : 'light');
        }

        // 4. Sessão
        restoreSession();

        // 5. Formulários e filtros
        if (typeof populateFormSelects === 'function') populateFormSelects();
        if (typeof renderChips === 'function') renderChips();

        // 6. UI conforme login
        afterLoginUI();

        // 7. Conteúdo
        if (typeof renderAll === 'function') {
            renderAll();
        } else if (typeof renderGrid === 'function') {
            renderGrid();
        }

        // 8. Scroll infinito
        setupInfiniteScroll();

        // --- Eventos globais ---

        // Fecha menus ao clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu') && typeof closeUserMenu === 'function') {
                closeUserMenu();
            }
            if (!e.target.closest('.notification-btn') && typeof closeNotifications === 'function') {
                closeNotifications();
            }
        });

        // Teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach((modal) => {
                    const id = modal.id;
                    if (id && typeof closeModal === 'function') {
                        closeModal(id);
                    } else {
                        modal.classList.remove('active');
                        modal.setAttribute('aria-hidden', 'true');
                    }
                });
                if (typeof closeUserMenu === 'function') closeUserMenu();
                if (typeof closeNotifications === 'function') closeNotifications();
            }

            // "/" foca a busca
            if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]')) {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.focus();
            }
        });

        // Clique no backdrop fecha o modal
        document.querySelectorAll('.modal').forEach((modal) => {
            modal.addEventListener('mousedown', (e) => {
                if (e.target === modal) {
                    const id = modal.id;
                    if (id && typeof closeModal === 'function') {
                        closeModal(id);
                    } else {
                        modal.classList.remove('active');
                        modal.setAttribute('aria-hidden', 'true');
                    }
                }
            });
        });

        console.log('EscamboX inicializado.');
    } catch (error) {
        console.error('Erro durante inicialização:', error);
        if (typeof showToast === 'function') {
            showToast('Erro ao inicializar. Recarregue a página.', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', init);