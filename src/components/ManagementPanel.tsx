// src/components/ManagementPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Plus, Building, Users, Phone, Mail, FileCheck, Trash2 } from 'lucide-react';

export default function ManagementPanel({ onClose, initialEditId }: { onClose: () => void, initialEditId?: string | null }) {
  const [parcels, setParcels] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<any | null>(null);
  const hasInitializedEdit = useRef(false);

  // YENİ EKLENEN: Kişi/Firma Merkezi Yönetim State'leri
  const [isModalOpen, setIsModalOpen] = useState(false);
// Atama Hedefi: 'structure' (Bina) veya 'parcel' (Arsa) olabilir
  const [assignTarget, setAssignTarget] = useState<{type: 'parcel'|'structure', id: string} | null>(null);
  const [sharePercentage, setSharePercentage] = useState<number>(100); // Parsel hissedarlığı için
  
  const [entitiesList, setEntitiesList] = useState<any[]>([]); // Veritabanındaki tüm kişi/firmalar
  const [modalMode, setModalMode] = useState<'select' | 'create'>('select'); // Form modu
  const [selectedEntityId, setSelectedEntityId] = useState<string>(''); // Seçim modu state'i
  
  // Yeni ekleme modu için state
  const [entityForm, setEntityForm] = useState({
    type: 'Şirket',
    name: '',
    tc_vkn: '',
    tax_office: '',
    phone: '',
    email: '',
  });

  // Ortak ilişki verileri
  const [linkForm, setLinkForm] = useState({
    role: 'Kiracı',
    has_work_license: false
  });

  const fetchParcels = () => {
    fetch('/api/parcels')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setParcels(data);
          if (selectedParcel) {
            setSelectedParcel(data.find((p: any) => p.id === selectedParcel.id) || null);
          }
        }
      })
      .catch(err => console.error(err));
  };

  const fetchEntities = () => {
    fetch('/api/entities')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEntitiesList(data);
        }
      })
      .catch(err => console.error(err));
  };

  // YENİ EKLENEN: Parsel Silme Fonksiyonu
  const deleteParcel = async (id: string) => {
    if (!window.confirm('Bu parseli ve içindeki tüm bina/firma kayıtlarını kalıcı olarak silmek istediğinize emin misiniz?')) {
      return;
    }
    
    try {
      await fetch(`/api/parcels/${id}`, { method: 'DELETE' });
      setSelectedParcel(null); // Seçili parsel ekranını kapat
      fetchParcels(); // Listeyi yenile
    } catch (err) {
      console.error("Silme hatası:", err);
      alert("Parsel silinirken bir hata oluştu.");
    }
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

 

  useEffect(() => {
    fetchParcels();
    fetchEntities(); // Panel açıldığında tüm paydaşları da getir
  }, []);

  // Formu açan fonksiyon
 
  const openAssignModal = (type: 'parcel' | 'structure', targetId: string) => {
    setAssignTarget({ type, id: targetId });
    setModalMode('select');
    setSelectedEntityId('');
    setEntityForm({ type: 'Şirket', name: '', tc_vkn: '', tax_office: '', phone: '', email: '' });
    setLinkForm({ role: 'Kiracı', has_work_license: false });
    setSharePercentage(100);
    setIsModalOpen(true);
  };

  // YENİ EKLENEN: Formu veritabanına kaydeden fonksiyon (Güvenli Versiyon)
  const handleSaveOccupant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget) return;

    let targetEntityId = selectedEntityId;

    try {
      if (modalMode === 'create') {
        const entityRes = await fetch('/api/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entityForm)
        });
        if (!entityRes.ok) throw new Error("Firma/Kişi kaydedilirken hata oluştu.");
        const entityData = await entityRes.json();
        targetEntityId = entityData.id;
      }

      if (!targetEntityId) {
        alert("Lütfen listeden bir firma/kişi seçin veya yeni ekleyin.");
        return;
      }

      // HEDEFE GÖRE DOĞRU API'YE İSTEK AT
      if (assignTarget.type === 'structure') {
        const linkRes = await fetch('/api/structure-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structure_id: assignTarget.id, entity_id: targetEntityId, role: linkForm.role, has_work_license: linkForm.has_work_license })
        });
        if (!linkRes.ok) throw new Error("Binaya atama yapılamadı.");
      } 
      else if (assignTarget.type === 'parcel') {
        const linkRes = await fetch('/api/parcel-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcel_id: assignTarget.id, entity_id: targetEntityId, share_percentage: sharePercentage })
        });
        if (!linkRes.ok) throw new Error("Parsele arsa sahibi atanamadı.");
      }
      
      setIsModalOpen(false);
      fetchParcels(); 
      fetchEntities(); 
      
    } catch (err: any) {
      console.error(err);
      alert(`HATA: ${err.message}`);
    }
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
                <div className="flex gap-2">
                  <button 
                    onClick={() => deleteParcel(selectedParcel.id)} 
                    className="flex items-center gap-1 bg-red-600/90 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors shadow-sm"
                  >
                    <Trash2 size={16} /> Sil
                  </button>
                  <button onClick={addStructure} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors shadow-sm">
                    <Plus size={16} /> Yeni Bina/Yapı Ekle
                  </button>
                </div>
              </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                
                {/* ---------------- BURADAN İTİBAREN YAPIŞTIRIN ---------------- */}
                {/* ARSA SAHİPLERİ (MALİKLER) BÖLÜMÜ */}
                <div className="bg-[#252526] border border-[#333] rounded-lg p-3 shadow-md mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-200 flex items-center gap-2">
                      <Users size={18} className="text-purple-400"/> Arsa Sahipleri (Tapu/Tahsis)
                    </h4>
                    <button 
                      onClick={() => openAssignModal('parcel', selectedParcel.id)} 
                      className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors shadow-sm"
                    >
                      <Plus size={14} /> Malik Ata
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {(!selectedParcel.owners || selectedParcel.owners.length === 0) && (
                      <p className="text-xs text-gray-500 italic text-center p-2">Bu parsele henüz arsa sahibi atanmamış.</p>
                    )}
                    {selectedParcel.owners?.map((owner: any) => (
                      <div key={owner.id} className="bg-[#1e1e1e] border border-[#444] rounded p-2 text-sm flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-100">{owner.name}</span>
                          <span className="ml-2 text-xs text-gray-400">({owner.type})</span>
                        </div>
                        <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                          Hisse: %{owner.share_percentage}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* AYIRICI ÇİZGİ VE BİNALAR BÖLÜMÜ BAŞLANGICI */}
                <div className="border-t border-[#333] pt-4 mb-4">
                  <h4 className="font-bold text-gray-200 flex items-center gap-2 mb-3">
                     Binalar ve Tesisler
                  </h4>
                </div>
                {/* ---------------- BURAYA KADAR YAPIŞTIRIN ---------------- */}

                {selectedParcel.structures?.length === 0 && (
                  <div className="text-center text-gray-500 py-10 bg-[#1e1e1e] rounded-lg border border-dashed border-[#444]">
                     Bu parselde henüz kayıtlı yapı/bina bulunmuyor.<br/>Sağ üstteki yeşil butondan ekleyebilirsiniz.
                  </div>
                )}
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
                        onClick={() => openAssignModal('structure', structure.id)} 
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
          {/* YENİ FİRMA / İLETİŞİM BİLGİSİ EKLEME MODALI */}
          {isModalOpen && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#252526] border border-[#444] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1e1e1e]">
                  <h3 className="font-bold text-gray-100 flex items-center gap-2">
                    <Users size={18} className="text-blue-400" /> Binaya Malik / Kiracı Ata
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSaveOccupant} className="p-5 space-y-4">
                  
                  {/* MOD SEÇİCİ (SEKME GÖRÜNÜMÜ) */}
                  <div className="flex bg-[#1e1e1e] p-1 rounded border border-[#444] mb-4">
                    <button type="button" onClick={() => setModalMode('select')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${modalMode === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Sistemden Seç</button>
                    <button type="button" onClick={() => setModalMode('create')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${modalMode === 'create' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Sisteme Yeni Ekle</button>
                  </div>

                  {modalMode === 'select' ? (
                    // VAR OLAN FİRMAYI SEÇME EKRANI
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Kayıtlı Paydaş (Kişi/Firma) Seçin</label>
                      <select 
                        required={modalMode === 'select'}
                        className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none focus:border-blue-500"
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                      >
                        <option value="">-- Listeden Seçin --</option>
                        {entitiesList.map(ent => (
                          <option key={ent.id} value={ent.id}>
                            {ent.name} ({ent.tc_vkn ? `TC/VKN: ${ent.tc_vkn}` : 'TC/VKN Yok'})
                          </option>
                        ))}
                      </select>
                      {entitiesList.length === 0 && <p className="text-xs text-orange-400 mt-1">Sistemde hiç kayıt yok. Lütfen "Yeni Ekle" sekmesini kullanın.</p>}
                    </div>
                  ) : (
                    // YENİ FİRMA YARATMA EKRANI
                    <div className="space-y-3 bg-[#1e1e1e] p-3 rounded border border-[#333]">
                      <div className="flex gap-4 mb-2">
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                          <input type="radio" checked={entityForm.type === 'Şirket'} onChange={() => setEntityForm({...entityForm, type: 'Şirket'})} /> Şirket (Tüzel)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                          <input type="radio" checked={entityForm.type === 'Kişi'} onChange={() => setEntityForm({...entityForm, type: 'Kişi'})} /> Şahıs (Gerçek)
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Unvan / Ad Soyad</label>
                        <input required={modalMode === 'create'} type="text" className="w-full bg-[#252526] border border-[#444] rounded p-1.5 text-white text-sm outline-none" value={entityForm.name} onChange={e => setEntityForm({...entityForm, name: e.target.value})} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">{entityForm.type === 'Şirket' ? 'Vergi Kimlik No' : 'TC Kimlik No'}</label>
                          <input type="text" className="w-full bg-[#252526] border border-[#444] rounded p-1.5 text-white text-sm outline-none" value={entityForm.tc_vkn} onChange={e => setEntityForm({...entityForm, tc_vkn: e.target.value})} />
                        </div>
                        {entityForm.type === 'Şirket' && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1">Vergi Dairesi</label>
                            <input type="text" className="w-full bg-[#252526] border border-[#444] rounded p-1.5 text-white text-sm outline-none" value={entityForm.tax_office} onChange={e => setEntityForm({...entityForm, tax_office: e.target.value})} />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">Telefon Numarası</label>
                          <input type="text" className="w-full bg-[#252526] border border-[#444] rounded p-1.5 text-white text-sm outline-none" value={entityForm.phone} onChange={e => setEntityForm({...entityForm, phone: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">E-Posta Adresi</label>
                          <input type="email" className="w-full bg-[#252526] border border-[#444] rounded p-1.5 text-white text-sm outline-none" value={entityForm.email} onChange={e => setEntityForm({...entityForm, email: e.target.value})} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BU BİNA İÇİN GEÇERLİ OLACAK ROL VE RUHSAT (ORTAK ALAN) */}
                 {/* HEDEFE GÖRE DEĞİŞEN ALT FORM KISMI */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#333]">
                    {assignTarget?.type === 'structure' ? (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">Bu Binadaki Rolü</label>
                          <select className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none" value={linkForm.role} onChange={e => setLinkForm({...linkForm, role: e.target.value})}>
                            <option value="Kiracı">Kiracı</option>
                            <option value="Malik">Mülk Sahibi (Malik)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">Çalışma Ruhsatı</label>
                          <select className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none" value={linkForm.has_work_license ? "true" : "false"} onChange={e => setLinkForm({...linkForm, has_work_license: e.target.value === "true"})}>
                            <option value="false">Yok / Alınmadı</option>
                            <option value="true">Var (Aktif)</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Hisse Oranı (%)</label>
                        <input type="number" min="1" max="100" className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-sm outline-none focus:border-blue-500" value={sharePercentage} onChange={e => setSharePercentage(Number(e.target.value))} />
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-2 border-t border-[#333] flex justify-end gap-2">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors">İptal</button>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold shadow-md transition-colors">Kaydet & Ata</button>
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