# Alan Bilgi Yönetimi

## Projenin Amacı
Bu proje, Organize Sanayi Bölgeleri (OSB) yönetimleri için özel olarak tasarlanmış, harita tabanlı bir parsel bilgi ve yönetim sistemidir. Sistemin temel hedefi, OSB sınırları içerisindeki parsel verilerinin tek bir merkezden, dijital harita üzerinden hızlı ve güvenilir bir şekilde yönetilmesini sağlamaktır.

## Hedef Kitle ve Temel İşlevler
*   **Müşteri Profili:** Organize Sanayi Bölgeleri (OSB) yönetimleri.
*   **Kullanıcı Profili:** OSB idari, teknik ve emlak birimi personeli.
*   **Temel İşlev (MVP):** Kullanıcılar harita üzerinden sınırları belirlenmiş parselleri oluşturabilir/sisteme tanımlayabilir. Her bir parsel için mülk sahibi (malik), kiracı ve bu kişilere ait iletişim bilgileri sisteme işlenir. Harita üzerinde herhangi bir parsele tıklandığında, o parsele ait tüm mülkiyet ve iletişim verileri özet bir panelde görüntülenir.

## Modüler Yapı ve Gelecek Vizyonu (Geliştirici ve AI Asistan Rehberi)
Bu kod tabanına katkıda bulunacak tüm geliştiriciler ve yapay zeka asistanları aşağıdaki temel prensiplere uymakla yükümlüdür:

1.  **Kesin Modülerlik (Separation of Concerns):** 
    Kullanıcı arayüzü (UI), harita kütüphanesi (Map rendering) ve iş mantığı/veri yönetimi (State/API) birbirinden tamamen izole edilmelidir. Bir bileşen haritayı çizerken, veri çekme işlemini başka bir katman yönetmelidir.
2.  **3D (Üç Boyut) Entegrasyonu İçin Altyapı:** 
    Sistem şu an 2 boyutlu (2D) çalışmaktadır. Ancak mimari, ileride Cesium, Three.js veya Mapbox GL gibi 3D motorlarının sisteme entegre edileceği varsayılarak kurulmalıdır. Veri modelleri, sadece 2D poligonları (GeoJSON) değil, gelecekte binaların kat planlarını, yükseklik (Z ekseni) verilerini ve 3D model referanslarını (GLTF/GLB) destekleyebilecek esneklikte genişletilebilir olmalıdır.
3.  **Teknoloji Yığını (Tech Stack):**
    *   **Frontend:** React (v18), Vite, Tailwind CSS.
    *   **2D Harita:** Leaflet & React-Leaflet.
    *   **Backend & Veri:** Node.js, Express, PostgreSQL, Drizzle ORM.



## Kurulum ve Çalıştırma
Projenin lokal ortamda çalıştırılması için gerekli adımlar:

1. Bağımlılıkları yükleyin:
   ```bash
   npm install

   Programı web editörde geliştiriyorum, package.json kodlarını maneul eklemeliyim
   vercel ile geliştiriyoruz.

   program ai lar ile geliştirileceği için mümkün mertebe ayrık sayfalarla çalışılması iyi olur

   Mobilde de kullanılacak şekilde tasarımlar yapılsın.

   Ai yeni kod düzenlemelerinde, kodların nasıl yerleştirileceğini hassas şekilde tarif etsin.

   Programı büyütüp, geliştireceğiz.

---


Tasarım Özellikleri

1. Renk Paleti (Color Palette)
Uygulamada kurumsal, güvenilir ve veri odaklı bir atmosfer yaratmak amacıyla net kontrastlara sahip işlevsel bir renk paleti tercih edilmiştir:

Birincil Koyu Renk (Primary Dark): #1a2d42 (Yaklaşık)

Kullanım: Üst barlar, kurumsal paneller ve ana çerçeve alanları. Genellikle beyaz metinlerle yüksek kontrast oluşturmak için tercih edilir.

İkincil Canlı Mavi (Secondary Blue): #3a87ad (Yaklaşık)

Kullanım: Bilgi pencerelerinin (image_b95e6b.jpg içerisindeki "Öznitelik Bilgisi" modalı gibi) başlık alanları ve odaklanılması gereken modüller.

Aksiyon Yeşili (Action Green): #5cb85c (Yaklaşık)

Kullanım: "Sorgula", "Favorilere ekle" gibi kullanıcının ana aksiyonu tamamlamasını sağlayan (Call-to-Action) butonlar. Beyaz metinle kombinlenir.

Vurgu Kırmızısı (Highlight Red/Burgundy): #8b0000 (Yaklaşık)

Kullanım: Harita üzerinde seçili veya odaklanılmış parsel sınırlarının çizimi (image_b95e87.jpg). Kenar çizgisi opak, iç dolgusu ise transparan kırmızıdır.

Nötr Renkler (Neutrals):

Arka planlar ve veri tabloları için temiz beyaz (#ffffff).

Çizgiler, sınırlar ve placeholder ipucu metinleri için açık gri tonları.

2. Tipografi ve Hiyerarşi (Typography)
Verilerin okunabilirliğini en üst düzeye çıkarmak için ekran kartografisi ve CBS standartlarına uygun modern bir yazı tipi ailesi kullanılır:

Font Ailesi: Sans-serif (Örn: Roboto, Arial veya Open Sans gibi temiz, köşesiz ve modern fontlar).

Yazı Ağırlıkları (Font Weights):

Bold (Kalın): Veri tablolarındaki başlıklar (Key değerleri: İl, İlçe, Ada, Parsel vb.) ve modal başlıkları için kullanılır.

Regular (Normal): Verinin kendisi (Value değerleri: Ankara, Nallıhan, 104 vb.) ve uzun açıklama metinleri için kullanılır.

Hizalama (Alignment): Tablo içi metinlerde ve form elemanlarında netlik sağlamak adına sola hizalı (Left-aligned) düzen hakimdir.

3. Bileşen Stilleri ve UI Öğeleri (Component Styling)
Sistemdeki arayüz elemanları flat (düz) tasarım çizgilerine sahiptir:

Buton Tasarımları
Gradyan (renk geçişi) içermeyen, düz ve doygun renkli tasarımlar.

Buton metinleri tamamen beyaz, ortalanmış ve net okunabilir yapıdadır.

image_b95e6b.jpg üzerinde görüldüğü gibi, alt aksiyon butonları içinde bulunduğu bloğun tam genişliğini (full-width) kaplayacak şekilde esneyebilir.

Veri Tabloları ve Grid Yapısı
Minimum görsel kalabalık prensibi uygulanmıştır.

Satırlar arasında belirgin olmayan, ince gri ayrım çizgileri kullanılır.

Sol sütun (Değişken Adı) kalın yazı tipiyle, sağ sütun (Veri Değeri) ise normal yazı tipiyle sunularak hiyerarşi sağlanır.

Harita Üzeri Vurgular ve Tooltip'ler (image_b95e87.jpg)
Konum Pini: Net odaklama için standart canlı mavi CBS pini kullanılır.

Tooltip (Bilgi Balonu): Pin üzerinde açılan kutucuk keskin köşeli, beyaz arka planlı ve siyah metinlidir. Harita altlığından ayrışması için hafif bir gölge efektine (box-shadow) sahip