// src/components/ParcelMap.tsx -- PROGRAMI HEP GELİŞTİRECEK ŞEKİLDE KOD YAZ
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, GeoJSON, Tooltip, useMap, LayersControl, ZoomControl } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { Upload, Focus, Database, X } from 'lucide-react';
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
  refreshTrigger?: number;
}

export default function ParcelMap({ onEditParcel, onSelectParcel, selectedParcelId, onOpenAdmin, refreshTrigger }: ParcelMapProps) {
  const defaultCenter: [number, number] = [39.92077, 32.85411];
  const [currentZoom, setCurrentZoom] = useState<number>(6);
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map>(null);

  // --- YENİ EKLENEN STATE'LER VE FONKSİYONLAR ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [manualInputStyle, setManualInputStyle] = useState<'file' | 'manual'>('file');
  const [manualGeoJson, setManualGeoJson] = useState('');

  // Manuel girilen JSON verisini veritabanına kaydetme fonksiyonu
  const handleManualSubmit = async () => {
    if (!manualGeoJson.trim()) return alert("Lütfen geçerli bir JSON verisi girin.");
    try {
      setUploading(true);
      const geojsonData = JSON.parse(manualGeoJson);

      let featuresToUpload: any[] = [];
      if (geojsonData.type === 'FeatureCollection' && Array.isArray(geojsonData.features)) {
        featuresToUpload = geojsonData.features;
      } else if (geojsonData.type === 'Feature') {
        featuresToUpload = [geojsonData];
      } else if (geojsonData.type === 'Polygon' || geojsonData.type === 'MultiPolygon') {
        featuresToUpload = [{ type: 'Feature', geometry: geojsonData, properties: {} }];
      } else {
        throw new Error("Geçersiz format. Lütfen FeatureCollection, Feature veya Polygon girin.");
      }

      let successCount = 0;
      for (const feature of featuresToUpload) {
        if (!feature.geometry) continue;
        const props = feature.properties || {};
        const parcelName = props.name || props.ada_parsel || `Manuel Parsel (${new Date().toLocaleDateString()})`;

        const response = await fetch('/api/parcels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: parcelName,
            geometry: feature.geometry,
            status: 'Aktif',
            adaParsel: props.ada_parsel || null,
          })
        });
        if (response.ok) successCount++;
      }

      if (successCount > 0) {
        alert(`${successCount} adet parsel başarıyla işlendi.`);
        setIsUploadModalOpen(false);
        setManualGeoJson('');
        fetchParcels(false); // Haritayı yenile
      } else {
        alert("JSON içinde geçerli bir parsel geometrisi bulunamadı.");
      }
    } catch (err: any) {
      alert(`JSON ayrıştırma veya kayıt hatası:\n${err.message}`);
    } finally {
      setUploading(false);
    }
  };
  // --- YENİ EKLENEN BÖLÜMÜN SONU ---

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

  useEffect(() => {
    // refreshTrigger 0 ise ilk yüklemedir (haritayı ortala), 0'dan büyükse sadece veriyi güncelle
    fetchParcels(refreshTrigger === 0);
  }, [refreshTrigger]);

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


  // ... diğer kodlar

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let geojsonData;
        try {
          // BOM (Byte Order Mark) karakterini temizleyerek ayrıştır (Gizli karakter hatasını çözer)
          const resultStr = (event.target?.result as string).replace(/^\uFEFF/, '');
          geojsonData = JSON.parse(resultStr);
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

          // Veritabanı hatasını önlemek için tipi string'e zorluyoruz
          adaParsel = adaParsel ? String(adaParsel) : null;

          let parcelName = props.name;
          if (!parcelName && adaParsel) {
            parcelName = `Ada/Parsel: ${adaParsel}`;
          } else if (!parcelName) {
            parcelName = props.PARSEL_NO ? `Parsel: ${props.PARSEL_NO}` : `Yüklenen Parsel (${new Date().toLocaleDateString()})`;
          }

          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => {
              if (lat && lng) uploadedLatLngs.push(L.latLng(lat, lng));
            });
          } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon: any[]) => {
              polygon[0].forEach(([lng, lat]: [number, number]) => {
                if (lat && lng) uploadedLatLngs.push(L.latLng(lat, lng));
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
        setIsUploadModalOpen(false); // Modal'ı veriler yüklendikten SONRA kapatıyoruz.

      } catch (err: any) {
        console.error('GeoJSON İşleme Hatası:', err);
        alert(`❌ PARSEL YÜKLEME BAŞARISIZ!\n\nSebep: ${err.message}`);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setUploading(false);
      alert("❌ Dosya okuma sırasında bir hata oluştu.");
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
      <header className="bg-[#1a2d42] border-b border-[#12202f] px-4 py-2.5 flex flex-wrap items-center justify-between shadow-md z-[400] relative select-none text-white">

        {/* SOL: Logo ve Kurumsal Başlık */}
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded h-9 w-9 flex items-center justify-center shadow-sm">
            <img
              src="https://static.wixstatic.com/media/0ded6e_0a74b2a1d6614c4b99998cde8a9d165c~mv2.png"
              alt="OSB Logo"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-[14px] font-bold tracking-wide leading-tight">OSB PARSEL BİLGİ SİSTEMİ</h1>
            <p className="text-[10px] text-gray-300">Coğrafi Bilgi Sistemi Yöneticisi</p>
          </div>
        </div>

        {/* ORTA & SAĞ: Aksiyon Butonları (Aksiyon Yeşili ve Beyaz Nötr) */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <input type="file" ref={fileInputRef} accept=".geojson,.json" onChange={handleFileUpload} className="hidden" />

          <button
            onClick={() => setIsUploadModalOpen(true)}
            disabled={uploading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded shadow-sm transition-colors ${uploading ? 'bg-gray-500 cursor-not-allowed' : 'bg-[#5cb85c] hover:bg-[#4cae4c] text-white cursor-pointer'
              }`}
          >
            <Upload size={16} /> <span className="hidden md:inline">{uploading ? 'İşleniyor...' : 'Parsel Sınırları Ekle'}</span>
          </button>

          <button
            onClick={handleFitBounds}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-[#1a2d42] text-sm font-bold rounded shadow-sm border border-gray-300 transition-colors cursor-pointer"
          >
            <Focus size={16} /> <span className="hidden md:inline">Sınırlara Odaklan</span>
          </button>

          <div className="w-px h-6 bg-gray-600 mx-1 hidden sm:block"></div>

          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-2 bg-[#3a87ad] hover:bg-[#2e6d8c] text-white px-4 py-2 rounded text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Database size={16} /> <span className="hidden sm:inline">Sistemi Yönet</span>
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
                  // Kurumsal Renk Paleti: Seçili ise Bordo/Kırmızı (#8b0000), normal ise CBS Mavisi (#3a87ad)
                  color: isSelected ? '#8b0000' : '#3a87ad',
                  fillColor: isSelected ? '#8b0000' : '#3a87ad',
                  fillOpacity: isSelected ? 0.3 : 0.15,
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
      {/* --- PARSEL YÜKLEME MODALI (POPUP) --- */}
      {/* --- PARSEL YÜKLEME MODALI (POPUP) --- */}
{isUploadModalOpen && (
  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
    <div className="bg-[#252526] border border-[#444] rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-gray-200">
      
      {/* Modal Başlığı */}
      <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1e1e1e]">
        <h3 className="font-bold flex items-center gap-2 text-blue-400">
          <Upload size={18} /> Parsel Sınırları Ekle
        </h3>
        <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer bg-[#333] hover:bg-rose-500 p-1 rounded transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Sekmeler */}
      <div className="flex border-b border-[#333] text-sm">
        <button 
          onClick={() => setManualInputStyle('tkgm')} 
          className={`flex-1 py-3 font-semibold transition-colors cursor-pointer ${manualInputStyle === 'tkgm' ? 'text-blue-400 border-b-2 border-blue-400 bg-[#2d2d2d]' : 'text-gray-400 hover:bg-[#2a2a2b]'}`}
        >
          TKGM Dosyası Ekle
        </button>
        <button 
          onClick={() => setManualInputStyle('geojson')} 
          className={`flex-1 py-3 font-semibold transition-colors cursor-pointer ${manualInputStyle === 'geojson' ? 'text-blue-400 border-b-2 border-blue-400 bg-[#2d2d2d]' : 'text-gray-400 hover:bg-[#2a2a2b]'}`}
        >
          GeoJSON Ekle
        </button>
        <button 
          onClick={() => setManualInputStyle('manual')} 
          className={`flex-1 py-3 font-semibold transition-colors cursor-pointer ${manualInputStyle === 'manual' ? 'text-blue-400 border-b-2 border-blue-400 bg-[#2d2d2d]' : 'text-gray-400 hover:bg-[#2a2a2b]'}`}
        >
          Manuel Koordinat Gir
        </button>
      </div>

      {/* İçerik */}
      <div className="p-6">
        
        {manualInputStyle === 'tkgm' && (
          <div className="text-center space-y-4">
            <div className="flex items-start gap-2 text-xs text-blue-400 bg-blue-500/10 p-3 rounded border border-blue-500/20 mb-4 text-left">
              <p>Tapu ve Kadastro Genel Müdürlüğü (TKGM) sisteminden indirdiğiniz <b>.json</b> veya <b>.kml</b> formatındaki parsel sınır dosyalarını buradan yükleyebilirsiniz.</p>
            </div>
            <div className="bg-[#1e1e1e] p-8 rounded-lg border border-dashed border-[#555] flex flex-col items-center justify-center">
              <Upload size={40} className="mb-3 text-gray-500" />
              <button 
                onClick={() => { setIsUploadModalOpen(false); fileInputRef.current?.click(); }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-md text-sm font-bold shadow-md cursor-pointer transition-colors"
              >
                TKGM Dosyası Seç (.json)
              </button>
            </div>
          </div>
        )}

        {manualInputStyle === 'geojson' && (
          <div className="text-center space-y-4">
             <div className="flex items-start gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded border border-emerald-500/20 mb-4 text-left">
              <p>QGIS, ArcGIS, NetCAD gibi CBS yazılımlarından dışa aktardığınız standart <b>.geojson</b> dosyalarınızı buradan yükleyebilirsiniz.</p>
            </div>
            <div className="bg-[#1e1e1e] p-8 rounded-lg border border-dashed border-[#555] flex flex-col items-center justify-center">
              <Upload size={40} className="mb-3 text-gray-500" />
              <button 
                onClick={() => { setIsUploadModalOpen(false); fileInputRef.current?.click(); }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-md text-sm font-bold shadow-md cursor-pointer transition-colors"
              >
                GeoJSON Dosyası Seç
              </button>
            </div>
          </div>
        )}

        {manualInputStyle === 'manual' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 p-3 rounded border border-amber-500/20">
              <Database size={16} className="shrink-0 mt-0.5" />
              <p>El ile koordinat girebilir veya ham GeoJSON kodunuzu buraya yapıştırabilirsiniz. <span className="text-gray-300 font-mono">Polygon</span> formatında olmalıdır.</p>
            </div>
            
            <textarea 
              className="w-full h-48 bg-[#151515] border border-[#444] rounded-md p-3 text-xs font-mono text-gray-300 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none custom-scrollbar"
              placeholder='Örnek: { "type": "Polygon", "coordinates": [ [ [32.85, 39.92], [32.86, 39.92], [32.86, 39.93], [32.85, 39.92] ] ] }'
              value={manualGeoJson}
              onChange={(e) => setManualGeoJson(e.target.value)}
            ></textarea>
            
            <div className="flex justify-end gap-3 mt-2">
              <button 
                onClick={() => setIsUploadModalOpen(false)} 
                className="px-5 py-2 bg-[#333] hover:bg-[#444] text-gray-300 rounded-md text-sm font-semibold cursor-pointer transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleManualSubmit}
                disabled={uploading}
                className={`px-6 py-2.5 rounded-md text-sm font-bold shadow-md transition-colors ${
                  uploading ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                }`}
              >
                {uploading ? 'İşleniyor...' : 'Koordinatları Haritaya Ekle'}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  </div>
)}


    </div>
  );
}