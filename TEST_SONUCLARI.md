# VANTA test sonuçları

Kontrol tarihi: **8 Ekim 2026**.

- Node: **76 testin 76'sı geçti; başarısız test yok.**
- Son ad-soyad değişikliğinin 22 tarayıcı senaryosu: **yerel 22/22 ve canlı 22/22 geçti**.
- Bu değişikliğin canlı kontrol zamanı: **8 Ekim 2026, 05:11 (Europe/Istanbul)**.

Önceki yönetim sürümünde 75/75 Node, 21/21 yerel ve 21/21 canlı tarayıcı testi geçti. O canlı koşu 8 Ekim 2026 03:29–03:30, son SQL kontrolü 03:32 (Europe/Istanbul) tarihindedir. Bu tarihsel sonuç, yeni ad-soyad kuralının tarayıcı/canlı sonucu olarak kullanılmaz.

Aşağıdaki her numaralı Node maddesi kaynakta ayrı bir testtir. Bir test içinde denenen birden fazla yanıt veya alan örneğini ek test gibi saymadım. Tarayıcıda dört ekran genişliği ayrı çalıştığı için dört ayrı senaryodur.

## Testlerin kullandığı ortam

Form/API testleri geçici SQLite test deposu veya taklit depo kullanır. Supabase kayıt ve yönetim deposu testlerinde HTTP bağlantısı taklit edilir. SSR testleri taklit SDK ile cookie/cache aktarımını kontrol eder. Yönetim kimlik testleri gerçek scrypt ve imza kodunu çalıştırır; veritabanı işlemleri test deposuyla karşılanır. Bu 76 test, gerçek PostgreSQL erişiminin veya veritabanındaki giriş sınırının bağımsız kanıtı değildir.

Tarayıcıda normal gönderim, bağlantı döndükten sonraki gönderim ve kayıp yanıt senaryoları yapılandırılan gerçek Supabase'e gider. Yönetim girişleri de gerçek sunucu akışını kullanır; kayıt okuma senaryosu gerçek satırı UUID ile geri okur. Hata yanıtları ve mobil panel verisi bazı senaryolarda özellikle taklit edilir. Bunları gerçek depolama başarısı olarak sunmuyorum.

## Form ve API — 32 test

Kaynak: `tests/request.test.mjs`. Aşağıdaki testlerin tamamı geçti.

1. **Normalizasyon ve hizmetler:** Alan kenarlarındaki boşluklar temizlenir, e-posta küçültülür; tanımlı dört hizmet kabul edilir.
2. **Boş isim:** Yalnız boşluk içeren isim 422 alır; depo açılmaz.
3. **Uzun isim:** 101 karakter isim 422 alır; kayıt oluşmaz.
4. **Hatalı e-posta:** Eksik adres biçimi 422 alır.
5. **Uzun e-posta:** E-posta sınırını aşan adres reddedilir.
6. **NUL e-posta:** Kontrol karakteri içeren adres 422 alır.
7. **Bilinmeyen hizmet:** Hizmet listesi dışındaki değer reddedilir.
8. **Kısa açıklama:** Alt sınırı karşılamayan açıklama 422 alır.
9. **Uzun açıklama:** 2001 karakter açıklama reddedilir.
10. **İsimde kontrol karakteri:** NUL içeren isim reddedilir.
11. **Yanlış alan türü:** Sayı olarak gelen açıklama reddedilir.
12. **Geçersiz UUID:** Hatalı gönderim kimliği 422 alır.
13. **Tek emoji isim:** Bir kod noktası olan isim alt sınırı karşılamaz.
14. **On emoji açıklama:** On kod noktası olan açıklama alt sınırı karşılamaz.
15. **Geçerli sınırlar:** Aralarında boşluk bulunan iki emoji adı (`😀 😀`), 20 emoji açıklama, 100 karakterlik iki parçalı ad ve 2000 karakter açıklama depoya ulaşır.
16. **Eksik/nesne olmayan gövde:** null, dizi, metin veya eksik alanlı nesne 422 alır.
17. **Kaydedilen alanlar:** Yeni 201 yanıtının kimliği, dört alanı ve zamanı test deposundaki satırla eşleşir.
18. **Kayıt tamamlanmasını bekleme:** Depo sonucu çözülmeden başarı yanıtı dönmez.
19. **Doğrulanmamış depo sonucu:** Eksik, yanlış kimlikli veya yanlış türde yanıt 503 alır; başarı oluşmaz.
20. **Eşzamanlı tekrar:** Aynı kimlikle üç gönderim bir satır bırakır; bir 201 ve iki 200 döner.
21. **Değişen içerik:** Aynı UUID farklı içerikle kullanılırsa 409 alır; ilk kayıt korunur.
22. **SQL/HTML görünümlü metin:** Açıklama aynen veri olarak saklanır; komut gibi çalıştırılmaz.
23. **Depolama hatası:** 503 döner; başarılı kayıt kimliği veya iç hata ayrıntısı sızmaz.
24. **Bozuk JSON:** 400 döner; kayıt oluşmaz.
25. **Yanlış içerik türü:** JSON dışındaki içerik türü 415 alır.
26. **Yabancı origin:** Başka origin veya cross-site isteği 403 alır.
27. **Gerçek gövde boyutu:** 16 KiB sınırı Content-Length olmadan da byte sayısıyla uygulanır.
28. **GET ile okuma:** Talep endpoint'i 405 döndürür; kişisel veriyi listelemez.
29. **Başarı koşulu:** Hatalı HTTP sonucu, eksik kimlik veya farklı kimlik başarı sayılmaz.
30. **Test dosyasında kalıcılık:** SQLite dosyası kapatılıp açıldığında satır korunur; bu yerel test deposu kontrolüdür.
31. **Proxy origin:** Dış Host/forwarded HTTPS kabul edilir; yabancı origin reddedilmeye devam eder.
32. **Ad ve soyad birlikte:** `Deniz`, sonunda yalnız boşluk/NBSP bulunan ad ve diğer tek parçalı örnekler ortak validator ve sunucuda reddedilir; API 422 verir, depo açılmaz ve kimlik dönmez. `Deniz Örnek`, birden çok boşluk, çok parçalı ad ve NBSP ile ayrılmış ad-soyad kabul edilir.

## Supabase kayıt bağlantısı — 10 test

Kaynak: `tests/supabase-store.test.mjs`. HTTP bağlantısı taklittir; tamamı geçti.

1. **RPC isteği:** Beş argümanla tek HTTPS POST gider; anahtar, içerik türü, no-store ve zaman aşımı sinyali doğru taşınır.
2. **Tekrar sonucu:** replayed sonucu yeni kayıt gibi değiştirilmez.
3. **Kimlik çakışması:** HTTP 409 tanımlı çakışma hatasına çevrilir.
4. **HTTP hatası:** 400/401/403/503 veritabanı ayrıntısını dışarı taşımaz.
5. **Yanlış/eksik kimlik:** Kaydı doğrulamayan JSON başarıya dönüşmez.
6. **Bozuk yanıt:** Boş, bozuk JSON veya HTML biçimli 200 kayıt doğrulaması sayılmaz.
7. **Gövdesiz yanıt:** 204, kaydın başarılı olduğu varsayımına dönüşmez.
8. **Ağ hatası:** İstek reddi başarılı depo sonucu üretmez.
9. **İptal/zaman aşımı:** Kesilen çağrı başarıya dönüşmez.
10. **Yanlış yapılandırma:** Geçersiz Supabase adresi veya boş anahtar ağ çağrısından önce reddedilir.

## SSR yardımcıları — 6 test

Kaynak: `tests/supabase-session.test.mjs`. SDK taklittir; tamamı geçti.

1. **İstemci ve getClaims:** Public yapılandırma kullanılır; getClaims çağrılır.
2. **Yenilemeyi bekleme:** Cookie yenilemesi tamamlanmadan yanıt dönmez.
3. **Cookie aktarımı:** Bütün parçalar, seçenekler ve request/response aktarımı korunur.
4. **Cache başlıkları:** SDK başlıkları cookie taşıyan aynı yanıtta kalır.
5. **Anonim ziyaretçi:** Oturumsuz ziyaretçi ana sayfaya giriş yönlendirmesi olmadan devam eder.
6. **İstek izolasyonu:** Eşzamanlı istekler ayrı istemci ve cookie kullanır.

Bu grup gerçek bir Supabase Auth kullanıcısının giriş veya oturum yenileme testi değildir.

## Yönetim kimlik ve HTTP akışı — 18 test

Kaynak: `tests/admin-auth.test.mjs`. Depo taklittir; tamamı geçti.

1. **Scrypt kontrolü:** Doğru kullanıcı/parola kabul edilir; yanlış kullanıcı veya parola reddedilir.
2. **Oturum süresi:** İmzalı oturum bir saat sonra geçersizdir; oluşturulmadan önce kullanılamaz.
3. **İmza bütünlüğü:** Değiştirilmiş, ek parçalı veya başka anahtarla imzalanmış oturum reddedilir.
4. **Çerez özellikleri:** HttpOnly, SameSite=Strict, Path=/, Secure ve bir saatlik ömür bulunur.
5. **Giriş origin'i:** Yabancı veya eksik Origin depoya erişmeden 403 alır.
6. **Yanlış giriş:** Bir deneme tüketilir; 401 döner ve oturum çerezi oluşmaz.
7. **Doğru giriş:** 200 ve doğrulanabilir çerez döner; JSON'da parola/token bulunmaz; yanıt no-store'dur.
8. **Deneme sınırı:** Depo ret verirse 429 ve Retry-After döner; oturum açılmaz.
9. **Deneme deposu hatası:** 503 döner; erişim kapalı kalır ve iç ayrıntı sızmaz.
10. **Giriş gövde sınırı:** Yanlış Content-Length değerine rağmen gerçek boyut 413 ile sınırlandırılır.
11. **Giriş biçimi:** Bozuk JSON 400, yanlış alan türü 422 alır; depo çağrılmaz.
12. **Anonim kayıt okuma:** Oturumsuz API isteği 401 alır; veritabanına ulaşmaz.
13. **Yetkili okuma:** Sayfa/filtre depoya doğru taşınır; yanıt private, no-store'dur.
14. **Değiştirilmiş çerez:** 401 alır; kayıt deposu çağrılmaz.
15. **Süresi dolmuş çerez:** 401 alır; kayıt deposu çağrılmaz.
16. **Yanlış sayfa/filtre:** Geçersiz sayfalama veya uzun filtre 422 alır; sorgu başlatılmaz.
17. **Listeleme hatası:** 503 döner; başarılı boş liste gibi gösterilmez ve SQL ayrıntısı sızmaz.
18. **Çıkış:** Çerez Max-Age=0 ile temizlenir; yabancı origin çıkış isteği reddedilir.

## Yönetim Supabase deposu — 10 test

Kaynak: `tests/admin-store.test.mjs`. HTTP bağlantısı taklittir; tamamı geçti.

1. **Listeleme RPC'si:** Public anahtar ve sunucu token'ı sınırlandırılmış POST gövdesinde taşınır; token URL'ye, cookie'ye veya Authorization başlığına eklenmez.
2. **Sayfalama tutarlılığı:** Tam, son ve boş sayfalar kabul edilir; toplam/sayfa boyutu uyuşmazlıkları reddedilir.
3. **Satır doğrulaması:** UUID, normalize alanlar, hizmet ve gerçek tarih zorunludur; beklenmeyen alanlar reddedilir.
4. **Listeleme girdisi:** Yanlış sayfa, uzun/kontrol karakterli veya yanlış türde filtre ağ çağrısından önce reddedilir.
5. **HTTP hatasında gizlilik:** Hata yanıtı veritabanı ayrıntısını ve okuma token'ını sızdırmaz.
6. **Bozuk liste yanıtı:** Boş, bozuk veya nesne olmayan başarılı yanıt kayıt listesine dönüşmez.
7. **Bağlantı hatası:** Ağ/zaman aşımı hatası iki RPC için de genel hata olarak kalır.
8. **Deneme sonucu aktarımı:** İzin/ret ve retryAfter değerleri doğru RPC isteğiyle korunur.
9. **Geçersiz deneme sonucu:** Bozuk sonuç veya yanlış anahtar biçimi giriş izni oluşturmaz.
10. **Depo yapılandırması:** Geçersiz adres, anahtar veya token ağ çağrısı yapmadan reddedilir.

## Sayfa ve form tarayıcı testleri — 16 senaryo

Kaynak: `e2e/site.spec.ts`. Güncel tam koşu sonucu üstteki tarayıcı kaydında belirtilir.

1. **320 px:** Başlık, CTA ve form görünür; sayfa yatay taşmaz.
2. **390 px:** Mobil yerleşim ve form görünür; yatay taşma olmaz.
3. **768 px:** Orta ekran yerleşimi ve form kullanılabilir.
4. **1440 px:** Masaüstü yerleşimi ve form kullanılabilir.
5. **İstemci doğrulaması:** Boş form POST başlatmaz; ilk hatalı alan odaklanır.
6. **Gönderiliyor ve gerçek başarı:** Form kilitlenir; tekrar tıklama ikinci istek üretmez; gerçek 201 ve eşleşen UUID sonrasında başarı görünür.
7. **Taklit 503:** Alanlar korunur; başarı mesajı gösterilmez.
8. **Offline ve tekrar:** Bağlantı hatasında alanlar korunur; çevrimiçi tekrar aynı UUID'yi kullanarak gerçek gönderim yapar.
9. **Taklit HTML hatası:** Anlaşılır belirsizlik mesajı görünür; parser ayrıntısı veya başarı gösterilmez.
10. **Taklit yanlış kimlik:** HTTP 200 olsa da farklı kayıt kimliği başarı oluşturmaz.
11. **Sunucu doğrulaması:** Tarayıcı kontrolü atlanarak gönderilen geçersiz veri 422, GET ise 405 alır.
12. **Klavye ve axe:** Skip-link/etiketler kullanılır; otomatik WCAG A/AA taramasında ihlal beklenmez.
13. **%200 metin:** Büyütülmüş masaüstü içerik yatay taşmaz; form görünür kalır.
14. **Gerçek kayıttan sonra yanıt kaybı:** İlk kayıt yapılır fakat yanıt kesilir; tekrar aynı UUID için 200/replayed alır. Tek satır kaldığı ayrıca veritabanından kontrol edilir.
15. **15 saniye zaman aşımı:** Sonuç belirsizliği doğru anlatılır; alanlar korunur ve gönderim düğmesi yeniden kullanılabilir.
16. **Tek parçalı ad:** Diğer alanlar geçerliyken `Deniz` girilirse “Adınızı ve soyadınızı birlikte girin.” görünür, ad alanı odaklanır ve form POST başlatmaz. Aynı veri doğrudan API'ye gönderilirse 422 ve yalnız ad alanı hatası döner; başarı/kimlik oluşmaz. Bu yeni senaryonun koşu sonucu üstteki güncel kayda işlenir.

## Yönetim tarayıcı testleri — 6 senaryo

Kaynak: `e2e/admin.spec.ts`. Güncel tam koşu sonucu üstteki tarayıcı kaydında belirtilir.

1. **Anonim erişim:** Kayıt API'si 401 verir; doğrudan /admin giriş ekranını açar. Ana sayfada admin bağlantısı yoktur; giriş sayfası noindex'tir.
2. **Giriş, yenileme ve çıkış:** Yanlış parola 401 alır; doğru giriş HttpOnly/Strict çerez oluşturur. Yenilemede oturum sürer; çıkıştan sonra kayıt okuma yeniden 401 alır.
3. **Gerçek kaydı geri okuma:** Kurgusal form kaydı 201 alır. Yönetim panelinde aynı UUID'nin dört alanı ve UTC zamanı eşleşir; yenilemeden sonra korunur. Yalnız bu satırın ekranı kaydedilir ve axe taraması yapılır.
4. **Taklit listeleme 503:** Hata mesajı odaklanır; başarısız okuma “0 kayıt” veya başarılı boş liste gibi gösterilmez.
5. **390 px yönetim:** Giriş ekranı ve panel sayfayı yatay taşırmaz. Taklit uzun satırda kaydırma yalnız odaklanabilir tablo bölgesi içinde kalır.
6. **Giriş erişilebilirliği:** Etiketler, autocomplete ve parola türü doğrudur; Tab sırası kullanıcı → parola → düğmedir; axe WCAG A/AA taraması uygulanır.

## Tarayıcı koşusunda yapılan düzeltme

Yönetim testlerinin eklendiği ilk tam turda **18/21** geçti. İki testte alert seçicisi Next.js'in route announcer'ıyla da eşleşiyordu; bir testte region seçicisi iki bölgeyi buluyordu. Seçiciler gerçek hata paragrafı `p[role="alert"]` ve kaydırılabilir `div` ile sınırlandırıldı. Kullanıcı mesajı veya erişilebilirlik duyurusu kaldırılmadı.

Seçiciler düzeltildikten sonra tam yerel koşu yeniden çalıştırıldı ve **21/21 geçti**. Form ekran görüntülerinin tamamını göstermek için yapılan yakalama değişikliği, iki ilgili senaryoyla ayrıca doğrulandı. Canlı tam koşu da 21/21 geçti. Ayrı HTTP ve PostgreSQL kontrolleri [CANLI_DOGRULAMA.md](CANLI_DOGRULAMA.md) içinde açıklanır.

## Sonuçların sınırı

Otomatik erişilebilirlik taraması bütün erişilebilirliği tek başına kanıtlamaz. Kalıcılık için API başarısına ek olarak UUID, dört alan ve zamanın yönetim panelinde/veritabanında eşleşmesi gerekir. Yeni testler kurgusal veriyle yapılır; mevcut kullanıcı kaydı değiştirilmez veya silinmez. Geçmiş kayıt kimlikleri bugün mevcut satır gibi gösterilmez.

Çalıştırma komutları ve manuel canlı inceleme adımları `TEST_REHBERI.txt` içindedir. Bu belge test sayısı ve kapsamını insan tarafından okunabilir biçimde özetler; puan garantisi vermez.