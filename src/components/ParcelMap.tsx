// src/components/ParcelMap.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, GeoJSON, Tooltip, useMap, LayersControl, ZoomControl } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { Upload, Focus, Database } from 'lucide-react';
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

// Zoom değişikliklerini dinleyen yardımcı bileşen
function ZoomListener({ setCurrentZoom }: { setCurrentZoom: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    setCurrentZoom(map.getZoom()); 
    const onZoomEnd = () => setCurrentZoom(map.getZoom());
    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [map, setCurrentZoom]);
  return null;
}

interface ParcelMapProps {
  onEditParcel?: (id: string) => void;
  onSelectParcel?: (parcel: any) => void;
  selectedParcelId?: string | null;
  onOpenAdmin?: () => void;
}

export default function ParcelMap({ onEditParcel, onSelectParcel, selectedParcelId, onOpenAdmin }: ParcelMapProps) {
  const defaultCenter: [number, number] = [39.92077, 32.85411]; 
  const [currentZoom, setCurrentZoom] = useState<number>(6); 
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [uploading, setUploading] = useState<boolean>(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map>(null); 

  const fetchParcels = (isInitialLoad = false) => {
    fetch('/api/parcels')
      .then(async (res) => {
        if (!res.ok) throw new Error(`API Hatası: Sunucu ${res.status} döndürdü.`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setParcels(data);
        } else {
          setParcels([]);
        }
        setLoading(false);

        if (isInitialLoad && Array.isArray(data) && data.length > 0) {
          const latLngs: L.LatLng[] = [];
          data.forEach((parcel: any) => {
            if (parcel.geometry && (parcel.geometry.type === 'Polygon' || parcel.geometry.type === 'MultiPolygon')) {
              try {
                const coords = parcel.geometry.type === 'Polygon' 
                  ? parcel.geometry.coordinates[0] 
                  : parcel.geometry.coordinates[0][0]; 
                  
                if (Array.isArray(coords)) {
                  coords.forEach(([lng, lat]: [number, number]) => {
                    if (lat && lng) latLngs.push(L.latLng(lat, lng));
                  });
                }
              } catch (e) {
                console.warn("Sınır hesaplama hatası atlandı.", e);
              }
            }
          });
          if (latLngs.length > 0) {
            setMapBounds(L.latLngBounds(latLngs));
          }
        }
      })
      .catch((err) => {
        console.error('Parseller yüklenirken hata oluştu:', err);
        setParcels([]); 
        setLoading(false); 
      });
  };

  useEffect(() => {
    fetchParcels(true); 
  }, []);

  const handleCreated = async (e: any) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon') {
      const geojsonData = layer.toGeoJSON();
      console.log('Yeni Çizilen Parsel Geometrisi:', geojsonData.geometry);
      
      try {
        const response = await fetch('/api/parcels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Manuel Çizim (${new Date().toLocaleDateString()})`,
            geometry: geojsonData.geometry,
            ownerName: null,
            ownerPhone: null,
            ownerEmail: null,
            status: 'Aktif',
            zoningStatus: 'Sanayi Tesis Alanı'
          })
        });

        if (!response.ok) throw new Error('Veritabanına kayıt başarısız.');
        fetchParcels(false); 
      } catch (err) {
        console.error("Manuel çizim kaydı hatası:", err);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let geojsonData;
        try {
          geojsonData = JSON.parse(event.target?.result as string);
        } catch (parseError) {
          throw new Error("Dosya geçerli bir JSON formatında değil. Lütfen dosyanın bozuk olmadığından emin olun.");
        }

        let featuresToUpload: any[] = [];

        if (!geojsonData || typeof geojsonData !== 'object') {
          throw new Error('Dosya içeriği okunabilir bir veri içermiyor.');
        }

        if (geojsonData.type === 'FeatureCollection' && Array.isArray(geojsonData.features)) {
          featuresToUpload = geojsonData.features;
        } else if (geojsonData.type === 'Feature') {
          featuresToUpload = [geojsonData];
        } else if (geojsonData.type === 'Polygon' || geojsonData.type === 'MultiPolygon') {
          featuresToUpload = [{ type: 'Feature', geometry: geojsonData, properties: {} }];
        } else if (Array.isArray(geojsonData)) {
           throw new Error("Dosya sadece dizi (Array) içeriyor. Lütfen geçerli bir GeoJSON nesnesi (.geojson) yükleyin.");
        } else {
          throw new Error('Desteklenmeyen format. Dosyanızın tipi "FeatureCollection", "Feature" veya "Polygon" olmalıdır.');
        }

        if (featuresToUpload.length === 0) {
          throw new Error('Dosya formatı doğru görünse de içerisinde işlenebilecek hiçbir parsel (Feature) bulunamadı.');
        }

        const uploadedLatLngs: L.LatLng[] = [];
        let successCount = 0;

        for (const feature of featuresToUpload) {
          if (!feature.geometry) continue;

          const props = feature.properties || {};
          
          let adaParsel = props.ada_parsel || null;
          if (!adaParsel && props.Ada && props.ParselNo) {
            adaParsel = `${props.Ada}/${props.ParselNo}`;
          }

          let parcelName = props.name;
          if (!parcelName && adaParsel) {
            parcelName = `Ada/Parsel: ${adaParsel}`;
          } else if (!parcelName) {
            parcelName = props.PARSEL_NO ? `Parsel: ${props.PARSEL_NO}` : `Yüklenen Parsel (${new Date().toLocaleDateString()})`;
          }

          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => {
              if(lat && lng) uploadedLatLngs.push(L.latLng(lat, lng));
            });
          } else if (feature.geometry.type === 'MultiPolygon') {
             feature.geometry.coordinates.forEach((polygon: any[]) => {
                polygon[0].forEach(([lng, lat]: [number, number]) => {
                   if(lat && lng) uploadedLatLngs.push(L.latLng(lat, lng));
                });
             });
          }

          const response = await fetch('/api/parcels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: parcelName,
              geometry: feature.geometry,
              ownerName: props.Nitelik || props.owner_name || null,
              ownerPhone: null,
              ownerEmail: null,
              status: 'Aktif',
              adaParsel: adaParsel,
              areaM2: props.area_m2 || 0,
              zoningStatus: props.zoning_status || 'Sanayi Tesis Alanı',
              hasWorkLicense: props.has_work_license || false
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Veritabanı Kayıt Hatası: ${errData.error || response.statusText}`);
          }
          
          successCount++;
        }

        if (successCount === 0) {
           throw new Error('Parsellerin geometrisi çıkarılamadı. Sadece Poligon (Alan) desteklenmektedir.');
        }

        if (uploadedLatLngs.length > 0) {
          setMapBounds(L.latLngBounds(uploadedLatLngs));
        }

        alert(`${successCount} adet parsel başarıyla işlendi ve haritaya eklendi.`);
        fetchParcels(false); 
        
      } catch (err: any) {
        console.error('GeoJSON İşleme Hatası:', err);
        alert(`❌ PARSEL YÜKLEME BAŞARISIZ!\n\nSebep: ${err.message}`);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };

    reader.readAsText(file);
  };

  const handleFitBounds = () => {
    if (mapRef.current && mapBounds && mapBounds.isValid()) {
      mapRef.current.fitBounds(mapBounds, { padding: [50, 50], maxZoom: 18 });
    } else {
      alert("Haritada odaklanılacak geçerli bir sınır bulunamadı. Lütfen parsel yüklendiğinden emin olun.");
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 font-medium bg-[#1e1e1e]">
        CAD Viewport Yükleniyor...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative z-0">
      
      {/* ------------------------------------------------------------------ */}
      {/* YENİ: UYGULAMANIN TEK VE ANA ÜST BARI (HEADER + TOOLBAR BİRLEŞİMİ) */}
      {/* ------------------------------------------------------------------ */}
      <header className="bg-[#252526] border-b border-[#333] px-4 py-2 flex items-center justify-between shadow-md z-[400] relative select-none">
        
        {/* SOL: Logo ve Uygulama Adı */}
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-md shadow-sm h-9 w-9 flex items-center justify-center">
            <img 
              src="https://static.wixstatic.com/media/0ded6e_0a74b2a1d6614c4b99998cde8a9d165c~mv2.png" 
              alt="OSB Logo" 
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold tracking-wide text-gray-100 leading-tight">OSB PARSEL BİLGİ SİSTEMİ</h1>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">CAD Viewport v1.0</p>
          </div>
        </div>

        {/* ORTA: Yükleme ve Odaklanma Araçları */}
        <div className="flex items-center gap-2">
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
            title="Sisteme GeoJSON / JSON formatında parsel yükle"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border transition-colors ${
              uploading 
                ? 'bg-[#444] text-gray-500 border-[#555] cursor-not-allowed' 
                : 'bg-[#3c3c3c] hover:bg-[#505050] active:bg-[#2d2d2d] text-gray-200 border-[#555] cursor-pointer'
            }`}
          >
            <Upload size={14} />
            {uploading ? 'İşleniyor...' : 'Veri Yükle (.json)'}
          </button>

          <div className="w-px h-5 bg-[#555] mx-1"></div>

          <button 
            onClick={handleFitBounds}
            title="Tüm parselleri ekrana sığdıracak şekilde kamerayı ayarla"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3c3c3c] hover:bg-[#505050] active:bg-[#2d2d2d] text-gray-200 text-xs font-bold rounded border border-[#555] transition-colors cursor-pointer"
          >
            <Focus size={14} />
            Parsellere Odaklan
          </button>
        </div>

        {/* SAĞ: Koordinat Bilgisi ve Yönetim Paneli */}
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-gray-500 font-mono hidden md:block">
            Koordinat Sistemi: EPSG:4326 (WGS84)
          </div>
          <button 
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Database size={14} /> Tüm Sistemi Yönet
          </button>
        </div>

      </header>

      {/* Harita / Çizim Alanı */}
      <div className="flex-1 w-full h-full bg-[#1e1e1e]">
        <MapContainer 
          center={defaultCenter}
          zoom={6} 
          ref={mapRef}
          zoomControl={false} // YENİ: Varsayılan sol-üst zoom kontrolünü kaldırdık.
          style={{ height: '100%', width: '100%', background: '#242424' }}
        >
          {/* YENİ: Zoom kontrolünü sağ-alt köşeye koyduk */}
          <ZoomControl position="bottomright" />

          {/* KATMANLAR: Eski dosyadaki 4 katman eksiksiz korundu ve Sağ-Üste alındı */}
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Google Yol Haritası">
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=m&hl=tr&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Google Uydu (Karma)">
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=y&hl=tr&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OSM Yol Haritası (Alternatif)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Esri Detaylı Uydu">
              <TileLayer
                attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <MapBoundsController bounds={mapBounds} />
          <ZoomListener setCurrentZoom={setCurrentZoom} />

          {/* PARSELLERİ ÇİZDİRDİĞİMİZ KISIM */}
          {parcels.map((parcel) => {
            if (!parcel.geometry) return null;
            
            const geoJsonFeature: any = {
              type: "Feature",
              properties: parcel,
              geometry: parcel.geometry
            };

            const rawAdaParsel = parcel.ada_parsel || '';
            const labelText = rawAdaParsel.replace(/\//g, '-') || parcel.name || '';

            // Seçili Parsel Vurgusu
            const isSelected = selectedParcelId === parcel.id;

            return (
              <GeoJSON
                key={`parcel-${parcel.id}-${isSelected}`} 
                data={geoJsonFeature}
                style={{
                  color: isSelected ? '#facc15' : '#4ade80', // Seçiliyse Sarı, değilse Yeşil
                  fillColor: isSelected ? '#fef08a' : '#22c55e',
                  fillOpacity: isSelected ? 0.4 : 0.25,
                  weight: isSelected ? 3 : 2
                }}
                eventHandlers={{
                  click: (e) => {
                    const layer = e.target;
                    // Tıklanan parsele hafifçe zoom yap
                    if (mapRef.current && layer.getBounds) {
                      mapRef.current.fitBounds(layer.getBounds(), { padding: [150, 150], maxZoom: 18 });
                    }
                    if (onSelectParcel) onSelectParcel(parcel); // Seçili parseli App'e gönder (Sidebar için)
                  }
                }}
              >
                {/* HARİTA ÜZERİNDE ORTADA GÖRÜNECEK KALICI ETİKET */}
                {labelText && (
                  <Tooltip permanent direction="center" className="parcel-center-label">
                    {labelText}
                  </Tooltip>
                )}
              </GeoJSON>
            );
          })}

          <FeatureGroup>
            {/* @ts-ignore: react-leaflet-draw tip tanımlamaları React 18+ ile uyumsuz olduğu için yoksayılıyor */}
            <EditControl
              position="topright" // Çizim Araçları da Katmanların altında Sağ Üstte
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