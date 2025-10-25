// Popup script for WB Extension with License System

const LICENSE_SERVER_URL = 'http://localhost:3000'; // Замените на ваш URL

class PopupManager {
    constructor() {
        this.currentTab = 'license';
        this.licenseValid = false;
        this.init();
    }

    async init() {
        this.setupTabs();
        this.setupButtons();
        await this.checkLicense();
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (!this.licenseValid && tab.dataset.tab !== 'license') {
                    this.showNotification('❌ Сначала активируйте расширение', 'error');
                    return;
                }
                this.switchTab(tab.dataset.tab);
            });
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById(tabName)?.classList.add('active');

        this.currentTab = tabName;
    }

    setupButtons() {
        // License activation
        document.getElementById('activateBtn')?.addEventListener('click', async () => {
            await this.activateLicense();
        });

        document.getElementById('deactivateBtn')?.addEventListener('click', async () => {
            await this.deactivateLicense();
        });

        document.getElementById('renewBtn')?.addEventListener('click', () => {
            this.showLicenseInput();
        });

        // Enter key for activation
        document.getElementById('licenseKey')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.activateLicense();
            }
        });

        // Auto-catch buttons
        document.getElementById('startAutoCatchBtn')?.addEventListener('click', async () => {
            if (!this.licenseValid) {
                this.showNotification('❌ Активируйте расширение', 'error');
                return;
            }
            await this.startAutoCatch();
        });

        document.getElementById('stopAutoCatchBtn')?.addEventListener('click', async () => {
            await this.stopAutoCatch();
        });

        document.getElementById('testClickBtn')?.addEventListener('click', async () => {
            if (!this.licenseValid) {
                this.showNotification('❌ Активируйте расширение', 'error');
                return;
            }
            await this.testClick();
        });

        document.getElementById('resetStatsBtn')?.addEventListener('click', async () => {
            if (confirm('Сбросить статистику?')) {
                await this.resetAutoCatchStats();
            }
        });

        document.getElementById('autoCatchToggle')?.addEventListener('change', async (e) => {
            if (!this.licenseValid) {
                e.target.checked = false;
                this.showNotification('❌ Активируйте расширение', 'error');
                return;
            }
            if (e.target.checked) {
                await this.startAutoCatch();
            } else {
                await this.stopAutoCatch();
            }
        });

        // Redistribute toggle
        document.getElementById('redistributeToggle')?.addEventListener('change', async (e) => {
            if (!this.licenseValid) {
                e.target.checked = false;
                this.showNotification('❌ Активируйте расширение', 'error');
                return;
            }
            if (e.target.checked) {
                await this.startRedistribute();
            } else {
                await this.stopRedistribute();
            }
        });

        // Box type change
        document.getElementById('boxType')?.addEventListener('change', (e) => {
            const monoBlock = document.getElementById('monopalletBlock');
            if (monoBlock) {
                monoBlock.style.display = e.target.value === 'monopallet' ? 'block' : 'none';
            }
        });

        // Date filter mode
        document.getElementById('dateFilterMode')?.addEventListener('change', (e) => {
            this.updateDateFilterVisibility(e.target.value);
        });

        // Coefficient filter
        document.getElementById('filterByCoefficient')?.addEventListener('change', (e) => {
            const coeffBlock = document.getElementById('coefficientBlock');
            if (coeffBlock) {
                coeffBlock.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Debug buttons
        document.getElementById('debugCalendarBtn')?.addEventListener('click', async () => {
            await this.debugCalendar();
        });

        document.getElementById('openConsoleBtn')?.addEventListener('click', () => {
            this.showNotification('Нажмите F12 для открытия консоли', 'info');
        });

        // Update statuses
        setInterval(async () => {
            if (this.licenseValid) {
                await this.updateAutoCatchStatus();
                await this.updateRedistributeStatus();
            }
        }, 1000);
    }

    updateDateFilterVisibility(mode) {
        const specificBlock = document.getElementById('specificDateBlock');
        const rangeBlock = document.getElementById('dateRangeBlock');
        
        if (specificBlock) specificBlock.style.display = mode === 'specific' ? 'block' : 'none';
        if (rangeBlock) rangeBlock.style.display = mode === 'range' ? 'block' : 'none';
    }

    // ========== LICENSE METHODS ==========

    async checkLicense() {
        const data = await chrome.storage.local.get(['licenseKey']);
        
        if (!data.licenseKey) {
            this.showLicenseInput();
            return;
        }

        // Verify license with server
        const result = await this.verifyLicense(data.licenseKey);
        
        if (result.valid) {
            this.licenseValid = true;
            this.showLicenseActive(data.licenseKey, result);
            this.updateStatusIndicator(true);
        } else if (result.expired) {
            this.showLicenseExpired(data.licenseKey);
            this.updateStatusIndicator(false);
        } else {
            this.showLicenseInput();
            this.showNotification(result.error || 'Неверный ключ', 'error');
            await chrome.storage.local.remove(['licenseKey']);
        }
    }

    async verifyLicense(licenseKey) {
        try {
            const response = await fetch(`${LICENSE_SERVER_URL}/api/verify-license`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('License verification error:', error);
            return { 
                success: false, 
                valid: false, 
                error: 'Ошибка подключения к серверу лицензий' 
            };
        }
    }

    async activateLicense() {
        const input = document.getElementById('licenseKey');
        const licenseKey = input?.value.trim().toUpperCase();

        if (!licenseKey) {
            this.showNotification('Введите ключ активации', 'error');
            return;
        }

        const btn = document.getElementById('activateBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳</span> Проверка...';
        }

        const result = await this.verifyLicense(licenseKey);

        if (result.valid) {
            await chrome.storage.local.set({ licenseKey });
            this.licenseValid = true;
            this.showLicenseActive(licenseKey, result);
            this.showNotification('✅ Расширение активировано!', 'success');
            this.updateStatusIndicator(true);
        } else {
            this.showNotification(result.error || 'Неверный ключ активации', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>✅</span> Активировать';
            }
        }
    }

    async deactivateLicense() {
        if (!confirm('Деактивировать расширение?')) return;

        await chrome.storage.local.remove(['licenseKey']);
        this.licenseValid = false;
        this.showLicenseInput();
        this.showNotification('Расширение деактивировано', 'info');
        this.updateStatusIndicator(false);
        this.switchTab('license');
    }

    showLicenseInput() {
        document.getElementById('licenseWarning').style.display = 'block';
        document.getElementById('licenseActive').style.display = 'none';
        document.getElementById('licenseExpired').style.display = 'none';
        
        // Block other tabs
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.dataset.tab !== 'license') {
                tab.style.opacity = '0.5';
                tab.style.pointerEvents = 'none';
            }
        });
    }

    showLicenseActive(licenseKey, data) {
        document.getElementById('licenseWarning').style.display = 'none';
        document.getElementById('licenseActive').style.display = 'block';
        document.getElementById('licenseExpired').style.display = 'none';

        // Update info
        const currentKeyEl = document.getElementById('currentLicenseKey');
        const daysLeftEl = document.getElementById('daysLeft');
        const expiresAtEl = document.getElementById('expiresAt');
        const userInfoEl = document.getElementById('userInfo');
        const userInfoRow = document.getElementById('userInfoRow');

        if (currentKeyEl) currentKeyEl.textContent = licenseKey;
        if (daysLeftEl) {
            daysLeftEl.textContent = data.daysLeft;
            daysLeftEl.style.color = data.daysLeft < 7 ? '#ef4444' : '#10b981';
        }
        if (expiresAtEl) {
            const date = new Date(data.expiresAt);
            expiresAtEl.textContent = date.toLocaleDateString('ru-RU');
        }
        if (data.userInfo && userInfoEl && userInfoRow) {
            userInfoEl.textContent = data.userInfo;
            userInfoRow.style.display = 'flex';
        }

        // Unblock tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.style.opacity = '1';
            tab.style.pointerEvents = 'auto';
        });
    }

    showLicenseExpired(licenseKey) {
        document.getElementById('licenseWarning').style.display = 'none';
        document.getElementById('licenseActive').style.display = 'none';
        document.getElementById('licenseExpired').style.display = 'block';

        const expiredKeyEl = document.getElementById('expiredLicenseKey');
        if (expiredKeyEl) expiredKeyEl.textContent = licenseKey;

        // Block other tabs
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.dataset.tab !== 'license') {
                tab.style.opacity = '0.5';
                tab.style.pointerEvents = 'none';
            }
        });
    }

    updateStatusIndicator(active) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = indicator?.querySelector('.status-text');
        
        if (active) {
            indicator?.classList.add('active');
            if (statusText) statusText.textContent = 'Активировано';
        } else {
            indicator?.classList.remove('active');
            if (statusText) statusText.textContent = 'Не активировано';
        }
    }

    // ========== AUTO-CATCH METHODS ==========

    async startAutoCatch() {
        const interval = parseInt(document.getElementById('autoCatchInterval')?.value || 1000);

        if (!interval || interval < 100) {
            this.showNotification('Неверный интервал', 'error');
            return;
        }

        const filters = this.collectFilters();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url?.includes('wildberries.ru')) {
                this.showNotification('Откройте страницу Wildberries', 'warning');
                return;
            }

            await chrome.storage.local.set({ autoCatchFilters: filters });

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'startAutoCatch',
                interval: interval,
                filters: filters
            });

            if (response?.success) {
                const toggle = document.getElementById('autoCatchToggle');
                const startBtn = document.getElementById('startAutoCatchBtn');
                const stopBtn = document.getElementById('stopAutoCatchBtn');
                const intervalInput = document.getElementById('autoCatchInterval');

                if (toggle) toggle.checked = true;
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                if (intervalInput) intervalInput.disabled = true;

                this.showNotification('🎯 Автоловля запущена!', 'success');
            }
        } catch (error) {
            console.error('Error starting auto-catch:', error);
            this.showNotification('Ошибка запуска. Обновите страницу WB', 'error');
        }
    }

    collectFilters() {
        const dateMode = document.getElementById('dateFilterMode')?.value || 'any';
        const filterByCoef = document.getElementById('filterByCoefficient')?.checked || false;
        const boxType = document.getElementById('boxType')?.value || 'box';

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
            monopalletCount: 1
        };

        if (dateMode === 'specific') {
            filters.specificDate = document.getElementById('specificDate')?.value;
        } else if (dateMode === 'range') {
            filters.dateFrom = document.getElementById('dateFrom')?.value;
            filters.dateTo = document.getElementById('dateTo')?.value;
        }

        if (filterByCoef) {
            filters.coefficientFrom = parseInt(document.getElementById('coefficientFrom')?.value || 0);
            filters.coefficientTo = parseInt(document.getElementById('coefficientTo')?.value || 20);
            filters.allowFree = document.getElementById('allowFree')?.checked || true;
        }

        if (boxType === 'monopallet') {
            filters.monopalletCount = parseInt(document.getElementById('monopalletCount')?.value || 1);
        }

        return filters;
    }

    async stopAutoCatch() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            await chrome.tabs.sendMessage(tab.id, { action: 'stopAutoCatch' });

            const toggle = document.getElementById('autoCatchToggle');
            const startBtn = document.getElementById('startAutoCatchBtn');
            const stopBtn = document.getElementById('stopAutoCatchBtn');
            const intervalInput = document.getElementById('autoCatchInterval');

            if (toggle) toggle.checked = false;
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            if (intervalInput) intervalInput.disabled = false;

            this.showNotification('🛑 Автоловля остановлена', 'success');
        } catch (error) {
            console.error('Error stopping auto-catch:', error);
        }
    }

    async testClick() {
        const btn = document.getElementById('testClickBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳</span> Тест...';
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url?.includes('wildberries.ru')) {
                this.showNotification('Откройте страницу Wildberries', 'warning');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'clickButton' });

            if (response?.success) {
                this.showNotification('✅ Тестовый клик выполнен', 'success');
            } else {
                const reason = response?.reason;
                if (reason === 'not_found') {
                    this.showNotification('❌ Кнопка не найдена', 'error');
                } else if (reason === 'disabled') {
                    this.showNotification('⚠️ Кнопка недоступна', 'warning');
                } else {
                    this.showNotification('❌ Ошибка клика', 'error');
                }
            }
        } catch (error) {
            console.error('Error test click:', error);
            this.showNotification('Ошибка. Обновите страницу WB', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>🧪</span> Тестовый клик';
            }
        }
    }

    async updateAutoCatchStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url?.includes('wildberries.ru')) return;

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAutoCatchStatus' });

            if (response) {
                const statusBadge = document.getElementById('autoCatchStatus');
                const clickCountEl = document.getElementById('clickCount');
                const lastClickEl = document.getElementById('lastClickTime');
                const toggle = document.getElementById('autoCatchToggle');
                const startBtn = document.getElementById('startAutoCatchBtn');
                const stopBtn = document.getElementById('stopAutoCatchBtn');

                if (response.enabled) {
                    if (statusBadge) {
                        statusBadge.textContent = 'Активна';
                        statusBadge.className = 'status-badge running';
                    }
                    if (startBtn) startBtn.disabled = true;
                    if (stopBtn) stopBtn.disabled = false;
                    if (toggle) toggle.checked = true;
                } else {
                    if (statusBadge) {
                        statusBadge.textContent = 'Остановлена';
                        statusBadge.className = 'status-badge stopped';
                    }
                    if (startBtn) startBtn.disabled = false;
                    if (stopBtn) stopBtn.disabled = true;
                    if (toggle) toggle.checked = false;
                }

                if (clickCountEl) clickCountEl.textContent = response.clickCount || 0;

                if (lastClickEl) {
                    if (response.lastClickTime) {
                        const time = new Date(response.lastClickTime);
                        lastClickEl.textContent = time.toLocaleTimeString('ru-RU');
                    } else {
                        lastClickEl.textContent = '-';
                    }
                }
            }
        } catch (error) {
            // Tab might not have content script
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

        const totalClicksEl = document.getElementById('totalClicks');
        if (totalClicksEl) totalClicksEl.textContent = '0';
        this.showNotification('Статистика сброшена', 'success');
    }

    // ========== REDISTRIBUTE METHODS ==========

    async startRedistribute() {
        const article = document.getElementById('redistributeArticle')?.value.trim();
        const quantity = parseInt(document.getElementById('redistributeQuantity')?.value || 0);
        const warehouseFrom = document.getElementById('warehouseFrom')?.value;
        const warehouseTo = document.getElementById('warehouseTo')?.value;

        if (!article) {
            this.showNotification('❌ Введите артикул товара', 'error');
            return;
        }

        if (!quantity || quantity < 1) {
            this.showNotification('❌ Введите количество товара', 'error');
            return;
        }

        if (!warehouseFrom) {
            this.showNotification('❌ Выберите склад ОТКУДА', 'error');
            return;
        }

        if (!warehouseTo) {
            this.showNotification('❌ Выберите склад КУДА', 'error');
            return;
        }

        if (warehouseFrom === warehouseTo) {
            this.showNotification('❌ Склады должны быть разными', 'error');
            return;
        }

        const settings = { article, quantity, warehouseFrom, warehouseTo };

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url?.includes('warehouse-remains')) {
                const newTab = await chrome.tabs.create({
                    url: 'https://seller.wildberries.ru/analytics-reports/warehouse-remains'
                });

                await this.sleep(3000);

                await chrome.tabs.sendMessage(newTab.id, {
                    action: 'startRedistribute',
                    settings: settings
                });
            } else {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'startRedistribute',
                    settings: settings
                });
            }

            const toggle = document.getElementById('redistributeToggle');
            if (toggle) toggle.checked = true;
            this.showNotification('🔄 Перераспределение запущено', 'success');
        } catch (error) {
            console.error('Error starting redistribute:', error);
            this.showNotification('Ошибка запуска', 'error');
        }
    }

    async stopRedistribute() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            await chrome.tabs.sendMessage(tab.id, { action: 'stopRedistribute' });

            const toggle = document.getElementById('redistributeToggle');
            if (toggle) toggle.checked = false;
            this.showNotification('🛑 Перераспределение остановлено', 'success');
        } catch (error) {
            console.error('Error stopping redistribute:', error);
        }
    }

    async updateRedistributeStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url?.includes('warehouse-remains')) return;

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getRedistributeStatus' });

            if (response) {
                const statusBadge = document.getElementById('redistributeStatus');
                const countEl = document.getElementById('redistributeCount');

                if (response.enabled) {
                    if (statusBadge) {
                        statusBadge.textContent = 'Активно';
                        statusBadge.className = 'status-badge running';
                    }
                } else {
                    if (statusBadge) {
                        statusBadge.textContent = 'Остановлено';
                        statusBadge.className = 'status-badge stopped';
                    }
                }

                if (countEl) countEl.textContent = response.count || 0;
            }
        } catch (error) {
            // Ignore
        }
    }

    // ========== DEBUG METHODS ==========

    async debugCalendar() {
        const btn = document.getElementById('debugCalendarBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳</span> Проверка...';
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url?.includes('wildberries.ru')) {
                this.showNotification('Откройте страницу Wildberries', 'warning');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'debugCalendar' });

            if (response) {
                console.log('Debug info:', response);
                let message = `Модальных окон: ${response.modalsCount}\n`;
                message += `TD элементов: ${response.tdCount}\n`;
                message += `Ячеек календаря: ${response.calendarCells}\n`;

                alert(message + '\nПодробности в консоли (F12)');
            }
        } catch (error) {
            console.error('Debug error:', error);
            this.showNotification('Ошибка отладки', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>🔍</span> Отладка календаря';
            }
        }
    }

    // ========== UTILITY METHODS ==========

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showNotification(message, type = 'info') {
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
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

