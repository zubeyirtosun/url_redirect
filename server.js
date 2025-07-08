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

// MongoDB için kalıcı storage
const { MongoClient } = require('mongodb');

let db = null;
let collection = null;

// MongoDB bağlantısı
async function connectMongoDB() {
    try {
        if (process.env.MONGODB_URI) {
            const client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            db = client.db('urlshortener');
            collection = db.collection('urls');
            console.log('MongoDB connected successfully');
            return true;
        } else {
            console.log('MongoDB URI not found, using memory only');
            return false;
        }
    } catch (error) {
        console.log('MongoDB connection failed, using memory only:', error.message);
        return false;
    }
}

// Hybrid storage: MongoDB + memory cache
async function loadUrls() {
    const mongoConnected = await connectMongoDB();
    
    if (mongoConnected && collection) {
        try {
            const urls = await collection.find({}).toArray();
            console.log(`Found ${urls.length} URLs in MongoDB`);
            
            urls.forEach(doc => {
                urlDatabase.set(doc.shortCode, doc.originalUrl);
            });
            console.log(`${urlDatabase.size} URLs loaded to memory`);
        } catch (error) {
            console.log('Error loading from MongoDB:', error.message);
        }
    }
}

async function saveUrl(shortCode, originalUrl) {
    try {
        // Memory'ye kaydet (hızlı erişim için)
        urlDatabase.set(shortCode, originalUrl);
        
        // MongoDB'ye kaydet (kalıcılık için)
        if (collection) {
            await collection.replaceOne(
                { shortCode },
                { 
                    shortCode, 
                    originalUrl, 
                    createdAt: new Date(),
                    lastAccessed: new Date()
                },
                { upsert: true }
            );
            console.log(`URL saved to MongoDB: ${shortCode}`);
        } else {
            console.log(`URL saved to memory only: ${shortCode}`);
        }
    } catch (error) {
        console.error('Error saving to MongoDB:', error);
        // MongoDB fail olursa en azından memory'de kalsın
        urlDatabase.set(shortCode, originalUrl);
    }
}

async function getUrl(shortCode) {
    // Önce memory'den bak (hızlı)
    let url = urlDatabase.get(shortCode);
    
    if (!url && collection) {
        // Memory'de yoksa MongoDB'den bak
        try {
            const doc = await collection.findOne({ shortCode });
            if (doc) {
                url = doc.originalUrl;
                // Buldu, memory'ye de ekle
                urlDatabase.set(shortCode, url);
                
                // Last accessed güncelle
                await collection.updateOne(
                    { shortCode },
                    { $set: { lastAccessed: new Date() } }
                );
                console.log(`URL loaded from MongoDB: ${shortCode}`);
            }
        } catch (error) {
            console.error('Error loading from MongoDB:', error);
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
        urls_count: urlDatabase.size
    });
});

// Direkt URL kısaltma testi (GET ile)
app.get('/api/shorten-test', async (req, res) => {
    const testUrl = 'https://store.steampowered.com/app/3527290/PEAK/';
    const testCode = 'peak-test';
    
    // Test URL'ini kalıcı storage'a kaydet
    await saveUrl(testCode, testUrl);
    
    const shortUrl = `${req.protocol}://${req.get('host')}/${testCode}`;
    
    res.json({
        message: 'Test URL oluşturuldu ve kalıcı storage\'a kaydedildi!',
        originalUrl: testUrl,
        shortUrl: shortUrl,
        shortCode: testCode,
        test_link: `<a href="${shortUrl}" target="_blank">Test Link - Tıkla</a>`
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