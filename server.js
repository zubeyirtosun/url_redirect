const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel için özel ayarlar
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());

// Static files öncelikli olarak serve et
app.use(express.static('public', {
    index: false, // index.html'i otomatik serve etme
    setHeaders: (res, path) => {
        console.log('Serving static file:', path);
    }
}));

// URL'leri saklamak için basit bir in-memory database
const urlDatabase = new Map();

// Upstash Redis için kalıcı storage
const { Redis } = require('@upstash/redis');

let redis = null;

// Redis bağlantısı
function initRedis() {
    try {
        if (process.env.KV_URL && process.env.KV_REST_API_TOKEN) {
            redis = new Redis({
                url: process.env.KV_URL,
                token: process.env.KV_REST_API_TOKEN,
            });
            console.log('Upstash Redis initialized successfully');
            return true;
        } else {
            console.log('Redis credentials not found, using memory only');
            return false;
        }
    } catch (error) {
        console.log('Redis initialization failed, using memory only:', error.message);
        return false;
    }
}

// Hybrid storage: Redis + memory cache
async function loadUrls() {
    const redisConnected = initRedis();
    
    if (redisConnected && redis) {
        try {
            // Redis'ten tüm URL anahtarlarını al
            const keys = await redis.keys('url:*');
            console.log(`Found ${keys.length} URLs in Redis`);
            
            // Her key için değeri al
            if (keys.length > 0) {
                const values = await redis.mget(...keys);
                keys.forEach((key, index) => {
                    const shortCode = key.replace('url:', '');
                    const originalUrl = values[index];
                    if (originalUrl) {
                        urlDatabase.set(shortCode, originalUrl);
                    }
                });
            }
            console.log(`${urlDatabase.size} URLs loaded to memory`);
        } catch (error) {
            console.log('Error loading from Redis:', error.message);
        }
    }
}

async function saveUrl(shortCode, originalUrl) {
    try {
        // Memory'ye kaydet (hızlı erişim için)
        urlDatabase.set(shortCode, originalUrl);
        
        // Redis'e kaydet (kalıcılık için)
        if (redis) {
            await redis.set(`url:${shortCode}`, originalUrl);
            
            // Metadata da kaydet (isteğe bağlı)
            await redis.set(`meta:${shortCode}`, JSON.stringify({
                createdAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString(),
                clicks: 0
            }));
            
            console.log(`URL saved to Redis: ${shortCode}`);
        } else {
            console.log(`URL saved to memory only: ${shortCode}`);
        }
    } catch (error) {
        console.error('Error saving to Redis:', error);
        // Redis fail olursa en azından memory'de kalsın
        urlDatabase.set(shortCode, originalUrl);
    }
}

async function getUrl(shortCode) {
    // Önce memory'den bak (hızlı)
    let url = urlDatabase.get(shortCode);
    
    if (!url && redis) {
        // Memory'de yoksa Redis'ten bak
        try {
            url = await redis.get(`url:${shortCode}`);
            if (url) {
                // Buldu, memory'ye de ekle
                urlDatabase.set(shortCode, url);
                
                // Last accessed güncelle
                try {
                    const metaData = await redis.get(`meta:${shortCode}`);
                    let meta = metaData ? JSON.parse(metaData) : { clicks: 0 };
                    meta.lastAccessed = new Date().toISOString();
                    meta.clicks = (meta.clicks || 0) + 1;
                    await redis.set(`meta:${shortCode}`, JSON.stringify(meta));
                } catch (metaError) {
                    console.log('Error updating metadata:', metaError);
                }
                
                console.log(`URL loaded from Redis: ${shortCode}`);
            }
        } catch (error) {
            console.error('Error loading from Redis:', error);
        }
    }
    
    return url;
}

// Sunucu başlatılırken URL'leri yükle
loadUrls();

// URL kısaltma endpoint'i (bu önce olmalı)
app.post('/api/shorten', async (req, res) => {
    console.log('=== SHORTEN REQUEST START ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    
    const { originalUrl, customName } = req.body;
    
    if (!originalUrl) {
        console.log('ERROR: No URL provided');
        return res.status(400).json({ error: 'URL gerekli!', debug: 'originalUrl is missing' });
    }
    
    // URL formatını kontrol et
    let validUrl;
    try {
        validUrl = new URL(originalUrl);
    } catch (error) {
        return res.status(400).json({ error: 'Geçersiz URL formatı!' });
    }
    
    let shortCode;
    
    // Özel isim verilmişse onu kullan, yoksa rastgele oluştur
    if (customName && customName.trim()) {
        // Nokta, tire, alt çizgi ve alfanümerik karakterlere izin ver
        shortCode = customName.trim().toLowerCase().replace(/[^a-z0-9.\-_]/g, '');
        
        // Özel isim boş kalırsa rastgele oluştur
        if (!shortCode) {
            shortCode = crypto.randomBytes(4).toString('hex');
        }
        
        // Static file extension'larla çakışmasın
        const forbiddenExtensions = ['.css', '.js', '.png', '.ico', '.jpg', '.jpeg', '.gif', '.svg'];
        if (forbiddenExtensions.some(ext => shortCode.endsWith(ext))) {
            return res.status(400).json({ error: 'Bu URL adı sistem dosyalarıyla çakışıyor! Başka bir isim deneyin.' });
        }
        
        // Bu isim zaten kullanılıyor mu kontrol et
        if (urlDatabase.has(shortCode)) {
            return res.status(400).json({ error: 'Bu URL adı zaten kullanılıyor! Başka bir isim deneyin.' });
        }
    } else {
        // Rastgele kod oluştur
        shortCode = crypto.randomBytes(4).toString('hex');
        
        // Rastgele kod çakışması durumunda yeni oluştur
        while (urlDatabase.has(shortCode)) {
            shortCode = crypto.randomBytes(4).toString('hex');
        }
    }
    
    // Kalıcı storage'a kaydet
    await saveUrl(shortCode, originalUrl);
    
    // Kısa URL'i oluştur
    const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;
    
    console.log('URL shortened successfully:', { originalUrl, shortUrl, shortCode });
    
    res.json({
        originalUrl,
        shortUrl,
        shortCode
    });
});

// Tüm kısaltılmış URL'leri görüntüleme (opsiyonel)
app.get('/api/urls', (req, res) => {
    const urls = Array.from(urlDatabase.entries()).map(([shortCode, originalUrl]) => ({
        shortCode,
        originalUrl,
        shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`
    }));
    
    res.json(urls);
});

// API test endpoint'i - direkt tarayıcıdan test edebilmek için
app.get('/api/test', (req, res) => {
    res.json({
        message: 'API çalışıyor!',
        timestamp: new Date().toISOString(),
        urls_count: urlDatabase.size,
        redis_connected: redis !== null,
        admin_password_set: !!process.env.ADMIN_PASSWORD,
        admin_password_preview: process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.substring(0, 5) + '...' : 'default',
        env_vars_count: Object.keys(process.env).filter(key => key.includes('ADMIN') || key.includes('KV')).length
    });
});

// URL istatistikleri endpoint'i
app.get('/api/stats/:shortCode', async (req, res) => {
    const { shortCode } = req.params;
    
    try {
        if (redis) {
            const metaData = await redis.get(`meta:${shortCode}`);
            const originalUrl = await redis.get(`url:${shortCode}`);
            
            if (originalUrl && metaData) {
                const meta = JSON.parse(metaData);
                res.json({
                    shortCode,
                    originalUrl,
                    ...meta,
                    exists: true
                });
            } else {
                res.status(404).json({ error: 'URL bulunamadı!' });
            }
        } else {
            res.json({
                shortCode,
                originalUrl: urlDatabase.get(shortCode) || null,
                message: 'Redis bağlı değil, sadece memory data',
                exists: urlDatabase.has(shortCode)
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'İstatistikler alınırken hata oluştu' });
    }
});

// URL silme endpoint'i (şifre korumalı)
app.delete('/api/delete/:shortCode', async (req, res) => {
    const { shortCode } = req.params;
    const { password } = req.body;
    
    // Şifre kontrolü
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Default şifre
    if (!password || password !== adminPassword) {
        return res.status(401).json({ 
            error: 'Yetkisiz erişim! Doğru şifre gerekli.',
            hint: 'Body\'de password alanı göndermeniz gerekiyor'
        });
    }
    
    try {
        let deleted = false;
        let originalUrl = null;
        
        // Memory'den sil
        if (urlDatabase.has(shortCode)) {
            originalUrl = urlDatabase.get(shortCode);
            urlDatabase.delete(shortCode);
            deleted = true;
        }
        
        // Redis'ten sil
        if (redis) {
            const redisUrl = await redis.get(`url:${shortCode}`);
            if (redisUrl) {
                originalUrl = redisUrl;
                await redis.del(`url:${shortCode}`);
                await redis.del(`meta:${shortCode}`);
                deleted = true;
                console.log(`URL deleted from Redis: ${shortCode}`);
            }
        }
        
        if (deleted) {
            res.json({
                message: 'URL başarıyla silindi!',
                shortCode,
                originalUrl,
                deletedFrom: redis ? 'Redis ve Memory' : 'Sadece Memory'
            });
        } else {
            res.status(404).json({ error: 'URL bulunamadı!' });
        }
        
    } catch (error) {
        console.error('Error deleting URL:', error);
        res.status(500).json({ error: 'URL silinirken hata oluştu' });
    }
});

// Toplu URL silme endpoint'i (şifre korumalı)
app.delete('/api/delete-all', async (req, res) => {
    const { password } = req.body;
    
    // Şifre kontrolü
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (!password || password !== adminPassword) {
        return res.status(401).json({ 
            error: 'Yetkisiz erişim! Doğru şifre gerekli.'
        });
    }
    
    try {
        let deletedCount = 0;
        
        // Memory'den tümünü sil
        const memoryCount = urlDatabase.size;
        urlDatabase.clear();
        deletedCount += memoryCount;
        
        // Redis'ten tümünü sil
        if (redis) {
            const urlKeys = await redis.keys('url:*');
            const metaKeys = await redis.keys('meta:*');
            const allKeys = [...urlKeys, ...metaKeys];
            
            if (allKeys.length > 0) {
                await redis.del(...allKeys);
                console.log(`Deleted ${allKeys.length} keys from Redis`);
            }
        }
        
        res.json({
            message: 'Tüm URL\'ler başarıyla silindi!',
            deletedCount: memoryCount,
            deletedFrom: redis ? 'Redis ve Memory' : 'Sadece Memory'
        });
        
    } catch (error) {
        console.error('Error deleting all URLs:', error);
        res.status(500).json({ error: 'URL\'ler silinirken hata oluştu' });
    }
});

// Direkt URL kısaltma testi (GET ile)
app.get('/api/shorten-test', async (req, res) => {
    const testUrl = 'https://store.steampowered.com/app/3527290/PEAK/';
    const testCode = 'peak-test';
    
    // Test URL'ini kalıcı storage'a kaydet
    await saveUrl(testCode, testUrl);
    
    const shortUrl = `${req.protocol}://${req.get('host')}/${testCode}`;
    
    res.json({
        message: 'Test URL oluşturuldu ve Redis\'e kaydedildi!',
        originalUrl: testUrl,
        shortUrl: shortUrl,
        shortCode: testCode,
        test_link: `<a href="${shortUrl}" target="_blank">Test Link - Tıkla</a>`,
        stats_link: `${req.protocol}://${req.get('host')}/api/stats/${testCode}`
    });
});

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Yönlendirme endpoint'i (en sonda olmalı - catch-all)
app.get('/:shortCode', async (req, res) => {
    const { shortCode } = req.params;
    
    // Sadece belirli static dosyaları hariç tut (nokta genel olarak hariç değil)
    const staticFiles = ['favicon.ico', 'favicon.png', 'script.js', 'style.css', 'robots.txt'];
    const fileExtensions = ['.css', '.js', '.png', '.ico', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf'];
    
    if (staticFiles.includes(shortCode) || 
        fileExtensions.some(ext => shortCode.endsWith(ext))) {
        console.log('Static file request ignored:', shortCode);
        return res.status(404).send('File not found');
    }
    
    console.log('Redirect request for:', shortCode);
    const originalUrl = await getUrl(shortCode);
    
    if (!originalUrl) {
        console.log('URL not found for code:', shortCode);
        return res.status(404).json({ error: 'URL bulunamadı!' });
    }
    
    console.log('Redirecting to:', originalUrl);
    // Orijinal URL'ye yönlendir
    res.redirect(originalUrl);
});

app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});

// Artık graceful shutdown'a gerek yok - Vercel KV otomatik persist ediyor 