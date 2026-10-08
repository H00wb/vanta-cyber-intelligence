# Gereksinimlerin karşılığı

Bu dosya, değerlendirme ölçütlerinin projede hangi davranış ve kontrolle karşılandığını gösterir. Puanı değerlendirici verir; aşağıdaki eşleştirme kesin puan tahmini değildir.

- [Canlı site](https://vanta-cyber-intelligence.vercel.app)
- [Kaynak kod](https://github.com/H00wb/vanta-cyber-intelligence)
- [Doğrudan yönetim girişi](https://vanta-cyber-intelligence.vercel.app/admin)

| Ölçüt | Projedeki karşılığı | İnceleme yolu |
| --- | --- | --- |
| Çalışan ürün ve gereksinimler — 25 | Hedef kitle ve problem anlatımı, dört hizmet, mobil/masaüstü sayfa, dört alanlı form, gönderiliyor/başarı/hata durumları, Supabase'de kayıt. | Formu gönderin; dönen UUID'yi panelde arayıp dört alanı ve kayıt zamanını karşılaştırın. Yenileyerek kalıcılığı kontrol edin. |
| Kod, veri akışı ve temel güvenlik — 20 | Ortak istemci/sunucu doğrulaması, JSON/gövde/Origin kontrolü, DB kısıtları, tek kayıt bırakan tekrar gönderim, kapalı anonim tablo erişimi, sınırlı RPC'ler. Yönetim okuması oturum ve sunucudaki ayrı token ile korunur. | Validator, API, depo ve üç SQL migration'ını okuyun. Olumsuz durumları test rehberindeki beklenen HTTP sonuçlarıyla karşılaştırın. |
| AI ile üretim ve doğrulama — 20 | AI_LOG'da kapsam kararları, kabul edilen/değiştirilen çözümler, açık Codex ve alt ajan katkısı, gerçek hata bulguları ve kontrol sınırları. | AI_LOG'u kod ve test senaryolarıyla karşılaştırın. Tarihsel sonuçlarla güncel kayıt kanıtını ayırın. |
| Kullanılabilirlik ve erişilebilirlik — 10 | Görünür odak, etiketler, alanla ilişkili hatalar, durum duyurusu, klavye kullanımı, dar ekranda form ve okunabilir içerik. | Mobil genişlikleri, klavyeyi, %200 metin büyütmeyi ve tarayıcı erişilebilirlik kontrolünü kullanın. |
| Test, hata yönetimi ve teslim — 10 | Anlamlı olumlu/olumsuz senaryolar, belirsiz gönderimde doğru mesaj, çalıştırma adımları, canlı URL, kaynak ve belgeler. | TEST_REHBERI.txt ile tekrar edin; güncel kontrol tarihi, teslim commit'i ve kaynak arşivini karşılaştırın. |
| Yazılı problem çözme — 10 | README ve AI_LOG'da risk, seçim, düzeltme ve doğrulama gerekçeleri. | Bunlar projedeki kararların kanıtıdır. Başvuru formunda ayrıca sorulan bir senaryonun yanıtı bu depoda verilmediyse, bu belgeleri otomatik olarak o yanıtın yerine saymayın. |
| Geçmiş proje ve kişisel katkı — 5 | BiLSTM müzik üretimi projesine bağlantı, model/kod yazarlığı beyanı ve hesap katkısını gösteren commit. | README'deki repo ve commit'i inceleyin. Bu case sırasında yeniden eğitim veya performans ölçümü yapılmadı. |

## Güncel kontrol kaydı

Node: **76/76**. Tarayıcı: **yerel 22/22 ve canlı 22/22 geçti**. Canlı kontrol zamanı: **8 Ekim 2026, 05:11 (Europe/Istanbul)**.

Önceki test turlarının başarıları tarihsel sonuçlardır. Veritabanı sonradan temizlendiği için eski test satırlarının hâlâ mevcut olduğunu ileri sürmüyoruz. Kalıcılık incelemesinde güncel paneli, mevcut kaydı ve güncel ekran görüntülerini esas alın. Mevcut kullanıcı kaydı korunur; yeni otomatik testlerin oluşturduğu kurgusal satırlar ayrıca tanımlanır.

## Kabul için kontrol edilecek davranışlar

- Geçerli talep kaydedilir; başarı mesajındaki kimlik aynı veritabanı satırına karşılık gelir.
- Geçersiz alan sunucuda da reddedilir; kayıt ve başarı mesajı oluşmaz. Ad soyad alanına yalnız ad girilirse istemcide hata, doğrudan API'de 422 görülür; veritabanı da tek parçalı adı reddeder.
- Gönderim sırasında tekrar tıklama ikinci istek başlatmaz.
- Depolama, ağ, bozuk yanıt ve zaman aşımı durumlarında başarı iddiası yapılmaz.
- Yanıt kaybından sonra aynı talep aynı kimlikle doğrulanır; farklı içerik aynı kimliği kullanamaz.
- Form verileri giriş yapılmadan yönetim API'sinden okunamaz; panel yalnız okuma sunar.
- Mobil ve masaüstünde içerik ve form kullanılabilir; etiketler, hata mesajları ve klavye odağı anlaşılırdır.
- Kurulum, test komutları, kaynak, yayın ve teslim commit'i birbiriyle eşleşir.

## Açık sınırlar

Demo yönetim hesabının bilgileri herkese açıktır; kişisel veri gizliliği sağlayan üretim hesabı gibi değerlendirilmez. Anonim talep RPC'si doğrudan çağrılabilir; form için hız sınırı ve bot koruması yoktur. Yönetim girişindeki deneme sınırı farklı bir amaç taşır.

Taklit depo/HTTP/SDK testleri gerçek PostgreSQL entegrasyonu değildir. Otomatik erişilebilirlik taraması tüm kullanım koşullarını kanıtlamaz. Kaynakta bulunmayan başvuru senaryosu ve geçmiş projedeki kişisel katkının kapsamı için gerekirse ek kanıt değerlendirilir; eksik erişimi gerçekleşmiş başarısızlık gibi sunmayız.