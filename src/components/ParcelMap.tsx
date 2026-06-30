import React, { useState } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css'; // Çizim araçlarının stilleri

export default function ParcelMap() {
  const centerPosition: [number, number] = [39.92077, 32.85411]; 

  // Çizilen parselin GeoJSON verisini tutacağımız state
  const [newParcelGeoJSON, setNewParcelGeoJSON] = useState<any>(null);

  // Çizim tamamlandığında tetiklenen fonksiyon
  const handleCreated = (e: any) => {
    const { layerType, layer } = e;
    
    if (layerType === 'polygon') {
      // Çizilen katmanı veritabanınızın beklediği GeoJSON formatına çeviriyoruz
      const geojsonData = layer.toGeoJSON();
      setNewParcelGeoJSON(geojsonData.geometry);
      
      console.log("Çizilen Parsel Geometrisi:", geojsonData.geometry);
      // BURA ÖNEMLİ: Çizim bittikten sonra burada bir modal/form açtırıp
      // kullanıcıdan "Malik Adı", "Kiracı", "İletişim" gibi bilgileri isteyebilirsiniz.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Harita Alanı */}
      <div style={{ height: '500px', width: '100%', borderRadius: '8px', overflow: 'hidden', zIndex: 0 }}>
        <MapContainer 
          center={centerPosition} 
          zoom={14} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Çizim Araçları Katmanı */}
          <FeatureGroup>
            <EditControl
              position="topright"
              onCreated={handleCreated}
              draw={{
                rectangle: false,     // Dikdörtgen çizimini kapat
                circle: false,        // Daire çizimini kapat
                circlemarker: false,  // Daire işaretçiyi kapat
                marker: false,        // Nokta işaretçiyi kapat
                polyline: false,      // Çizgi çizimini kapat
                polygon: {
                  allowIntersection: false, // Çizgilerin birbiriyle kesişmesini engeller (gerçekçi parsel çizimi için önemli)
                  drawError: {
                    color: '#e1e100', // Kesişme olursa verilecek uyarı rengi
                    message: '<strong>Hata:</strong> Parsel sınırları kendi içinde kesişemez!'
                  },
                  shapeOptions: {
                    color: '#2563eb', // Çizilen parselin rengi (Tailwind blue-600)
                    fillOpacity: 0.5
                  }
                }
              }}
            />
          </FeatureGroup>
        </MapContainer>
      </div>

      {/* Test Amaçlı: Çizilen veriyi ekranda gösterme */}
      {newParcelGeoJSON && (
        <div className="p-4 bg-gray-100 rounded-lg">
          <h3 className="font-bold mb-2">Çizilen Parsel Verisi (GeoJSON)</h3>
          <pre className="text-xs overflow-auto">{JSON.stringify(newParcelGeoJSON, null, 2)}</pre>
          <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Bu Parseli Kaydet (Formu Aç)
          </button>
        </div>
      )}
    </div>
  );
}