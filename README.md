# VANTA — Cyber Intelligence Platform

Güvenlik liderleri, SOC ve BT ekiplerine siber tehdit istihbaratı, saldırı yüzeyi analizi, olay korelasyonu ve dijital risk haritalamasını anlatan Türkçe landing page. Dört alanlı talep formu doğrulanan bilgileri Supabase PostgreSQL'de kalıcı bir kayda dönüştürür. Kapsam hizmet sitesi ve talep kaydıdır; çalışan bir siber güvenlik analiz motoru değildir.

- Canlı site: https://vanta-cyber-intelligence.vercel.app
- İncelenebilir kaynak: https://github.com/H00wb/vanta-cyber-intelligence
- AI kullanımı ve kararlar: [AI_LOG.md](AI_LOG.md)
- Test adımları: [TEST_REHBERI.txt](TEST_REHBERI.txt)
- Gereksinim/kanıt eşleştirmesi: [DEGERLENDIRME.md](DEGERLENDIRME.md)

## Kurulum

Node.js **24.x** ve npm kullanın. Terminali `vanta` klasöründe açın:

```sh
npm ci
```

`.env.example` dosyasını `.env.local` olarak kopyalayın ve kendi Supabase projenizin değerlerini girin:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Bu değerler sunucu tarafında okunur; `NEXT_PUBLIC_` kullanılmaz. Publishable key düşük yetkilidir ve gizli bir güvenlik sınırı değildir. Bu uygulama geniş yetkili secret/service-role anahtarı gerektirmez. `.env.local`, Vercel oturum verileri ve test trace dosyaları Git'e dahil edilmez.

Supabase SQL Editor'de `supabase/migrations/20261007212753_vanta_requests.sql` dosyasının tamamını yeni kurulumda **bir kez** çalıştırın. Aynı migration daha önce uygulanmışsa yeniden çalıştırmayın. Migration yalnız VANTA tablosu/fonksiyonuna dokunur; başka proje tablolarının yetkilerini değiştirmez. Mevcut teslimde migration bağlı Supabase projesine uygulanmıştır.

```sh
npm run dev
```

Adres: http://127.0.0.1:5173 . Üretim derlemesini yerelde çalıştırmak için:

```sh
npm run build
npm run start
```

Yerel uygulama da yapılandırılan gerçek Supabase'e yazar. Yalnız kurgusal isimler ve `example.com` e-postalarıyla test edin. Ortam değerleri/veritabanı hazır değilse form başarı göstermez.

## Mimari ve veri akışı

- Next.js App Router / React / TypeScript; standart Next.js dev/build/start komutları ve webpack üretim derlemesi.
- `app/page.tsx`, `app/globals.css`: landing page, responsive yerleşim ve erişilebilirlik davranışları.
- `components/request-form.tsx`: gönderiliyor/başarı/hata durumları, odak yönetimi ve tekrar gönderim kimliği.
- `lib/request-validation.ts`: istemci ve sunucunun ortak alan kuralları.
- `app/api/requests/route.ts` → `lib/request-handler.ts` → `lib/supabase-store.ts` → Supabase RPC → PostgreSQL.
- `supabase/migrations/20261007212753_vanta_requests.sql`: tablo, CHECK kısıtları, RLS, yetkiler ve atomik kayıt RPC'si.

İsim 2–100, e-posta en fazla 254, açıklama 20–2000 Unicode kod noktası olmalıdır; hizmet allowlist'ten seçilir. Kontrol karakterleri reddedilir; açıklamada satır sonu/tab kabul edilir. E-posta küçük harfe çevrilir, alan kenarlarındaki boşluklar temizlenir. Gönderim kimliği UUID v4'tür. Sunucu JSON biçimini, yöntemi, gerçek gövde byte sınırını (16 KiB), alanları ve Origin'i kontrol eder. Next.js proxy ortamında public Host/forwarded protocol kullanılır; farklı origin reddedilir.

RPC'nin UUID birincil anahtarı eşzamanlı gönderimleri tek kayıtta tutar. `INSERT ... ON CONFLICT DO NOTHING RETURNING` sonrasında ayrı SELECT mevcut dört alanı karşılaştırır: yeni kayıt **201**, aynı içerikle tekrar **200/replayed**, aynı kimlikle farklı içerik **409**. PostgreSQL VOLATILE fonksiyonun ayrı SQL ifadeleri eşzamanlı kazananın commit edilmiş satırını görebilir. Başarı yalnız kimliği ve `replayed` alanı doğrulanmış kayıt sonucundan sonra gösterilir. Yanıt kaybında form aynı bilgileri/kimliği koruyarak tekrar deneyebilir.

Sunucu depolama veya belirsiz yanıt hatasında **503** döndürür; başarı iddiasında bulunmaz ve iç SQL/anahtarları yanıta taşımaz. Tarayıcı 15 saniye, Supabase çağrısı 10 saniye zaman aşımına sahiptir. Başarısız gönderimde bilgiler korunur. HTTP 200 tek başına başarı sayılmaz.

## Erişim sınırı

`public.vanta_service_requests` için RLS açıktır. PUBLIC, anon ve authenticated rollerinin doğrudan tablo erişimi kaldırılmıştır; ziyaretçiler kayıtları listeleyemez, okuyamaz veya doğrudan tabloya yazamaz.

`vanta_submit_request` ise **bilinçli olarak anonim talep oluşturma API'sidir**. Publishable key ile Vercel'i atlayarak çağrılabilir. Bu nedenle alan/UUID/hizmet kuralları veritabanında da CHECK ile uygulanır. Fonksiyon `SECURITY DEFINER`, boş `search_path`, sabit şema adları ve tipli argümanlarla yalnız kayıt oluşturur veya tamamen aynı talebin tekrarını doğrular. Dinamik SQL kullanmaz; yalnız `{id,replayed}` döndürür, ziyaretçi alanlarını döndürmez. PUBLIC EXECUTE kaldırılmış, yalnız anon/authenticated için bu fonksiyonun signature'ına EXECUTE verilmiştir. Origin kontrolü veya publishable key'i gizlemek bot koruması olarak sunulmaz.

## Testler ve gerçek kanıtlar

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run start
# Başka terminalde:
npm run test:e2e
```

- **41 Node testi geçti.** HTTP/alan kuralları, kayıt bekleme, replay/çatışma, yanıt kimliği, hata yönetimi, NUL e-posta ve proxy Origin regresyonları. SQLite fixture yalnız depo sözleşmesinin test çiftidir; mocked fetch Supabase transport'u sınar. Bu testler gerçek PostgreSQL entegrasyonu diye sunulmaz.
- **15 yerel Chromium testi geçti:** derlenmiş Next.js → gerçek uzak Supabase.
- **15 canlı Chromium testi geçti:** herkese açık Vercel → gerçek Supabase. 320/390/768/1440 px, form doğrulaması, loading kilidi, gerçek başarı, 503, offline, HTML/yanlış kimlik, timeout, yanıt kaybından sonra aynı kayıt, klavye, axe WCAG A/AA ve %200 metin büyütme.
- Canlı HTTPS betiğinde 201/200/409/422/405, NUL reddi ve beş paralel istekte [201,200,200,200,200] doğrulandı. Anonim tablo okuma/yazma **401** ile reddedildi; doğrudan geçersiz RPC **400** döndürdü.
- HTTP ve tarayıcı fixture'ları bağımsız Supabase SQL sorgusuyla okundu: dört alan/zaman eşleşti ve her kimlik için satır sayısı **1**. RLS ve anon/authenticated tablo yetkileri ayrıca doğrulandı.

Kanıtlar: `evidence/supabase-unit-tests.tap`, `supabase-browser-results.json`, `supabase-local-records.json`, `vercel-browser-results.json`, `supabase-production-verification.json`, `supabase-production-records.json`, `vercel-submit.json`, `vercel-lost-response.json`, `vercel-desktop.png`, `vercel-mobile.png`.

Canlı HTTP kontrolü, ortam değerleri hazırken şöyle çalıştırılır (yeni kurgusal kayıt oluşturur):

```sh
node --env-file=.env.local scripts/verify-production.mjs https://vanta-cyber-intelligence.vercel.app
```

Betik HTTP kanıtını üretir; bağımsız SQL okumasını kendiliğinden yapmaz. Betik tekrar çalıştırılırsa yeni kimlikler için SQL kontrolünü ayrıca yenileyin. Ayrıntılı canlı tarayıcı komutları TXT dosyasındadır.

H00wb GitHub hesabındaki public repo, Bulyerleş Vercel hesabındaki `vanta-cyber-intelligence` projesine bağlanmıştır. `main` push'ları Git entegrasyonuyla yayımlanır. `vercel.json` Next.js preset'ini, npm ci kurulumunu ve build komutunu tanımlar. SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY Production ve Preview ortamlarında yapılandırılmıştır. Preview da bu değerlendirme tablosuna kurgusal kayıt yazar.

Kesin teslim commit'i `git rev-parse HEAD` ile, GitHub eşleşmesi `git ls-remote origin refs/heads/main` ile kontrol edilir. Son commit ve redeploy sonrası bağımsız kayıt kanıtı dış `TESLIM.txt` / teslim paketinde belirtilir. Kaynak ZIP yalnız o commit'in izlenen dosyalarından oluşturulur; `.env`, node_modules veya yerel oturum/state içermez.

İlk sürüm Sites/Vinext Next.js starter'ı ile başladı; starter ve shadcn/ui yardımcı dosyaları depoda tarihsel olarak duruyor. Aktif uygulama standart Next.js + Supabase + Vercel kullanır; eski D1/Vite/Sites scriptleri güncel kurulum için kullanılmaz. Eski D1/Sites raporları yeni PostgreSQL/Vercel kanıtı olarak değerlendirilmemelidir.

Hazır VANTA landing page şablonu kullanılmadı. Türkçe ürün anlatımı, sayfa düzeni, form/kayıt doğruluk sözleşmesi ve testler bu case için Codex desteğiyle üretildi. Hero görseli ImageGen ile üretildi. AI ve alt ajan iş paylaşımı, kabul edilen/değiştirilen öneriler ve gerçek başarısızlıklar AI_LOG'da açıkça yer alır. Lisans/sağlayıcı kayıtları ilk sürümdeki vendor dosyalarında korunur. Uygulama runtime'ında LLM çağrısı yoktur; sohbetin temperature=0 ayarlandığı iddia edilmez.

Geçmiş projem: [Music-Generation-Using-BiLSTM](https://github.com/H00wb/Music-Generation-Using-BiLSTM). Modeli oluşturup kodunu kendim yazdığımı beyan ettim. Notebook'ta music21 ile MIDI hazırlama, 100 adımlık sekanslar ve Keras'ta 64 → 128 → 64 BiLSTM katmanları incelenebilir. [Model/notebook commit'i](https://github.com/H00wb/Music-Generation-Using-BiLSTM/commit/52a7700afe4ced82f8c3631609a1633e10340ef0) hesap katkısını gösterir. Repo bu case'te statik incelendi; model yeniden eğitilmedi veya performansı tekrar ölçülmedi.

Değerlendirme için kurgusal verili hizmet sitesi teslimidir. Ticari bot/rate-limit koruması, CRM/e-posta bildirimi, yönetim paneli, gerçek tehdit analizi motoru ve veri yaşam döngüsü süreçleri kapsam dışıdır. Gerçek cihaz/ekran okuyucu manuel testi yapılmadı; axe sonuçları tüm erişilebilirliği tek başına kanıtlamaz. Testler ve kanıtlar gereksinimleri somutlaştırır; mülakat/değerlendirme puanı garanti edilmez. Başlangıç, gerçek geçen süre ve son teslim saati dış teslim kaydında dürüstçe belirtilir.