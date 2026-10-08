# Canlı inceleme ve doğrulama

[Canlı site](https://vanta-cyber-intelligence.vercel.app) · [Yönetim girişi](https://vanta-cyber-intelligence.vercel.app/admin) · [Kaynak kod](https://github.com/H00wb/vanta-cyber-intelligence)

Bu rapor 8 Ekim 2026 tarihinde yapılan kontrolleri anlatır. Tam canlı tarayıcı koşusu 03:29–03:30, veritabanı kontrolü ve test temizliği 03:31–03:32 (Europe/Istanbul) arasında tamamlandı. Kontrol edilen uygulama kodu [a1a66e5](https://github.com/H00wb/vanta-cyber-intelligence/commit/a1a66e5bf84f3ee5d40215bf4f634f510536cef5) commit'idir. Bu raporu ekleyen teslim commit'i, uygulama kodunu değiştirmez; son kimlik kaynak arşivinin yanındaki TESLIM.txt içindedir.

## Değerlendirici için kısa inceleme

1. Siteyi açıp yalnız kurgusal bilgilerle form gönderin. Örneğin Deniz Örnek / deniz@example.com kullanabilirsiniz.
2. Başarı mesajındaki kayıt numarasını kopyalayın.
3. Doğrudan `/admin` adresine gidin. Kullanıcı adı **admin**, şifre **admin123**.
4. Kayıt numarasını arama alanına yapıştırın. İsim, e-posta, hizmet ve açıklamayı gönderdiğiniz bilgilerle karşılaştırın. Kayıt zamanı veritabanından gelir ve UTC olarak gösterilir.
5. Sayfayı yenileyip aynı numarayı tekrar arayın. Aynı satır ve değerler korunmalı. Çıkış yapınca kayıt API'si tekrar giriş ister.

Site ve API Vercel'de çalışır; kayıtlar Supabase PostgreSQL'de saklanır. Panel her aramada/yenilemede sunucu üzerinden veritabanını okur; kaynak içine yazılmış örnek satırları göstermez. Ana sayfada yönetim bağlantısı yoktur.

![Doğrudan /admin giriş ekranı](evidence/admin-login.png)

## Gerçek gönderimin tabloya ulaşması

Aşağıdaki ekran, canlı formdan gönderilen kurgusal talebin UUID ile filtrelenmiş halidir. Form gönderimi 201, yönetim okuması 200 döndü. Aynı satır hem sayfa yenilemesinden sonra hem bağımsız Supabase SQL sorgusunda doğrulandı.

| Alan | Doğrulanan değer |
| --- | --- |
| Kayıt no | d7e2e375-6a71-41cc-8dd8-876c1fc00983 |
| İsim | İnceleme Testi |
| E-posta | inceleme@example.com |
| Hizmet | Dijital varlık ve risk haritalama (`risk-mapping`) |
| Açıklama | Kurgusal test kurumunun dijital varlıklarını ve güvenlik risklerini değerlendirmek istiyoruz. |
| Veritabanı zamanı | 8 Ekim 2026 00:29:20 UTC |

![Canlı formdan gelen ve kimliğiyle filtrelenen kurgusal kayıt](evidence/admin-record.png)

**Bu ekran kontrol anının kanıtıdır.** Kontroller bitince yalnız bu turda oluşturulan 15 kurgusal test satırı, kaydedilmiş kimlikleri ve kurgusal alanlarıyla eşleştirilerek temizlendi. Kullanıcının önceden oluşturduğu tek kayıt korundu; temizlik öncesi ve sonrası bütün satırın özeti aynıydı. Son kontrolde tabloda bu bir kayıt kaldı. Dolayısıyla ekrandaki test UUID'sini bugün arayınca bulamamanız beklenir; güncel akışı yukarıdaki adımlarla kendi kurgusal kaydınız üzerinden inceleyin. Uygulama, gönderilen talepleri kendiliğinden silmez.

Mevcut kişinin adını ve e-postasını kaynak kodda veya kanıt ekranlarında yayımlamadık. Demo giriş bilgileri açıktır; panel bu değerlendirme için salt okunur erişim sağlar.

## Başarı, hata ve tekrar gönderim sonuçları

| Kontrol | Gözlenen sonuç |
| --- | --- |
| Geçerli canlı form | 201; eşleşen UUID sonrasında başarı mesajı. Dört alan SQL ile eşleşti. |
| Boş/geçersiz form | Tarayıcı isteği engelledi; doğrudan API ile geçersiz alan 422 aldı. |
| Gönderiliyor | Form ve düğme kilitlendi; ikinci gönderim yeni istek başlatmadı. |
| Simüle edilen depolama hatası | 503; bilgiler korundu, başarı mesajı görünmedi. Bu senaryo kontrollü hata taklididir. |
| Ağ kesintisi, HTML yanıtı, yanlış UUID, 15 saniye zaman aşımı | Başarı gösterilmedi; anlaşılır hata/belirsizlik mesajı ve tekrar deneme olanağı korundu. |
| Gerçek kayıttan sonra yanıtın kaybedilmesi | Aynı UUID tekrarında 200/replayed; bağımsız SQL'de tek satır. |
| Aynı UUID ile beş eşzamanlı canlı gönderim | Bir 201 ve dört 200; SQL'de tek satır. |
| Aynı UUID, farklı içerik | 409; ilk satır korundu. |
| Vercel yeniden yayını | Yerel testte daha önce açılan satır, yeni Vercel yayını sonrasında aynı alanlarla SQL'de bulundu. |

![Gerçek yanıtı bekleyen form](evidence/form-sending.png)

![Doğrulanmış kayıttan sonra başarı mesajı](evidence/form-success.png)

![503 taklidinde alanları koruyan ve başarı göstermeyen form](evidence/form-error.png)

## Yönetim ve veritabanı erişimi

| Canlı kontrol | Sonuç |
| --- | --- |
| Oturumsuz veya uydurulmuş çerezle kayıt API'si | 401; satır dönmedi. |
| Geçerli imzalı fakat süresi dolmuş oturum | 401; satır dönmedi. |
| Yanlış parola | 401; oturum açılmadı. |
| Yabancı veya eksik Origin ile giriş | 403. Yabancı Origin ile çıkış da 403 aldı. |
| Doğru giriş ve yenileme | 200; HttpOnly, SameSite=Strict, Secure ve bir saatlik çerez doğrulandı. |
| Yetkili kayıt okuma | 200; private/no-store. Mevcut kayıt kimliğiyle bulunabildi. |
| Geçersiz sayfa numarası | 422. |
| Çıkış | 204; çerez temizlendi. Tarayıcıdan sonraki kayıt okuması 401 aldı. |
| Publishable key ile doğrudan tablo okuma/yazma | 401; anonim tablo yetkisi kapalı. |
| Yanlış token ile yönetim RPC'si | 401; satır dönmedi. |
| Giriş sınırı için gerçek DB'ye 11 paralel çağrı | Aynı kurgusal limit anahtarında 10 izin, 1 ret. Bu, API'nin 429 davranışını sınayan birim testinden ayrı PostgreSQL kontrolüdür. |
| Aramada `%`, `_` ve ters bölü | Joker olarak genişlemek yerine düz karakter olarak arandı; sonuçlar mevcut alanlarla karşılaştırıldı. |

Çıkış tarayıcıdaki çerezi temizler. Oturum stateless olduğu için önceden kopyalanmış bir çerez, bir saatlik süresi dolana kadar geçerli kalır. Panel salt okunurdur; düzenleme/silme arayüzü yoktur. Okuma token'ı ve parola özeti tarayıcıya verilmez.

## Test kapsamı ve ekran uyumu

- **75/75 Node testi:** 31 form/API, 10 Supabase kayıt bağlantısı, 6 SSR, 18 yönetim kimlik/HTTP ve 10 yönetim deposu.
- **21/21 yerel Chromium, 21/21 canlı Chromium:** 15 sayfa/form ve 6 yönetim senaryosu.
- **Lint, TypeScript ve üretim derlemesi:** başarılı.
- **320, 390, 768 ve 1440 px:** sayfa/form kullanılabilir, sayfa yatay taşmadı. Yönetimde 390 px tablonun kaydırması kendi bölgesinde kaldı.
- **Klavye, %200 metin ve axe WCAG A/AA:** ilgili senaryolar geçti; landing, giriş ve kurgusal satırlı panel taramalarında ihlal çıkmadı. Bu sonuç manuel ekran okuyucu veya bütün erişilebilirlik koşullarının yerine geçmez.

Her testin neyi sınadığı [TEST_SONUCLARI.md](TEST_SONUCLARI.md), komutlar ve manuel adımlar [TEST_REHBERI.txt](TEST_REHBERI.txt) içindedir. Node testlerinin geçici SQLite/taklit HTTP/SDK kullanımı gerçek PostgreSQL kanıtından ayrı belirtilmiştir. Ayrı canlı HTTP kontrolü ve SQL okuması yukarıdaki kalıcılık ve izin sonuçlarını doğruladı.

[Masaüstü ekran görüntüsü](evidence/vercel-desktop.png) · [Mobil ekran görüntüsü](evidence/vercel-mobile.png)

Eski veritabanı temizlenmeden önce üretilen JSON/TAP kanıt dosyaları teslimden kaldırıldı. Bu rapor güncel kontrolleri ve test temizliğini açıklar; önceki satırların hâlâ var olduğunu ileri sürmez.
