# WB Extension - License Server

Сервер лицензирования для расширения WB Extension.

## Функционал

- ✅ Генерация уникальных ключей активации
- ✅ Управление сроком действия подписок
- ✅ Продление и деактивация ключей
- ✅ Автоматическая проверка истечения срока
- ✅ Админ-панель для управления
- ✅ PostgreSQL база данных

## Установка

### 1. Установите зависимости

```bash
cd license-backend
npm install
```

### 2. Настройте переменные окружения

Файл `.env` уже создан с вашими данными:
```env
DATABASE_URL=postgresql://postgres:DMocDobQDcYDcdxksTGwdzygftLibyln@metro.proxy.rlwy.net:33760/railway
PORT=3000
ADMIN_PASSWORD=admin123
```

⚠️ **ВАЖНО**: Смените `ADMIN_PASSWORD` на более безопасный!

### 3. Запустите сервер

```bash
npm start
```

Или для разработки с автоперезагрузкой:
```bash
npm run dev
```

Сервер запустится на http://localhost:3000

## Деплой на Railway

### Шаг 1: Создайте проект на Railway

1. Перейдите на https://railway.app
2. Нажмите "New Project" → "Deploy from GitHub repo"
3. Подключите ваш репозиторий

### Шаг 2: Настройте переменные окружения

В Railway добавьте:
- `DATABASE_URL` - ваша строка подключения к PostgreSQL
- `PORT` - 3000
- `ADMIN_PASSWORD` - ваш пароль администратора

### Шаг 3: Деплой

Railway автоматически развернет приложение. Скопируйте URL вашего приложения (например: `https://your-app.railway.app`)

### Шаг 4: Обновите расширение

В файле `popup.js` замените:
```javascript
const LICENSE_SERVER_URL = 'http://localhost:3000';
```

На:
```javascript
const LICENSE_SERVER_URL = 'https://your-app.railway.app';
```

## Использование админ-панели

### Вход

1. Откройте http://localhost:3000 (или ваш Railway URL)
2. Введите пароль администратора (`admin123` или ваш пароль из `.env`)

### Генерация ключей

1. Заполните информацию о пользователе (необязательно)
2. Выберите срок действия (7, 14, 30, 60, 90, 180, 365 дней или свой)
3. Нажмите "Сгенерировать ключ"
4. Ключ автоматически скопируется в буфер обмена

### Управление ключами

- **Продлить** - добавить дни к текущему сроку
- **Деактивировать** - заблокировать ключ
- **Удалить** - удалить ключ из базы данных

## API Endpoints

### Для расширения

#### POST `/api/verify-license`
Проверка ключа активации

**Request:**
```json
{
  "licenseKey": "WB-XXXX-XXXX-XXXX-XXXX"
}
```

**Response (успех):**
```json
{
  "success": true,
  "valid": true,
  "expiresAt": "2025-11-24T10:00:00.000Z",
  "daysLeft": 30,
  "userInfo": "Пользователь"
}
```

**Response (истек):**
```json
{
  "success": true,
  "valid": false,
  "expired": true,
  "error": "⏰ Ваша подписка истекла",
  "expiresAt": "2025-01-24T10:00:00.000Z"
}
```

### Для админ-панели

#### POST `/admin/generate-key`
Генерация нового ключа

#### POST `/admin/list-keys`
Список всех ключей

#### POST `/admin/extend-key`
Продление ключа

#### POST `/admin/deactivate-key`
Деактивация ключа

#### POST `/admin/delete-key`
Удаление ключа

Все admin endpoints требуют поле `password` в body запроса.

## База данных

### Структура таблицы `license_keys`

```sql
CREATE TABLE license_keys (
    id SERIAL PRIMARY KEY,
    license_key VARCHAR(255) UNIQUE NOT NULL,
    user_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP
);
```

## Безопасность

### Рекомендации:

1. **Смените пароль администратора** в `.env`
2. **Используйте HTTPS** (Railway предоставляет автоматически)
3. **Ограничьте CORS** при необходимости (сейчас разрешены все источники)
4. **Регулярно создавайте бэкапы базы данных**

## Мониторинг

### Проверка работоспособности

```bash
curl https://your-server.railway.app/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2025-01-24T10:00:00.000Z"
}
```

## Troubleshooting

### Ошибка подключения к PostgreSQL

- Проверьте `DATABASE_URL` в `.env`
- Убедитесь, что PostgreSQL запущен
- Проверьте firewall и сетевые настройки

### Расширение не может подключиться к серверу

- Убедитесь, что сервер запущен
- Проверьте `LICENSE_SERVER_URL` в `popup.js`
- Проверьте CORS настройки

### Таблица не создается автоматически

Выполните вручную:
```sql
CREATE TABLE IF NOT EXISTS license_keys (
    id SERIAL PRIMARY KEY,
    license_key VARCHAR(255) UNIQUE NOT NULL,
    user_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP
);
```

## Поддержка

При возникновении проблем проверьте:
1. Логи сервера (`npm start`)
2. Консоль браузера (F12)
3. Network tab для проверки запросов

## Лицензия

Proprietary - для внутреннего использования

