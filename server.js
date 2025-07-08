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
app.use(express.static('public'));

// URL'leri saklamak için basit bir in-memory database
const urlDatabase = new Map();

// URL kısaltma endpoint'i (bu önce olmalı)
app.post('/api/shorten', (req, res) => {
    console.log('Shorten request received:', req.body);
    const { originalUrl, customName } = req.body;
    
    if (!originalUrl) {
        console.log('No URL provided');
        return res.status(400).json({ error: 'URL gerekli!' });
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
        shortCode = customName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // Özel isim boş kalırsa rastgele oluştur
        if (!shortCode) {
            shortCode = crypto.randomBytes(4).toString('hex');
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
    
    // Database'e kaydet
    urlDatabase.set(shortCode, originalUrl);
    
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

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Yönlendirme endpoint'i (en sonda olmalı - catch-all)
app.get('/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    
    console.log('Redirect request for:', shortCode);
    const originalUrl = urlDatabase.get(shortCode);
    
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