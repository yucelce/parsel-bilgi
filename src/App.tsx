// src/App.tsx
import React, { useState } from 'react';
import ParcelMap from './components/ParcelMap';
import ManagementPanel from './components/ManagementPanel';
import ParcelSidebar from './components/ParcelSidebar';

function App() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [initialEditId, setInitialEditId] = useState<string | null>(null);
  const [selectedParcelData, setSelectedParcelData] = useState<any | null>(null);
  
  // YENİ: Harita ve verilerin güncellenmesini tetikleyecek state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEditParcel = (id: string) => {
    setInitialEditId(id);
    setShowAdminPanel(true);
  };

  const handleCloseAdmin = () => {
    setShowAdminPanel(false);
    setInitialEditId(null);
  };

  // YENİ: Yönetim panelinde bir şey değiştiğinde burası çalışır
  const handleDataChanged = (deletedParcelId?: string) => {
    setRefreshTrigger(prev => prev + 1); // Haritayı yenilenmeye zorla
    
    // Eğer silinen parsel, şu an solda açık olan parsel ise sol paneli kapat
    if (deletedParcelId && selectedParcelData?.id === deletedParcelId) {
      setSelectedParcelData(null);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] flex flex-col font-sans overflow-hidden text-slate-200">
      <main className="flex-1 relative w-full h-full overflow-hidden">
        
        <ParcelMap 
          onEditParcel={handleEditParcel} 
          onSelectParcel={setSelectedParcelData} 
          selectedParcelId={selectedParcelData?.id || null} 
          onOpenAdmin={() => setShowAdminPanel(true)}
          refreshTrigger={refreshTrigger} // YENİ: Tetikleyiciyi haritaya gönderdik
        />
        
        {selectedParcelData && (
          <ParcelSidebar 
            parcel={selectedParcelData} 
            onClose={() => setSelectedParcelData(null)} 
            onManage={() => handleEditParcel(selectedParcelData.id)}
          />
        )}

        {showAdminPanel && (
          <ManagementPanel 
            onClose={handleCloseAdmin} 
            initialEditId={initialEditId} 
            onDataChanged={handleDataChanged} // YENİ: Tetikleyici fonksiyonu gönderdik
          />
        )}
      </main>
    </div>
  );
}

export default App;