import React from 'react';
import ParcelMap from './components/ParcelMap';
import { Map as MapIcon } from 'lucide-react';

function App() {
  return (
    <div className="h-screen w-screen bg-[#1e1e1e] flex flex-col font-sans overflow-hidden text-gray-200">
      {/* AutoCAD Stili Koyu Tema Başlık (Header) */}
      <header className="bg-[#252526] border-b border-[#333] px-4 py-2 flex items-center justify-between shadow-md z-10 select-none">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-1.5 rounded-md shadow-sm">
            <MapIcon size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-gray-100">OSB PARSEL BİLGİ SİSTEMİ</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">CAD Viewport v1.0</p>
          </div>
        </div>
        <div className="text-xs text-gray-500 font-mono hidden sm:block">
          Koordinat Sistemi: EPSG:4326 (WGS84)
        </div>
      </header>
      
      {/* Harita / Çalışma Alanı (Workspace) */}
      <main className="flex-1 relative w-full h-full">
        <ParcelMap />
      </main>
    </div>
  );
}

export default App;