const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS license_keys (
                id SERIAL PRIMARY KEY,
                license_key VARCHAR(255) UNIQUE NOT NULL,
                user_info TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT true,
                last_used TIMESTAMP
            );
        `);
        console.log('✅ Database initialized');
    } catch (error) {
        console.error('❌ Database init error:', error);
    } finally {
        client.release();
    }
}

// Generate unique license key
function generateLicenseKey() {
    const prefix = 'WB';
    const random = crypto.randomBytes(12).toString('hex').toUpperCase();
    return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}-${random.slice(12, 16)}`;
}

// ============= ADMIN API =============

// Admin: Generate new license key
app.post('/admin/generate-key', async (req, res) => {
    const { password, userInfo, durationDays } = req.body;

    // Simple password protection
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Неверный пароль' });
    }

    if (!durationDays || durationDays < 1) {
        return res.status(400).json({ success: false, error: 'Укажите срок действия' });
    }

    try {
        const licenseKey = generateLicenseKey();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

        const result = await pool.query(
            `INSERT INTO license_keys (license_key, user_info, expires_at) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [licenseKey, userInfo || '', expiresAt]
        );

        res.json({
            success: true,
            key: result.rows[0]
        });
    } catch (error) {
        console.error('Error generating key:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания ключа' });
    }
});

// Admin: Get all keys
app.post('/admin/list-keys', async (req, res) => {
    const { password } = req.body;

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Неверный пароль' });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM license_keys ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            keys: result.rows
        });
    } catch (error) {
        console.error('Error fetching keys:', error);
        res.status(500).json({ success: false, error: 'Ошибка загрузки ключей' });
    }
});

// Admin: Deactivate key
app.post('/admin/deactivate-key', async (req, res) => {
    const { password, licenseKey } = req.body;

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Неверный пароль' });
    }

    try {
        const result = await pool.query(
            `UPDATE license_keys SET is_active = false WHERE license_key = $1 RETURNING *`,
            [licenseKey]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ключ не найден' });
        }

        res.json({
            success: true,
            key: result.rows[0]
        });
    } catch (error) {
        console.error('Error deactivating key:', error);
        res.status(500).json({ success: false, error: 'Ошибка деактивации ключа' });
    }
});

// Admin: Extend key
app.post('/admin/extend-key', async (req, res) => {
    const { password, licenseKey, additionalDays } = req.body;

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Неверный пароль' });
    }

    try {
        // Get current expiration
        const current = await pool.query(
            `SELECT expires_at FROM license_keys WHERE license_key = $1`,
            [licenseKey]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ключ не найден' });
        }

        const newExpiresAt = new Date(current.rows[0].expires_at);
        newExpiresAt.setDate(newExpiresAt.getDate() + parseInt(additionalDays));

        const result = await pool.query(
            `UPDATE license_keys 
             SET expires_at = $1, is_active = true 
             WHERE license_key = $2 
             RETURNING *`,
            [newExpiresAt, licenseKey]
        );

        res.json({
            success: true,
            key: result.rows[0]
        });
    } catch (error) {
        console.error('Error extending key:', error);
        res.status(500).json({ success: false, error: 'Ошибка продления ключа' });
    }
});

// Admin: Delete key
app.post('/admin/delete-key', async (req, res) => {
    const { password, licenseKey } = req.body;

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Неверный пароль' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM license_keys WHERE license_key = $1 RETURNING *`,
            [licenseKey]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ключ не найден' });
        }

        res.json({
            success: true,
            deletedKey: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting key:', error);
        res.status(500).json({ success: false, error: 'Ошибка удаления ключа' });
    }
});

// ============= PUBLIC API (for extension) =============

// Verify license key
app.post('/api/verify-license', async (req, res) => {
    const { licenseKey } = req.body;

    if (!licenseKey) {
        return res.json({ 
            success: false, 
            valid: false, 
            error: 'Ключ не указан' 
        });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM license_keys WHERE license_key = $1`,
            [licenseKey]
        );

        if (result.rows.length === 0) {
            return res.json({ 
                success: true, 
                valid: false, 
                error: 'Неверный ключ активации' 
            });
        }

        const key = result.rows[0];
        const now = new Date();
        const expiresAt = new Date(key.expires_at);
        const isExpired = now > expiresAt;

        // Update last_used timestamp
        await pool.query(
            `UPDATE license_keys SET last_used = CURRENT_TIMESTAMP WHERE license_key = $1`,
            [licenseKey]
        );

        if (!key.is_active) {
            return res.json({
                success: true,
                valid: false,
                error: 'Ключ деактивирован администратором'
            });
        }

        if (isExpired) {
            return res.json({
                success: true,
                valid: false,
                expired: true,
                error: '⏰ Ваша подписка истекла. Пожалуйста, продлите подписку',
                expiresAt: expiresAt.toISOString()
            });
        }

        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

        res.json({
            success: true,
            valid: true,
            expiresAt: expiresAt.toISOString(),
            daysLeft: daysLeft,
            userInfo: key.user_info
        });
    } catch (error) {
        console.error('Error verifying license:', error);
        res.status(500).json({ 
            success: false, 
            valid: false, 
            error: 'Ошибка проверки ключа' 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
async function start() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`🚀 License server running on port ${PORT}`);
        console.log(`📊 Admin panel: http://localhost:${PORT}`);
    });
}

start();

