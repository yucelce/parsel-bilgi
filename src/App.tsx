import React from 'react';
import ParcelMap from './components/ParcelMap';

function App() {
  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Parsel Bilgi Sistemi</h1>
      <p className="mb-4 text-gray-600">Tamamen ücretsiz Leaflet haritası üzerinden parsellerinizi görüntüleyebilirsiniz.</p>
      
      {/* Harita Bileşenini Burada Çağırıyoruz */}
      <div className="border shadow-lg rounded-lg">
        <ParcelMap />
      </div>
    </div>
  );
}

export default App;