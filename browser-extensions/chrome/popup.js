const API_BASE = 'https://url-redirect-two.vercel.app/api';

document.addEventListener('DOMContentLoaded', async function() {
    const currentUrlDiv = document.getElementById('currentUrl');
    const customNameInput = document.getElementById('customName');
    const shortenBtn = document.getElementById('shortenBtn');
    const resultDiv = document.getElementById('result');
    const shortUrlDiv = document.getElementById('shortUrl');
    const errorDiv = document.getElementById('error');
    const copyBtn = document.getElementById('copyBtn');
    const openBtn = document.getElementById('openBtn');
    const shareBtn = document.getElementById('shareBtn');

    let currentTab = null;
    let currentShortUrl = null;

    // Mevcut tab'ın URL'ini al
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            currentTab = tabs[0];
            currentUrlDiv.textContent = currentTab.url;
        }
    } catch (error) {
        console.error('Tab bilgisi alınamadı:', error);
        currentUrlDiv.textContent = 'Tab bilgisi alınamadı';
    }

    // URL kısaltma
    shortenBtn.addEventListener('click', async function() {
        if (!currentTab || !currentTab.url) {
            showError('Mevcut sayfa bilgisi alınamadı!');
            return;
        }

        const customName = customNameInput.value.trim();
        
        shortenBtn.disabled = true;
        shortenBtn.textContent = 'Kısaltılıyor...';
        hideError();
        hideResult();

        try {
            const response = await fetch(`${API_BASE}/shorten`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    originalUrl: currentTab.url,
                    customName: customName || undefined
                })
            });

            const data = await response.json();

            if (response.ok) {
                currentShortUrl = data.shortUrl;
                showResult(data.shortUrl);
                customNameInput.value = '';
                
                // Chrome storage'a kaydet
                chrome.storage.local.set({
                    lastShortened: {
                        originalUrl: currentTab.url,
                        shortUrl: data.shortUrl,
                        timestamp: Date.now()
                    }
                });
            } else {
                showError(data.error || 'Bir hata oluştu!');
            }
        } catch (error) {
            console.error('Request error:', error);
            showError('Bağlantı hatası: ' + error.message);
        } finally {
            shortenBtn.disabled = false;
            shortenBtn.textContent = 'Kısalt';
        }
    });

    // Kopyala butonu
    copyBtn.addEventListener('click', async function() {
        if (currentShortUrl) {
            try {
                await navigator.clipboard.writeText(currentShortUrl);
                copyBtn.textContent = 'Kopyalandı!';
                setTimeout(() => {
                    copyBtn.textContent = 'Kopyala';
                }, 2000);
            } catch (error) {
                console.error('Kopyalama hatası:', error);
            }
        }
    });

    // Aç butonu
    openBtn.addEventListener('click', function() {
        if (currentShortUrl) {
            chrome.tabs.create({ url: currentShortUrl });
        }
    });

    // Paylaş butonu
    shareBtn.addEventListener('click', function() {
        if (currentShortUrl) {
            const text = `Bu linke bakın: ${currentShortUrl}`;
            if (navigator.share) {
                navigator.share({
                    title: 'Kısaltılmış Link',
                    text: text,
                    url: currentShortUrl
                });
            } else {
                // Fallback - clipboard'a kopyala
                navigator.clipboard.writeText(text).then(() => {
                    shareBtn.textContent = 'Kopyalandı!';
                    setTimeout(() => {
                        shareBtn.textContent = 'Paylaş';
                    }, 2000);
                });
            }
        }
    });

    // Enter tuşu ile kısaltma
    customNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            shortenBtn.click();
        }
    });

    function showResult(shortUrl) {
        shortUrlDiv.textContent = shortUrl;
        resultDiv.classList.add('show');
    }

    function hideResult() {
        resultDiv.classList.remove('show');
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }

    function hideError() {
        errorDiv.classList.remove('show');
    }
}); 