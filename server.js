const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio');
const validator = require('validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel için özel ayarlar
app.set('trust proxy', 1);

// Performance ve Security Middleware
app.use(compression()); // Gzip compression
app.use(helmet({ // Güvenlik headers
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(morgan('combined')); // Logging

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 30, // IP başına maksimum 30 request
    message: {
        error: 'Çok fazla istek gönderdiniz! 15 dakika sonra tekrar deneyin.',
        retryAfter: '15 dakika'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// API route'larına rate limit uygula
app.use('/api/', limiter);

// HTTPS Enforcement (production'da)
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
        return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
});

// Input sanitization ve XSS koruması
app.use((req, res, next) => {
    if (req.body) {
        // Tehlikeli karakterleri temizle
        const sanitizeString = (str) => {
            if (typeof str !== 'string') return str;
            return str
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<[^>]*>?/gm, '')
                .trim();
        };

        // Body'deki string değerleri temizle
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeString(req.body[key]);
            }
        });
    }
    next();
});

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://url-redirect-two.vercel.app', 'https://makeurl.dev'] 
        : true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // JSON size limit

// Static files öncelikli olarak serve et
app.use(express.static('public', {
    index: false, // index.html'i otomatik serve etme
    setHeaders: (res, path) => {
        console.log('Serving static file:', path);
    }
}));

// URL'leri saklamak için basit bir in-memory database
const urlDatabase = new Map();

// Malicious URL patterns - Bu listeyi genişletebilirsiniz
const MALICIOUS_PATTERNS = [
    /bit\.ly\/[a-zA-Z0-9]+/, // Nested URL shorteners
    /tinyurl\.com\/[a-zA-Z0-9]+/,
    /t\.co\/[a-zA-Z0-9]+/,
    /short\.link\/[a-zA-Z0-9]+/,
    /phishing/i,
    /malware/i,
    /virus/i,
    /scam/i,
    /fake/i,
    /doubleclick\.net/,
    /googleadservices\.com/,
    /googlesyndication\.com/
];

// Suspicious domains
const SUSPICIOUS_DOMAINS = [
    'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly',
    'free-bitcoin', 'get-rich-quick', 'win-money', 'click-here-now'
];

// URL güvenlik kontrolü
async function checkUrlSafety(url) {
    try {
        // 1. Basic pattern kontrolü
        for (const pattern of MALICIOUS_PATTERNS) {
            if (pattern.test(url)) {
                return {
                    safe: false,
                    reason: 'Şüpheli URL pattern tespit edildi',
                    pattern: pattern.toString()
                };
            }
        }

        // 2. Domain kontrolü
        const urlObj = new URL(url);
        const domain = urlObj.hostname.toLowerCase();
        
        for (const suspiciousDomain of SUSPICIOUS_DOMAINS) {
            if (domain.includes(suspiciousDomain)) {
                return {
                    safe: false,
                    reason: 'Şüpheli domain tespit edildi',
                    domain: domain
                };
            }
        }

        // 3. URL format doğrulama
        if (!validator.isURL(url, { 
            protocols: ['http', 'https'],
            require_protocol: true,
            require_host: true,
            require_valid_protocol: true
        })) {
            return {
                safe: false,
                reason: 'Geçersiz URL formatı'
            };
        }

        // 4. HTTP HEAD request ile erişebilirlik kontrolü
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                maxRedirects: 3,
                headers: {
                    'User-Agent': 'makeURL-Bot/1.0 (+https://url-redirect-two.vercel.app)'
                }
            });

            // Şüpheli content type'lar
            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('application/octet-stream') || 
                contentType.includes('application/x-msdownload')) {
                return {
                    safe: false,
                    reason: 'Şüpheli dosya türü tespit edildi',
                    contentType
                };
            }

        } catch (error) {
            // URL'ye erişilemiyorsa şüpheli kabul et
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return {
                    safe: false,
                    reason: 'URL\'ye erişim sağlanamadı',
                    error: error.message
                };
            }
        }

        return { safe: true, reason: 'URL güvenli görünüyor' };

    } catch (error) {
        console.error('URL safety check error:', error);
        return {
            safe: false,
            reason: 'Güvenlik kontrolü sırasında hata oluştu',
            error: error.message
        };
    }
}

// URL önizleme fonksiyonu
async function getUrlPreview(url) {
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            maxRedirects: 3,
            headers: {
                'User-Agent': 'makeURL-Bot/1.0 (+https://url-redirect-two.vercel.app)'
            }
        });

        const $ = cheerio.load(response.data);
        
        const preview = {
            title: $('title').text() || 
                   $('meta[property="og:title"]').attr('content') || 
                   $('meta[name="twitter:title"]').attr('content') || 
                   'Başlık bulunamadı',
                   
            description: $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="twitter:description"]').attr('content') || 
                        'Açıklama bulunamadı',
                        
            image: $('meta[property="og:image"]').attr('content') || 
                   $('meta[name="twitter:image"]').attr('content') || 
                   $('link[rel="icon"]').attr('href') || null,
                   
            siteName: $('meta[property="og:site_name"]').attr('content') || 
                     new URL(url).hostname,
                     
            favicon: $('link[rel="icon"]').attr('href') || 
                    $('link[rel="shortcut icon"]').attr('href') || null
        };

        // Göreceli URL'leri mutlak URL'ye çevir
        if (preview.image && !preview.image.startsWith('http')) {
            const baseUrl = new URL(url);
            if (preview.image.startsWith('/')) {
                preview.image = baseUrl.origin + preview.image;
            } else {
                preview.image = baseUrl.origin + '/' + preview.image;
            }
        }

        return preview;

    } catch (error) {
        console.error('URL preview error:', error);
        return {
            title: 'Önizleme alınamadı',
            description: 'Bu URL için önizleme bilgisi alınamadı',
            image: null,
            siteName: new URL(url).hostname,
            favicon: null,
            error: error.message
        };
    }
}

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

async function saveUrl(shortCode, originalUrl, expirationDays = 365) {
    try {
        // Memory'ye kaydet (hızlı erişim için)
        urlDatabase.set(shortCode, originalUrl);
        
        // Redis'e kaydet (kalıcılık için)
        if (redis) {
            // Expiration süresi hesapla (saniye)
            const expirationSeconds = expirationDays * 24 * 60 * 60;
            
            await redis.set(`url:${shortCode}`, originalUrl, { ex: expirationSeconds });
            
            // Metadata da kaydet (isteğe bağlı)
            const expirationDate = new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000));
            await redis.set(`meta:${shortCode}`, JSON.stringify({
                createdAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString(),
                expiresAt: expirationDate.toISOString(),
                expirationDays: expirationDays,
                clicks: 0
            }), { ex: expirationSeconds });
            
            console.log(`URL saved to Redis with ${expirationDays} days expiration: ${shortCode}`);
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
    
    const { originalUrl, customName, expirationDays } = req.body;
    
    if (!originalUrl) {
        console.log('ERROR: No URL provided');
        return res.status(400).json({ error: 'URL gerekli!', debug: 'originalUrl is missing' });
    }

    // Karakter sınırları kontrolü
    if (originalUrl.length > 2000) {
        return res.status(400).json({ 
            error: 'URL çok uzun! Maksimum 2000 karakter olmalıdır.',
            debug: `URL length: ${originalUrl.length}`
        });
    }

    if (customName && customName.length > 50) {
        return res.status(400).json({ 
            error: 'Özel isim çok uzun! Maksimum 50 karakter olmalıdır.',
            debug: `Custom name length: ${customName.length}`
        });
    }

    // Expiration kontrolü
    let validExpirationDays = 365; // Default 1 yıl
    if (expirationDays) {
        if (!Number.isInteger(expirationDays) || expirationDays < 1 || expirationDays > 3650) {
            return res.status(400).json({ 
                error: 'Geçerli bir expiration süresi girin! (1-3650 gün arası)',
                debug: `Expiration days: ${expirationDays}`
            });
        }
        validExpirationDays = expirationDays;
    }
    
    // URL formatını kontrol et
    let validUrl;
    try {
        validUrl = new URL(originalUrl);
    } catch (error) {
        return res.status(400).json({ error: 'Geçersiz URL formatı!' });
    }

    // Güvenlik kontrolü
    console.log('Checking URL safety for:', originalUrl);
    const safetyCheck = await checkUrlSafety(originalUrl);
    if (!safetyCheck.safe) {
        console.log('URL rejected for safety:', safetyCheck);
        return res.status(400).json({ 
            error: 'Güvenlik nedeniyle bu URL kısaltılamaz!',
            reason: safetyCheck.reason,
            details: safetyCheck
        });
    }

    // URL önizlemesi al (optional, sadece başarılı response için)
    let preview = null;
    try {
        preview = await getUrlPreview(originalUrl);
        console.log('URL preview generated:', preview.title);
    } catch (error) {
        console.log('Preview generation failed:', error.message);
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
    await saveUrl(shortCode, originalUrl, validExpirationDays);
    
    // Kısa URL'i oluştur
    const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;
    
    console.log('URL shortened successfully:', { originalUrl, shortUrl, shortCode });
    
    const response = {
        originalUrl,
        shortUrl,
        shortCode,
        safetyCheck: safetyCheck.reason,
        expirationDays: validExpirationDays,
        expiresAt: new Date(Date.now() + (validExpirationDays * 24 * 60 * 60 * 1000)).toISOString()
    };

    // Preview varsa ekle
    if (preview && !preview.error) {
        response.preview = preview;
    }
    
    res.json(response);
});

// Toplu URL kısaltma endpoint'i
app.post('/api/bulk-shorten', async (req, res) => {
    console.log('=== BULK SHORTEN REQUEST START ===');
    
    const { urls, defaultExpirationDays } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ 
            error: 'URL listesi gerekli!',
            debug: 'urls array is required'
        });
    }

    if (urls.length > 100) {
        return res.status(400).json({ 
            error: 'Maksimum 100 URL aynı anda kısaltılabilir!',
            debug: `URL count: ${urls.length}`
        });
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    for (let i = 0; i < urls.length; i++) {
        const urlData = urls[i];
        
        try {
            // URL string ise object'e çevir
            const urlInfo = typeof urlData === 'string' 
                ? { originalUrl: urlData } 
                : urlData;

            const { originalUrl, customName, expirationDays } = urlInfo;

            if (!originalUrl) {
                errors.push({
                    index: i,
                    url: urlData,
                    error: 'URL gerekli!'
                });
                continue;
            }

            // Karakter sınırları
            if (originalUrl.length > 2000) {
                errors.push({
                    index: i,
                    url: originalUrl,
                    error: 'URL çok uzun (max 2000 karakter)'
                });
                continue;
            }

            if (customName && customName.length > 50) {
                errors.push({
                    index: i,
                    url: originalUrl,
                    error: 'Özel isim çok uzun (max 50 karakter)'
                });
                continue;
            }

            // URL format kontrolü
            let validUrl;
            try {
                validUrl = new URL(originalUrl);
            } catch (error) {
                errors.push({
                    index: i,
                    url: originalUrl,
                    error: 'Geçersiz URL formatı'
                });
                continue;
            }

            // Güvenlik kontrolü
            const safetyCheck = await checkUrlSafety(originalUrl);
            if (!safetyCheck.safe) {
                errors.push({
                    index: i,
                    url: originalUrl,
                    error: 'Güvenlik nedeniyle reddedildi',
                    reason: safetyCheck.reason
                });
                continue;
            }

            // Expiration kontrolü
            let validExpirationDays = defaultExpirationDays || 365;
            if (expirationDays) {
                if (!Number.isInteger(expirationDays) || expirationDays < 1 || expirationDays > 3650) {
                    errors.push({
                        index: i,
                        url: originalUrl,
                        error: 'Geçersiz expiration süresi (1-3650 gün)'
                    });
                    continue;
                }
                validExpirationDays = expirationDays;
            }

            // Short code oluştur
            let shortCode;
            if (customName && customName.trim()) {
                shortCode = customName.trim().toLowerCase().replace(/[^a-z0-9.\-_]/g, '');
                
                if (!shortCode) {
                    shortCode = crypto.randomBytes(4).toString('hex');
                }

                // Static file çakışması
                const forbiddenExtensions = ['.css', '.js', '.png', '.ico', '.jpg', '.jpeg', '.gif', '.svg'];
                if (forbiddenExtensions.some(ext => shortCode.endsWith(ext))) {
                    errors.push({
                        index: i,
                        url: originalUrl,
                        error: 'Özel isim sistem dosyalarıyla çakışıyor'
                    });
                    continue;
                }

                // Çakışma kontrolü
                if (urlDatabase.has(shortCode)) {
                    errors.push({
                        index: i,
                        url: originalUrl,
                        error: 'Bu özel isim zaten kullanılıyor'
                    });
                    continue;
                }
            } else {
                shortCode = crypto.randomBytes(4).toString('hex');
                while (urlDatabase.has(shortCode)) {
                    shortCode = crypto.randomBytes(4).toString('hex');
                }
            }

            // Kaydet
            await saveUrl(shortCode, originalUrl, validExpirationDays);

            // Başarılı sonuç
            const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;
            results.push({
                index: i,
                originalUrl,
                shortUrl,
                shortCode,
                expirationDays: validExpirationDays,
                expiresAt: new Date(Date.now() + (validExpirationDays * 24 * 60 * 60 * 1000)).toISOString(),
                safetyCheck: safetyCheck.reason
            });

            successCount++;

        } catch (error) {
            console.error(`Bulk shorten error for index ${i}:`, error);
            errors.push({
                index: i,
                url: urlData,
                error: 'İşleme sırasında hata oluştu',
                details: error.message
            });
        }
    }

    console.log(`Bulk operation completed: ${successCount} success, ${errors.length} errors`);

    res.json({
        message: `${successCount} URL başarıyla kısaltıldı, ${errors.length} hata oluştu`,
        totalRequested: urls.length,
        successCount,
        errorCount: errors.length,
        results,
        errors
    });
});

// Tüm kısaltılmış URL'leri görüntüleme (opsiyonel)
app.get('/api/urls', async (req, res) => {
    try {
        let allUrls = {};
        
        // Memory'den al
        for (const [shortCode, originalUrl] of urlDatabase.entries()) {
            allUrls[shortCode] = originalUrl;
        }
        
        // Redis'ten al (eğer varsa)
        if (redis) {
            try {
                const urlKeys = await redis.keys('url:*');
                for (const key of urlKeys) {
                    const shortCode = key.replace('url:', '');
                    const originalUrl = await redis.get(key);
                    if (originalUrl) {
                        allUrls[shortCode] = originalUrl;
                    }
                }
            } catch (redisError) {
                console.log('Redis error in /api/urls:', redisError.message);
            }
        }
        
        res.json(allUrls);
    } catch (error) {
        console.error('Error in /api/urls:', error);
        res.status(500).json({ error: 'URL\'ler alınırken hata oluştu' });
    }
});

// API test endpoint'i - direkt tarayıcıdan test edebilmek için
app.get('/api/test', (req, res) => {
    res.json({
        message: 'API çalışıyor!',
        timestamp: new Date().toISOString(),
        urls_count: urlDatabase.size,
        redis_connected: redis !== null
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