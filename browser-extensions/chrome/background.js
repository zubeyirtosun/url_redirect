// Context menu oluştur
chrome.runtime.onInstalled.addListener(function() {
    // Sağ tık menüsüne "URL Kısalt" seçeneği ekle
    chrome.contextMenus.create({
        id: "shortenUrl",
        title: "Bu Sayfayı Kısalt",
        contexts: ["page"]
    });

    chrome.contextMenus.create({
        id: "shortenLink",
        title: "Bu Linki Kısalt",
        contexts: ["link"]
    });
});

// Context menu tıklamaları
chrome.contextMenus.onClicked.addListener(async function(info, tab) {
    if (info.menuItemId === "shortenUrl") {
        // Sayfa URL'ini kısalt
        await shortenUrl(tab.url, tab);
    } else if (info.menuItemId === "shortenLink") {
        // Link URL'ini kısalt
        await shortenUrl(info.linkUrl, tab);
    }
});

// URL kısaltma fonksiyonu
async function shortenUrl(url, tab) {
    try {
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

        if (response.ok) {
            // Kısaltılmış URL'i clipboard'a kopyala
            await copyToClipboard(data.shortUrl, tab);
            
            // Bildirim göster
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'makeURL',
                message: `URL kısaltıldı! Kopyalandı: ${data.shortUrl}`
            });

            // Storage'a kaydet
            chrome.storage.local.set({
                lastShortened: {
                    originalUrl: url,
                    shortUrl: data.shortUrl,
                    timestamp: Date.now()
                }
            });

        } else {
            // Hata bildirimini göster
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'makeURL - Hata',
                message: data.error || 'URL kısaltılamadı!'
            });
        }
    } catch (error) {
        console.error('Shorten URL error:', error);
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'makeURL - Hata',
            message: 'Bağlantı hatası oluştu!'
        });
    }
}

// Clipboard'a kopyala (service worker'da)
async function copyToClipboard(text, tab) {
    try {
        // Content script'e mesaj gönder
        await chrome.tabs.sendMessage(tab.id, {
            action: 'copyToClipboard',
            text: text
        });
    } catch (error) {
        console.error('Clipboard error:', error);
    }
}

// Extension icon'a tıklama
chrome.action.onClicked.addListener(function(tab) {
    // Popup açılacak (manifest.json'da tanımlı)
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async function(command) {
    if (command === "shorten-current-page") {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            await shortenUrl(tabs[0].url, tabs[0]);
        }
    }
});

// Extension kurulduğunda hoş geldin mesajı
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: 'https://url-redirect-two.vercel.app/?welcome=chrome-extension'
        });
    }
}); 