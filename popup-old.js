// Popup script for WB Deliveries Extension

class PopupManager {
    constructor() {
        this.currentTab = 'deliveries';
        this.init();
    }

    async init() {
        this.setupTabs();
        this.setupButtons();
        this.setupSettings();
        await this.loadData();
        this.updateLastUpdateTime();
        await this.checkConnectionStatus();
        await this.checkApiKey();
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
    }

    switchTab(tabName) {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;
    }

    setupButtons() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', async () => {
            await this.refreshData();
        });

        // Scan page button
        document.getElementById('scanPageBtn').addEventListener('click', async () => {
            await this.scanCurrentPage();
        });

        // Save settings button
        document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
            await this.saveSettings();
        });

        // Clear data button
        document.getElementById('clearDataBtn').addEventListener('click', async () => {
            if (confirm('Вы уверены, что хотите очистить все данные?')) {
                await this.clearAllData();
            }
        });

        // Auto monitoring toggle
        document.getElementById('autoMonitoringToggle').addEventListener('change', async (e) => {
            await this.toggleMonitoring(e.target.checked);
        });

        // Auto-catch buttons
        document.getElementById('startAutoCatchBtn').addEventListener('click', async () => {
            await this.startAutoCatch();
        });

        document.getElementById('stopAutoCatchBtn').addEventListener('click', async () => {
            await this.stopAutoCatch();
        });

        document.getElementById('testClickBtn').addEventListener('click', async () => {
            await this.testClick();
        });

        document.getElementById('resetStatsBtn').addEventListener('click', async () => {
            if (confirm('Сбросить статистику кликов?')) {
                await this.resetAutoCatchStats();
            }
        });

        document.getElementById('autoCatchToggle').addEventListener('change', async (e) => {
            if (e.target.checked) {
                await this.startAutoCatch();
            } else {
                await this.stopAutoCatch();
            }
        });

        // Update auto-catch status periodically
        setInterval(async () => {
            await this.updateAutoCatchStatus();
            await this.updateRedistributeStatus();
        }, 1000);

        // Date filter mode change
        document.getElementById('dateFilterMode').addEventListener('change', (e) => {
            this.updateDateFilterVisibility(e.target.value);
        });

        // Coefficient filter toggle
        document.getElementById('filterByCoefficient').addEventListener('change', (e) => {
            document.getElementById('coefficientBlock').style.display = e.target.checked ? 'block' : 'none';
        });

        // Box type change - показываем поле количества только для монопаллет
        document.getElementById('boxType').addEventListener('change', (e) => {
            document.getElementById('monopalletBlock').style.display = e.target.value === 'monopallet' ? 'block' : 'none';
        });

        // Debug buttons
        document.getElementById('debugCalendarBtn').addEventListener('click', async () => {
            await this.debugCalendar();
        });

        document.getElementById('openConsoleBtn').addEventListener('click', () => {
            this.showNotification('Нажмите F12 для открытия консоли', 'info');
        });

        // Refresh warehouses button
        document.getElementById('refreshWarehousesBtn').addEventListener('click', async () => {
            await this.refreshWarehouses();
        });

        // Go to settings button (from API warning)
        const goToSettingsBtn = document.getElementById('goToSettingsBtn');
        if (goToSettingsBtn) {
            goToSettingsBtn.addEventListener('click', () => {
                this.switchTab('settings');
            });
        }

        // Redistribute toggle
        document.getElementById('redistributeToggle').addEventListener('change', async (e) => {
            if (e.target.checked) {
                await this.startRedistribute();
            } else {
                await this.stopRedistribute();
            }
        });
    }

    updateDateFilterVisibility(mode) {
        document.getElementById('specificDateBlock').style.display = mode === 'specific' ? 'block' : 'none';
        document.getElementById('dateRangeBlock').style.display = mode === 'range' ? 'block' : 'none';
    }

    async setupSettings() {
        // Load saved settings
        const settings = await chrome.storage.local.get([
            'apiToken',
            'monitoringInterval',
            'autoMonitoring',
            'notifyNewDelivery',
            'notifyStatusChange',
            'notifyDeadline'
        ]);

        // Populate form fields
        if (settings.apiToken) {
            document.getElementById('apiToken').value = settings.apiToken;
        }
        if (settings.monitoringInterval) {
            document.getElementById('monitoringInterval').value = settings.monitoringInterval;
        }

        // Set checkboxes
        document.getElementById('autoMonitoringToggle').checked = settings.autoMonitoring || false;
        document.getElementById('notifyNewDelivery').checked = settings.notifyNewDelivery !== false;
        document.getElementById('notifyStatusChange').checked = settings.notifyStatusChange !== false;
        document.getElementById('notifyDeadline').checked = settings.notifyDeadline !== false;
    }

    async loadData() {
        const data = await chrome.storage.local.get([
            'deliveries', 
            'stats', 
            'monitoringLog', 
            'autoCatchStats', 
            'autoCatchInterval',
            'warehousesData',
            'lastWarehousesUpdate'
        ]);
        
        // Update statistics
        const stats = data.stats || { active: 0, pending: 0, completed: 0 };
        document.getElementById('activeDeliveries').textContent = stats.active;
        document.getElementById('pendingDeliveries').textContent = stats.pending;
        document.getElementById('completedDeliveries').textContent = stats.completed;

        // Update deliveries list
        if (data.deliveries && data.deliveries.length > 0) {
            this.renderDeliveries(data.deliveries);
        }

        // Update monitoring log
        if (data.monitoringLog && data.monitoringLog.length > 0) {
            this.renderMonitoringLog(data.monitoringLog);
        }

        // Update auto-catch stats
        if (data.autoCatchStats) {
            this.updateAutoCatchStatsDisplay(data.autoCatchStats);
        }

        // Update auto-catch interval
        if (data.autoCatchInterval) {
            document.getElementById('autoCatchInterval').value = data.autoCatchInterval;
        }

        // Update warehouses data
        if (data.warehousesData) {
            this.renderWarehouses(data.warehousesData, data.lastWarehousesUpdate);
        }

        // Update auto-catch status
        await this.updateAutoCatchStatus();
    }

    renderDeliveries(deliveries) {
        const container = document.getElementById('deliveriesList');
        
        if (deliveries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>📦 Нет активных поставок</p>
                    <p class="empty-hint">Перейдите на страницу поставок WB и нажмите "Сканировать"</p>
                </div>
            `;
            return;
        }

        container.innerHTML = deliveries.map(delivery => `
            <div class="delivery-item">
                <div class="delivery-header">
                    <span class="delivery-id">№ ${delivery.id}</span>
                    <span class="delivery-status ${delivery.status}">${this.getStatusText(delivery.status)}</span>
                </div>
                <div class="delivery-info">
                    📅 Создана: ${new Date(delivery.createdAt).toLocaleDateString('ru-RU')}
                    ${delivery.deadline ? `<br>⏰ Дедлайн: ${new Date(delivery.deadline).toLocaleDateString('ru-RU')}` : ''}
                    ${delivery.itemsCount ? `<br>📦 Товаров: ${delivery.itemsCount}` : ''}
                </div>
            </div>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'active': 'Активна',
            'pending': 'Ожидает',
            'completed': 'Завершена',
            'cancelled': 'Отменена'
        };
        return statusMap[status] || status;
    }

    renderMonitoringLog(logs) {
        const container = document.getElementById('monitoringLog');
        
        if (logs.length === 0) {
            container.innerHTML = '<p class="log-empty">История пуста</p>';
            return;
        }

        container.innerHTML = logs.slice(-10).reverse().map(log => `
            <div class="log-entry">
                ${new Date(log.timestamp).toLocaleTimeString('ru-RU')} - ${log.message}
            </div>
        `).join('');
    }

    async refreshData() {
        const btn = document.getElementById('refreshBtn');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Обновление...';

        try {
            // Send message to background script to refresh data
            await chrome.runtime.sendMessage({ action: 'refreshDeliveries' });
            
            // Reload data
            await this.loadData();
            this.updateLastUpdateTime();

            // Show success
            this.showNotification('Данные обновлены', 'success');
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showNotification('Ошибка при обновлении', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>🔄</span> Обновить данные';
        }
    }

    async scanCurrentPage() {
        const btn = document.getElementById('scanPageBtn');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Сканирование...';

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('wildberries.ru')) {
                this.showNotification('Откройте страницу Wildberries', 'warning');
                return;
            }

            // Send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanDeliveries' });

            if (response.success) {
                await this.loadData();
                this.showNotification(`Найдено поставок: ${response.count}`, 'success');
            }
        } catch (error) {
            console.error('Error scanning page:', error);
            this.showNotification('Ошибка сканирования', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>📊</span> Сканировать страницу';
        }
    }

    async saveSettings() {
        const settings = {
            apiToken: document.getElementById('apiToken').value,
            monitoringInterval: parseInt(document.getElementById('monitoringInterval').value),
            notifyNewDelivery: document.getElementById('notifyNewDelivery').checked,
            notifyStatusChange: document.getElementById('notifyStatusChange').checked,
            notifyDeadline: document.getElementById('notifyDeadline').checked
        };

        try {
            await chrome.storage.local.set(settings);
            
            // Перепроверяем API ключ
            await this.checkApiKey();
            
            // Update monitoring if enabled
            const autoMonitoring = document.getElementById('autoMonitoringToggle').checked;
            if (autoMonitoring) {
                await chrome.runtime.sendMessage({ 
                    action: 'updateMonitoringInterval', 
                    interval: settings.monitoringInterval 
                });
            }

            this.showNotification('Настройки сохранены', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Ошибка сохранения', 'error');
        }
    }

    async toggleMonitoring(enabled) {
        try {
            await chrome.storage.local.set({ autoMonitoring: enabled });
            await chrome.runtime.sendMessage({ 
                action: 'toggleMonitoring', 
                enabled: enabled 
            });

            const status = enabled ? 'включён' : 'выключен';
            this.showNotification(`Мониторинг ${status}`, 'success');

            // Add log entry
            await this.addMonitoringLog(`Мониторинг ${status}`);
        } catch (error) {
            console.error('Error toggling monitoring:', error);
            this.showNotification('Ошибка переключения', 'error');
        }
    }

    async clearAllData() {
        try {
            await chrome.storage.local.clear();
            await this.loadData();
            this.showNotification('Все данные очищены', 'success');
            
            // Reset form
            document.getElementById('apiToken').value = '';
            
            // Перепроверяем API ключ
            await this.checkApiKey();
        } catch (error) {
            console.error('Error clearing data:', error);
            this.showNotification('Ошибка очистки', 'error');
        }
    }

    async addMonitoringLog(message) {
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
        this.renderMonitoringLog(logs);
    }

    updateLastUpdateTime() {
        const now = new Date().toLocaleTimeString('ru-RU');
        document.getElementById('lastUpdate').textContent = now;
    }

    async checkConnectionStatus() {
        const settings = await chrome.storage.local.get(['apiToken']);
        const indicator = document.getElementById('statusIndicator');
        
        if (settings.apiToken) {
            indicator.classList.add('active');
            indicator.querySelector('.status-text').textContent = 'Подключено';
        } else {
            indicator.classList.remove('active');
            indicator.querySelector('.status-text').textContent = 'Не подключено';
        }
    }

    async checkApiKey() {
        const settings = await chrome.storage.local.get(['apiToken']);
        const warning = document.getElementById('apiKeyWarning');
        const mainContent = document.getElementById('mainContent');
        
        if (!settings.apiToken) {
            // Показываем предупреждение
            warning.style.display = 'block';
            mainContent.classList.add('hidden');
            
            // Блокируем другие вкладки
            document.querySelectorAll('.tab').forEach(tab => {
                if (tab.dataset.tab !== 'deliveries' && tab.dataset.tab !== 'settings') {
                    tab.style.opacity = '0.5';
                    tab.style.pointerEvents = 'none';
                }
            });
        } else {
            // Скрываем предупреждение
            warning.style.display = 'none';
            mainContent.classList.remove('hidden');
            
            // Разблокируем вкладки
            document.querySelectorAll('.tab').forEach(tab => {
                tab.style.opacity = '1';
                tab.style.pointerEvents = 'auto';
            });
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            font-size: 13px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ========== AUTO-CATCH METHODS ==========

    async startAutoCatch() {
        const interval = parseInt(document.getElementById('autoCatchInterval').value);

        if (!interval || interval < 100) {
            this.showNotification('Неверный интервал', 'error');
            return;
        }

        // Collect filter settings
        const filters = this.collectFilters();
        
        console.log('🎯 POPUP: Собранные фильтры:', filters);

        try {
            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('wildberries.ru')) {
                this.showNotification('Откройте страницу Wildberries', 'warning');
                return;
            }

            // Save filters to storage
            await chrome.storage.local.set({ autoCatchFilters: filters });
            console.log('💾 POPUP: Фильтры сохранены в storage');

            // Send start command to content script
            console.log('📤 POPUP: Отправляем фильтры в content script:', filters);
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'startAutoCatch',
                interval: interval,
                filters: filters
            });

            if (response.success) {
                document.getElementById('autoCatchToggle').checked = true;
                document.getElementById('startAutoCatchBtn').disabled = true;
                document.getElementById('stopAutoCatchBtn').disabled = false;
                document.getElementById('autoCatchInterval').disabled = true;

                this.showNotification('🎯 Автоловля запущена!', 'success');
            }
        } catch (error) {
            console.error('Error starting auto-catch:', error);
            this.showNotification('Ошибка запуска. Обновите страницу WB', 'error');
        }
    }

    collectFilters() {
        const dateMode = document.getElementById('dateFilterMode').value;
        const filterByCoef = document.getElementById('filterByCoefficient').checked;
        const boxType = document.getElementById('boxType').value;

        const filters = {
            dateMode: dateMode,
            specificDate: null,
            dateFrom: null,
            dateTo: null,
            filterByCoefficient: filterByCoef,
            coefficientFrom: 0,
            coefficientTo: 20,
            allowFree: true,
            boxType: boxType,
            monopalletCount: 1  // По умолчанию 1, если не монопаллеты - игнорируется
        };

        // Date filters
        if (dateMode === 'specific') {
            filters.specificDate = document.getElementById('specificDate').value;
        } else if (dateMode === 'range') {
            filters.dateFrom = document.getElementById('dateFrom').value;
            filters.dateTo = document.getElementById('dateTo').value;
        }

        // Coefficient filters
        if (filterByCoef) {
            filters.coefficientFrom = parseInt(document.getElementById('coefficientFrom').value);
            filters.coefficientTo = parseInt(document.getElementById('coefficientTo').value);
            filters.allowFree = document.getElementById('allowFree').checked;
        }

        // Monopallet count - только если выбраны монопаллеты
        if (boxType === 'monopallet') {
            filters.monopalletCount = parseInt(document.getElementById('monopalletCount').value) || 1;
        }

        return filters;
    }

    async stopAutoCatch() {
        try {
            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Send stop command to content script
            await chrome.tabs.sendMessage(tab.id, {
                action: 'stopAutoCatch'
            });

            document.getElementById('autoCatchToggle').checked = false;
            document.getElementById('startAutoCatchBtn').disabled = false;
            document.getElementById('stopAutoCatchBtn').disabled = true;
            document.getElementById('autoCatchInterval').disabled = false;

            this.showNotification('🛑 Автоловля остановлена', 'success');
        } catch (error) {
            console.error('Error stopping auto-catch:', error);
        }
    }

    async testClick() {
        const btn = document.getElementById('testClickBtn');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Тест...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('wildberries.ru')) {
                this.showNotification('Откройте страницу Wildberries', 'warning');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'clickButton'
            });

            if (response.success) {
                this.showNotification('✅ Тестовый клик выполнен', 'success');
            } else {
                if (response.reason === 'not_found') {
                    this.showNotification('❌ Кнопка не найдена на странице', 'error');
                } else if (response.reason === 'disabled') {
                    this.showNotification('⚠️ Кнопка недоступна', 'warning');
                } else {
                    this.showNotification('❌ Ошибка клика', 'error');
                }
            }
        } catch (error) {
            console.error('Error test click:', error);
            this.showNotification('Ошибка. Обновите страницу WB', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>🧪</span> Тестовый клик';
        }
    }

    async updateAutoCatchStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url.includes('wildberries.ru')) {
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getAutoCatchStatus'
            });

            if (response) {
                const statusBadge = document.getElementById('autoCatchStatus');
                const clickCountEl = document.getElementById('clickCount');
                const lastClickEl = document.getElementById('lastClickTime');

                if (response.enabled) {
                    statusBadge.textContent = 'Активна';
                    statusBadge.className = 'status-badge running';
                    document.getElementById('startAutoCatchBtn').disabled = true;
                    document.getElementById('stopAutoCatchBtn').disabled = false;
                    document.getElementById('autoCatchToggle').checked = true;
                } else {
                    statusBadge.textContent = 'Остановлена';
                    statusBadge.className = 'status-badge stopped';
                    document.getElementById('startAutoCatchBtn').disabled = false;
                    document.getElementById('stopAutoCatchBtn').disabled = true;
                    document.getElementById('autoCatchToggle').checked = false;
                }

                clickCountEl.textContent = response.clickCount || 0;
                
                if (response.lastClickTime) {
                    const time = new Date(response.lastClickTime);
                    lastClickEl.textContent = time.toLocaleTimeString('ru-RU');
                } else {
                    lastClickEl.textContent = '-';
                }
            }
        } catch (error) {
            // Tab might not have content script, ignore
        }
    }

    updateAutoCatchStatsDisplay(stats) {
        if (stats.totalClicks) {
            document.getElementById('totalClicks').textContent = stats.totalClicks;
        }
    }

    async resetAutoCatchStats() {
        await chrome.storage.local.set({
            autoCatchStats: {
                totalClicks: 0,
                successfulClicks: 0,
                lastClickTime: null,
                sessionClicks: 0
            }
        });

        document.getElementById('totalClicks').textContent = '0';
        this.showNotification('Статистика сброшена', 'success');
    }

    async refreshWarehouses() {
        const btn = document.getElementById('refreshWarehousesBtn');
        btn.disabled = true;
        btn.innerHTML = '⏳ Загрузка...';

        try {
            // Запрашиваем данные через background script
            const response = await chrome.runtime.sendMessage({ action: 'fetchWarehouses' });

            if (response.success && response.warehouses) {
                this.renderWarehouses(response.warehouses, Date.now());
                this.showNotification(`✅ Загружено складов: ${response.warehouses.length}`, 'success');
            } else {
                this.showNotification(`❌ ${response.warehouses?.error || 'Ошибка загрузки'}`, 'error');
            }
        } catch (error) {
            console.error('Error refreshing warehouses:', error);
            this.showNotification('Ошибка API. Проверьте токен', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🔄 Обновить';
        }
    }

    renderWarehouses(warehouses, lastUpdate) {
        const container = document.getElementById('warehousesContainer');

        if (!warehouses || warehouses.length === 0 || warehouses.error) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>⚠️ Нет данных о складах</p>
                    <p class="empty-hint">${warehouses?.error || 'Проверьте API токен в настройках'}</p>
                </div>
            `;
            return;
        }

        let html = '';
        let totalAvailableDates = 0;

        for (const warehouse of warehouses) {
            const datesCount = warehouse.dates?.length || 0;
            totalAvailableDates += datesCount;
            
            if (datesCount === 0) continue; // Пропускаем склады без доступных дат
            
            const scIcon = warehouse.isSortingCenter ? '📦' : '🏭';
            
            html += `
                <div class="warehouse-card">
                    <div class="warehouse-header">
                        <span class="warehouse-name">${scIcon} ${warehouse.name}</span>
                        <span class="dates-count">${datesCount} ${this.getDatesWord(datesCount)}</span>
                    </div>
            `;

            if (warehouse.dates && warehouse.dates.length > 0) {
                html += '<div class="warehouse-dates">';
                
                // Показываем первые 12 дат
                warehouse.dates.slice(0, 12).forEach(dateItem => {
                    const date = new Date(dateItem.date);
                    const dateStr = date.toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'short'
                    });
                    const coef = dateItem.coefficient;
                    const isFree = coef === 0;
                    const coefClass = isFree ? 'free' : 'paid';
                    const coefText = isFree ? '✅ Бесплатно' : `${coef}x`;
                    const boxType = dateItem.boxTypeName ? `<div style="font-size: 10px; color: #9ca3af;">${dateItem.boxTypeName}</div>` : '';

                    html += `
                        <div class="date-item">
                            <div class="date-item-date">${dateStr}</div>
                            <div class="date-item-coef ${coefClass}">${coefText}</div>
                            ${boxType}
                        </div>
                    `;
                });

                if (warehouse.dates.length > 12) {
                    html += `<div class="date-item" style="text-align: center; color: #6b7280; display: flex; align-items: center; justify-content: center;">+${warehouse.dates.length - 12} еще</div>`;
                }

                html += '</div>';
            }

            html += '</div>';
        }

        // Добавляем общую статистику
        html = `
            <div class="stats-summary">
                <div class="summary-item">
                    <span class="summary-label">Складов с доступными датами:</span>
                    <span class="summary-value">${warehouses.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Всего доступных дат:</span>
                    <span class="summary-value">${totalAvailableDates}</span>
                </div>
            </div>
        ` + html;

        if (lastUpdate) {
            const updateTime = new Date(lastUpdate).toLocaleTimeString('ru-RU');
            html += `<p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px;">Последнее обновление: ${updateTime}</p>`;
        }

        container.innerHTML = html;
    }

    getDatesWord(count) {
        if (count % 10 === 1 && count % 100 !== 11) return 'дата';
        if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'даты';
        return 'дат';
    }

    // ========== REDISTRIBUTE METHODS ==========

    openRedistributePage() {
        chrome.tabs.create({
            url: 'https://seller.wildberries.ru/analytics-reports/warehouse-remains'
        });
        this.showNotification('Открываем страницу перераспределения', 'info');
    }

    async updateRedistributeStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url.includes('warehouse-remains')) {
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getRedistributeStatus'
            });

            if (response) {
                const statusBadge = document.getElementById('redistributeStatus');
                const countEl = document.getElementById('redistributeCount');

                if (response.enabled) {
                    statusBadge.textContent = 'Активно';
                    statusBadge.className = 'status-badge running';
                } else {
                    statusBadge.textContent = 'Остановлено';
                    statusBadge.className = 'status-badge stopped';
                }

                countEl.textContent = response.count || 0;
            }
        } catch (error) {
            // Ignore
        }
    }

    async startRedistribute() {
        // Собираем данные от пользователя
        const article = document.getElementById('redistributeArticle').value.trim();
        const quantity = parseInt(document.getElementById('redistributeQuantity').value);
        const warehouseFrom = document.getElementById('warehouseFrom').value;
        const warehouseTo = document.getElementById('warehouseTo').value;

        // Валидация
        if (!article) {
            this.showNotification('❌ Введите артикул товара', 'error');
            return;
        }

        if (!quantity || quantity < 1) {
            this.showNotification('❌ Введите количество товара', 'error');
            return;
        }

        if (!warehouseFrom) {
            this.showNotification('❌ Выберите склад ОТКУДА забрать', 'error');
            return;
        }

        if (!warehouseTo) {
            this.showNotification('❌ Выберите склад КУДА переместить', 'error');
            return;
        }

        if (warehouseFrom === warehouseTo) {
            this.showNotification('❌ Склады должны быть разными', 'error');
            return;
        }

        const settings = {
            article: article,
            quantity: quantity,
            warehouseFrom: warehouseFrom,
            warehouseTo: warehouseTo
        };

        console.log('📋 Настройки перераспределения:', settings);

        try {
            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('warehouse-remains')) {
                // Открываем нужную страницу
                const newTab = await chrome.tabs.create({
                    url: 'https://seller.wildberries.ru/analytics-reports/warehouse-remains'
                });

                // Ждем загрузки страницы
                await this.sleep(3000);

                // Отправляем команду на новую вкладку
                await chrome.tabs.sendMessage(newTab.id, {
                    action: 'startRedistribute',
                    settings: settings
                });
            } else {
                // Отправляем на текущую вкладку
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'startRedistribute',
                    settings: settings
                });
            }

            document.getElementById('redistributeToggle').checked = true;
            this.showNotification('🔄 Перераспределение запущено', 'success');
        } catch (error) {
            console.error('Error starting redistribute:', error);
            this.showNotification('Ошибка запуска', 'error');
        }
    }

    async stopRedistribute() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            await chrome.tabs.sendMessage(tab.id, {
                action: 'stopRedistribute'
            });

            document.getElementById('redistributeToggle').checked = false;
            this.showNotification('🛑 Перераспределение остановлено', 'success');
        } catch (error) {
            console.error('Error stopping redistribute:', error);
        }
    }

    async testRedistributeClick() {
        const btn = document.getElementById('testRedistributeBtn');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Тест...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('warehouse-remains')) {
                this.showNotification('Откройте страницу перераспределения', 'warning');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'testRedistributeClick'
            });

            if (response.success) {
                this.showNotification('✅ Кнопка найдена и нажата', 'success');
            } else {
                this.showNotification('❌ Кнопка не найдена', 'error');
            }
        } catch (error) {
            console.error('Error test redistribute:', error);
            this.showNotification('Ошибка. Обновите страницу', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>🧪</span> Тестовый клик';
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async debugCalendar() {
        const btn = document.getElementById('debugCalendarBtn');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Проверка...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('wildberries.ru')) {
                this.showNotification('Откройте страницу Wildberries', 'warning');
                return;
            }

            // Отправляем команду для отладки
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'debugCalendar'
            });

            if (response) {
                console.log('Debug info:', response);
                let message = `Модальных окон: ${response.modalsCount}\n`;
                message += `TD элементов: ${response.tdCount}\n`;
                message += `Ячеек календаря: ${response.calendarCells}\n`;
                
                alert(message + '\nПодробности в консоли (F12)');
            }
        } catch (error) {
            console.error('Debug error:', error);
            this.showNotification('Ошибка отладки. Откройте F12 и посмотрите консоль', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>🔍</span> Отладка календаря';
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});


