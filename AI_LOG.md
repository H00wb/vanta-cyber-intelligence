# AI ile üretim ve doğrulama kaydım

Bu belgede VANTA case study'sindeki kararlarımı, AI ile iş paylaşımımı ve doğrulama kanıtlarını kaydediyorum. Kısa yönlendirmelerimi teknik amaçlarıyla özetliyorum; bunlar birebir prompt alıntısı değildir. AI desteğini, kendi katkımı ve gerçekten alınan test sonuçlarını açıkça ayırıyorum.

D1/Sites ile hazırlanan ilk sürümün sonuçlarını aşağıda tarihsel kayıt olarak koruyorum. Sonraki Supabase, Vercel ve GitHub geçişinin uygulama ve doğrulama durumunu ayrı bölümde izliyorum. İlk sürümün başarılı testlerini yeni altyapının doğrulanmış sonucu olarak kullanmıyorum.

## AI ile iş paylaşımım

- Ana Codex agent'i: ilk sürümün Site yaşam döngüsü, kapsamın teknik karşılığı, sayfa/API/şema, test kodu, entegrasyon, belgeler ve yayın. Yeni altyapı geçişini de ana agent yürüttü.
- `rubric_review`: ilk sürümde gereksinim/kanıt matrisi, form/server kodunun bağımsız salt okunur incelemesi ve geçmiş proje araştırması. İlk sürüm kodunu düzenlemedi veya yayın yapmadı. Yeni geçişte bu AI_LOG belgesinin birinci ağızdan, kanıtları koruyarak düzenlenmesi görevi verildi.
- `hero_asset`: tek soyut siber istihbarat görselini üretti; Site dosyalarını düzenlemeden asset teslim etti.
- `migration_review`: yeni altyapı geçişinde salt okunur inceleme yaptı; e-postadaki kontrol karakteri doğrulama açığını bildirdi. Ardından yeni RequestStore sözleşmesi ve Supabase HTTP transport testlerini yetkilendirdiğim iki dosyada düzenledi; son belge/kanıt incelemesini yaptı. Bulgunun düzeltmesini ve sonuçları 9. bölümde doğruladım.

## 1. Ürün anlatımı ve görsel kararım — ilk sürüm

Güvenlik liderlerinin, SOC ve BT ekiplerinin VANTA'nın hangi sorunu çözdüğünü ilk ekranda anlamasını ve hizmet talebine ulaşmasını hedefledim.

Codex ile Türkçe içerik ürettim; İngilizce marka sloganını korudum. İçerik sırasını problem → yaklaşım → dört hizmet → başlangıç süreci → talep formu olarak kurduk. Koyu zemin, turuncu vurgu, açık metin ve sade teknik başlıklar kullanıldı. Tek görseli, metni ve formu gölgelemeyen sağ hero sütununda değerlendirdik.

Ölçülmemiş başarı yüzdelerini, müşteri logolarını, canlı tehdit sayaçlarını ve çalışmayan dashboard gösterimini kullanmadım. Brief'teki dört hizmeti ve ziyaretçi talebini ana akışta tuttum. Hazır starter'ı altyapı olarak kabul ettim; Codex başlangıç placeholder sayfasını bu case'in içeriğiyle değiştirdi.

İlk sürümde Codex 320–1440 px responsive ölçümleri, masaüstü/mobil screenshot incelemesini, CTA anchor'larını, görünür formu ve başlıkları kontrol etti. Hero 1254×1254 PNG'den 1000×1000 WebP'ye çevrildi (yaklaşık 97 KB). Bu görseli gerçek güvenlik verisi veya telemetri olarak sunmuyorum.

## 2. Sunucunun doğruluk sınırı — ilk site sürümü

Ziyaretçi talebinin yalnız arayüzde başarı gösteren bir demo olmamasını istedim. İlk sürümde AI ile geliştirilen çözümde Cloudflare D1'i kalıcı kayıt kaynağı olarak kullandık. Browser storage veya process belleğini ürün kaydı için kullanmadık. Drizzle versionlanan şema/migration üretirken runtime sorguları D1 prepared statement ve bound parametrelerle çalıştı. Aynı alan kurallarını istemci ve sunucuda uyguladık; sunucu kontrolünü zorunlu tuttuk.

Doğrudan HTTP isteğiyle istemci kontrolleri atlanabildiği için güven sınırını sunucu doğrulamasında kurduk. Kayıt türleri, hizmet allowlist'i, alan uzunlukları, JSON biçimi, 16 KiB gövde limiti ve origin denetimi sunucuda uygulandı. Veritabanındaki CHECK/NOT NULL kısıtlarını ek bir tutarlılık katmanı olarak kullandık.

Codex geçersiz alanların veritabanına erişmeden reddini, bozuk JSON'u, fazla gövdeyi, farklı origin'i ve GET reddini otomatik sınadı. SQL/HTML benzeri test metni literal veri olarak saklandı. Sunucu hatalarında iç ayrıntı sızıntısı kontrol edildi. Bunlar ilk D1/Sites sürümünün kanıtlarıdır; Supabase geçişinin sonucunu ayrıca doğruladım; kanıtları 9. bölümde kaydettim.

## 3. Başarı koşulu ve tekrar gönderim kararım

Sonuç mesajının yalnız gerçekten bilinen durumu ifade etmesini istedim. İlk sürümde INSERT await edilmeden başarı dönülmedi. UI yalnız 200/201 ve beklenen kayıt UUID'siyle eşleşen geçerli JSON yanıtında başarı gösterdi. Ağ kesilmesi ve 15 saniye zaman aşımında kesin sonucu bilemediğimiz için “Gönderim doğrulanamadı” mesajını tercih ettim; girdiler korundu.

Sunucu kaydı tamamlayıp yanıtı ulaştıramayabileceği için değişmemiş gönderimin UUID'sini koruduk. Birincil anahtar + ON CONFLICT ile aynı kimlik/aynı veri için tek satır bırakıldı; farklı veri 409 üretti. E-posta üzerinden global uniqueness uygulamadık; aynı kişi farklı ihtiyacı için tekrar talep gönderebilir.

İlk sürümde Codex commit bekleme, paralel aynı kimlik, farklı veriyle kimlik çakışması, 503 ve yanlış yanıt ID'sinde başarı olmaması, gerçek kayıt sonrası response kaybı ve 200 replay, offline ve timeout senaryolarını çalıştırdı. Yanıt kaybı testinin yerel D1'de tek satır bıraktığı bağımsız okunarak doğrulandı. Yeni altyapıya geçerken aynı kabul şartlarını korudum; yeni depo üzerinde ayrıca çalıştırdığım testleri ve bağımsız SQL kanıtını 9. bölümde kaydettim.

## 4. İlk incelemede bulduğumuz ve düzelttiğimiz durumlar

Bağımsız AI incelemesinden gelen iki somut bulguyu düzeltme kapsamına aldım:

1. JavaScript string.length UTF-16 birimi sayarken SQLite length() Unicode kod noktası sayıyordu. Bir emoji isim veya on emoji açıklama validator'u geçip DB CHECK'te hata verebiliyordu. Codex alan uzunluğu hesabını Array.from(...).length ile veritabanıyla eşleştirdi. Geçersiz kısa ve geçerli sınır Unicode verisi için regresyon testleri ekledi.
2. Boş/HTML/bozuk sunucu yanıtında JSON parse hata metni kullanıcıya taşınabiliyordu. Codex parse hatasını okunabilir belirsiz gönderim mesajına çevirdi. HTML 502 yanıtında başarı olmaması ve teknik parser metni görünmemesi tarayıcıda sınandı.

Mobil header taşması olasılığını 320 px testiyle ele aldık; dar ekranda marka alt satırı gizlendi ve header'ın gerektiğinde sarılması sağlandı. Fontlar rem kullandı; 200% masaüstü metin büyütme kontrolü geçti. Görünür odak, label/hata eşleşmesi, skip-link, canlı durum mesajı ve reduced-motion uygulandı. React kalite kontrolünde state yalnız formda tutuldu; statik sayfa server component olarak kaldı.

Yeni geçiş sırasında tespit edilen e-posta kontrol karakteri açığını bu iki tarihsel düzeltmeye ekleyerek yapılmış gibi göstermiyorum; durumu 9. bölümde ayrı kaydediyorum.

## 5. İlk geliştirme ortamındaki sorunları nasıl ele aldık

Başlangıçta korumalı terminal ve alternatif Node REPL `setup refresh had errors` nedeniyle çalışmadı. Codex proje kapsamıyla sınırlı yükseltilmiş PowerShell yürütmesiyle devam etti. Çalışma klasörünün boş olduğu görüldü; ben de sıfırdan başlanacağını netleştirdim.

Windows npm shim çözümlemesi Sites helper çağrılarında yanlış konumdan npm-cli arıyordu. Codex kurulumu global npm JavaScript girişinden yaptı; helper build için ignored, yalnız bu checkout'a ait npm shim kullandı. Framework veya plugin kaynaklarını bu sorunu gizlemek amacıyla değiştirmedik. Tek büyük PowerShell komutu Windows command-length sınırına takılınca yazımlar küçük partilere ayrıldı. Bu ortam sorunlarını uygulama hatası olarak raporlamıyorum.

## 6. İlk sürümde doğrulanmış yerel sonuçlar

Codex'in çalıştırdığı ilk D1/Sites sürümü kontrollerinin kaydedilmiş sonuçları:

- Node/gerçek SQLite: 28 test, 28 başarılı, 0 başarısız. `evidence/unit-tests.tap`.
- Chromium: ilk 13 ve iki ek kenar senaryosu, toplam 15 başarılı. Ayrı JSON raporları `evidence/browser-results.json` ve `browser-edge-results.json`.
- TypeScript: hatasız. Production Worker build: başarılı.
- 320, 390, 768, 1440 px: yatay taşma yok; 200% masaüstü metin büyütme geçti.
- Axe WCAG A/AA taraması: 0 otomatik ihlal. Bu sonucu kapsamlı manuel erişilebilirlik sertifikasyonu olarak sunmuyorum.
- Gerçek tarayıcı POST kimliği `087f3e01-336c-429e-a0dc-78e992879895`, yerel D1 satırıyla ve dört ziyaretçi alanıyla eşleşti.
- Kayıt sonrası yanıt kaybı test kimliği `c4a65dd0-b9bc-4469-96b0-2174d12f6666`; tekrar isteği 200/replayed verdi ve tek D1 satırı doğrulandı.
- Tüm senaryolarda kurgusal test verisi kullanıldı. Hata simülasyonu kullanılan tarayıcı senaryolarını gerçek depolama testlerinden ayrı adlandırdık.

Canlı ortam sonuçlarını yerel testten türetmedim. İlk sürümün production HTTP ve D1 kontrolü aşağıdaki ayrı kanıtla gerçekleştirildi. Bu 28+15 sonuç yeni Supabase/Vercel sürümünün testleri değildir.

İlk çalışma başlangıcını 7 Ekim 2026 23:26:15 (Europe/Istanbul) olarak kaydettim. Tamamlanma ve süre dış teslim kaydında belirtilir. Hedef 3–4 saat emek harcanmış gibi göstermiyorum. Geçmiş proje ve bireysel katkı için daha sonra BiLSTM repo bağlantımı ve model/kod yazarlığı beyanımı paylaştım.

## 7. İlk D1/Sites sürümünün canlı doğrulaması

İlk sürüm Sites üzerinde başarıyla yayımlandı. Yayın URL'si kayıt sırasında öngörülen domain'den farklı döndüğü için başarılı deployment'ın döndürdüğü URL'yi esas aldık. İlk sürümün canlı adresi https://vanta-cyber-intelligence.emrehanh00wb.chatgpt.site idi; bu adresin doğrulamasını Supabase/Vercel yayınıyla karıştırmıyorum.

İlk canlı smoke kontrolü, WebP yanıtı application/octet-stream etiketli olduğu için katı MIME varsayımında durdu. Asset 200 ve 97.416 byte olarak sunuluyordu. Codex kontrolü kaynak WebP dosyasının byte içeriğiyle birebir eşleşme şartına çevirdi. Bu şekilde yanlış MIME etiketine rağmen dosyanın gerçek içeriği doğrulandı. İlk duruş kayıt oluşturmadan gerçekleşti; platform MIME sınırlaması ilk sürümün README'sinde belirtildi.

İlk sürümün gerçek canlı kontrolü 2026-10-07T20:58:20Z'de tamamlandı: anonim sayfa 200, kaynakla eşleşen hero 200, POST 201, aynı UUID ve veri için 200/replayed, geçersiz e-posta için 422. Test verisi Ece Test / ece-test@example.com / risk-mapping ve kurgusal açıklamaydı.

Codex bağımsız Sites `read_database_overview` ve `read_database_table_rows` araçlarıyla DB/service_requests satırını okudu. UUID `2da4c6b3-0b58-4524-bdd1-fb0fba2bb1f8`, isim/e-posta/hizmet/açıklama ve created_at gönderimle eşleşti. Bu kontrolü sunucu yanıtından ayrı bir kalıcılık kanıtı olarak kaydettim. `evidence/production-verification.json` ilk sürümün HTTP durumlarını ve doğrulanmış D1 satırını saklar.

İlk sürümün son güvenlik kontrolünde formun native method'u açıkça POST yapıldı; JavaScript devre dışıysa alanların GET query string'ine taşınması engellendi. Zengin alan doğrulaması ve arayüz durumları JavaScript gerektirir; no-JS talebini başarılıymış gibi sunmadık.

Kaynak arşivi, kesin teslim commit'i, son yayın sonucu, canlı satırın korunması ve gerçek toplam oturum süresi dış teslim kaydında izlenir. Eski teslim commit'i veya eski D1 kayıt kimliğini yeni Supabase/Vercel tesliminin kimliği olarak kullanmıyorum.

## 8. Supabase, Vercel ve GitHub teslimini tamamlamam

İlk sürümün tasarımını koruyup yayın/kayıt altyapısını standart Next.js, Vercel ve Supabase PostgreSQL'e taşıdım. Bu geçişi Codex ile uyguladım; alt ajanı migration'ın yetki/snapshot davranışını bağımsız incelemek ve depo sözleşmesi/HTTP transport testlerini güncellemek için kullandım. Belge düzenlemesini ayrı alt ajana verdim, canlı doğrulamayı ve son teslim eşleştirmesini ana çalışma akışında tamamladım. Bu iş paylaşımını kişisel elle kodlama iddiası olarak sunmuyorum.

### Tercih ettiğim kayıt sınırı

Geniş yetkili service-role anahtarını uygulamaya vermek yerine düşük yetkili publishable key ve yalnız talep oluşturma işlemini sunan RPC kullandım. Supabase'de ayrı `public.vanta_service_requests` tablosunu, UUID v4 birincil anahtarını, dört alanın CHECK kurallarını ve sunucunun ürettiği timestamptz alanını migration'a koydum. RLS'yi açtım; PUBLIC/anon/authenticated rollerinin doğrudan tablo erişimini kaldırdım. Diğer proje tablolarının yetkilerine dokunmadım.

Anonim formun ihtiyaç duyduğu `vanta_submit_request` işlemini sınırlı `SECURITY DEFINER` fonksiyonla sundum: boş search_path, sabit şema adları, tipli argümanlar, dinamik SQL olmaması ve yalnız id/replayed dönüşü. PUBLIC EXECUTE'i kaldırıp bu signature'a anon/authenticated EXECUTE verdim. Böylece fonksiyonun oluşturma/replay yetkisini tablo listeleme/okuma/yazma yetkisinden ayırdım. Publishable key'in gizli olmadığını ve RPC'nin Vercel atlanarak çağrılabileceğini kabul ettim; aynı alan/hizmet/UUID kurallarını veritabanında da uyguladım. Origin kontrolünü bot önleme veya gizli anahtar gibi sunmadım.

Tek SQL CTE ile INSERT/fallback SELECT birleştirme önerisini kullanmadım. PostgreSQL READ COMMITTED altında çakışan eşzamanlı kayıt statement snapshot'ında görünmeyebilirdi. VOLATILE PL/pgSQL fonksiyon içinde INSERT ve SELECT'i ayrı ifadeler olarak tuttum; değişen içerikte PT409 döndürdüm. Beş gerçek paralel HTTP isteği ve bağımsız SQL count=1 sonucu bu tercihi doğruladı. [PostgreSQL volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html), [Supabase fonksiyon yetkileri](https://supabase.com/docs/guides/database/functions) ve [PostgREST hata eşlemesi](https://docs.postgrest.org/en/stable/references/errors.html) kaynaklarını kullandım. Supabase Advisor'ın anonim SECURITY DEFINER fonksiyon erişimi bildirimi bu dar oluşturma API'si için bilinçli bir tercihtir; genel bir 'tüm güvenlik uyarıları temiz' iddiasında bulunmadım.

### Gerçek bulgular ve yaptığım düzeltmeler

Migration incelemesinde `deniz\u0000@example.com` e-postasının eski validator'dan geçtiğini alt ajan gerçek Node çağrısıyla gösterdi. PostgreSQL text NUL kabul etmediği için hatanın depolamada 503'e dönüşmesini önlemek istedim. Codex ile ortak e-posta validator'ında kontrol karakterlerini reddettim ve regresyon testi ekledim. İsim/açıklama uzunluklarını Unicode kod noktası olarak saymayı PostgreSQL char_length ile uyumlu tuttum.

İlk yeni tarayıcı turunda 8 test geçti, 7 test başarısız oldu. Gerçek gönderimde 127.0.0.1 Origin ile Next.js'in iç localhost URL'si karşılaştırılıyor, aynı siteden istek 403 oluyordu. Public Host/forwarded protocol üzerinden origin kontrolünü düzelttim; başka origin'in reddedildiğini ayrıca test ettim. Origin kontrolünü kaldırmadım.

Diğer başarısızlıklar Next.js'in eklediği `__next-route-announcer__` alert'i ile form alert'inin global test seçicisinde çakışmasındandı. Testi form içindeki alert'e daralttım; erişilebilir duyuruyu veya kullanıcı hata mesajını gizlemedim. Düzeltmeden sonra aynı 15 tarayıcı testi yerel üretim derlemesinde gerçek Supabase ile geçti.

Canlı izin kontrolü betiğimde önce anonim erişim reddi için yalnız 403 bekledim. Gerçek Supabase 401 döndürdü. Reddin 401/403 olarak eşlenebildiğini esas alıp kontrolü iki ret durumunu kabul edecek şekilde düzelttim; başarı/boş liste sonucunu ret gibi saymadım. Yeniden çalıştırdığım betik geçti. Vercel ortam API'sinde CLI'ye top-level array vermek Invalid JSON 400 üretti; API isteklerini belgelenen tek nesne biçimine çevirdim ve iki ortam değişkenini ayrı çağrılarla kaydettim.

### Uyguladığım yayın akışı

Mevcut Git Credential Manager oturumunun H00wb hesabına ait olduğunu doğrulayıp `H00wb/vanta-cyber-intelligence` public reposunu oluşturdum ve main branch'ini yükledim. Erişim anahtarlarını kaynak dosyalarına, komut argümanlarına veya AI_LOG'a eklemedim.

Vercel bağlı araç çağrısı hesap kapsamı için403 döndürdü. Aynı H00wb/Bulyerleş hesabının mevcut Vercel CLI oturumuyla ilerledim; başka hesaba geçmedim. Ayrı VANTA projesini oluşturdum, link edilen proje kimliğini kontrol ettim, Next.js preset'ini ve npm ci/build akışını tanımladım. SUPABASE_URL ve SUPABASE_PUBLISHABLE_KEY değerlerini Production/Preview ortamlarına kaydettim. GitHub reposunu Vercel projesine bağladım ve production deployment'ı tamamladım. Node engine'i gelecekte otomatik büyük sürüm yükseltmesi olmaması için 24.x'e sabitledim.

Canlı adresim: https://vanta-cyber-intelligence.vercel.app
İncelenebilir kaynağım: https://github.com/H00wb/vanta-cyber-intelligence

### Doğruladığım sonuçlar

- 41 Node testi, lint, typecheck ve production build başarılı. SQLite fixture yalnız depo sözleşmesi test çiftidir; mocked fetch testi PostgreSQL/RLS entegrasyonu olarak sunulmaz.
- 15 yerel Chromium senaryosu: derlenmiş Next.js → gerçek uzak Supabase. 15/15 başarılı.
- 15 canlı Chromium senaryosu: public Vercel → gerçek Supabase. 15/15 başarılı. Mobil genişlikler, loading kilidi, doğrulama, gerçek başarı, 503/offline/HTML/yanlış kimlik/timeout, yanıt kaybından sonra replay, klavye, axe ve %200 metin büyütme kontrol edildi.
- Canlı HTTPS: yeni kayıt 201, aynı içerik 200/replayed, değişen içerik 409, geçersiz alan/NUL e-posta 422, GET 405; beş paralel gönderimde bir 201 ve dört 200.
- Anonim doğrudan tablo SELECT/INSERT 401 ile reddedildi. Geçersiz doğrudan RPC 400 döndürdü. RLS açık, anon/authenticated table SELECT/INSERT grants kapalı olarak bağımsız SQL ile okundu.
- Normal, paralel ve yanıt kaybı fixture'larının dört alanını/zamanını bağımsız Supabase SQL ile karşılaştırdım; her kimlik için satır sayısı 1. HTTP ve tarayıcı sonucunu tek başına kalıcılık kanıtı saymadım.

Kanıtlar `evidence/supabase-unit-tests.tap`, `supabase-browser-results.json`, `supabase-local-records.json`, `vercel-browser-results.json`, `supabase-production-verification.json`, `supabase-production-records.json`, `vercel-submit.json`, `vercel-lost-response.json` dosyalarındadır. Yalnız kurgusal test verisi kullandım. Son teslim commit'ini, arşiv eşleşmesini, yeniden deployment sonrasında kaydın korunmasını ve gerçek geçen oturum süresini dış TESLIM.txt kaydında belirtiyorum; commit'in kendisini kendi içeriğine yazmaya çalışmıyorum.

Çalışmayı ölçütler ve somut kanıtlarla teslim ediyorum. Gerçek cihaz/ekran okuyucu manuel testi, geçmiş modelin yeniden eğitimi veya kesin 100 puan iddiası eklemiyorum. İlk D1/Sites sürümünün sonuçlarını tarihsel bırakıyorum; Supabase/Vercel sonuçlarını burada ayrı kaydediyorum.
