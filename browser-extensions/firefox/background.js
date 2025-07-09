// Firefox için uyumlu background script (Manifest V2)

// Context menu oluştur
browser.runtime.onInstalled.addListener(function() {
    console.log('makeURL Firefox Extension yüklendi, context menu oluşturuluyor...');
    
    // Sağ tık menüsüne "URL Kısalt" seçeneği ekle
    browser.contextMenus.create({
        id: "shortenUrl",
        title: "Bu Sayfayı Kısalt",
        contexts: ["page"]
    }).then(() => {
        console.log('Context menu "Bu Sayfayı Kısalt" oluşturuldu');
    }).catch((error) => {
        console.error('Context menu oluşturma hatası:', error);
    });

    browser.contextMenus.create({
        id: "shortenLink",
        title: "Bu Linki Kısalt",
        contexts: ["link"]
    }).then(() => {
        console.log('Context menu "Bu Linki Kısalt" oluşturuldu');
    }).catch((error) => {
        console.error('Link context menu oluşturma hatası:', error);
    });
    
    // Hoş geldin mesajı (sadece ilk kurulumda)
    browser.tabs.create({
        url: 'https://url-redirect-two.vercel.app/?welcome=firefox-extension'
    });
});

// Context menu tıklamaları
browser.contextMenus.onClicked.addListener(async function(info, tab) {
    console.log('Context menu tıklandı:', info.menuItemId);
    
    if (info.menuItemId === "shortenUrl") {
        // Sayfa URL'ini kısalt
        console.log('Sayfa URL kısaltılıyor:', tab.url);
        await shortenUrl(tab.url, tab);
    } else if (info.menuItemId === "shortenLink") {
        // Link URL'ini kısalt
        console.log('Link URL kısaltılıyor:', info.linkUrl);
        await shortenUrl(info.linkUrl, tab);
    }
});

// URL kısaltma fonksiyonu
async function shortenUrl(url, tab) {
    try {
        console.log('URL kısaltma işlemi başlıyor:', url);
        
        const response = await fetch('https://url-redirect-two.vercel.app/api/shorten', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                originalUrl: url
            })
        });

        const data = await response.json();
        console.log('API yanıtı:', data);

        if (response.ok) {
            // Kısaltılmış URL'i clipboard'a kopyala
            await copyToClipboard(data.shortUrl, tab);
            
            // Bildirim göster
            browser.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'makeURL',
                message: `URL kısaltıldı! Kopyalandı: ${data.shortUrl}`
            });

            // Storage'a kaydet
            browser.storage.local.set({
                lastShortened: {
                    originalUrl: url,
                    shortUrl: data.shortUrl,
                    timestamp: Date.now()
                }
            });

        } else {
            // Hata bildirimini göster
            browser.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'makeURL - Hata',
                message: data.error || 'URL kısaltılamadı!'
            });
        }
    } catch (error) {
        console.error('Shorten URL error:', error);
        browser.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'makeURL - Hata',
            message: 'Bağlantı hatası oluştu!'
        });
    }
}

// Clipboard'a kopyala
async function copyToClipboard(text, tab) {
    try {
        // Firefox'ta navigator.clipboard API kullan
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            console.log('Clipboard\'a kopyalandı (modern API):', text);
        } else {
            // Fallback: Content script'e mesaj gönder
            await browser.tabs.sendMessage(tab.id, {
                action: 'copyToClipboard',
                text: text
            });
            console.log('Clipboard\'a kopyalandı (fallback):', text);
        }
    } catch (error) {
        console.error('Clipboard error:', error);
        // Son çare: Content script fallback
        try {
            await browser.tabs.sendMessage(tab.id, {
                action: 'copyToClipboard',
                text: text
            });
        } catch (fallbackError) {
            console.error('Clipboard fallback error:', fallbackError);
        }
    }
}

// Browser action tıklama (Firefox'ta browserAction)
browser.browserAction.onClicked.addListener(function(tab) {
    console.log('Extension icon tıklandı');
    // Popup açılacak (manifest.json'da tanımlı)
});

// Keyboard shortcuts
browser.commands.onCommand.addListener(async function(command) {
    console.log('Klavye komutu:', command);
    
    if (command === "shorten-current-page") {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            console.log('Klavye kısayolu ile URL kısaltılıyor:', tabs[0].url);
            await shortenUrl(tabs[0].url, tabs[0]);
        }
    }
}); 