import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function ParcelMap() {
  // Haritanın açılacağı başlangıç noktası (Örn: Ankara)
  const centerPosition: [number, number] = [39.92077, 32.85411]; 

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer 
        center={centerPosition} 
        zoom={6} 
        style={{ height: '100%', width: '100%' }}
      >
        {/* Ücretsiz OpenStreetMap Katmanı */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Örnek İşaretçi (Daha sonra veritabanından gelen verilerle bunu döngüye alacağız) */}
        <Marker position={centerPosition}>
          <Popup>
            Buraya tıklanabilir içerikler <br /> ve parsel detayları eklenecek.
          </Popup>
        </Marker>

        {/* Örnek Bir Parsel (Çokgen) */}
        <Polygon 
          positions={[
            [39.92, 32.85],
            [39.93, 32.85],
            [39.93, 32.86],
            [39.92, 32.86],
          ]} 
          pathOptions={{ color: 'blue', fillColor: 'lightblue', fillOpacity: 0.5 }}
        >
          <Popup>Örnek Parsel Bilgisi</Popup>
        </Polygon>
      </MapContainer>
    </div>
  );
}