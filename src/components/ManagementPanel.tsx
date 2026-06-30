// src/components/ManagementPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Plus, Building, Users } from 'lucide-react';

export default function ManagementPanel({ onClose, initialEditId }: { onClose: () => void, initialEditId?: string | null }) {
  const [parcels, setParcels] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<any | null>(null);
  const hasInitializedEdit = useRef(false);

  const fetchParcels = () => {
    fetch('/api/parcels')
      .then(res => res.json())
      .then(data => {
        setParcels(data);
        if (selectedParcel) {
          setSelectedParcel(data.find((p: any) => p.id === selectedParcel.id));
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  useEffect(() => {
    if (initialEditId && parcels.length > 0 && !hasInitializedEdit.current) {
      const parcelToEdit = parcels.find(p => p.id === initialEditId);
      if (parcelToEdit) {
        setSelectedParcel(parcelToEdit);
        hasInitializedEdit.current = true;
      }
    }
  }, [initialEditId, parcels]);

  const addStructure = async () => {
    const name = prompt("Bina/Yapı Adı (Örn: A Blok):");
    if (!name || !selectedParcel) return;
    
    await fetch('/api/structures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcel_id: selectedParcel.id, name, building_type: 'Fabrika' })
    });
    fetchParcels();
  };

  const addOccupant = async (structureId: string) => {
    const name = prompt("Firma / Kişi Adı:");
    if (!name) return;
    const role = confirm("Bu kişi Malik mi? (İptal derseniz Kiracı olur)") ? "Malik" : "Kiracı";
    
    await fetch('/api/occupants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structure_id: structureId, name, role, phone: '', email: '', has_work_license: false })
    });
    fetchParcels();
  };

  const filteredParcels = parcels.filter(p => 
    (p.ada_parsel || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="absolute inset-0 bg-[#1e1e1e]/95 z-[999] p-6 flex flex-col overflow-hidden backdrop-blur-sm">
      <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Gelişmiş Tesis Yönetim Paneli</h2>
          <p className="text-sm text-gray-400">Parselleri, Binaları ve Firmaları yönetin.</p>
        </div>
        <button onClick={onClose} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><X size={24} /></button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* SOL TARAF: PARSEL LİSTESİ */}
        <div className="w-1/3 flex flex-col border border-[#333] rounded-lg bg-[#252526] overflow-hidden">
          <div className="p-3 border-b border-[#333]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Parsel Ara..."
                className="w-full bg-[#1e1e1e] border border-[#444] text-sm rounded pl-9 p-2 text-white outline-none focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredParcels.map(parcel => (
              <div 
                key={parcel.id} 
                onClick={() => setSelectedParcel(parcel)}
                className={`p-3 border-b border-[#333] cursor-pointer transition-colors ${selectedParcel?.id === parcel.id ? 'bg-blue-900/30 border-l-4 border-l-blue-500' : 'hover:bg-[#2a2a2b]'}`}
              >
                <h3 className="font-bold text-gray-200">{parcel.ada_parsel ? `Ada/Parsel: ${parcel.ada_parsel}` : parcel.name}</h3>
                <p className="text-xs text-gray-500">{parcel.structures?.length || 0} Yapı Kayıtlı</p>
              </div>
            ))}
          </div>
        </div>

        {/* SAĞ TARAF: DETAYLAR (BİNALAR VE FİRMALAR) */}
        <div className="w-2/3 flex flex-col border border-[#333] rounded-lg bg-[#252526] overflow-hidden">
          {selectedParcel ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1e1e1e]">
                <h3 className="text-lg font-bold text-blue-400">
                  Seçili Parsel: {selectedParcel.ada_parsel || selectedParcel.name}
                </h3>
                <button onClick={addStructure} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-semibold">
                  <Plus size={16} /> Yeni Bina/Yapı Ekle
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedParcel.structures?.length === 0 && (
                  <div className="text-center text-gray-500 py-10">Bu parselde henüz kayıtlı yapı bulunmuyor.</div>
                )}
                {selectedParcel.structures?.map((structure: any) => (
                  <div key={structure.id} className="bg-[#1e1e1e] border border-[#444] rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3 border-b border-[#333] pb-2">
                      <h4 className="font-bold text-gray-200 flex items-center gap-2"><Building size={18} className="text-gray-400"/> {structure.name}</h4>
                      <button onClick={() => addOccupant(structure.id)} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-semibold">
                        <Users size={14} /> Malik/Kiracı Ekle
                      </button>
                    </div>
                    
                    <div className="space-y-2 pl-4 border-l-2 border-[#333]">
                      {structure.occupants?.length === 0 && <p className="text-xs text-gray-500 italic">Kayıtlı kişi/firma yok.</p>}
                      {structure.occupants?.map((occupant: any) => (
                        <div key={occupant.id} className="flex justify-between items-center bg-[#2a2a2b] p-2 rounded text-sm">
                          <div>
                            <span className="font-semibold text-gray-200">{occupant.name}</span>
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${occupant.role === 'Malik' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>
                              {occupant.role}
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className={occupant.has_work_license ? "text-green-400" : "text-red-400"}>
                              Ruhsat: {occupant.has_work_license ? 'VAR' : 'YOK'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Detayları görmek için soldan bir parsel seçin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}