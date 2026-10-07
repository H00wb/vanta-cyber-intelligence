# VANTA — Cyber Intelligence Platform

Siber güvenlik ve BT ekiplerinin hizmeti anlamasını ve dört hizmetten biri için talep oluşturmasını sağlayan responsive landing page. Form, sunucu doğrulamasından sonra Cloudflare D1 veritabanına kalıcı kayıt yazar. Gerçek bir tehdit analizi motoru veya güvenlik operasyon sistemi uygulanmamıştır; değerlendirme kapsamı hizmet sitesi ve talep kaydıdır.

Canlı adres: https://vanta-cyber-intelligence.emrehanh00wb.chatgpt.site

Site herkese açık yayımlandı; giriş gerektirmeyen sayfa 200 döndü. Bu adresin yayın ve erişim durumu `evidence/production-verification.json` ve teslimin yanındaki `TESLIM.txt` içinde belirtilir. Teslim commit kimliği `TESLIM.txt` ve `git rev-parse HEAD` ile alınır. SHA'nın kendi commit'inin içinde yazılması döngü oluşturacağından dış teslim kaydında tutulur.

## Kurulum

Node.js 24 LTS ve npm gerekir. Proje kökünden:

```sh
npm ci
npm run build
npm run db:migrate
npm run dev -- --port 5173 --hostname 127.0.0.1
```

Tarayıcı: http://127.0.0.1:5173/ . İlk build, yerel D1 konfigürasyonunu üretir. Migration scripti yalnız bekleyen migration'ları uygular; tekrar çalıştırıldığında uygulanmış dosyaları tekrar oynatmaz. `.wrangler/state` yerel kalıcı veridir. Bu klasörü silmek yerel test kayıtlarını siler; canlı veritabanı bundan bağımsızdır.

Üretim Worker'ını yerelde çalıştırmak için build ve migration sonrasında `npm start` kullanılır. Ekrana yazılan Local URL açılır. Aynı D1 state dizini kullanılır.

Uygulama için API anahtarı, OpenAI hesabı veya `.env` dosyası gerekmez. `.openai/hosting.json` içinde `d1: "DB"` mantıksal binding'i bulunur. Canlı D1 kaynağını ve migration uygulamasını Sites platformu yönetir. Starter'ın yerel placeholder database kimliği üretim kaynağı olarak kullanılmaz.

Bu geliştirme oturumunda Windows npm shim'i yanlış dizinden çalışıyordu. Global npm JavaScript girişiyle kurulum yapıldı; Sites helper için sadece ignored `.sites-runtime/bin` altında yerel bir workaround kullanıldı. Bu makineye özgü dosyalar teslimin parçası değildir. Normal npm kurulumunda yukarıdaki komutlar kullanılabilir.

## Veri akışı ve temel güvenlik

1. Formun dört alanı ortak `validateRequest` kurallarıyla doğrulanır. İsim 2–100, açıklama 20–2000 Unicode kod noktası; e-posta en fazla 254 karakter; hizmet tanımlı dört seçenekten biri olmalıdır.
2. İstemci her mantıksal gönderim için UUID v4 üretir. İçerik değişmeden yeniden denendiğinde aynı kimlik korunur. Gönderim sırasında form kilitlenir.
3. `POST /api/requests`, alanları yeniden doğrular. İstemci doğrulaması güven sınırı değildir. JSON türü, gerçek gövde boyutu (16 KiB) ve tarayıcı origin'i denetlenir.
4. Prepared statement ve bound parametrelerle `service_requests` tablosuna yazılır. Migration'da NOT NULL, birincil anahtar ve alan CHECK kısıtları vardır. Şema runtime'da oluşturulmaz.
5. INSERT tamamlandıktan sonra `201 { id, replayed: false }` döner. Aynı kimlik ve aynı veri için ikinci satır yerine `200 { id, replayed: true }`; kimliği farklı veriyle kullanmak için `409` döner.
6. UI yalnız 200/201, geçerli yanıt biçimi ve beklenen kayıt kimliği eşleştiğinde başarı gösterir. Form bu aşamada temizlenir.
7. Bağlantı kesilmesi/zaman aşımı kesin bir kayıt başarısızlığı anlamına gelmez. UI “Gönderim doğrulanamadı” mesajı verir, girdileri korur ve güvenli tekrar gönderime izin verir.

Alan hatası 422; bozuk JSON 400; fazla gövde 413; yanlış içerik türü 415; farklı origin 403; doğrulanamayan depolama işlemi 503. Kayıtları listeleyen herkese açık bir API yoktur. GET ile talep verisi okunamaz. Açıklama HTML olarak render edilmez. Sunucu loglarında kişisel alanlar, ham SQL veya gizli anahtar yazılmaz; ziyaretçiye stack trace dönmez. Yanıtlar `no-store` olarak işaretlenir.

## Testler ve kanıt

```sh
npm test
npm run typecheck
npx playwright install chromium
# Yukarıdaki yerel sunucu açıkken:
npm run test:e2e
node scripts/verify-local-record.mjs
```

`TEST_BASE_URL` başka bir test sunucusunu seçebilir. Tarayıcı testleri gerçek kayıt oluşturur; varsayılan hedef yerel sunucudur. Veri yalnız kurgusaldır (`Deniz Örnek`, `deniz@example.com`). Testler canlı adres üzerinde kontrolsüz tekrar çalıştırılmamalıdır.

Bu oturumda doğrulananlar:

- 28 Node testinin tamamı geçti. Testler gerçek SQLite migration'ını kullanır; alan kuralları, Unicode sınırları, parametrik kayıt, commit bekleme, idempotency, depolama hatası ve dosya tabanlı kalıcılık kontrol edilir.
- 15 Chromium senaryosu geçti: ilk 13 senaryo ve ayrı iki yanıt kaybı/zaman aşımı senaryosu. JSON raporları `evidence/browser-results.json` ve `evidence/browser-edge-results.json`.
- 320, 390, 768 ve 1440 px genişlikte yatay taşma kontrol edildi. 200% masaüstü metin büyütme ve klavye skip-link kontrol edildi.
- Axe ile WCAG A/AA kapsamında taranan sayfada otomatik ihlal bulunmadı. Bu, tüm erişilebilirlik ölçütlerinin veya ekran okuyucu deneyiminin eksiksiz sertifikasyonu değildir.
- Gerçek tarayıcı POST'undan alınan kimlik ve dört alan yerel D1 satırıyla eşleşti. Kayıt tamamlandıktan sonra yanıtın kaybedildiği ikinci senaryoda tekrar gönderim tek satır bıraktı.
- TypeScript ve üretim build'i başarılı. Masaüstü/mobil ekran görüntüleri görsel olarak incelendi.

`evidence/unit-tests.tap`, `local-submit.json`, `lost-response.json`, `local-d1-records.json`, `desktop.png`, `mobile.png` ve `form-success.png` kontrolün izlenebilir çıktılarıdır. Hata simülasyonları ile gerçek kayıt testleri raporlarda ayrı senaryolardır. Ayrıntılı manuel yönerge: `TEST_REHBERI.txt`.

## Dosya düzeni

- `app/page.tsx`, `app/globals.css`: içerik ve responsive tasarım.
- `components/request-form.tsx`: form durumları, istemci kontrolü, tekrar gönderim kimliği.
- `lib/request-validation.ts`: ortak alan kuralları; `request-handler.ts`: HTTP ve kalıcı kayıt; `request-response.ts`: UI başarı koşulu.
- `app/api/requests/route.ts`, `db/index.ts`: Worker/D1 entegrasyonu.
- `db/schema.ts`, `drizzle/`: versionlanan şema ve migration.
- `tests/`, `e2e/`, `evidence/`: otomatik doğrulama ve sonuçlar.

## AI, şablon ve katkı ayrımı

Başlangıç altyapısı OpenAI Sites eklentisindeki `templates/vinext-starter` kopyasıdır (Sites 0.1.75). Framework [Cloudflare Vinext](https://github.com/cloudflare/vinext), React, TypeScript, Drizzle ve Cloudflare D1 kullanır. Starter'ın build/runtime/auth/connector helper'ları ve hazır UI kitaplığı şablon katkısıdır; bunların özgün olarak yazıldığı iddia edilmez. Mevcut lisans dosyaları korunmuştur.

VANTA metinleri, sayfa düzeni, renk/typography seçimi, dört hizmetin sunumu, talep formu, doğrulama, kayıt/idempotency akışı, şema, testler ve teslim belgeleri bu case için Codex yardımıyla üretilmiştir. Hero görseli tek ImageGen üretimidir; WebP olarak optimize edilmiştir ve gerçek ağ/telemetri çıktısı değildir. İnsan yönlendirmesi, AI görev paylaşımı, bulunan sorunlar ve doğrulama kararları `AI_LOG.md` içinde ayrıştırılır.

Uygulama LLM çağrısı yapmaz. Bu sohbetin ve ImageGen'in model sampling/temperature ayarlarına erişilmedi; “temperature=0 ile üretildi” şeklinde doğrulanmamış bir beyan yoktur.

## Bilinen sınırlar ve değerlendirme

- Bu kurgusal hizmet sitesi gerçek threat intelligence, e-posta gönderimi, CRM, yönetim paneli veya ticari SLA sunmaz. Başarı mesajı yalnız talebin kaydedildiğini ifade eder.
- Ticari trafik için bot/rate-limit koruması, veri saklama/silme politikası ve operasyonel izleme ayrıca tasarlanmalıdır; bu değerlendirme teslimine eklenmemiştir.
- İdempotency kimliği tarayıcı sekmesinin belleğindedir. Sayfa yenilendikten sonra tekrar gönderim yeni bir talep sayılır.
- E-posta biçimi kontrol edilir; adresin teslim alabilirliği doğrulanmaz.
- Chromium otomasyonu ve responsive kontroller çalıştırıldı; gerçek iOS/Safari/Firefox cihazları ve ekran okuyucu ile manuel deneme yapılmadı.
- Vinext 1.0.0-beta.5 starter tarafından kullanılır. Framework bağımlılığı ve beta durumu açıkça belirtilir.
- Geçmiş proje kanıtı aşağıdadır. Repo statik incelendi; model bu case sırasında yeniden eğitilmedi, performans iddiası yeniden doğrulanmadı.
- Nihai puan değerlendirme ekibine aittir. Gereksinim/kanıt matrisi `DEGERLENDIRME.md` içindedir; hiçbir skor garanti edilmez.

Teslim penceresi başlangıcı: 7 Ekim 2026 23:26:15 (Europe/Istanbul). 24 saatlik pencere sonu: 8 Ekim 2026 23:26:15. Gerçek oturum süresi ve tamamlanma saati dış teslim kaydında yazılır; 3–4 saat emek harcanmış gibi gösterilmez.
## Geçmiş proje ve kişisel katkı

[Music Generation Using BiLSTM](https://github.com/H00wb/Music-Generation-Using-BiLSTM), İstanbul Kültür Üniversitesi CSE0471 Applied Deep Learning ders projesidir. Adayın kişisel katkı beyanı: model mimarisini oluşturdu ve kodunu kendisi yazdı.

Repoda MIDI verisinden music21 ile nota/akor çıkarımı, 100 adımlık sekans hazırlama, TensorFlow/Keras ile 64 → 128 → 64 birimli Bidirectional LSTM katmanları, regularization/eğitim callback'leri ve MIDI üretimi notebook üzerinden incelenebilir. Model ağırlıkları, grafikleri, örnek MIDI çıktıları ve rapor da bulunur. [Model ve notebook'u ekleyen commit](https://github.com/H00wb/Music-Generation-Using-BiLSTM/commit/52a7700afe4ced82f8c3631609a1633e10340ef0) ve [commit geçmişi](https://github.com/H00wb/Music-Generation-Using-BiLSTM/commits/main/) H00wb hesabındaki katkıları gösterir.

Bu geçmiş çalışma, VANTA'nın koduna bağımlılık olarak eklenmedi. Bu oturumda notebook çalıştırılmadı veya model yeniden eğitilmedi; hesap commitleri tek başına kaynak kodun tümünün bağımsız özgün yazımını kanıtlayan bir iddia olarak kullanılmaz.
## Canlı kayıt kanıtı

7 Ekim 2026 23:58:20 (Europe/Istanbul) canlı HTTP doğrulaması: anonim landing page 200, yeni talep 201, aynı talebin tekrarı 200/replayed, geçersiz e-posta 422. Kurgusal canlı test kaydı: `2da4c6b3-0b58-4524-bdd1-fb0fba2bb1f8`. Sites veritabanı okuma aracıyla DB/service_requests tablosunda aynı UUID, dört alan ve created_at bağımsız olarak doğrulandı. `evidence/production-verification.json` sonuçları ve gerçek satırı içerir.

Tek kurgusal talep oluşturup HTTP davranışını yeniden sınamak için `node scripts/verify-production.mjs https://vanta-cyber-intelligence.emrehanh00wb.chatgpt.site` kullanılabilir. Script sonucu HTTP kanıtıdır; bağımsız canlı DB okumasını tek başına gerçekleştirmez. WebP üretimde application/octet-stream etiketiyle sunuluyor; asset'in byte içeriği kaynak dosyayla birebir doğrulandı. Platform MIME etiketi gerçek görsel varlığının kanıtı yerine kullanılmadı.

Kaynak için teslimle birlikte `VANTA_KAYNAK.zip` paylaşılır. Arşiv `git archive` ile teslim commit'inin izlenen dosyalarından oluşturulur; node_modules, yerel DB state ve kimlik bilgileri içermez. Değerlendirici kaynak kodu herkese açık GitHub reposu olmadan bu arşivden inceleyebilir. ZIP'in kendisine erişim için dosyanın değerlendirme kanalına eklenmesi gerekir.