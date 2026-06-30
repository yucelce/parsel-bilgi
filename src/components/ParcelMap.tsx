import React, { useState, useEffect } from 'react';
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
  const defaultCenter: [number, number] = [39.92077, 32.85411]; // Eğer hiç parsel yoksa başlangıç noktası (Ankara)
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // API'den mevcut yüklenmiş parselleri çekiyoruz
  useEffect(() => {
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

  if (loading) {
    return <div className="p-4 text-center text-gray-600 font-medium">OSB Parsel Verileri Yükleniyor...</div>;
  }

  return (
    <div style={{ height: '600px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
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