// src/components/ManagementPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Plus, Building, Users, Phone, Mail, FileCheck } from 'lucide-react';

export default function ManagementPanel({ onClose, initialEditId }: { onClose: () => void, initialEditId?: string | null }) {
  const [parcels, setParcels] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<any | null>(null);
  const hasInitializedEdit = useRef(false);

  // YENİ EKLENEN: Kişi/Firma Ekleme Formu (Modal) için state (durum) yönetimi
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStructureId, setActiveStructureId] = useState<string | null>(null);
  const [occupantForm, setOccupantForm] = useState({
    name: '',
    role: 'Kiracı',
    phone: '',
    email: '',
    has_work_license: false
  });

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
    const name = prompt("Bina/Yapı Adı (Örn: A Blok, İdari Bina, Depo):");
    if (!name || !selectedParcel) return;
    
    await fetch('/api/structures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcel_id: selectedParcel.id, name, building_type: 'Bina' })
    });
    fetchParcels();
  };

  // YENİ EKLENEN: Formu açan fonksiyon
  const openOccupantModal = (structureId: string) => {
    setActiveStructureId(structureId);
    setOccupantForm({ name: '', role: 'Kiracı', phone: '', email: '', has_work_license: false }); // Formu sıfırla
    setIsModalOpen(true);
  };

  // YENİ EKLENEN: Formu veritabanına kaydeden fonksiyon
  const handleSaveOccupant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStructureId) return;

    await fetch('/api/occupants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        structure_id: activeStructureId, 
        name: occupantForm.name, 
        role: occupantForm.role, 
        phone: occupantForm.phone, 
        email: occupantForm.email, 
        has_work_license: occupantForm.has_work_license 
      })
    });
    
    setIsModalOpen(false);
    fetchParcels(); // Verileri yenile
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
          <p className="text-sm text-gray-400">Parselleri, Binaları, İletişim Bilgilerini ve Ruhsatları yönetin.</p>
        </div>
        <button onClick={onClose} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden relative">
        
        {/* SOL TARAF: PARSEL LİSTESİ */}
        <div className="w-1/3 flex flex-col border border-[#333] rounded-lg bg-[#252526] overflow-hidden">
          <div className="p-3 border-b border-[#333]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Ada/Parsel veya İsim Ara..."
                className="w-full bg-[#1e1e1e] border border-[#444] text-sm rounded pl-9 p-2 text-white outline-none focus:border-blue-500 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredParcels.map(parcel => (
              <div 
                key={parcel.id} 
                onClick={() => setSelectedParcel(parcel)}
                className={`p-3 border-b border-[#333] cursor-pointer transition-colors ${selectedParcel?.id === parcel.id ? 'bg-blue-900/30 border-l-4 border-l-blue-500' : 'hover:bg-[#2a2a2b]'}`}
              >
                <h3 className="font-bold text-gray-200">{parcel.ada_parsel ? `Ada/Parsel: ${parcel.ada_parsel}` : parcel.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{parcel.structures?.length || 0} Yapı, {parcel.structures?.reduce((sum: number, s: any) => sum + (s.occupants?.length || 0), 0) || 0} Firma Kayıtlı</p>
              </div>
            ))}
          </div>
        </div>

        {/* SAĞ TARAF: DETAYLAR (BİNALAR VE İLETİŞİM BİLGİLERİ) */}
        <div className="w-2/3 flex flex-col border border-[#333] rounded-lg bg-[#252526] overflow-hidden relative">
          {selectedParcel ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1e1e1e]">
                <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                  Seçili Parsel: {selectedParcel.ada_parsel || selectedParcel.name}
                </h3>
                <button onClick={addStructure} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors shadow-sm">
                  <Plus size={16} /> Yeni Bina/Yapı Ekle
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                {selectedParcel.structures?.length === 0 && (
                  <div className="text-center text-gray-500 py-10 bg-[#1e1e1e] rounded-lg border border-dashed border-[#444]">
                    Bu parselde henüz kayıtlı yapı/bina bulunmuyor.<br/>Sağ üstteki yeşil butondan ekleyebilirsiniz.
                  </div>
                )}
                {selectedParcel.structures?.map((structure: any) => (
                  <div key={structure.id} className="bg-[#1e1e1e] border border-[#444] rounded-lg overflow-hidden shadow-sm">
                    <div className="flex justify-between items-center p-3 bg-[#222] border-b border-[#444]">
                      <h4 className="font-bold text-gray-200 flex items-center gap-2">
                        <Building size={18} className="text-gray-400"/> {structure.name}
                      </h4>
                      <button 
                        onClick={() => openOccupantModal(structure.id)} 
                        className="flex items-center gap-1 bg-[#333] hover:bg-[#444] border border-[#555] text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Users size={14} /> Malik/Kiracı Ekle
                      </button>
                    </div>
                    
                    <div className="p-3 space-y-3">
                      {structure.occupants?.length === 0 && <p className="text-xs text-gray-500 italic p-2 text-center">Bu yapıda kayıtlı kişi/firma yok.</p>}
                      {structure.occupants?.map((occupant: any) => (
                        <div key={occupant.id} className="bg-[#2a2a2b] border border-[#3c3c3c] rounded p-3 text-sm flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-gray-100 text-base">{occupant.name}</span>
                              <span className={`ml-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${occupant.role === 'Malik' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                                {occupant.role}
                              </span>
                            </div>
                            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${occupant.has_work_license ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                              <FileCheck size={14} /> Ruhsat: {occupant.has_work_license ? 'Var' : 'Yok'}
                            </span>
                          </div>
                          
                          {/* İLETİŞİM BİLGİLERİ KISMI */}
                          <div className="flex gap-4 mt-1 pt-2 border-t border-[#3c3c3c]">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Phone size={12} className="text-gray-500"/> 
                              {occupant.phone || <span className="text-gray-600 italic">Girilemedi</span>}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Mail size={12} className="text-gray-500"/> 
                              {occupant.email || <span className="text-gray-600 italic">Girilemedi</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e]">
              <Search size={48} className="text-[#333] mb-4" />
              <p>Detayları görmek için soldan bir parsel seçin.</p>
            </div>
          )}

          {/* YENİ EKLENEN: FİRMA / İLETİŞİM BİLGİSİ EKLEME MODALI */}
          {isModalOpen && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#252526] border border-[#444] rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1e1e1e]">
                  <h3 className="font-bold text-gray-100 flex items-center gap-2">
                    <Users size={18} className="text-blue-400" /> Kişi veya Firma Ekle
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSaveOccupant} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Unvan / Ad Soyad</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="Örn: X Otomotiv San. Tic. A.Ş."
                      className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      value={occupantForm.name} 
                      onChange={e => setOccupantForm({...occupantForm, name: e.target.value})} 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Rol (Malik / Kiracı)</label>
                      <select 
                        className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none focus:border-blue-500"
                        value={occupantForm.role} 
                        onChange={e => setOccupantForm({...occupantForm, role: e.target.value})}
                      >
                        <option value="Kiracı">Kiracı</option>
                        <option value="Malik">Mülk Sahibi (Malik)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Çalışma Ruhsatı</label>
                      <select 
                        className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none focus:border-blue-500"
                        value={occupantForm.has_work_license ? "true" : "false"} 
                        onChange={e => setOccupantForm({...occupantForm, has_work_license: e.target.value === "true"})}
                      >
                        <option value="false">Yok / Alınmadı</option>
                        <option value="true">Var (Aktif)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Telefon Numarası</label>
                    <input 
                      type="text" 
                      placeholder="Örn: 0224 123 45 67"
                      className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none focus:border-blue-500"
                      value={occupantForm.phone} 
                      onChange={e => setOccupantForm({...occupantForm, phone: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">E-Posta Adresi</label>
                    <input 
                      type="email" 
                      placeholder="Örn: info@firma.com"
                      className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none focus:border-blue-500"
                      value={occupantForm.email} 
                      onChange={e => setOccupantForm({...occupantForm, email: e.target.value})} 
                    />
                  </div>

                  <div className="pt-3 mt-2 border-t border-[#333] flex justify-end gap-2">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                      İptal
                    </button>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold shadow-md transition-colors">
                      Kaydet
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}