# WB Extension License Server

Сервер лицензирования для расширения WB Extension (автоматизация работы с Wildberries).

## 🚀 Быстрый старт

### Деплой на Railway (рекомендуется)

**Читайте полную инструкцию:** [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)

Кратко:
1. Fork этот репозиторий
2. Зарегистрируйтесь на https://railway.app
3. New Project → Deploy from GitHub
4. Настройте переменные окружения
5. Готово! 🎉

### Локальный запуск

```bash
cd license-backend
npm install
npm start
```

Откройте http://localhost:3000

## 📋 Что внутри

- **Backend:** Node.js + Express
- **База данных:** PostgreSQL
- **Админ-панель:** HTML/JS (встроена)
- **API:** REST для проверки лицензий

## 🔑 Функции

- ✅ Генерация уникальных ключей активации
- ✅ Управление сроком подписки
- ✅ Продление и деактивация ключей
- ✅ Автоматическая проверка истечения
- ✅ Защита паролем
- ✅ Красивая админ-панель

## 🛠️ Технологии

- Node.js 16+
- PostgreSQL
- Express.js
- Crypto (генерация ключей)

## 📄 Лицензия

Proprietary - для внутреннего использования

## 🤝 Контакты

Telegram: @your_telegram
