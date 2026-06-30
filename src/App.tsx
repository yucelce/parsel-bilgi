// src/App.tsx
import React, { useState } from 'react';
import ParcelMap from './components/ParcelMap';
import ManagementPanel from './components/ManagementPanel';
import ParcelSidebar from './components/ParcelSidebar';

function App() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [initialEditId, setInitialEditId] = useState<string | null>(null);
  
  // Haritada tıklanan parselin tüm verisini tutacak State
  const [selectedParcelData, setSelectedParcelData] = useState<any | null>(null);

  // Sidebar'dan (veya başka yerden) "Detayları Yönet" butonuna basıldığında
  const handleEditParcel = (id: string) => {
    setInitialEditId(id);
    setShowAdminPanel(true);
  };

  const handleCloseAdmin = () => {
    setShowAdminPanel(false);
    setInitialEditId(null);
  };

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] flex flex-col font-sans overflow-hidden text-gray-200">
      
      <main className="flex-1 relative w-full h-full overflow-hidden">
        
        {/* Haritaya seçili ID'yi, tıklama fonksiyonunu ve Yönetim Panelini açma tetikleyicisini gönderiyoruz */}
        <ParcelMap 
          onEditParcel={handleEditParcel} 
          onSelectParcel={setSelectedParcelData} 
          selectedParcelId={selectedParcelData?.id || null} 
          onOpenAdmin={() => setShowAdminPanel(true)}
        />
        
        {/* Seçili bir parsel varsa Sol Panel açılır */}
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