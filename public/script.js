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

    // Karakter sayaçları
    function updateCharacterCount(input, countElement, maxLength) {
        const currentLength = input.value.length;
        countElement.textContent = `${currentLength}/${maxLength}`;
        
        if (currentLength > maxLength) {
            countElement.style.color = '#dc3545';
            input.style.borderColor = '#dc3545';
        } else if (currentLength > maxLength * 0.8) {
            countElement.style.color = '#ffc107';
            input.style.borderColor = '#ffc107';
        } else {
            countElement.style.color = '#666';
            input.style.borderColor = '#ddd';
        }
    }

    // Karakter sayaçlarını ekle
    const urlCharCount = document.createElement('div');
    urlCharCount.className = 'char-count';
    urlCharCount.textContent = '0/2000';
    originalUrlInput.parentNode.appendChild(urlCharCount);

    const customCharCount = document.createElement('div');
    customCharCount.className = 'char-count';
    customCharCount.textContent = '0/50';
    customNameInput.parentNode.appendChild(customCharCount);

    // Input event'leri
    originalUrlInput.addEventListener('input', function() {
        updateCharacterCount(this, urlCharCount, 2000);
    });

    customNameInput.addEventListener('input', function() {
        updateCharacterCount(this, customCharCount, 50);
    });

    // URL kısaltma
    shortenBtn.addEventListener('click', async function() {
        const originalUrl = originalUrlInput.value.trim();
        const customName = customNameInput.value.trim();
        
        if (!originalUrl) {
            showError('Lütfen bir URL girin!');
            return;
        }

        // Karakter sınırı kontrolü
        if (originalUrl.length > 2000) {
            showError('URL çok uzun! Maksimum 2000 karakter olmalıdır.');
            return;
        }

        if (customName.length > 50) {
            showError('Özel isim çok uzun! Maksimum 50 karakter olmalıdır.');
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
            console.log('Sending request with:', { originalUrl: formattedUrl, customName });
            
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

            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (response.ok) {
                showResult(data);
                originalUrlInput.value = '';
                customNameInput.value = '';
                hideError();
            } else {
                showError(data.error || 'Bir hata oluştu!');
            }
        } catch (error) {
            console.error('Request error:', error);
            showError('Sunucu bağlantısında hata oluştu: ' + error.message);
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

    // Sayfalama değişkenleri
    let currentPage = 1;
    const itemsPerPage = 10;
    let allUrls = [];

    function displayUrls(urls) {
        allUrls = Object.entries(urls).map(([shortCode, originalUrl]) => ({
            shortCode,
            originalUrl,
            shortUrl: window.location.origin + '/' + shortCode
        }));

        if (allUrls.length === 0) {
            urlsList.innerHTML = '<p style="color: #666; text-align: center;">Henüz kısaltılmış URL yok.</p>';
            return;
        }

        displayPage(currentPage);
    }

    function displayPage(page) {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageUrls = allUrls.slice(startIndex, endIndex);
        const totalPages = Math.ceil(allUrls.length / itemsPerPage);

        // URL listesini göster
        const urlsHtml = pageUrls.map(url => `
            <div class="url-item">
                <div class="url-item-short">
                    <a href="${url.shortUrl}" target="_blank">${url.shortUrl}</a>
                </div>
                <div class="url-item-original" title="${url.originalUrl}">
                    → ${url.originalUrl}
                </div>
            </div>
        `).join('');

        // Sayfalama kontrollerini oluştur
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = `
                <div class="pagination">
                    <div class="pagination-info">
                        ${allUrls.length} URL'den ${startIndex + 1}-${Math.min(endIndex, allUrls.length)} arası gösteriliyor
                    </div>
                    <div class="pagination-controls">
                        <button onclick="changePage(${page - 1})" ${page === 1 ? 'disabled' : ''}>
                            ← Önceki
                        </button>
                        <span class="page-info">Sayfa ${page} / ${totalPages}</span>
                        <button onclick="changePage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>
                            Sonraki →
                        </button>
                    </div>
                </div>
            `;
        }

        urlsList.innerHTML = urlsHtml + paginationHtml;
    }

    // Global function for pagination
    window.changePage = function(page) {
        const totalPages = Math.ceil(allUrls.length / itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            displayPage(page);
        }
    }
}); 