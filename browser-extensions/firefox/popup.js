// Firefox popup script - browser API kullanır

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Firefox popup yüklendi');
    
    // Mevcut tab bilgisini al
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (currentTab && currentTab.url) {
            document.getElementById('currentUrl').textContent = currentTab.url;
        } else {
            document.getElementById('currentUrl').textContent = 'URL alınamadı';
        }
    } catch (error) {
        console.error('Tab bilgisi alınamadı:', error);
        document.getElementById('currentUrl').textContent = 'Hata: Tab bilgisi alınamadı';
    }

    // Kısalt butonu click handler
    document.getElementById('shortenBtn').addEventListener('click', async function() {
        const btn = this;
        const customName = document.getElementById('customName').value.trim();
        const currentUrl = document.getElementById('currentUrl').textContent;
        
        if (currentUrl === 'Yükleniyor...' || currentUrl === 'URL alınamadı') {
            showError('Geçerli bir URL bulunamadı');
            return;
        }

        // Button'ı disable et
        btn.disabled = true;
        btn.textContent = 'Kısaltılıyor...';
        hideError();
        hideResult();

        try {
            const response = await fetch('https://url-redirect-two.vercel.app/api/shorten', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    originalUrl: currentUrl,
                    customName: customName || undefined
                })
            });

            const data = await response.json();

            if (response.ok) {
                showResult(data.shortUrl);
                
                // Bildirim göster
                browser.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'makeURL Firefox',
                    message: `URL kısaltıldı! ${data.shortUrl}`
                });

                // Storage'a kaydet
                browser.storage.local.set({
                    lastShortened: {
                        originalUrl: currentUrl,
                        shortUrl: data.shortUrl,
                        customName: customName,
                        timestamp: Date.now()
                    }
                });

            } else {
                showError(data.error || 'URL kısaltılamadı');
            }

        } catch (error) {
            console.error('API Hatası:', error);
            showError('Bağlantı hatası: ' + error.message);
        } finally {
            // Button'ı yeniden aktif et
            btn.disabled = false;
            btn.textContent = 'Kısalt';
        }
    });

    // Result kopyala butonu
    document.getElementById('copyBtn').addEventListener('click', function() {
        const shortUrl = document.getElementById('shortUrl').textContent;
        copyToClipboard(shortUrl);
    });

    // Result aç butonu
    document.getElementById('openBtn').addEventListener('click', function() {
        const shortUrl = document.getElementById('shortUrl').textContent;
        browser.tabs.create({ url: shortUrl });
    });

    // Share butonu
    document.getElementById('shareBtn').addEventListener('click', function() {
        const shortUrl = document.getElementById('shortUrl').textContent;
        
        // Firefox'ta native share API yoksa WhatsApp'a yönlendir
        if (navigator.share) {
            navigator.share({
                title: 'makeURL ile kısaltılan link',
                url: shortUrl
            }).catch(err => console.log('Share hatası:', err));
        } else {
            // Fallback: WhatsApp share
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shortUrl)}`;
            browser.tabs.create({ url: whatsappUrl });
        }
    });

    // Enter tuşu ile kısalt
    document.getElementById('customName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('shortenBtn').click();
        }
    });
});

// Clipboard'a kopyala
function copyToClipboard(text) {
    // Modern API dene
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Modern API ile kopyalandı:', text);
            showCopySuccess();
        }).catch((error) => {
            console.error('Modern clipboard hatası:', error);
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

// Fallback clipboard
function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            console.log('Fallback ile kopyalandı:', text);
            showCopySuccess();
        } else {
            console.error('Fallback kopyalama başarısız');
        }
    } catch (err) {
        console.error('Fallback kopyalama hatası:', err);
    }
    
    document.body.removeChild(textarea);
}

// Copy success mesajı
function showCopySuccess() {
    const copyBtn = document.getElementById('copyBtn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓ Kopyalandı';
    copyBtn.style.background = '#28a745';
    
    setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = '';
    }, 2000);
}

// Sonuç göster
function showResult(shortUrl) {
    document.getElementById('shortUrl').textContent = shortUrl;
    document.getElementById('result').classList.add('show');
}

// Sonuç gizle
function hideResult() {
    document.getElementById('result').classList.remove('show');
}

// Hata göster
function showError(message) {
    document.getElementById('error').textContent = message;
    document.getElementById('error').classList.add('show');
}

// Hata gizle
function hideError() {
    document.getElementById('error').classList.remove('show');
} 