#!/bin/bash

echo "🚀 WB Extension License Server - Setup"
echo "======================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите Node.js с https://nodejs.org"
    exit 1
fi

echo "✅ Node.js установлен: $(node --version)"
echo ""

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "📝 Создаем .env файл..."
    cp .env.example .env
    echo "✅ .env создан"
    echo ""
    echo "⚠️  ВАЖНО: Откройте .env и смените ADMIN_PASSWORD!"
    echo ""
else
    echo "✅ .env файл уже существует"
    echo ""
fi

# Install dependencies
echo "📦 Установка зависимостей..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Зависимости установлены"
    echo ""
    echo "🎉 Готово! Теперь запустите:"
    echo ""
    echo "   npm start"
    echo ""
    echo "И откройте http://localhost:3000"
else
    echo ""
    echo "❌ Ошибка установки зависимостей"
    exit 1
fi

