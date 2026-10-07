# Gereksinim ve kanıt matrisi

Bu dosya gereksinimlerin uygulama ve kanıt karşılığını gösterir; kesin puan garantisi değildir. Canlı adres: https://vanta-cyber-intelligence.vercel.app . Kaynak: https://github.com/H00wb/vanta-cyber-intelligence . D1/Sites kanıtları ilk sürümün tarihsel sonuçlarıdır.

| Ölçüt | Uygulama ve somut kanıt | Durum |
| --- | --- | --- |
| Çalışan ürün ve gereksinimler (25) | Türkçe hedef kitle/problem, dört hizmet, responsive landing page, isim/e-posta/hizmet/açıklama formu. Vercel HTTPS ve gerçek Supabase kaydı. | 15 yerel +15 canlı Chromium; bağımsız dört alan/zaman/count=1 SQL kanıtı |
| Kod, veri akışı ve temel güvenlik (20) | Ortak istemci/sunucu validator, JSON/body/origin kontrolü, DB CHECK, UUID idempotency, kapalı RLS tablo grants, dar anonim oluşturma RPC, güvenilir başarı gate'i. | 47 Node testi; canlı201/200/409/422/405; anon read/write401; doğrudan geçersiz RPC 400; SQL rol kanıtı |
| AI ile üretim ve doğrulama (20) | Birinci ağız AI_LOG, açık Codex/agent katkısı, kabul/değişiklik gerekçesi, gerçek bulunan hatalar ve test kanıtları. | Belgelendi; değerlendirme takdirine bağlı |
| Kullanılabilirlik ve erişilebilirlik (10) | Label/hata ilişkisi, odak yönetimi, skip-link, live durum, rem, reduced-motion. | 320/390/768/1440px; axe WCAG A/AA; klavye ve %200 metin. Gerçek cihaz/ekran okuyucu manuel testi yapılmadı |
| Test, hata yönetimi ve teslim (10) | 47 Node,15 yerel,15 canlı Chromium; loading/503/offline/HTML/wrongid/timeout/yanıtkaybı; kalıcı SQL kanıtı; canlı URL/public repo/README/AI_LOG/TXT. | Geçti; kesin commit/arşiv/redeploy koruma kanıtı TESLIM.txt içindedir |
| Yazılı problem çözme (10) | README veri akışı/yetki sınırı/kurulum, AI_LOG karar-gerekçe-doğrulama, TXT tekrarlanabilir test adımları. | Belgelendi; değerlendirme takdirine bağlı |
| Geçmiş proje ve kişisel katkı (5) | H00wb/Music-Generation-Using-BiLSTM modeli/kod yazarlığı beyanı; public notebook/commit kaynakları. | Statik repo incelemesi; model yeniden eğitilmedi |

## Teslim şartlarının karşılığı

- Mobil/masaüstü sayfa: `app/page.tsx`, `app/globals.css`; `evidence/vercel-desktop.png`, `vercel-mobile.png`.
- Dört alan ve çift doğrulama: `components/request-form.tsx`, `lib/request-validation.ts`, API handler.
- Gönderiliyor/başarı/hata: form durumu ve browser suite; başarı yalnız doğrulanmış kayıt sonucu.
- Kalıcı kayıt: `public.vanta_service_requests`; `evidence/supabase-production-records.json` bağımsız SQL.
- Tekrar/paralellik: aynı UUID/aynı içerik 200; farklı içerik 409; beş gerçek istek ve count=1.
- CanlıURL ve source: public Vercel, H00wb GitHub; Git entegrasyonu.
- Belgeler: README.md, AI_LOG.md, TEST_REHBERI.txt; kesin commit/dış teslim kaydı.

## Kanıt dosyaları

`ssr-unit-tests.tap`:47 test. `supabase-browser-results.json`:15 yerel test. `vercel-browser-results.json`:15 canlı test. `supabase-local-records.json`:yerel Next→gerçek PG. `supabase-production-verification.json`:canlı HTTPS/API/erişim kontrolleri. `supabase-production-records.json`:normal/paralel/browser/replay satırları ve rol sınırları. `vercel-submit.json`, `vercel-lost-response.json`:gerçek browser gönderim kimlikleri.

## Sınırlar

Anonim RPC bilerek talep oluşturabilir; publishable key gizli güvenlik sınırı değildir. Ticari bot/rate-limit, CRM/e-posta, yönetim paneli, gerçek tehdit motoru ve veri yaşam döngüsü kapsam dışıdır. Otomatik erişilebilirlik testi bütün kullanıcı koşullarını garanti etmez. Değerlendiricinin takdirindeki ölçütler ve mülakat sonucu için100 puan garantisi verilmez; tamamlanmış gereksinimler somut kanıtlarla sunulur.