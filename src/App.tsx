// src/App.tsx
import React, { useState } from 'react';
import ParcelMap from './components/ParcelMap';
import ManagementPanel from './components/ManagementPanel';
import ParcelSidebar from './components/ParcelSidebar'; // YENİ: Sidebar'ı içe aktardık
import { Database } from 'lucide-react';

function App() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [initialEditId, setInitialEditId] = useState<string | null>(null);
  
  // YENİ: Haritada tıklanan parselin tüm verisini tutacak State
  const [selectedParcelData, setSelectedParcelData] = useState<any | null>(null);

  // Sidebar'dan (veya başka yerden) "Detayları Yönet" butonuna basıldığında
  const handleEditParcel = (id: string) => {
    setInitialEditId(id);
    setShowAdminPanel(true);
  };

  const handleCloseAdmin = () => {
    setShowAdminPanel(false);
    setInitialEditId(null);
    // Panel kapanınca yan paneldeki seçimi de temizlemek isterseniz:
    // setSelectedParcelData(null); 
  };

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] flex flex-col font-sans overflow-hidden text-gray-200">
      <header className="bg-[#252526] border-b border-[#333] px-4 py-2 flex items-center justify-between shadow-md z-10 select-none">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-md shadow-sm h-10 w-10 flex items-center justify-center">
            <img 
              src="https://static.wixstatic.com/media/0ded6e_0a74b2a1d6614c4b99998cde8a9d165c~mv2.png" 
              alt="OSB Logo" 
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-gray-100">OSB PARSEL BİLGİ SİSTEMİ</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">CAD Viewport v1.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500 font-mono hidden sm:block">
            Koordinat Sistemi: EPSG:4326 (WGS84)
          </div>
          <button 
            onClick={() => setShowAdminPanel(true)}
            className="flex items-center gap-2 bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded text-xs font-semibold border border-[#555] transition-colors cursor-pointer"
          >
            <Database size={14} /> Yönetim Paneli
          </button>
        </div>
      </header>
      
      <main className="flex-1 relative w-full h-full">
        
        {/* YENİ: Haritaya artık seçili ID'yi ve tıklama fonksiyonunu gönderiyoruz */}
        <ParcelMap 
          onEditParcel={handleEditParcel} 
          onSelectParcel={setSelectedParcelData} 
          selectedParcelId={selectedParcelData?.id || null} 
        />
        
        {/* YENİ: Seçili bir parsel varsa Sol Panel açılır */}
        {selectedParcelData && (
          <ParcelSidebar 
            parcel={selectedParcelData} 
            onClose={() => setSelectedParcelData(null)} 
            onManage={() => handleEditParcel(selectedParcelData.id)}
          />
        )}

        {showAdminPanel && (
          <ManagementPanel onClose={handleCloseAdmin} initialEditId={initialEditId} />
        )}
      </main>
    </div>
  );
}

export default App;