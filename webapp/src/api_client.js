// Utilitário para Headers Autenticados
export const getAuthHeaders = () => {
    // Tenta pegar a chave secreta do ambiente (Vite)
    const apiKey = import.meta.env.VITE_API_KEY || "Abr30cpx#"; 
    
    // Importante: No front, essa chave "vaza" se alguém inspecionar o código.
    // O ideal seria o Token vir do Telegram (initData), mas para iniciar, isso resolve.
    return {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
    };
};

export const fetchWithAuth = async (url, options = {}) => {
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    return fetch(url, { ...options, headers });
};
