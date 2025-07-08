document.addEventListener('DOMContentLoaded', function() {
    const originalUrlInput = document.getElementById('originalUrl');
    const customNameInput = document.getElementById('customName');
    const shortenBtn = document.getElementById('shortenBtn');
    const resultDiv = document.getElementById('result');
    const shortUrlInput = document.getElementById('shortUrl');
    const copyBtn = document.getElementById('copyBtn');
    const errorDiv = document.getElementById('error');
    const originalUrlDisplay = document.getElementById('originalUrlDisplay');
    const loadUrlsBtn = document.getElementById('loadUrlsBtn');
    const urlsList = document.getElementById('urlsList');

    // URL kısaltma
    shortenBtn.addEventListener('click', async function() {
        const originalUrl = originalUrlInput.value.trim();
        const customName = customNameInput.value.trim();
        
        if (!originalUrl) {
            showError('Lütfen bir URL girin!');
            return;
        }

        // URL formatını kontrol et (http:// veya https:// yoksa ekle)
        let formattedUrl = originalUrl;
        if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
            formattedUrl = 'https://' + originalUrl;
        }

        shortenBtn.disabled = true;
        shortenBtn.textContent = 'Kısaltılıyor...';

        try {
            const response = await fetch('/api/shorten', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    originalUrl: formattedUrl,
                    customName: customName 
                }),
            });

            const data = await response.json();

            if (response.ok) {
                showResult(data);
                originalUrlInput.value = '';
                customNameInput.value = '';
                hideError();
            } else {
                showError(data.error || 'Bir hata oluştu!');
            }
        } catch (error) {
            showError('Sunucu bağlantısında hata oluştu!');
        } finally {
            shortenBtn.disabled = false;
            shortenBtn.textContent = 'Kısalt';
        }
    });

    // Enter tuşu ile kısaltma
    originalUrlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            shortenBtn.click();
        }
    });

    customNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            shortenBtn.click();
        }
    });

    // URL kopyalama
    copyBtn.addEventListener('click', function() {
        shortUrlInput.select();
        shortUrlInput.setSelectionRange(0, 99999); // Mobil için
        
        navigator.clipboard.writeText(shortUrlInput.value).then(function() {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Kopyalandı!';
            copyBtn.style.background = '#28a745';
            
            setTimeout(function() {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '#007bff';
            }, 2000);
        }).catch(function() {
            // Fallback için eski yöntem
            document.execCommand('copy');
            copyBtn.textContent = 'Kopyalandı!';
            setTimeout(function() {
                copyBtn.textContent = 'Kopyala';
            }, 2000);
        });
    });

    // Tüm URL'leri yükleme
    loadUrlsBtn.addEventListener('click', async function() {
        try {
            const response = await fetch('/api/urls');
            const urls = await response.json();
            
            displayUrls(urls);
        } catch (error) {
            showError('URLler yüklenirken hata oluştu!');
        }
    });

    function showResult(data) {
        shortUrlInput.value = data.shortUrl;
        originalUrlDisplay.textContent = data.originalUrl;
        resultDiv.classList.remove('hidden');
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    function hideError() {
        errorDiv.classList.add('hidden');
    }

    function displayUrls(urls) {
        if (urls.length === 0) {
            urlsList.innerHTML = '<p style="color: #666; text-align: center;">Henüz kısaltılmış URL yok.</p>';
            return;
        }

        urlsList.innerHTML = urls.map(url => `
            <div class="url-item">
                <div class="url-item-short">
                    <a href="${url.shortUrl}" target="_blank">${url.shortUrl}</a>
                </div>
                <div class="url-item-original">
                    → ${url.originalUrl}
                </div>
            </div>
        `).join('');
    }
}); 