# Gereksinim ve kanıt matrisi

Bu tablo öz değerlendirmedir; bir puan tahmini veya 100 puan garantisi değildir. “Doğrulandı” yalnız çalıştırılmış kontrollere dayanır. Canlı yayın, source erişimi ve geçmiş katkı ayrıca ele alınır.

| Ölçüt | Uygulama / somut kanıt | Durum |
| --- | --- | --- |
| Çalışan ürün ve gereksinimler (25) | Türkçe hedef kitle/problem anlatımı, dört hizmet, responsive landing page, dört alanlı form. `app/page.tsx`, `components/request-form.tsx`; 320–1440 px tarayıcı kontrolleri. | Yerelde ve gerçek canlı HTTP/D1 akışında doğrulandı |
| Kod, veri akışı ve temel güvenlik (20) | Sunucuya POST, ortak kuralların sunucuda yeniden uygulanması, D1 prepared statements, schema constraints, byte limiti, origin kontrolü, ziyaretçiye hata ayrıntısı sızmaması, GET okuma endpoint'i olmaması. 28 Node testi. | Doğrulandı |
| AI ile üretim ve doğrulama (20) | `AI_LOG.md`: araç/görev ayrımı, gerçek yönlendirme özetleri, teknik kararlar, iki gerçek inceleme bulgusu ve regresyon kanıtı, starter/AI katkısı açıklaması. | Belgelendi; değerlendirme takdirine bağlı |
| Kullanılabilirlik ve erişilebilirlik (10) | Form label/hata ilişkisi, görünür odak, skip-link, canlı durum, rem, reduced-motion; axe taramasında 0 otomatik ihlal; 200% masaüstü text-size kontrolü. | Belirtilen kapsamda doğrulandı |
| Test, hata yönetimi ve teslim (10) | 28 Node + 15 Chromium senaryosu; 503, offline, HTML response, timeout, commit-sonrası response kaybı; JSON/TAP kayıtları, screenshots, TXT yönergesi. | Yerel testler ve canlı kayıt doğrulandı; son commit/kaynak arşivi TESLIM.txt içinde |
| Yazılı problem çözme (10) | README veri akışı/güvenlik/kurulum/sınırlar; AI_LOG seçim/gerekçe/doğrulama; bu gereksinim matrisi. | Belgelendi; değerlendirme takdirine bağlı |
| Geçmiş proje ve kişisel katkı (5) | BiLSTM müzik üretimi reposu, model/notebook commit bağlantısı ve kullanıcının model/kod katkı beyanı README içinde. VANTA için insan kapsam yönlendirmesi ve AI uygulaması ayrıştırıldı. | Referanslandı; geçmiş model yeniden çalıştırılmadı |

## Formun temel kabul şartları

- Yeni kayıt sonrası 201 + aynı UUID; committed satırda dört alan ve created_at mevcut.
- Aynı kimlik/aynı veri → 200 replay + tek satır; farklı veri → 409.
- Alan hatası → 422, başarı yok; depolama hatası → 503, başarı yok.
- Belirsiz bağlantı → girdiler korunur, kesin kayıt başarısızlığı iddia edilmez.
- UI success koşulu HTTP durumuna ek olarak yanıt biçimini ve kayıt kimliğini kontrol eder.
- Canlı kaydın kanıtı yerel veriden türetilmez; ayrı production doğrulama dosyasıyla gösterilir.

## Teslim riskleri

Canlı sayfanın değerlendirici erişimi, source arşivinin/reponun paylaşılması ve gerçek kişisel portfolyo bilgisi adayın teslim eyleminde kontrol edilmelidir. Ticari trafik için rate-limit/bot koruması kapsam dışıdır. Gerçek cihaz/ekran okuyucu manuel testi yapılmadı. Değerlendirme takdirine bağlı maddeler kesin puan gibi sunulmaz.
Canlı kanıt: evidence/production-verification.json. Anonim sayfa 200, POST 201, aynı kimlik için 200/replayed, geçersiz e-posta 422; canlı D1 satırı bağımsız okunarak eşleştirildi. Son yayından sonra aynı satırın korunması dış teslim kaydında ayrıca doğrulanır.
