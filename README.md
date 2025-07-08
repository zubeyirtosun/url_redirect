# URL Kısaltıcı ve Yönlendirici

Bu proje, uzun URL'leri kısaltmanızı ve özel isimlerle yönlendirme yapmanızı sağlayan bir web uygulamasıdır.

## Özellikler

- ✅ URL kısaltma
- ✅ Özel URL isimleri (örn: `localhost:3000/github` → GitHub sayfanıza)
- ✅ Anlık yönlendirme
- ✅ Modern ve responsive tasarım
- ✅ Kopyalama özelliği
- ✅ Tüm URL'leri görüntüleme

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Sunucuyu başlatın:
```bash
npm start
```

veya geliştirme modunda:
```bash
npm run dev
```

3. Tarayıcınızda `http://localhost:3000` adresine gidin.

## Kullanım

1. **URL Girin**: Yönlendirmek istediğiniz URL'yi girin
2. **Özel İsim (Opsiyonel)**: İstediğiniz özel ismi girin (örn: "github", "projelerim")
3. **Kısalt Butonuna Tıklayın**: Kısa URL'niz oluşturulacak
4. **Paylaşın**: Oluşan kısa URL'yi paylaşın

## Örnekler

- `localhost:3000/github` → https://github.com/kullaniciadi
- `localhost:3000/linkedin` → https://linkedin.com/in/profil
- `localhost:3000/proje` → https://example.com/uzun/proje/linki

## Teknik Detaylar

- **Backend**: Node.js + Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Veritabanı**: In-memory (Map yapısı)
- **Port**: 3000 (varsayılan)

## Notlar

- URL'ler sunucu yeniden başlatıldığında silinir (in-memory storage)
- Kalıcı saklama için MongoDB, PostgreSQL gibi veritabanları entegre edilebilir
- Production ortamında HTTPS kullanılması önerilir 