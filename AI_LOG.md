# AI ile üretim ve doğrulama kaydı

Bu belge gerçek oturum kararlarını teknik amaçlarıyla özetler. Aşağıdaki yönlendirmeler birebir prompt alıntısı değildir. Kullanıcının kısa ifadeleri sonradan teknik kapsam olarak açıklanmıştır; kullanıcı o teknik cümleleri söylemiş gibi sunulmaz. AI desteği, kişisel katkı veya test sonuçları saklanmaz.

## Kapsam ve sorumluluk

Kullanıcı VANTA için sıfırdan hizmet landing page'i, kalıcı talep formu, değerlendirme gereksinimlerine uygun teslim belgeleri ve bir TXT test yönergesi istedi. Ek ürün özellikleri kapsam dışı tutuldu. İnsan tarafındaki doğrulanabilir katkı: hizmet brief'i, değerlendirme ölçütleri, kapsam ve profesyonel/teknik belge beklentisi. Bu oturumdaki tasarım, uygulama ve test kodu Codex tarafından kullanıcı yönlendirmesiyle üretildi. Kullanıcı adına elle kod yazma veya önceki projelerde katkı beyanı oluşturulmadı.

Araçlar: Codex, PowerShell/Node.js, OpenAI Sites starter ve hosting, ImageGen, TypeScript, Node test runner + SQLite, Playwright Chromium, axe-core, Drizzle ve Wrangler D1. Git, kesin source state ve teslim commit'i için kullanılır. Uygulama runtime'ında OpenAI/LLM çağrısı yoktur; model temperature ayarı bu oturumdan değiştirilemedi ve 0 kullanıldığı iddia edilmez.

## İş paylaşımı

- Ana agent: Site yaşam döngüsü, kapsam kararları, sayfa/API/şema, test kodu, entegrasyon, belgeler ve yayın.
- `rubric_review`: önce değerlendirme maddelerine göre gereksinim/kanıt matrisi, sonra mevcut form/server kodunun bağımsız salt okunur incelemesi. Dosya düzenlemedi, yayın yapmadı.
- `hero_asset`: tek soyut siber istihbarat görseli üretti; Site dosyalarına dokunmadı. Sadece asset teslim etti.

## 1. Ürün anlatımı ve görsel karar

Amaç: güvenlik liderleri, SOC ve BT ekiplerinin VANTA'nın hangi sorunu çözdüğünü ilk ekranda anlaması ve hizmet talebine ulaşması.

Üretim: Türkçe içerik; İngilizce marka sloganı korunarak problem → yaklaşım → dört hizmet → başlangıç süreci → talep formu sıralaması. Koyu zemin, turuncu vurgu, açık metin, teknik ama sade başlıklar. Tek görsel, metni ve formu gölgelemeyen sağ hero sütununda kullanıldı.

Karar: ölçülmemiş başarı yüzdeleri, müşteri logoları, canlı tehdit sayaçları veya çalışmayan dashboard gösterilmedi. Brief'teki dört hizmet ve ziyaretçi talebi ana akış olarak korundu. Hazır starter altyapı olarak kabul edildi; başlangıç placeholder sayfası teslim içeriğiyle değiştirildi.

Doğrulama: 320–1440 px responsive ölçümler, masaüstü/mobil screenshot incelemesi, CTA anchor'ları, görünür form ve başlık kontrolleri. Hero 1254×1254 PNG'den 1000×1000 WebP'ye çevrildi (yaklaşık 97 KB). Üretilen görsel gerçek güvenlik verisi olarak sunulmaz.

## 2. Sunucunun doğruluk sınırı

Amaç: ziyaretçi talebinin sadece arayüzde başarı gösteren bir demo olmaması.

Karar: Cloudflare D1 kalıcı kayıt kaynağı olarak seçildi. Browser storage veya process belleği ürün kaydı için kullanılmadı. Drizzle yalnız versionlanan şema/migration üretir; runtime sorguları D1 prepared statement ve bound parametrelerle çalışır. Aynı alan kuralları istemci ve sunucuda kullanılır; sunucu kontrolü zorunludur.

Gerekçe: istemci doğrulaması HTTP isteğiyle atlanabilir. Kayıt türleri, hizmet allowlist'i, alan uzunlukları, JSON biçimi, 16 KiB gövde limiti ve origin denetimi sunucuda uygulanır. Veritabanı CHECK/NOT NULL kısıtları ek bir tutarlılık katmanıdır.

Doğrulama: geçersiz alanların veritabanına erişmeden reddi, bozuk JSON, fazla gövde, farklı origin ve GET reddi otomatik sınandı. SQL/HTML benzeri test metni literal veri olarak saklandı. Sunucu hatalarında iç ayrıntı sızıntısı kontrol edildi.

## 3. Başarı koşulu ve tekrar gönderim

Amaç: mesajın gerçekten bilinen sonucu ifade etmesi.

Karar: INSERT await edilmeden başarı dönülmez. UI yalnız 200/201 ve beklenen kayıt UUID'siyle eşleşen geçerli JSON yanıtında başarı gösterir. Ağ kesilmesi ve 15 saniye zaman aşımında sonucu kesin olarak bilemediğimiz için “Gönderim doğrulanamadı” kullanılır; girdiler korunur.

Gerekçe: sunucu kayıt yapmış fakat yanıt kaybolmuş olabilir. Aynı değişmemiş gönderim için UUID korunur. Birincil anahtar + ON CONFLICT ile aynı kimlik/aynı veri bir satır kalır; farklı veri 409 üretir. E-posta üzerinden global uniqueness uygulanmadı; aynı kişi farklı ihtiyacı için tekrar talep gönderebilir.

Doğrulama: commit bekleme; paralel aynı kimlik; farklı veriyle kimlik çakışması; 503 ve yanlış yanıt ID'sinde başarı olmaması; gerçek kayıt sonrası response kaybı ve 200 replay; offline ve timeout senaryoları. Yerel D1'de response kaybı testinin tek satır bıraktığı bağımsız okunarak doğrulandı.

## 4. İncelemede bulunan ve düzeltilen durumlar

Bağımsız inceleme iki gerçek kenar durum buldu:

1. JavaScript string.length UTF-16 birimi sayarken SQLite length() Unicode kod noktası sayıyordu. Bir emoji isim veya on emoji açıklama validator'u geçip DB CHECK'te hata verebiliyordu. Alan uzunluğu hesabı Array.from(...).length ile veritabanıyla eşleştirildi. Geçersiz kısa ve geçerli sınır Unicode verisi için regresyon testleri eklendi.
2. Boş/HTML/bozuk sunucu yanıtında JSON parse hata metni kullanıcıya taşınabiliyordu. Parse hatası okunabilir belirsiz gönderim mesajına çevrildi. HTML 502 yanıtında başarı olmaması ve teknik parser metni görünmemesi tarayıcıda sınandı.

Mobil header taşması olasılığı 320 px testiyle ele alındı; dar ekranda marka alt satırı gizlenir, header gerekirse sarılır. Fontlar rem kullanır; 200% masaüstü metin büyütme kontrolü geçti. Görünür odak, label/hata eşleşmesi, skip-link, canlı durum mesajı ve reduced-motion uygulandı. React kalite kontrolünde state yalnız formda tutuldu; statik sayfa server component olarak kaldı.

## 5. Ortam sorunları ve çözüm

Başlangıçta korumalı terminal ve alternatif Node REPL `setup refresh had errors` nedeniyle çalışmadı. Proje kapsamıyla sınırlı yükseltilmiş PowerShell yürütmesiyle devam edildi. Çalışma klasörünün boş olduğu görüldü; kullanıcı da sıfırdan başlatılacağını netleştirdi.

Windows npm shim çözümlemesi Sites helper çağrılarında yanlış konumdan npm-cli arıyordu. Kurulum global npm JavaScript girişinden yapıldı; helper build için ignored, yalnız bu checkout'a ait npm shim kullanıldı. Framework veya plugin kaynakları bu sorunu gizlemek amacıyla değiştirilmedi. Tek büyük PowerShell komutu Windows command-length sınırına takıldığında yazımlar küçük partilere ayrıldı. Bunlar uygulama hatası diye raporlanmaz.

## 6. Doğrulanmış yerel sonuçlar

- Node/gerçek SQLite: 28 test, 28 başarılı, 0 başarısız. `evidence/unit-tests.tap`.
- Chromium: ilk 13 ve iki ek kenar senaryosu, toplam 15 başarılı. Ayrı JSON raporları `evidence/browser-results.json` ve `browser-edge-results.json`.
- TypeScript: hatasız. Production Worker build: başarılı.
- 320, 390, 768, 1440 px: yatay taşma yok; 200% masaüstü metin büyütme geçti.
- Axe WCAG A/AA taraması: 0 otomatik ihlal. Bu sonuç kapsamlı manuel erişilebilirlik sertifikasyonu olarak sunulmaz.
- Gerçek tarayıcı POST kimliği `087f3e01-336c-429e-a0dc-78e992879895` yerel D1 satırıyla ve dört ziyaretçi alanıyla eşleşti.
- Kayıt sonrası yanıt kaybı test kimliği `c4a65dd0-b9bc-4469-96b0-2174d12f6666`; tekrar isteği 200/replayed verdi ve tek D1 satırı doğrulandı.
- Test verisi tüm senaryolarda kurgusaldır. Hata simülasyonu kullanılan tarayıcı senaryoları gerçek depolama testlerinden ayrı adlandırıldı.

Canlı ortama ilişkin sonuçlar yerel testten türetilmedi; aşağıdaki ayrı production HTTP ve D1 kontrolü gerçekleştirildi.

Başlangıç: 7 Ekim 2026 23:26:15 (Europe/Istanbul). Gerçek tamamlanma ve süre dış teslim kaydında belirtilir. Hedef 3–4 saat emek harcanmış gibi gösterilmez; geçmiş proje ve bireysel katkı için kullanıcı sonradan BiLSTM repo bağlantısı ve model/kod yazarlığı beyanı sağladı.
## 7. Geçmiş proje kanıtı ve yayın erişimi

Kullanıcı canlı sitenin herkese açık olmasını açıkça onayladı. Varsayılan özel erişim bu onaydan sonra public olarak değiştirildi; kayıtları ziyaretçilere açan bir endpoint eklenmedi.

Kullanıcı https://github.com/H00wb/Music-Generation-Using-BiLSTM bağlantısını ve “modeli oluşturup kendim yazmıştım” kişisel katkı beyanını paylaştı. Research agent GitHub REST API ile README, notebook hücreleri, dosya ağacı ve commit geçmişini salt okunur inceledi. BiLSTM/MIDI iş akışı kaynakta görüldü; model notebook'u/ağırlıklarını ekleyen commit `52a7700afe4ced82f8c3631609a1633e10340ef0` ve H00wb hesabının görünen commitleri referanslandı. Kullanıcı beyanı, repo artefact'leri ve bu oturumda yeniden çalıştırılmamış geçmiş sonuçlar birbirinden ayrıldı. Geçmiş repo değiştirilmedi.

Yayın paketi için Windows'un WSL Bash'i Windows yollarını doğru çözümlemedi. Kurulu Git Bash seçildi; GNU tar'ın sürücü harfini uzak host sanması `TAR_OPTIONS=--force-local` ile giderildi. Bu ayarlar yalnız yayın sürecinin ortamında kullanıldı, uygulama davranışını değiştirmedi.
## 8. Canlı doğrulama

İlk sürüm Sites üzerinde başarıyla yayımlandı. Gerçek yayın URL'si kayıt sırasında öngörülen domain'den farklı döndüğü için dönen başarılı deployment URL'si esas alındı; README bu adresle güncellendi.

İlk canlı smoke kontrolü, WebP yanıtı application/octet-stream etiketli olduğu için katı MIME varsayımında durdu. Asset 200 ve 97.416 byte olarak sunuluyordu. Kontrol, kaynak WebP dosyasının byte içeriğiyle birebir eşleşme şartına çevrildi; bu, yanlış MIME etiketi yüzünden gerçek dosyayı yok saymak yerine içeriği doğrular. İlk duruş kayıt oluşturmadan gerçekleşti. Platform MIME sınırlaması README'de belirtildi.

Gerçek canlı kontrol 2026-10-07T20:58:20Z'de tamamlandı: anonim sayfa 200, kaynakla eşleşen hero 200, POST 201, aynı UUID ve veri için 200/replayed, geçersiz e-posta için 422. Test verisi Ece Test / ece-test@example.com / risk-mapping ve kurgusal açıklamadır.

Bağımsız Sites `read_database_overview` ve `read_database_table_rows` ile DB/service_requests satırı okundu. UUID `2da4c6b3-0b58-4524-bdd1-fb0fba2bb1f8`, isim/e-posta/hizmet/açıklama ve created_at gönderimle eşleşti. Bu kontrol sunucu yanıtına körlemesine güvenmekten ayrı bir kalıcılık kanıtıdır. `evidence/production-verification.json` hem HTTP durumlarını hem doğrulanmış satırı saklar.

Son güvenlik kontrolünde formun native method'u açıkça POST yapıldı; JavaScript devre dışıysa alanlar GET query string'ine taşınmaz. Zengin alan doğrulaması ve arayüz durumları JavaScript gerektirir; uygulama no-JS talebini JSON endpoint'i üzerinden başarılıymış gibi sunmaz.

Son kaynak arşivi Git'in izlenen dosyalarından üretilecek; kesin teslim commit'i, son yayın sonucu, son canlı satırın korunması ve gerçek toplam oturum süresi `TESLIM.txt` içinde verilecektir. Hedef emek süresi veya garanti değerlendirme puanı uydurulmadı.