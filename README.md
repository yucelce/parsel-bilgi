# OSB Parsel Bilgi Sistemi

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