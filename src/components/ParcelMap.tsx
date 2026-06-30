import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, Popup, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Haritayı mevcut parsellerin sınırlarına otomatik odaklayan yardımcı bileşen
function FitBoundsComponent({ parcels }: { parcels: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (parcels.length > 0) {
      const latLngs: L.LatLng[] = [];
      
      parcels.forEach((parcel) => {
        if (parcel.geometry && parcel.geometry.type === 'Polygon') {
          // GeoJSON formatında koordinatlar [lng, lat] şeklindedir. 
          // Bunları Leaflet LatLng nesnesine çevirip sınır belirleme dizisine ekliyoruz.
          parcel.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => {
            latLngs.push(L.latLng(lat, lng));
          });
        }
      });

      if (latLngs.length > 0) {
        // Tüm koordinatları içine alacak en optimum harita sınırını (bounnd) hesaplıyoruz
        const bounds = L.latLngBounds(latLngs);
        // Haritayı bu sınırlara, kenarlardan 50px pay bırakarak otomatik kaydır ve yakınlaştır
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [parcels, map]);

  return null;
}

export default function ParcelMap() {
  const defaultCenter: [number, number] = [39.92077, 32.85411]; 
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // --- YENİ EKLENEN STATE VE REF'LER ---
  const [uploading, setUploading] = useState<boolean>(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DEĞİŞTİRİLEN VERİ ÇEKME MOTORU ---
  // Tekrar çağrılabilmesi için fetch işlemini bir fonksiyona aldık
  const fetchParcels = () => {
    fetch('/api/parcels')
      .then((res) => res.json())
      .then((data) => {
        setParcels(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Parseller yüklenirken hata oluştu:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  // Yeni çizim tamamlandığında tetiklenen fonksiyon (Önceki adımdan korundu)
  const handleCreated = (e: any) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon') {
      const geojsonData = layer.toGeoJSON();
      console.log('Yeni Çizilen Parsel Geometrisi:', geojsonData.geometry);
      // Buraya ileride yeni parsel kayıt formu (Modal) açma fonksiyonu eklenecek
    }
  };

  // --- YENİ EKLENEN DOSYA YÜKLEME FONKSİYONU ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    // Dosya okunduğunda çalışacak asenkron blok
    reader.onload = async (event) => {
      try {
        const geojsonData = JSON.parse(event.target?.result as string);
        let featuresToUpload: any[] = [];

        // TKGM ve standart CBS araçları genelde FeatureCollection üretir
        if (geojsonData.type === 'FeatureCollection' && Array.isArray(geojsonData.features)) {
          featuresToUpload = geojsonData.features;
        } else if (geojsonData.type === 'Feature') {
          featuresToUpload = [geojsonData];
        } else if (geojsonData.coordinates) {
          // Sadece ham geometri nesnesi yüklenirse sarmala
          featuresToUpload = [{ type: 'Feature', geometry: geojsonData, properties: {} }];
        }

        if (featuresToUpload.length === 0) {
          alert('Geçerli bir GeoJSON parsel verisi bulunamadı.');
          setUploading(false);
          return;
        }

        // Dosya içindeki tüm parselleri döngüyle backend'e asenkron post ediyoruz
        for (const feature of featuresToUpload) {
          // TKGM properties altındaki PARSEL_NO özniteliğini veya genel adı yakalamaya çalışıyoruz
          const parcelName = feature.properties?.name || 
                             feature.properties?.PARSEL_NO || 
                             `Yüklenen Parsel (${new Date().toLocaleDateString()})`;

          await fetch('/api/parcels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: parcelName,
              geometry: feature.geometry, // Backend'deki ST_GeomFromGeoJSON doğrudan bunu bekler
              ownerName: feature.properties?.owner_name || null,
              ownerPhone: null,
              ownerEmail: null,
              status: 'Aktif'
            })
          });
        }

        alert(`${featuresToUpload.length} adet parsel başarıyla veritabanına işlendi ve haritaya eklendi.`);
        fetchParcels(); // Haritada hemen görünmesi için listeyi yenile
      } catch (err) {
        console.error('GeoJSON işleme hatası:', err);
        alert('Dosya formatı hatalı. Lütfen geçerli bir .geojson veya .json dosyası seçin.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Aynı dosya tekrar seçilebilsin diye temizle
      }
    };

    reader.readAsText(file); // Dosyayı string olarak okumaya başla
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-600 font-medium">OSB Parsel Verileri Yükleniyor...</div>;
  }

  return (
    <div className="w-full flex flex-col gap-2">
      {/* --- GÖRSEL BUTON VE GİZLİ INPUT EKLEDİK (Tailwind V4 Uyumlu) --- */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-xs">
        <span className="text-sm text-gray-600 font-medium">
          TKGM'den indirdiğiniz veya ürettiğiniz <strong>.geojson</strong> dosyalarını doğrudan sisteme yükleyebilirsiniz.
        </span>
        <div>
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".geojson,.json" 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`px-4 py-2 rounded-md font-medium text-sm text-white transition-all shadow-sm ${
              uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
            }`}
          >
            {uploading ? 'Parseller İşleniyor...' : 'GeoJSON Dosyası Yükle'}
          </button>
        </div>
      </div>

      {/* Harita buradaki div'in altında temiz bir şekilde çalışmaya devam edecek */}
      <div style={{ height: '600px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <MapContainer 
          center={defaultCenter}
        zoom={6} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Otomatik Odaklanma Motoru */}
        <FitBoundsComponent parcels={parcels} />

        {/* Mevcut Parselleri Haritaya Basma ve Sol Tık Bilgi Penceresi */}
        {parcels.map((parcel) => {
          if (!parcel.geometry || !parcel.geometry.coordinates) return null;
          
          // GeoJSON formatındaki [lng, lat] yapısını Leaflet'in beklediği [lat, lng] yapısına dönüştürüyoruz
          const positions = parcel.geometry.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);

          return (
            <Polygon
              key={parcel.id}
              positions={positions}
              pathOptions={{
                color: '#1e3a8a',      // Parsel çizgi rengi (Koyu Mavi)
                fillColor: '#3b82f6',  // Parsel iç dolgu rengi (Mavi)
                fillOpacity: 0.35,     // Saydamlık derecesi
                weight: 2              // Çizgi kalınlığı
              }}
            >
              {/* Parsele sol tıklandığında açılacak OSB Bilgi Kartı */}
              <Popup minWidth={260}>
                <div className="font-sans text-sm p-1">
                  <div className="border-b pb-2 mb-2">
                    <h3 className="font-bold text-base text-blue-950 m-0 mb-1">{parcel.name || 'İsimsiz Parsel'}</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                      Durum: {parcel.status || 'Aktif'}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-gray-700">
                    <p className="m-0"><strong>Malik (Sahip):</strong> {parcel.owner_name || 'Belirtilmemiş'}</p>
                    <p className="m-0"><strong>Telefon:</strong> {parcel.owner_phone || 'Belirtilmemiş'}</p>
                    <p className="m-0"><strong>E-posta:</strong> {parcel.owner_email || 'Belirtilmemiş'}</p>
                    {/* İleride buraya Kiracı bilgisi de schema.ts'ye eklenerek kolayca basılabilir */}
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Çizim Araçları Katmanı (Yeni parsel eklemek için) */}
        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={handleCreated}
            draw={{
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
              polygon: {
                allowIntersection: false,
                drawError: {
                  color: '#e1e100',
                  message: '<strong>Hata:</strong> Parsel sınırları kendi içinde kesişemez!'
                },
                shapeOptions: {
                  color: '#2563eb',
                  fillOpacity: 0.5
                }
              }
            }}
          />
        </FeatureGroup>
      </MapContainer>
    </div>
  );
}