// Background script'ten mesaj dinle
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'copyToClipboard') {
        copyToClipboard(request.text);
        sendResponse({ success: true });
    }
});

// Clipboard'a kopyala
function copyToClipboard(text) {
    // Geçici textarea oluştur
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    // Seç ve kopyala
    textarea.select();
    document.execCommand('copy');
    
    // Temizle
    document.body.removeChild(textarea);
}

// Sayfa yüklendiğinde URL kısaltma önerisi göster (opsiyonel)
if (window.location.href.includes('?welcome=chrome-extension')) {
    // Hoş geldin mesajı için özel davranış
    setTimeout(() => {
        const banner = document.createElement('div');
        banner.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; z-index: 10000; 
                        background: #4CAF50; color: white; padding: 15px; 
                        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        font-family: Arial, sans-serif; max-width: 300px;">
                <div style="font-weight: bold; margin-bottom: 8px;">
                    🎉 makeURL Chrome Extension Kuruldu!
                </div>
                <div style="font-size: 14px; margin-bottom: 10px;">
                    Artık herhangi bir sayfada sağ tıklayarak hızlıca URL kısaltabilirsiniz!
                </div>
                <button onclick="this.parentElement.remove()" 
                        style="background: white; color: #4CAF50; border: none; 
                               padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                    Tamam
                </button>
            </div>
        `;
        document.body.appendChild(banner);
        
        // 10 saniye sonra otomatik kapat
        setTimeout(() => {
            if (banner.parentElement) {
                banner.remove();
            }
        }, 10000);
    }, 1000);
} 