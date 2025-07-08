# 🔌 Browser Extensions Rehberi

Bu rehber, makeURL için Chrome ve Firefox browser extension'larının nasıl kurulacağını ve kullanılacağını açıklar.

## 📋 İçindekiler

1. [Chrome Extension](#chrome-extension)
2. [Firefox Extension](#firefox-extension)
3. [Özellikler](#özellikler)
4. [Kurulum](#kurulum)
5. [Kullanım](#kullanım)
6. [Geliştirici Notları](#geliştirici-notları)

---

## 🟡 Chrome Extension

### Kurulum (Developer Mode)

1. **Chrome'u açın** ve `chrome://extensions/` adresine gidin
2. **Developer mode'u aktif edin** (sağ üst köşe)
3. **"Load unpacked"** butonuna tıklayın
4. **`browser-extensions/chrome`** klasörünü seçin
5. Extension aktif hale gelecek!

### Kurulum (Chrome Web Store)
```
🚧 Henüz Chrome Web Store'da yayınlanmadı
Geliştirme aşamasında - yakında eklenecek!
```

---

## 🦊 Firefox Extension

### manifest.json (Firefox için)
```json
{
    "manifest_version": 2,
    "name": "makeURL - URL Kısaltıcı",
    "version": "1.0",
    "description": "Herhangi bir sayfada hızlıca URL kısaltın.",
    
    "permissions": [
        "activeTab",
        "contextMenus",
        "storage",
        "notifications",
        "https://url-redirect-two.vercel.app/*"
    ],
    
    "background": {
        "scripts": ["background.js"],
        "persistent": false
    },
    
    "content_scripts": [
        {
            "matches": ["<all_urls>"],
            "js": ["content.js"]
        }
    ],
    
    "browser_action": {
        "default_popup": "popup.html",
        "default_title": "URL Kısalt",
        "default_icon": {
            "16": "icons/icon16.png",
            "32": "icons/icon32.png",
            "48": "icons/icon48.png",
            "128": "icons/icon128.png"
        }
    },
    
    "icons": {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
    }
}
```

### Kurulum (Firefox Developer)

1. **Firefox'u açın** ve `about:debugging#/runtime/this-firefox` adresine gidin
2. **"Load Temporary Add-on"** butonuna tıklayın
3. **Firefox klasöründeki `manifest.json`** dosyasını seçin
4. Extension yüklenecek!

---

## ✨ Özellikler

### 🎯 Ana Özellikler

- **Popup Interface**: Extension icon'a tıklayarak hızlı kısaltma
- **Context Menu**: Sağ tık → "Bu Sayfayı Kısalt" / "Bu Linki Kısalt"
- **Keyboard Shortcut**: `Ctrl+Shift+U` (özelleştirilebilir)
- **Auto Copy**: Kısaltılan URL otomatik kopyalanır
- **Desktop Notifications**: İşlem sonucu bildirimleri
- **Custom Names**: Özel isim verebilme
- **History**: Son kısaltılan URL'ler

### 🔧 Teknik Özellikler

- **Manifest V3** (Chrome)
- **Service Worker** background script
- **Modern APIs**: Fetch, Clipboard, Storage
- **Rate Limiting**: API koruma ile entegre
- **Error Handling**: Detaylı hata yönetimi
- **Offline Support**: Cache mekanizması

---

## 🚀 Kurulum

### Chrome için Adım Adım:

```bash
1. Chrome Extensions sayfasına git: chrome://extensions/
2. "Developer mode" açık
3. "Load unpacked" → browser-extensions/chrome klasörü seç
4. ✅ Kurulum tamamlandı!
```

### Firefox için Adım Adım:

```bash
1. Firefox Debug sayfasına git: about:debugging#/runtime/this-firefox
2. "Load Temporary Add-on" tıkla
3. browser-extensions/firefox/manifest.json seç
4. ✅ Kurulum tamamlandı!
```

---

## 📱 Kullanım

### 1. **Popup ile Kısaltma**
- Extension icon'a tıkla
- Özel isim gir (opsiyonel)
- "Kısalt" butonuna bas
- URL otomatik kopyalanır!

### 2. **Sağ Tık Menüsü**
- Herhangi bir sayfada sağ tık
- "Bu Sayfayı Kısalt" seç
- Link üzerinde sağ tık → "Bu Linki Kısalt"
- Bildirim gelir, URL kopyalanır

### 3. **Klavye Kısayolu**
- `Ctrl+Shift+U` (Windows/Linux)
- `Cmd+Shift+U` (Mac)
- Mevcut sayfa kısaltılır

### 4. **Paylaşım Özellikleri**
- Kısaltılan URL'i WhatsApp'a gönder
- Twitter'da paylaş
- Telegram'a gönder
- Kopyala ve paylaş

---

## 🛠️ Geliştirici Notları

### API Entegrasyonu

```javascript
const API_BASE = 'https://url-redirect-two.vercel.app/api';

// URL kısaltma
const response = await fetch(`${API_BASE}/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        originalUrl: url,
        customName: customName || undefined
    })
});
```

### Güvenlik Önlemleri

- **Content Security Policy**: XSS koruması
- **Host Permissions**: Sadece gerekli domain'lere erişim
- **Input Validation**: Kullanıcı girişleri filtreleniyor
- **Rate Limiting**: API koruma entegrasyonu

### Chrome Web Store Yayınlama

```bash
1. Extension'ı zip'le
2. Chrome Developer Dashboard'a git
3. $5 registration fee öde
4. Extension'ı yükle
5. Store listing bilgilerini doldur
6. İncelemeye gönder (1-3 gün)
```

### Firefox Add-ons Yayınlama

```bash
1. Extension'ı zip'le
2. Firefox Developer Hub'a git
3. Ücretsiz hesap oluştur
4. Extension'ı yükle
5. İncelemeye gönder (otomatik + manuel)
```

---

## 📊 Extension Analytics

### Kullanım İstatistikleri

```javascript
// Chrome Storage'dan veri al
chrome.storage.local.get(['stats'], function(result) {
    const stats = result.stats || {
        totalShortened: 0,
        lastUsed: null,
        favoriteNames: []
    };
});

// İstatistik güncelle
chrome.storage.local.set({
    stats: {
        totalShortened: stats.totalShortened + 1,
        lastUsed: Date.now(),
        favoriteNames: stats.favoriteNames
    }
});
```

### Event Tracking

- URL kısaltma sayısı
- En çok kullanılan özellik
- Hata istatistikleri
- Performance metrikleri

---

## 🔧 Özelleştirme

### Keyboard Shortcuts

Chrome'da `chrome://extensions/shortcuts` adresinden:
- **Kısaltma**: `Ctrl+Shift+U`
- **Popup Aç**: `Ctrl+Shift+M`
- **Son URL'i Aç**: `Ctrl+Shift+L`

### Theme Support

```css
/* Light Theme */
:root {
    --bg-color: #ffffff;
    --text-color: #333333;
    --border-color: #e9ecef;
}

/* Dark Theme */
@media (prefers-color-scheme: dark) {
    :root {
        --bg-color: #2d3748;
        --text-color: #e2e8f0;
        --border-color: #4a5568;
    }
}
```

---

## 🐛 Sorun Giderme

### Yaygın Sorunlar:

1. **Extension yüklenmiyor**
   - Developer mode açık mı?
   - Manifest.json doğru mu?
   - Dosya izinleri OK mi?

2. **API bağlantısı yok**
   - İnternet bağlantısı var mı?
   - CORS ayarları doğru mu?
   - Host permissions verildi mi?

3. **Clipboard çalışmıyor**
   - HTTPS sayfalarında test edin
   - Browser permissions kontrol edin
   - Content script yüklendi mi?

### Debug Modu:

```javascript
// Console log'ları aç
chrome.runtime.onMessage.addListener((message) => {
    console.log('Extension message:', message);
});

// Storage'ı temizle
chrome.storage.local.clear();
```

---

## 📞 Destek

- **GitHub Issues**: https://github.com/zubeyirtosun/url_redirect/issues
- **Extension Sorular**: Browser extension tag'i ile issue aç
- **API Problemi**: API tag'i ile issue aç

---

## 🚀 Roadmap

### Gelecek Özellikler:
- [ ] QR kod oluşturma
- [ ] Bulk URL import
- [ ] Password protected URLs
- [ ] Custom domain support
- [ ] Analytics dashboard
- [ ] Team sharing
- [ ] Firefox Mobile support

---

> **Not**: Extension'lar sürekli güncellenecektir. Yeni özellikler için repo'yu takip edin! 