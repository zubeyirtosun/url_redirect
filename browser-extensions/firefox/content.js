// Firefox için uyumlu content script

// Background script'ten mesaj dinle
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'copyToClipboard') {
        copyToClipboard(request.text);
        sendResponse({ success: true });
    }
});

// Clipboard'a kopyala
function copyToClipboard(text) {
    // Modern Clipboard API dene
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Modern Clipboard API ile kopyalandı:', text);
        }).catch((error) => {
            console.error('Modern Clipboard API hatası:', error);
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

// Fallback clipboard kopyalama
function fallbackCopy(text) {
    // Geçici textarea oluştur
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    
    // Seç ve kopyala
    textarea.select();
    textarea.setSelectionRange(0, 99999); // Mobile support
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            console.log('Fallback ile kopyalandı:', text);
        } else {
            console.error('Fallback kopyalama başarısız');
        }
    } catch (err) {
        console.error('Fallback kopyalama hatası:', err);
    }
    
    // Temizle
    document.body.removeChild(textarea);
}

// Sayfa yüklendiğinde Firefox hoş geldin mesajı
if (window.location.href.includes('?welcome=firefox-extension')) {
    // Hoş geldin mesajı için özel davranış
    setTimeout(() => {
        const banner = document.createElement('div');
        banner.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; z-index: 10000; 
                        background: #FF6611; color: white; padding: 15px; 
                        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        font-family: Arial, sans-serif; max-width: 300px;">
                <div style="font-weight: bold; margin-bottom: 8px;">
                    🦊 makeURL Firefox Extension Kuruldu!
                </div>
                <div style="font-size: 14px; margin-bottom: 10px;">
                    Artık herhangi bir sayfada sağ tıklayarak hızlıca URL kısaltabilirsiniz!
                </div>
                <div style="font-size: 12px; margin-bottom: 10px; opacity: 0.9;">
                    • Sağ tık → "Bu Sayfayı Kısalt"<br/>
                    • Ctrl+Shift+U kısayolu<br/>
                    • Extension ikonuna tıklama
                </div>
                <button onclick="this.parentElement.remove()" 
                        style="background: white; color: #FF6611; border: none; 
                               padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                    Tamam
                </button>
            </div>
        `;
        document.body.appendChild(banner);
        
        // 15 saniye sonra otomatik kapat
        setTimeout(() => {
            if (banner.parentElement) {
                banner.remove();
            }
        }, 15000);
    }, 1000);
} 