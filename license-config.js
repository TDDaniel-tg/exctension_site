// License server configuration
const LICENSE_CONFIG = {
    // Замените на ваш URL после деплоя сервера
    SERVER_URL: 'http://localhost:3000',
    // SERVER_URL: 'https://your-server.railway.app',
    
    API_ENDPOINTS: {
        VERIFY: '/api/verify-license'
    },
    
    // Интервал проверки лицензии (каждые 30 минут)
    CHECK_INTERVAL: 30 * 60 * 1000
};

// Экспортируем для использования в расширении
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LICENSE_CONFIG;
}

