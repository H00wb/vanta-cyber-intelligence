# AI ile çalışma kaydım

VANTA case study'sinde aldığım kararları, AI ile iş paylaşımımı ve kontrolleri bu belgede özetliyorum. Kısa konuşma yönlendirmelerimi teknik amaçlarıyla anlatıyorum; bu metin birebir prompt dökümü değildir.

Kapsamı, hizmetin anlatımını ve kabul şartlarını belirledim. Kod, test, belge ve yayın çalışmalarında Codex kullandım. Ana ajan uygulama ve entegrasyonu yürüttü; alt ajanlar form ve veritabanı sözleşmesini bağımsız inceledi, testleri ve belgeleri hazırladı. Hero görselini ImageGen ile ürettik. Bu iş paylaşımını kendi katkımdan ayrı ve açık tutuyorum.

## Sayfanın amacını belirlemem

Ziyaretçinin ilk ekranda VANTA'nın kime yardımcı olduğunu anlamasını ve talep formuna ulaşmasını istedim. İçeriği problem, yaklaşım, dört hizmet ve talep sırasıyla kurduk. İngilizce sloganı koruyup hizmet açıklamalarını Türkçe hazırladık. Ölçülmemiş başarı oranları veya müşteri referansları eklemedim.

İlk kurulumda Sites/Vinext starter'ını kullandık. Daha sonra mevcut tasarımı koruyarak standart Next.js, Supabase ve Vercel'e geçiş istedim. Starter altyapısını kabul ettim; sayfa içeriği ve kayıt davranışı bu case için AI desteğiyle üretildi. Uygulamanın içinde çalışan bir LLM veya gerçek tehdit analiz motoru bulunmuyor. Sohbetin temperature ayarının 0 yapıldığına dair bir doğrulama iddiası eklemiyorum.

## Talebin gerçekten kaydedilmesini sağlamam

Arayüzün yalnız gönderim yapılmış gibi görünmesini yeterli kabul etmedim. İsim, e-posta, hizmet ve açıklama için ortak doğrulama kuralları kullandık; aynı bilgiler sunucuda yeniden denetlenir. Veritabanında da alan türü, uzunluk, hizmet ve kimlik kuralları bulunur.

Başarı koşulunu açık tuttum: kayıt işlemi tamamlanmalı, API yanıtı geçerli olmalı ve dönen kimlik gönderilen UUID ile eşleşmeli. HTTP 200 tek başına yeterli değildir. Ağ hatasında veya zaman aşımında kesin sonucu bilemeyeceğimiz için bilgileri koruyan “Gönderim doğrulanamadı” mesajını tercih ettim.

Yanıt kaybolduğunda aynı talep aynı UUID ile yeniden gönderilir. Aynı kimlik ve içerik tek kaydı doğrular; farklı içerik 409 hatası verir. PostgreSQL'de eşzamanlı kayıt sonrası satırın doğru okunması için INSERT ve SELECT'i ayrı ifadeler olarak kullandık. Bu tercih, tek statement'ın snapshot sınırına takılabilen alternatifin yerine geçti.

## Veritabanı erişimini sınırlamam

Supabase'in publishable key'ini gizli bir anahtar gibi kullanmadım. RLS'yi açıp anonim rollerin tabloyu doğrudan okuma ve yazma yetkisini kaldırdık. Talep oluşturmayı tipli argüman alan, sabit şema adları kullanan ve yalnız kimlik/tekrar bilgisini döndüren bir RPC ile sunduk. Fonksiyonun SECURITY DEFINER yetkisini boş search_path ve dar işlem kapsamıyla sınırladık.

Bu fonksiyon anonim taleplere açıktır; Vercel API'si atlanarak çağrılabilir. Bu yüzden veritabanı kurallarını da gerekli gördüm. Origin denetimini bot koruması olarak sunmadım. Form için hız sınırı veya bot doğrulaması bu sürümde bulunmuyor.

## Kontrollerde bulduğumuz sorunlar

Bağımsız AI incelemesi ve otomatik testlerde çıkan gerçek bulguları düzeltme kapsamına aldım:

- JavaScript'in UTF-16 uzunluğu ile veritabanının karakter hesabı farklıydı. Ortak validator'ı Unicode kod noktası hesabına çevirdik; kısa emoji girdileri ve geçerli sınırlar için regresyon testleri ekledik.
- Boş veya HTML sunucu yanıtında teknik JSON hatası görünebiliyordu. Kullanıcıya anlaşılır belirsizlik mesajı gösterilmesini sağladık; yanlış yanıtın başarıya dönüşmemesini tarayıcıda sınadık.
- NUL içeren bir e-posta eski validator'dan geçiyordu. Kontrol karakterlerini reddettik ve bu örneği ayrı bir testle koruduk.
- Next.js'e geçişte yerel isteğin dış Origin'i iç localhost adresiyle karşılaştırıldığı için geçerli gönderim 403 alıyordu. Public Host ve forwarded protocol üzerinden kontrolü düzelttik; başka origin'in reddini koruduk.
- İlk Next.js tarayıcı turundaki bazı testler, form hata mesajıyla Next.js route announcer'ın aynı seçiciye uymasından başarısız oldu. Seçiciyi form içine daralttık; erişilebilir duyuruyu kaldırmadık.
- Supabase erişim reddi kontrolü önce yalnız 403 bekliyordu. Gerçek 401 yanıtını da ret olarak ele aldık; başarılı boş yanıtı erişim reddi saymadık.

Supabase SSR yardımcılarını eklerken cookie parçalarının, tarayıcı seçeneklerinin ve cache başlıklarının aynı yanıtta taşınmasını kontrol ettik. Bu kontroller taklit SDK ile yapıldı; gerçek bir Supabase Auth kullanıcısının giriş/yenileme testi olarak sunmuyorum.

## Kayıtları incelemek için yönetim ekranı eklemem

Sonraki isteğim, değerlendiren kişinin veritabanındaki kaydı doğrudan inceleyebilmesiydi. Ana sayfanın tasarımını koruyup yalnız doğrudan /admin adresinden açılan bir giriş ve salt okunur tablo ekledik. Panelde kimlik filtresi, sayfalama, dört form alanı ve kayıt zamanı bulunur.

Demo girişini admin / admin123 olarak belirledim. Bunun herkese açık değerlendirme hesabı olduğunu açıkça yazdım. Sunucuda parola scrypt özetiyle kontrol edilir; bir saatlik imzalı oturum HttpOnly, SameSite=Strict ve HTTPS'te Secure çerezle taşınır. Listeleme, geçerli oturumdan sonra sunucunun kullandığı ayrı okuma token'ına bağlı RPC ile yapılır. Token'ın yalnız özeti veritabanında tutulur; service-role anahtarı kullanılmaz. Giriş denemelerini veritabanında beş dakikada on denemeyle sınırlandırdık.

## Sonuçları nasıl kaydediyorum

Birim testlerini, taklit Supabase HTTP/SDK testlerini ve gerçek veritabanına giden tarayıcı kontrollerini ayırıyorum. Önceki geliştirme turlarında 47 Node, 15 yerel ve 15 canlı tarayıcı testi geçti; veritabanı sonradan temizlendiği için bu tarihsel sonuçlar eski kayıtların bugün varlığını kanıtlamaz.

Bir önceki yönetim sürümünün kontrolü: Node 75, tarayıcı yerel 21/21 ve canlı 21/21; canlı kontrol zamanı 8 Ekim 2026, 03:32 (Europe/Istanbul). Bu sonuç, aşağıdaki yeni ad-soyad değişikliğinin güncel canlı kanıtı değildir. Sonuçları güncel yayın ve mevcut kayıt üzerinden yeniden kontrol ederek teslim kaydına işliyoruz. Yeni testlerde kurgusal veri kullanılır; mevcut kullanıcı kaydı silinmez. Paylaşılan ekran görüntülerinde mevcut gerçek kişinin isim ve e-postasını yayımlamıyorum.

README'de kurulum ve erişim adımlarını, TEST_REHBERI.txt'de senaryoları ve beklenen sonuçları verdim. Geçmiş test kimliklerini güncel kalıcılık kanıtı olarak taşımadım. Teslim commit'i, yayın ve kaynak arşivi son teslim kaydında birlikte belirtilir.

Çalışmanın başlangıcını 7 Ekim 2026 23:26:15 (Europe/Istanbul) olarak kaydettim. Hedef 3–4 saati gerçekleşmiş emek gibi yazmıyorum; geçen süre teslim kaydında belirtilir. Yapılmayan test veya kesin puan iddiası eklemiyorum.
## Yönetim akışını doğrulamam

Yönetim girişi için değerlendirme hesabının kullanıcı adı/parola şartını korudum. İmzalı çerez kontrolünü yalnız arayüzde bırakmadık: kayıt API'si geçerli oturum olmadan veritabanı deposunu çağırmaz. Beş dakikalık giriş sınırını process belleği yerine PostgreSQL'e taşıdık; Vercel'in farklı function örneklerinde de aynı sayaç kullanılır. Anahtar, güvenilir Vercel IP başlığının HMAC özetiyle oluşturulur; ham IP saklanmaz.

Admin eklenince ilk tarayıcı turunda 18/21 geçti. İki alert seçicisi Next.js route announcer'ıyla, bir region seçicisi iki bölgeyle eşleşti. AI'ın önerdiği genel seçicileri gerçek hata paragrafı ve kaydırılabilir tablo bölgesiyle daraltarak değiştirdik. Bu yönetim sürümünün tam yerel ve canlı turları 21/21 geçti. Bu hata arayüz mesajı veya erişilebilirlik duyurusu kaldırılarak gizlenmedi.

Gerçek Supabase kontrolünde yanlış okuma token'ı ve anonim tablo okuması 401 aldı. Aynı kurgusal limit anahtarına 11 paralel veritabanı çağrısında 10 izin ve 1 ret çıktı. Canlı sunucuda uydurulmuş ve süresi dolmuş oturumları, yabancı/eksik Origin'i, Secure çerezi ve çıkışı ayrıca kontrol ettik. Bu sonuçları mock testlerin başarısı yerine koymadım; iki katmanın kanıtını ayrı yazdım.

Supabase security advisor raporunu da okuduk. Üç kapalı tabloda RLS policy bulunmaması bilgi düzeyi uyarı üretti; doğrudan tablo erişimi bilerek kapalı, işlemler sınırlı fonksiyonlardan geçiyor. SECURITY DEFINER fonksiyonlarının anon tarafından çağrılabilmesi ayrıca uyarı olarak göründü. Talep fonksiyonu açık form içindir; yönetim fonksiyonları veri okumadan önce ayrı sunucu token'ının özetini kontrol eder. Boş search_path, sabit sorgular, dar EXECUTE yetkileri ve gerçek ret testleriyle bu tercih doğrulandı. Raporun bütün uyarılarının kapandığını iddia etmiyorum. [RLS bildirimi](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) ve [anon SECURITY DEFINER bildirimi](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) bu tasarımın incelenecek sınırlarını açıklıyor.

Sonuçları JSON yığınları yerine okunabilir CANLI_DOGRULAMA.md ve TEST_SONUCLARI.md belgelerine taşıdım. Kanıt ekranları yalnız yeni kurgusal kayıtları içerir. 03:32'de tamamlanan önceki kontrolün sonunda o turda oluşturulan 15 test satırını yalnız kayıt kimlikleri ve kurgusal alanlarıyla eşleştirerek temizledik. Mevcut tek kayıt korundu; temizlik öncesi ve sonrası bütün satır özeti eşleşti. Ekrandaki test kimliklerinin temizlikten sonra bulunmayacağını açıkça yazdım.

## Ad ve soyadın birlikte girilmesini istemem

Tek bir ad yazılmasının kabul edilmemesini istedim. Codex ile ortak validator'a, kenar boşlukları temizlendikten sonra Unicode boşluklarla ayrılan en az iki dolu bölüm şartı ekledik. Birden çok adı veya arada birden çok boşluğu kabul ettik; boş soyadı tamamlanmış bilgi gibi değerlendirmedik. Bu kontrol adın yapısını denetler; harf kümesini daraltmaz ve kişinin kimliğini doğrulamaz.

Aynı kuralı `20261008015909_require_full_name.sql` migration'ıyla PostgreSQL'e taşıdık. JavaScript'in `\s` boşluk sınıfını SQL'de açık Unicode karakterleriyle eşledik; RPC'nin ad normalizasyonunu da aynı sınıfla yaptık. Tablo ve fonksiyon yetkilerini değiştirmedik.

Yeni regresyon testi tek parçalı adları hem ortak validator'da hem API'de kontrol eder: 422, ad alanı hatası, depo açılmaması ve kayıt kimliğinin dönmemesi beklenir. Normal ad-soyad, çok parçalı ad, birden çok boşluk ve NBSP örnekleri kabul edilir. Önceki uzunluk testlerini de iki parçalı adlarla koruduk.

Bu değişiklikten sonra 76 Node testinin tamamı geçti. Tarayıcıya tek ad için anlaşılır hata, ad alanına odak, formdan POST çıkmaması ve doğrudan API'de 422 senaryosu eklendi; toplam 22 tarayıcı senaryosu bulunuyor. Güncel tarayıcı sonucu: yerel 22/22 ve canlı 22/22 geçti. Canlı kontrol zamanı: 8 Ekim 2026, 05:11 (Europe/Istanbul). Yeni doğrulama tamamlanana kadar önceki 21/21 sonucunu bu değişikliğe taşımadım.

Yeni tarayıcı testinde JSON yanıtının tipi unknown olarak geldiği için ilk derleme tip kontrolünde durdu. Yanıtı varsayılan bir tipe zorlamak yerine Playwright'ın toHaveProperty kontrolüyle beklenen hata alanını doğruladık. İkinci üretim derlemesi ve 22 yerel tarayıcı senaryosu geçti.

Son canlı turda 22/22 geçti. Tek ad içeren anonim Supabase RPC isteği 400/23514 ile reddedildi ve SQL'de sıfır satır doğrulandı. PostgreSQL kontrolündeki üç ret/dört kabul örneği geri alındı. Bu turdaki 10 kurgusal kayıt yalnız kendi kimlikleriyle temizlendi; başta mevcut olan iki kaydın bütün satır özetleri değişmedi. Supabase advisor sonuçları önceki kapsamlı güvenlik kontrolüyle aynı kaldı.
