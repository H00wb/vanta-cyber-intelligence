# VANTA — Cyber Intelligence Platform

VANTA, güvenlik liderlerine, SOC ve BT ekiplerine siber tehdit istihbaratı, saldırı yüzeyi analizi, olay korelasyonu ve dijital risk haritalama hizmetlerini anlatan bir hizmet sitesidir. Ziyaretçi formu doldurduğunda talebi sunucuda doğrulanır ve Supabase veritabanına kaydedilir.

- [Canlı site](https://vanta-cyber-intelligence.vercel.app)
- [Kaynak kod](https://github.com/H00wb/vanta-cyber-intelligence)
- [Test rehberi](TEST_REHBERI.txt)
- [Her testin kapsamı ve sonucu](TEST_SONUCLARI.md)
- [Ekran görüntüleriyle canlı doğrulama](CANLI_DOGRULAMA.md)
- [AI ile çalışma kaydı](AI_LOG.md)
- [Gereksinim karşılıkları](DEGERLENDIRME.md)

## Ürün

Sayfa, VANTA'nın kime yardımcı olduğunu ve dört hizmetin hangi ihtiyaca karşılık geldiğini açıklar. Talep formunda isim, e-posta, hizmet seçimi ve açıklama bulunur. Alanlar hem tarayıcıda hem sunucuda doğrulanır; veritabanı da temel alan kurallarını uygular.

Gönderim sırasında form kilitlenir. Başarı mesajı, kaydın tamamlandığını doğrulayan ve gönderim kimliğiyle eşleşen yanıttan sonra gösterilir. Hata veya bağlantı belirsizliğinde bilgiler korunur. Değişmeyen bir talebin tekrar gönderilmesi aynı kimliği kullanır; böylece yanıt kaybolduğunda gereksiz ikinci kayıt oluşmaz.

Uygulama Next.js, React ve TypeScript ile geliştirildi. Vercel siteyi ve API'yi yayımlar; Supabase PostgreSQL kayıtları saklar. Talep oluşturma işlemi sınırlı bir veritabanı fonksiyonuyla yapılır. Anonim kullanıcıların tabloyu doğrudan okuma ve yazma yetkisi kapalıdır.

Kayıtları incelemek için doğrudan `/admin` adresine gidilir; ana sayfada yönetim bağlantısı bulunmaz. Girişten sonra salt okunur tabloda kayıt kimliği, dört form alanı ve kayıt zamanı görülebilir. Filtreleme ve sayfalama vardır; panel kayıt değiştirme veya silme işlemi sunmaz.

## Kurulum

Node.js **24.x** kullanın. Terminali proje klasöründe açın:

```sh
npm ci
```

`.env.example` dosyasını `.env.local` adıyla kopyalayın. Kendi Supabase projenizin `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` değerlerini girin. Publishable key tarayıcıda kullanılabilen düşük yetkili anahtardır; tablo erişimi veritabanı yetkileriyle sınırlandırılır.

Yeni bir Supabase projesinde SQL Editor üzerinden şu iki migration'ı sırayla uygulayın:

1. `supabase/migrations/20261007212753_vanta_requests.sql`
2. `supabase/migrations/20261008000924_vanta_admin_read_access.sql`

Daha önce uygulanmış migration'ları yeniden çalıştırmayın. Supabase CLI ile çalışanlar projelerini `supabase link` ile bağladıktan sonra `supabase db push` kullanabilir.

Yönetim girişi için:

```sh
node scripts/setup-admin.mjs
```

Bu yardımcı, demo girişini ve rastgele sunucu anahtarlarını `.env.local` dosyasına hazırlar. `ADMIN_USERNAME`, scrypt parola özeti içeren `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` ve `ADMIN_DB_READ_TOKEN` yalnız sunucuda kullanılır; `NEXT_PUBLIC_` öneki almaz. Üretilen `.test-results/admin-access.sql` dosyasını migration'lardan sonra SQL Editor'de çalıştırın. Bu SQL, okuma token'ının SHA-256 özetini tanımlar. Ortam dosyasını ve bu yerel çıktıyı kaynak kodla paylaşmayın.

Vercel'de aynı ortam değişkenlerini ilgili proje ortamına ekleyip yeniden yayın yapın. Uygulama Supabase service-role anahtarı gerektirmez.

```sh
npm run dev
```

Yerel adres: http://127.0.0.1:5173 . Üretim derlemesini çalıştırmak için:

```sh
npm run build
npm run start
```

Yerel form da yapılandırdığınız Supabase'e yazar. Yeni testlerde yalnız kurgusal bilgiler ve `example.com` e-postaları kullanın.

## Canlı inceleme

[Siteyi](https://vanta-cyber-intelligence.vercel.app) mobil ve masaüstünde açın. Formdaki boş alan hatalarını, gönderiliyor durumunu ve kayıt sonrasındaki sonucu kontrol edin.

Ardından [yönetim sayfasını](https://vanta-cyber-intelligence.vercel.app/admin) doğrudan açın. Değerlendirme için demo giriş bilgileri **admin / admin123** olarak belirlenmiştir. Bu bilgiler herkese açık demo erişimidir; gerçek bir üretim ortamında kişisel veri gizliliği sağlamaz.

Başarı mesajındaki kayıt kimliğini kopyalayıp panelde arayın. İsim, e-posta, hizmet, açıklama ve kayıt zamanını gönderdiğiniz bilgilerle karşılaştırın. Sayfayı yenileyerek kaydın hâlâ veritabanından geldiğini kontrol edin. Mevcut kaydı değiştirmeyin veya silmeyin. Ayrıntılı adımlar [TEST_REHBERI.txt](TEST_REHBERI.txt) içindedir.

Panel erişimi sunucuda imzalı oturum çereziyle denetlenir. Çerez HttpOnly ve SameSite=Strict'tir; HTTPS'te Secure kullanır ve bir saat sonra geçersiz olur. Veritabanı okuma token'ı tarayıcıya gönderilmez. Giriş denemeleri veritabanında beş dakikada on denemeyle sınırlandırılır.

## Testler

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run start
# Ayrı terminalde:
npm run test:e2e
```

Güncel yeniden kontrol kaydı: **75 Node testi**, **yerel 21/21 ve canlı 21/21 tarayıcı testi**; canlı kontrol zamanı **8 Ekim 2026, 03:32 (Europe/Istanbul)**. Senaryolar, beklenen sonuçlar ve testlerin kullandığı gerçek veya taklit depolar test rehberinde açıklanır.

Önceki geliştirme turlarında geçen testler tarihsel sonuçlardır; veritabanı sonradan temizlendiği için eski kayıtların bugün mevcut olduğunu kanıtlamaz. Canlı incelemede güncel ekran görüntülerini ve kayıt kontrolünü esas alın. Son teslim commit'i ve kaynak arşivi teslim kaydında belirtilir.

## Notlar

İlk kurulumda Sites/[Vinext](https://github.com/cloudflare/vinext) starter'ından yararlanıldı; mevcut uygulama standart Next.js kullanır. Sayfa, kayıt akışı ve testler bu case için Codex ve alt ajan desteğiyle üretildi; hero görseli ImageGen ile hazırlandı. Uygulama çalışırken LLM çağrısı yapmaz.

Anonim talep oluşturma fonksiyonu doğrudan da çağrılabilir. Alan doğrulaması ve gövde sınırı vardır; form için bot koruması veya hız sınırı uygulanmadı. Yönetim girişindeki sınır, formu bu tür kullanımdan korumaz. Formun native maxLength sınırı UTF-16, ortak validator ise Unicode kod noktası sayar; üst sınıra yakın emoji girdilerinde tarayıcı daha erken sınırlayabilir. E-posta/CRM bildirimi ve gerçek bir tehdit analiz motoru bu teslimin kapsamında değildir.

Geçmiş kişisel projem [Music-Generation-Using-BiLSTM](https://github.com/H00wb/Music-Generation-Using-BiLSTM). Modeli oluşturup kodunu kendim yazdım. Klasik müzik MIDI verilerini 100 adımlık sekanslara dönüştürüp Keras'ta 64 → 128 → 64 BiLSTM katmanlarıyla yeni müzik üretimi üzerine çalıştım. Notebook'ta veri hazırlama ve model kodu incelenebilir; [ilgili commit](https://github.com/H00wb/Music-Generation-Using-BiLSTM/commit/52a7700afe4ced82f8c3631609a1633e10340ef0) H00wb hesabındaki katkıyı gösterir. Bu case sırasında model yeniden eğitilmedi.

Test sonuçları yapılan kontrolleri gösterir; değerlendirme puanı veya mülakat sonucu garanti edilmez.