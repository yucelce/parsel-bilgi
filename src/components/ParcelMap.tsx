import React, { useState, useEffect, useRef } from 'react';

import { MapContainer, TileLayer, FeatureGroup, GeoJSON, Popup, Tooltip, useMap, LayersControl } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { Upload, Focus, Download, Edit2 } from 'lucide-react';
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

interface ParcelMapProps {
  onEditParcel?: (id: string) => void;
  onSelectParcel?: (parcel: any) => void; // YENİ: Tıklanan parseli App.tsx'e gönderecek
  selectedParcelId?: string | null;       // YENİ: Seçili parselin sarı renk olmasını sağlayacak
}

export default function ParcelMap({ onEditParcel, onSelectParcel, selectedParcelId }: ParcelMapProps) {
  // ParcelMap bileşeni içine eklenecek yeni state
const [currentZoom, setCurrentZoom] = useState<number>(6); // Varsayılan zoom seviyesi

// Zoom değişikliklerini dinleyen yardımcı bileşen
function ZoomListener() {
  const map = useMap();
  useEffect(() => {
    setCurrentZoom(map.getZoom()); // İlk yüklemede zoomu al
    const onZoomEnd = () => setCurrentZoom(map.getZoom());
    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [map]);
  return null;
}
  const defaultCenter: [number, number] = [39.92077, 32.85411]; 
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [uploading, setUploading] = useState<boolean>(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map>(null); // Haritaya dışarıdan müdahale için referans

  const fetchParcels = (isInitialLoad = false) => {
    fetch('/api/parcels')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`API Hatası: Sunucu ${res.status} döndürdü.`);
        }
        return res.json();
      })
      .then((data) => {
        // Gelen verinin dizi (array) olup olmadığını kontrol et
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
        setParcels([]); // Haritanın çökmesini engellemek için boş diziye çek
        setLoading(false); // Yüklenme ekranından çık
      });
  };

  useEffect(() => {
    fetchParcels(true); 
  }, []);

  // YENİ EKLENEN: Koordinat indirme fonksiyonu
  const downloadCoordinates = (geometry: any, name: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geometry, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${name ? name.replace(/\//g, '-') : "parsel"}_koordinatlar.geojson`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

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
        fetchParcels(false); // Yeni çizileni sisteme yükle
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

          // Yüklenen dosyanın sınırlarını (Bounds) bulmak için
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

          // Backend API'ye kaydet
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
      {/* AutoCAD Stili Koyu Toolbar (Araç Çubuğu) */}
      <div className="bg-[#2d2d2d] border-b border-[#444] p-1.5 flex items-center gap-2 z-[400] relative shadow-sm">
        <input 
          type="file" 
          ref={fileInputRef}
          accept=".geojson,.json" 
          onChange={handleFileUpload} 
          className="hidden" 
        />
        
        {/* Veri Yükle Butonu */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Sisteme GeoJSON / JSON formatında parsel yükle"
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
            uploading 
              ? 'bg-[#444] text-gray-500 border-[#555] cursor-not-allowed' 
              : 'bg-[#3c3c3c] hover:bg-[#505050] active:bg-[#2d2d2d] text-gray-200 border-[#555] cursor-pointer'
          }`}
        >
          <Upload size={16} />
          {uploading ? 'İşleniyor...' : 'Veri Yükle (.json)'}
        </button>

        {/* Ayraç */}
        <div className="w-px h-5 bg-[#555] mx-1"></div>

        {/* Tüm Parsellere Odaklan Butonu */}
        <button 
          onClick={handleFitBounds}
          title="Tüm parselleri ekrana sığdıracak şekilde kamerayı ayarla"
          className="flex items-center gap-2 px-3 py-1.5 bg-[#3c3c3c] hover:bg-[#505050] active:bg-[#2d2d2d] text-gray-200 text-xs font-medium rounded border border-[#555] transition-colors cursor-pointer"
        >
          <Focus size={16} />
          Parsellere Odaklan
        </button>
      </div>

      {/* Harita / Çizim Alanı */}
      <div className="flex-1 w-full h-full bg-[#1e1e1e]">
        <MapContainer 
          center={defaultCenter}
          zoom={6} 
          ref={mapRef}
          style={{ height: '100%', width: '100%', background: '#242424' }}
        >
          {/* Katmanlar Kapatılmadı, Aynen Korundu */}
          <LayersControl position="topleft">
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
          <ZoomListener /> {/* YENİ EKLENEN */}

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
            
            // YENİ EKLENEN KISIM: Bu parsel şu an seçili mi?
            const isSelected = selectedParcelId === parcel.id;

            return (
              <GeoJSON
                key={`parcel-${parcel.id}-${isSelected}`} 
                data={geoJsonFeature}
                style={{
                  // Seçiliyse SARI, seçili değilse YEŞİL tonları
                  color: isSelected ? '#facc15' : '#4ade80',
                  fillColor: isSelected ? '#fef08a' : '#22c55e',
                  fillOpacity: isSelected ? 0.4 : 0.25,
                  weight: isSelected ? 3 : 2
                }}
                eventHandlers={{
                  click: (e) => {
                    const layer = e.target;
                    // Tıklandığında kamerayı o parsele hafifçe yaklaştır/odakla
                    if (mapRef.current && layer.getBounds) {
                      mapRef.current.fitBounds(layer.getBounds(), { padding: [150, 150], maxZoom: 18 });
                    }
                    // Tıklanan parselin verisini üst bileşene (App.tsx) gönder
                    if (onSelectParcel) {
                      onSelectParcel(parcel);
                    }
                  }
                }}
              >
                {/* HARİTA ÜZERİNDE ORTADA GÖRÜNECEK KALICI ETİKET */}
                {labelText && (
                  <Tooltip permanent direction="center" className="parcel-center-label">
                    {labelText}
                  </Tooltip>
                )}
                
                {/* DİKKAT: <Popup> etiketi ve içindeki her şey buradan silindi! */}
              </GeoJSON>
            );
          })}
          })}

          <FeatureGroup>
            {/* @ts-ignore: react-leaflet-draw tip tanımlamaları React 18+ ile uyumsuz olduğu için yoksayılıyor */}
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