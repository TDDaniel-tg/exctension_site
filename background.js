// Background Service Worker for WB Deliveries Extension

class BackgroundService {
    constructor() {
        this.monitoringEnabled = false;
        this.monitoringInterval = 15; // minutes
        this.alarmName = 'deliveryMonitoring';
        
        // Единый Telegram бот для всех пользователей
        this.TELEGRAM_BOT_TOKEN = '8264101016:AAFaLq6XBnj100awXV4xCw6Y4IrUb9IXJ4c';
        this.TELEGRAM_CHAT_ID = '5123262366'; // ID бота для получения уведомлений
        
        this.init();
    }

    async init() {
        console.log('WB Extension: Background service initialized');

        // Listen for messages
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Will respond asynchronously
        });

        // Listen for alarms
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });

        // Listen for extension installation/update
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });

        // Load settings and start monitoring if enabled
        await this.loadSettings();
    }

    async handleMessage(request, sender, sendResponse) {
        console.log('Background received message:', request.action);

        try {
            switch (request.action) {
                case 'refreshDeliveries':
                    await this.refreshDeliveries();
                    sendResponse({ success: true });
                    break;

                case 'toggleMonitoring':
                    await this.toggleMonitoring(request.enabled);
                    sendResponse({ success: true });
                    break;

                case 'updateMonitoringInterval':
                    await this.updateMonitoringInterval(request.interval);
                    sendResponse({ success: true });
                    break;

                case 'deliveriesScanned':
                    await this.handleDeliveriesScanned(request.count);
                    sendResponse({ success: true });
                    break;

                case 'sendNotification':
                    await this.sendNotification(request.title, request.message, request.data);
                    sendResponse({ success: true });
                    break;

                case 'fetchWarehouses':
                    const warehouses = await this.fetchWarehouses();
                    sendResponse({ success: true, warehouses: warehouses });
                    break;

                case 'supplyPlanned':
                    await this.handleSupplyPlanned(request);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async fetchWarehouses() {
        try {
            console.log('📡 Запрашиваем список складов из WB API...');
            
            const settings = await chrome.storage.local.get(['apiToken']);
            
            if (!settings.apiToken) {
                console.warn('API токен не настроен');
                return { error: 'API токен не настроен' };
            }

            const response = await fetch('https://supplies-api.wildberries.ru/api/v1/acceptance/coefficients', {
                method: 'GET',
                headers: {
                    'Authorization': settings.apiToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API ошибка: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Получены данные о складах:', data);

            // Обрабатываем данные
            const warehouses = this.processWarehousesData(data);
            
            // Сохраняем в storage
            await chrome.storage.local.set({ 
                warehousesData: warehouses,
                lastWarehousesUpdate: Date.now()
            });

            await this.addLog(`Обновлены данные о складах: ${warehouses.length} складов`);

            return warehouses;
        } catch (error) {
            console.error('Ошибка получения данных о складах:', error);
            await this.addLog(`Ошибка API: ${error.message}`);
            return { error: error.message };
        }
    }

    processWarehousesData(data) {
        try {
            console.log('🔄 Обрабатываем данные от WB API...');
            
            // API возвращает массив объектов, каждый элемент = дата для конкретного склада и типа упаковки
            if (!Array.isArray(data)) {
                console.error('Неверный формат данных от API');
                return [];
            }

            console.log(`Получено записей от API: ${data.length}`);

            // Группируем по складам
            const warehousesMap = new Map();

            for (const item of data) {
                const warehouseID = item.warehouseID;
                const warehouseName = item.warehouseName;
                
                // ВАЖНО: Проверяем доступность приемки
                // Дата доступна только если (coefficient === 0 или 1) И allowUnload === true
                const isAvailable = (item.coefficient === 0 || item.coefficient === 1) && item.allowUnload === true;
                
                if (!isAvailable) {
                    // Пропускаем недоступные даты
                    continue;
                }

                // Получаем или создаем объект склада
                if (!warehousesMap.has(warehouseID)) {
                    warehousesMap.set(warehouseID, {
                        id: warehouseID,
                        name: warehouseName,
                        isSortingCenter: item.isSortingCenter || false,
                        dates: []
                    });
                }

                const warehouse = warehousesMap.get(warehouseID);

                // Добавляем дату
                warehouse.dates.push({
                    date: item.date,
                    coefficient: item.coefficient,
                    allowUnload: item.allowUnload,
                    boxTypeName: item.boxTypeName,
                    boxTypeID: item.boxTypeID,
                    isFree: item.coefficient === 0
                });
            }

            // Конвертируем Map в массив
            const warehouses = Array.from(warehousesMap.values());

            // Сортируем даты в каждом складе
            warehouses.forEach(warehouse => {
                warehouse.dates.sort((a, b) => new Date(a.date) - new Date(b.date));
            });

            // Сортируем склады по количеству доступных дат (больше дат = выше)
            warehouses.sort((a, b) => b.dates.length - a.dates.length);

            console.log(`✅ Обработано складов с доступными датами: ${warehouses.length}`);
            
            // Логируем статистику
            const totalDates = warehouses.reduce((sum, w) => sum + w.dates.length, 0);
            console.log(`📅 Всего доступных дат: ${totalDates}`);

            return warehouses;
        } catch (error) {
            console.error('Ошибка обработки данных складов:', error);
            return [];
        }
    }

    async handleSupplyPlanned(data) {
        await this.addLog(`🎉 Поставка запланирована! Дата: ${data.date}, Коэффициент: ${data.coefficient}`);
        
        await this.sendNotification(
            '🎉 Поставка запланирована!',
            `Дата: ${data.date}\nКоэффициент: ${data.coefficient}`,
            data
        );
    }

    async handleAlarm(alarm) {
        console.log('Alarm triggered:', alarm.name);

        if (alarm.name === this.alarmName) {
            await this.performMonitoring();
        }
    }

    async handleInstall(details) {
        if (details.reason === 'install') {
            console.log('Extension installed');
            
            // Set default settings
            await chrome.storage.local.set({
                monitoringInterval: 15,
                autoMonitoring: false,
                notifyNewDelivery: true,
                notifyStatusChange: true,
                notifyDeadline: true,
                deliveries: [],
                stats: { active: 0, pending: 0, completed: 0 },
                monitoringLog: []
            });

            // Open welcome page
            chrome.tabs.create({
                url: chrome.runtime.getURL('welcome.html')
            });
        } else if (details.reason === 'update') {
            console.log('Extension updated to version', chrome.runtime.getManifest().version);
        }
    }

    async loadSettings() {
        const settings = await chrome.storage.local.get([
            'autoMonitoring',
            'monitoringInterval'
        ]);

        if (settings.autoMonitoring) {
            this.monitoringEnabled = true;
            this.monitoringInterval = settings.monitoringInterval || 15;
            await this.startMonitoring();
        }
    }

    async toggleMonitoring(enabled) {
        this.monitoringEnabled = enabled;
        
        if (enabled) {
            await this.startMonitoring();
            await this.addLog('Автоматический мониторинг включён');
        } else {
            await this.stopMonitoring();
            await this.addLog('Автоматический мониторинг выключен');
        }
    }

    async startMonitoring() {
        console.log('Starting monitoring with interval:', this.monitoringInterval, 'minutes');

        // Clear existing alarms
        await chrome.alarms.clear(this.alarmName);

        // Create new alarm
        await chrome.alarms.create(this.alarmName, {
            periodInMinutes: this.monitoringInterval
        });

        await this.addLog(`Мониторинг запущен (интервал: ${this.monitoringInterval} мин)`);
    }

    async stopMonitoring() {
        console.log('Stopping monitoring');
        await chrome.alarms.clear(this.alarmName);
    }

    async updateMonitoringInterval(interval) {
        this.monitoringInterval = interval;
        
        if (this.monitoringEnabled) {
            await this.startMonitoring();
        }
    }

    async performMonitoring() {
        console.log('Performing automatic monitoring check...');

        try {
            // Get settings
            const settings = await chrome.storage.local.get([
                'apiToken',
                'notifyNewDelivery',
                'notifyStatusChange',
                'notifyDeadline'
            ]);

            if (!settings.apiToken) {
                console.log('No API token configured, skipping monitoring');
                return;
            }

            // Try to get active WB tab
            const tabs = await chrome.tabs.query({
                url: [
                    'https://seller.wildberries.ru/*',
                    'https://suppliers-portal.wildberries.ru/*'
                ]
            });

            if (tabs.length > 0) {
                // Send scan request to first matching tab
                try {
                    const response = await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'scanDeliveries'
                    });

                    if (response.success) {
                        await this.processMonitoringResult(response, settings);
                    }
                } catch (error) {
                    console.log('Could not scan tab:', error);
                }
            } else {
                // No WB tabs open, try API method
                await this.fetchFromAPI(settings);
            }

            await this.addLog('Мониторинг выполнен');
        } catch (error) {
            console.error('Error during monitoring:', error);
            await this.addLog(`Ошибка мониторинга: ${error.message}`);
        }
    }

    async processMonitoringResult(result, settings) {
        // Get previous deliveries state
        const data = await chrome.storage.local.get(['deliveries', 'lastNotificationTime']);
        const previousDeliveries = data.deliveries || [];
        const currentDeliveries = result.deliveries || [];

        // Check for new deliveries
        if (settings.notifyNewDelivery) {
            const newDeliveries = currentDeliveries.filter(current => 
                !previousDeliveries.find(prev => prev.id === current.id)
            );

            if (newDeliveries.length > 0) {
                await this.sendNotification(
                    '🆕 Новые поставки',
                    `Обнаружено новых поставок: ${newDeliveries.length}`,
                    { type: 'new_delivery', count: newDeliveries.length }
                );
            }
        }

        // Check for status changes
        if (settings.notifyStatusChange) {
            const statusChanges = currentDeliveries.filter(current => {
                const previous = previousDeliveries.find(p => p.id === current.id);
                return previous && previous.status !== current.status;
            });

            if (statusChanges.length > 0) {
                await this.sendNotification(
                    '🔄 Изменение статуса',
                    `Статус поставок изменился: ${statusChanges.length}`,
                    { type: 'status_change', changes: statusChanges }
                );
            }
        }

        // Check for approaching deadlines
        if (settings.notifyDeadline) {
            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;
            
            const approachingDeadlines = currentDeliveries.filter(delivery => {
                if (!delivery.deadline) return false;
                const timeUntilDeadline = delivery.deadline - now;
                return timeUntilDeadline > 0 && timeUntilDeadline < oneDayMs;
            });

            if (approachingDeadlines.length > 0) {
                await this.sendNotification(
                    '⏰ Приближается дедлайн',
                    `Поставки с истекающим сроком: ${approachingDeadlines.length}`,
                    { type: 'deadline', deliveries: approachingDeadlines }
                );
            }
        }
    }

    async fetchFromAPI(settings) {
        // If API token is configured, try to fetch from WB API
        if (!settings.apiToken) return;

        try {
            const response = await fetch('https://suppliers-api.wildberries.ru/api/v2/supplies', {
                headers: {
                    'Authorization': settings.apiToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Process and save deliveries
                if (data.supplies && data.supplies.length > 0) {
                    const deliveries = data.supplies.map(supply => ({
                        id: supply.id,
                        status: this.mapAPIStatus(supply.status),
                        createdAt: new Date(supply.createdAt).getTime(),
                        deadline: supply.deadline ? new Date(supply.deadline).getTime() : null,
                        itemsCount: supply.itemsCount,
                        scannedAt: Date.now(),
                        source: 'api'
                    }));

                    await chrome.storage.local.set({ deliveries });
                    await this.updateStatistics(deliveries);

                    await this.addLog(`Получено из API: ${deliveries.length} поставок`);
                }
            }
        } catch (error) {
            console.error('Error fetching from API:', error);
            await this.addLog(`Ошибка API: ${error.message}`);
        }
    }

    mapAPIStatus(status) {
        const statusMap = {
            'CREATED': 'pending',
            'ACTIVE': 'active',
            'IN_PROGRESS': 'active',
            'COMPLETED': 'completed',
            'CANCELLED': 'cancelled'
        };
        return statusMap[status] || 'active';
    }

    async updateStatistics(deliveries) {
        const stats = {
            active: deliveries.filter(d => d.status === 'active').length,
            pending: deliveries.filter(d => d.status === 'pending').length,
            completed: deliveries.filter(d => d.status === 'completed').length,
            total: deliveries.length
        };

        await chrome.storage.local.set({ stats });
    }

    async refreshDeliveries() {
        console.log('Refreshing deliveries...');
        
        // Perform immediate monitoring check
        await this.performMonitoring();
    }

    async handleDeliveriesScanned(count) {
        await this.addLog(`Сканирование завершено: найдено ${count} поставок`);
    }

    async sendNotification(title, message, data = {}) {
        // Check if notifications are allowed
        const lastNotification = await chrome.storage.local.get(['lastNotificationTime']);
        const now = Date.now();
        
        // Throttle notifications (max one per minute for same type)
        if (lastNotification.lastNotificationTime) {
            const timeSinceLastNotification = now - lastNotification.lastNotificationTime;
            if (timeSinceLastNotification < 60000) {
                console.log('Notification throttled');
                return;
            }
        }

        // Create notification
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: title,
            message: message,
            priority: 2
        });

        // Update last notification time
        await chrome.storage.local.set({ lastNotificationTime: now });

        // Send to Telegram if configured
        await this.sendTelegramNotification(title, message, data);
    }

    async sendTelegramNotification(title, message, data) {
        try {
            // Форматируем сообщение
            const timestamp = new Date().toLocaleString('ru-RU');
            const text = `🚚 <b>WB Extension</b>\n\n` +
                        `<b>${title}</b>\n\n` +
                        `${message}\n\n` +
                        `⏰ ${timestamp}`;
            
            const response = await fetch(
                `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        chat_id: this.TELEGRAM_CHAT_ID,
                        text: text,
                        parse_mode: 'HTML'
                    })
                }
            );

            if (response.ok) {
                console.log('✅ Уведомление отправлено в Telegram бот');
                const result = await response.json();
                console.log('   Message ID:', result.result.message_id);
            } else {
                const error = await response.text();
                console.log('⚠️ Ошибка отправки в Telegram:', error);
            }
        } catch (error) {
            console.log('Telegram notification error:', error);
        }
    }

    async addLog(message) {
        const data = await chrome.storage.local.get(['monitoringLog']);
        const logs = data.monitoringLog || [];
        
        logs.push({
            timestamp: Date.now(),
            message: message
        });

        // Keep only last 50 entries
        if (logs.length > 50) {
            logs.splice(0, logs.length - 50);
        }

        await chrome.storage.local.set({ monitoringLog: logs });
    }
}

// Initialize background service
const backgroundService = new BackgroundService();


