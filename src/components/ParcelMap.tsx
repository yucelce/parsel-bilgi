import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, Popup, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Haritayı verilen sınırlara otomatik odaklayan yardımcı bileşen
function MapBoundsController({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
  }, [bounds, map]);

  return null;
}

export default function ParcelMap() {
  const defaultCenter: [number, number] = [39.92077, 32.85411]; 
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Haritanın odaklanacağı sınırları tutan State
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  const [uploading, setUploading] = useState<boolean>(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchParcels = (isInitialLoad = false) => {
    fetch('/api/parcels')
      .then((res) => res.json())
      .then((data) => {
        setParcels(data);
        setLoading(false);

        if (isInitialLoad && data.length > 0) {
          const latLngs: L.LatLng[] = [];
          data.forEach((parcel: any) => {
            if (parcel.geometry && parcel.geometry.type === 'Polygon') {
              parcel.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => {
                latLngs.push(L.latLng(lat, lng));
              });
            }
          });
          if (latLngs.length > 0) {
            setMapBounds(L.latLngBounds(latLngs));
          }
        }
      })
      .catch((err) => {
        console.error('Parseller yüklenirken hata oluştu:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchParcels(true); 
  }, []);

  const handleCreated = (e: any) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon') {
      const geojsonData = layer.toGeoJSON();
      console.log('Yeni Çizilen Parsel Geometrisi:', geojsonData.geometry);
    }
  };

  // GELİŞTİRİLMİŞ AKILLI DOSYA YÜKLEME VE HATA BİLDİRİM MOTORU
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        // 1. JSON Format Kontrolü (Dosya bozuk mu?)
        let geojsonData;
        try {
          geojsonData = JSON.parse(event.target?.result as string);
        } catch (parseError) {
          throw new Error("Dosya geçerli bir JSON formatında değil. Lütfen dosyanın bozuk olmadığından emin olun.");
        }

        let featuresToUpload: any[] = [];

        // 2. Akıllı Format Algılama (Standart GeoJSON veya Ham Geometri)
        if (!geojsonData || typeof geojsonData !== 'object') {
          throw new Error('Dosya içeriği okunabilir bir veri içermiyor.');
        }

        if (geojsonData.type === 'FeatureCollection' && Array.isArray(geojsonData.features)) {
          // TKGM veya QGIS gibi sistemlerin standart çıktısı
          featuresToUpload = geojsonData.features;
        } else if (geojsonData.type === 'Feature') {
          // Sadece tek bir parsel verisi (Feature)
          featuresToUpload = [geojsonData];
        } else if (geojsonData.type === 'Polygon' || geojsonData.type === 'MultiPolygon') {
          // Sadece ham koordinat geometrisi yüklenmişse (Doğal format) bunu sarmala
          featuresToUpload = [{ type: 'Feature', geometry: geojsonData, properties: {} }];
        } else if (Array.isArray(geojsonData)) {
           throw new Error("Dosya sadece dizi (Array) içeriyor. Lütfen geçerli bir GeoJSON nesnesi (.geojson) yükleyin.");
        } else {
          // Ne olduğunu anlayamadığımız bir JSON objesi ise
          throw new Error('Desteklenmeyen format. Dosyanızın tipi "FeatureCollection", "Feature" veya "Polygon" olmalıdır.');
        }

        // 3. İçerik Boşluk Kontrolü
        if (featuresToUpload.length === 0) {
          throw new Error('Dosya formatı doğru görünse de içerisinde işlenebilecek hiçbir parsel (Feature) bulunamadı.');
        }

        const uploadedLatLngs: L.LatLng[] = [];
        let successCount = 0;

        // 4. Verileri Veritabanına Yazma
        for (const feature of featuresToUpload) {
          // Geometri verisi yoksa bu kaydı atla
          if (!feature.geometry) continue;

          const props = feature.properties || {};
          
          let parcelName = props.name;
          if (!parcelName && props.Ilce && props.Mahalle && props.Ada && props.ParselNo) {
            parcelName = `${props.Ilce}/${props.Mahalle} - Ada: ${props.Ada}, Parsel: ${props.ParselNo}`;
          } else if (!parcelName) {
            parcelName = props.PARSEL_NO ? `Parsel: ${props.PARSEL_NO}` : `Yüklenen Parsel (${new Date().toLocaleDateString()})`;
          }

          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => {
              uploadedLatLngs.push(L.latLng(lat, lng));
            });
          } else if (feature.geometry.type === 'MultiPolygon') {
             feature.geometry.coordinates.forEach((polygon: any[]) => {
                polygon[0].forEach(([lng, lat]: [number, number]) => {
                   uploadedLatLngs.push(L.latLng(lat, lng));
                });
             });
          }

          await fetch('/api/parcels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: parcelName,
              geometry: feature.geometry,
              ownerName: props.Nitelik || props.owner_name || null,
              ownerPhone: null,
              ownerEmail: null,
              status: 'Aktif'
            })
          });
          successCount++;
        }

        if (successCount === 0) {
           throw new Error('Parsellerin geometrisi çıkarılamadı (Sadece nokta/line yüklemiş olabilirsiniz). Sadece Poligon (Alan) desteklenmektedir.');
        }

        // 5. Başarılı Yükleme Sonrası Zoom
        if (uploadedLatLngs.length > 0) {
          setMapBounds(L.latLngBounds(uploadedLatLngs));
        }

        alert(`${successCount} adet parsel başarıyla işlendi ve haritaya eklendi.`);
        fetchParcels(false); 
        
      } catch (err: any) {
        // HATA YAKALAMA VE BİLGİLENDİRME EKRANI
        console.error('GeoJSON İşleme Hatası:', err);
        alert(`❌ PARSEL YÜKLEME BAŞARISIZ!\n\nSebep: ${err.message}\n\nÇözüm: TKGM'den indirdiğiniz orijinal .json dosyasını değiştirmeden yüklemeyi deneyin.`);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };

    reader.readAsText(file);
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-600 font-medium">OSB Parsel Verileri Yükleniyor...</div>;
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm">
        <span className="text-sm text-gray-600 font-medium">
          TKGM'den indirdiğiniz veya ürettiğiniz <strong>.geojson / .json</strong> dosyalarını doğrudan sisteme yükleyebilirsiniz.
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
              uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {uploading ? 'Parseller İşleniyor...' : 'GeoJSON Dosyası Yükle'}
          </button>
        </div>
      </div>

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

          <MapBoundsController bounds={mapBounds} />

          {parcels.map((parcel) => {
            if (!parcel.geometry || !parcel.geometry.coordinates) return null;
            
            const positions = parcel.geometry.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);

            return (
              <Polygon
                key={parcel.id}
                positions={positions}
                pathOptions={{
                  color: '#1e3a8a',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.35,
                  weight: 2
                }}
              >
                <Popup minWidth={260}>
                  <div className="font-sans text-sm p-1">
                    <div className="border-b pb-2 mb-2">
                      <h3 className="font-bold text-base text-blue-950 m-0 mb-1">{parcel.name || 'İsimsiz Parsel'}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                        Durum: {parcel.status || 'Aktif'}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-gray-700">
                      <p className="m-0"><strong>Nitelik/Sahip:</strong> {parcel.owner_name || 'Belirtilmemiş'}</p>
                      <p className="m-0"><strong>Telefon:</strong> {parcel.owner_phone || 'Belirtilmemiş'}</p>
                      <p className="m-0"><strong>E-posta:</strong> {parcel.owner_email || 'Belirtilmemiş'}</p>
                    </div>
                  </div>
                </Popup>
              </Polygon>
            );
          })}

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
    </div>
  );
}