# 🔗 URL Kısaltıcı API Dokümantasyonu

Bu dokümantasyon, URL kısaltıcı sisteminin tüm API endpoint'lerini ve kullanımını açıklamaktadır.

## 📋 İçindekiler

1. [Genel Bilgiler](#genel-bilgiler)
2. [Authentication](#authentication)
3. [URL Kısaltma](#url-kısaltma)
4. [URL Yönlendirme](#url-yönlendirme)
5. [URL Silme (Admin)](#url-silme-admin)
6. [İstatistikler](#istatistikler)
7. [Test Endpoint'leri](#test-endpointleri)
8. [Hata Kodları](#hata-kodları)
9. [Örnekler](#örnekler)

---

## 🌐 Genel Bilgiler

**Base URL:** `https://url-redirect-two.vercel.app`

**Desteklenen HTTP Methods:**
- `GET` - Veri okuma
- `POST` - URL kısaltma
- `DELETE` - URL silme (Admin)

**Content-Type:** `application/json`

**Storage:** Hybrid sistem (Redis + Memory Cache)

---

## 🔐 Authentication

### Admin İşlemleri
URL silme işlemleri için admin şifresi gereklidir.

**Environment Variable:** `ADMIN_PASSWORD`
**Mevcut Şifre:** `adminblockmax.!`

Admin şifresi request body'de `password` alanında gönderilmelidir.

---

## ✂️ URL Kısaltma

### URL Kısalt
Uzun URL'leri kısa URL'lere çevirir.

**Endpoint:** `POST /api/shorten`

**Request Body:**
```json
{
    "originalUrl": "https://example.com/very/long/url",
    "customCode": "mylink"  // Opsiyonel
}
```

**Response (Başarılı):**
```json
{
    "originalUrl": "https://example.com/very/long/url",
    "shortUrl": "https://url-redirect-two.vercel.app/mylink",
    "shortCode": "mylink"
}
```

**Response (Hata):**
```json
{
    "error": "URL gerekli!",
    "debug": "originalUrl is missing"
}
```

**Özel Kod Kuralları:**
- Nokta (.), tire (-), alt çizgi (_) desteklenir
- Minimum 1, maksimum 50 karakter
- Boşluk ve özel karakterler desteklenmez
- Eğer belirtilmezse otomatik kod üretilir

---

## 🔄 URL Yönlendirme

### Kısa URL'e Erişim
Kısa URL'e erişildiğinde orijinal URL'ye yönlendirir.

**Endpoint:** `GET /:shortCode`

**Örnek:** 
- Request: `GET /mylink`
- Response: `302 Redirect` → orijinal URL'e yönlendirir

**Not:** Bu endpoint aynı zamanda tıklama istatistiklerini günceller.

---

## 🗑️ URL Silme (Admin)

### Tekil URL Silme
Belirtilen kısa URL'i sistemden tamamen siler.

**Endpoint:** `DELETE /api/delete/:shortCode`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
    "password": "adminblockmax.!"
}
```

**Response (Başarılı):**
```json
{
    "message": "URL başarıyla silindi!",
    "shortCode": "mylink",
    "originalUrl": "https://example.com/very/long/url",
    "deletedFrom": "Redis ve Memory"
}
```

**Response (Hata - Yanlış Şifre):**
```json
{
    "error": "Yetkisiz erişim! Doğru şifre gerekli.",
    "hint": "Body'de password alanı göndermeniz gerekiyor"
}
```

**Response (Hata - URL Bulunamadı):**
```json
{
    "error": "URL bulunamadı!"
}
```

### Toplu URL Silme
Sistemdeki tüm URL'leri siler.

**Endpoint:** `DELETE /api/delete-all`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
    "password": "adminblockmax.!"
}
```

**Response (Başarılı):**
```json
{
    "message": "Tüm URL'ler başarıyla silindi!",
    "deletedCount": 15,
    "deletedFrom": "Redis ve Memory"
}
```

---

## 📊 İstatistikler

### URL İstatistikleri
Belirtilen kısa URL'in detaylı istatistiklerini getirir.

**Endpoint:** `GET /api/stats/:shortCode`

**Response (Başarılı):**
```json
{
    "shortCode": "mylink",
    "originalUrl": "https://example.com/very/long/url",
    "clickCount": 42,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastAccessed": "2024-01-20T14:25:30.000Z",
    "exists": true
}
```

**Response (URL Bulunamadı):**
```json
{
    "error": "URL bulunamadı!"
}
```

### Tüm URL'lerin Listesi
Sistemdeki tüm URL'leri listeler.

**Endpoint:** `GET /api/urls`

**Response:**
```json
{
    "mylink": "https://example.com/very/long/url",
    "github": "https://github.com",
    "google": "https://google.com"
}
```

---

## 🧪 Test Endpoint'leri

### API Durum Kontrolü
API'nin çalışıp çalışmadığını kontrol eder.

**Endpoint:** `GET /api/test`

**Response:**
```json
{
    "message": "API çalışıyor!",
    "timestamp": "2024-01-20T16:45:00.000Z",
    "urls_count": 25,
    "redis_connected": true
}
```

### Test URL Oluşturma
Test amaçlı otomatik URL oluşturur.

**Endpoint:** `GET /api/shorten-test`

**Response:**
```json
{
    "message": "Test URL oluşturuldu ve Redis'e kaydedildi!",
    "originalUrl": "https://store.steampowered.com/app/3527290/PEAK/",
    "shortUrl": "https://url-redirect-two.vercel.app/peak-test",
    "shortCode": "peak-test",
    "test_link": "<a href=\"...\">Test Link - Tıkla</a>",
    "stats_link": "https://url-redirect-two.vercel.app/api/stats/peak-test"
}
```

---

## ⚠️ Hata Kodları

| HTTP Kod | Açıklama | Örnek |
|----------|----------|-------|
| `200` | Başarılı | URL başarıyla kısaltıldı |
| `302` | Yönlendirme | Kısa URL'den orijinal URL'ye |
| `400` | Geçersiz İstek | URL formatı yanlış |
| `401` | Yetkisiz Erişim | Yanlış admin şifresi |
| `404` | Bulunamadı | URL mevcut değil |
| `409` | Çakışma | Özel kod zaten kullanımda |
| `500` | Sunucu Hatası | Redis bağlantı problemi |

---

## 🔧 Örnekler

### cURL ile URL Kısaltma
```bash
curl -X POST https://url-redirect-two.vercel.app/api/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "originalUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "customCode": "rickroll"
  }'
```

### JavaScript ile URL Kısaltma
```javascript
fetch('https://url-redirect-two.vercel.app/api/shorten', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        originalUrl: 'https://github.com/zubeyirtosun',
        customCode: 'mygithub'
    })
})
.then(response => response.json())
.then(data => console.log(data));
```

### cURL ile URL Silme (Admin)
```bash
curl -X DELETE https://url-redirect-two.vercel.app/api/delete/rickroll \
  -H "Content-Type: application/json" \
  -d '{"password": "adminblockmax.!"}'
```

### Python ile İstatistik Alma
```python
import requests

response = requests.get('https://url-redirect-two.vercel.app/api/stats/mygithub')
data = response.json()
print(f"Tıklama sayısı: {data['clickCount']}")
```

### cURL ile Tüm URL'leri Silme (Admin)
```bash
curl -X DELETE https://url-redirect-two.vercel.app/api/delete-all \
  -H "Content-Type: application/json" \
  -d '{"password": "adminblockmax.!"}'
```

---

## 🔒 Güvenlik Notları

1. **Admin şifresi** sadece güvenilir kişilerle paylaşılmalıdır
2. **Environment variables** Vercel dashboard'dan yönetilmelidir
3. **Rate limiting** şu an aktif değil, yoğun kullanımda dikkat edilmelidir
4. **HTTPS** zorunludur, HTTP istekleri kabul edilmez
5. **Redis** veriler kalıcıdır, silinmedikçe kaybolmaz

---

## 📞 Destek

**Repository:** https://github.com/zubeyirtosun/url_redirect  
**Live Demo:** https://url-redirect-two.vercel.app  
**Son Güncelleme:** 8 Ocak 2025

---

> **Not:** Bu API dokümantasyonu güncel tutulmaktadır. Değişiklikler için repository'yi takip edin. 