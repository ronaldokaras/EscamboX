'use strict';

// Inicialização
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
        if (entries[0].isIntersecting) {
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
        // Carrega dados persistentes
        loadData();

        // Inicializa senhas (provavelmente criptografia ou seed)
        await initPasswords();

        // Salva estado inicial
        save();

        // Aplica tema salvo
        applyTheme(localStorage.getItem(KEYS.theme) || 'light');

        // Restaura sessão do usuário (se houver)
        restoreSession();

        // Preenche selects de formulários (categorias, etc.)
        populateFormSelects();

        // Renderiza chips de categorias
        renderChips();

        // Atualiza interface conforme autenticação
        afterLoginUI();

        // Renderiza todas as seções
        renderAll();

        // Configura scroll infinito
        setupInfiniteScroll();

        // --- Event Listeners Globais ---

        // Fecha menus ao clicar fora deles
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                closeUserMenu();
            }
            if (!e.target.closest('.notification-btn')) {
                closeNotifications();
            }
        });

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            // Fecha modais e menus com Escape
            if (e.key === 'Escape') {
                // Fecha todos os modais ativos
                document.querySelectorAll('.modal.active').forEach((modal) => {
                    modal.classList.remove('active');
                    // Remove aria-hidden se estiver definido
                    modal.setAttribute('aria-hidden', 'true');
                });

                // Fecha menu do usuário e notificações
                closeUserMenu();
                closeNotifications();
            }

            // Atalho "/" para focar na busca
            if (e.key === '/' && !e.target.closest('input, textarea, select')) {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                }
            }
        });

        // Fecha modal ao clicar no backdrop (fora do conteúdo)
        document.querySelectorAll('.modal').forEach((modal) => {
            modal.addEventListener('mousedown', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    modal.setAttribute('aria-hidden', 'true');
                }
            });
        });

    } catch (error) {
        console.error('Erro durante inicialização:', error);
        // Opcional: exibir toast de erro para o usuário
        if (typeof showToast === 'function') {
            showToast('Erro ao inicializar aplicação. Recarregue a página.', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', init);