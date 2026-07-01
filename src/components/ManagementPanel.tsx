// src/components/ManagementPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  X, Search, Plus, Building, Users, Trash2, DoorOpen, ShieldAlert, BarChart3,
  CheckCircle2, AlertTriangle, Building2, Map, User
} from 'lucide-react';

interface ManagementPanelProps {
  onClose: () => void;
  initialEditId?: string | null;
  onDataChanged?: (deletedParcelId?: string) => void;
}

export default function ManagementPanel({ onClose, initialEditId, onDataChanged }: ManagementPanelProps) {
  // --- STATE TANIMLAMALARI ---
  const [parcels, setParcels] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<any | null>(null);
  const hasInitializedEdit = useRef(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ type: 'parcel' | 'unit', id: string } | null>(null);
  const [sharePercentage, setSharePercentage] = useState<number>(100);

  const [entitiesList, setEntitiesList] = useState<any[]>([]);
  const [modalMode, setModalMode] = useState<'select' | 'create'>('select');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  const [entityForm, setEntityForm] = useState({
    type: 'Şirket', name: '', tc_vkn: '', tax_office: '', phone: '', email: '',
  });

  const [linkForm, setLinkForm] = useState({ role: 'Kiracı', has_work_license: false });

  // --- API VERİ ÇEKME FONKSİYONLARI ---
  const fetchParcels = () => {
    fetch('/api/parcels')
      .then(res => {
        if (!res.ok) throw new Error("Parsel verileri çekilemedi.");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setParcels(data);
          if (selectedParcel) {
            const updated = data.find((p: any) => p.id === selectedParcel.id);
            if (updated) setSelectedParcel(updated);
          }
        }
      })
      .catch(err => console.error("Hata:", err));
  };

  const fetchEntities = () => {
    fetch('/api/entities').then(res => res.json()).then(data => {
        if (Array.isArray(data)) setEntitiesList(data);
      }).catch(err => console.error("Paydaş hatası:", err));
  };

  useEffect(() => { fetchParcels(); fetchEntities(); }, []);

  useEffect(() => {
    if (initialEditId && parcels.length > 0 && !hasInitializedEdit.current) {
      const parcelToEdit = parcels.find(p => p.id === initialEditId);
      if (parcelToEdit) { setSelectedParcel(parcelToEdit); hasInitializedEdit.current = true; }
    }
  }, [initialEditId, parcels]);

  // --- SİLME VE EKLEME EYLEMLERİ ---
  const deleteParcel = async (id: string) => {
    if (!window.confirm('DİKKAT! Bu parseli sildiğinizde içindeki tüm binalar, bağımsız bölümler ve ruhsat ilişkileri KALICI olarak silinecektir. Emin misiniz?')) return;
    try {
      const res = await fetch(`/api/parcels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedParcel(null); fetchParcels();
        if (onDataChanged) onDataChanged(id);
      } else alert("Parsel silinemedi.");
    } catch (err) { console.error(err); }
  };

  const addStructure = async () => {
    const name = prompt("Yeni Yapı/Bina Adı Giriniz (Örn: İdari Bina, Fabrika Hol-1, Depo):");
    if (!name || !selectedParcel) return;
    try {
      const res = await fetch('/api/structures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcel_id: selectedParcel.id, name, building_type: 'Bina' })
      });
      if (res.ok) fetchParcels();
    } catch (err) { console.error(err); }
  };

  const addIndependentUnit = async (structureId: string, structureName: string) => {
    const unitNo = prompt(`${structureName} içerisine eklenecek olan Bağımsız Bölüm Numarasını giriniz (Örn: 1, 3B, Z-02):`);
    if (!unitNo) return;
    const name = prompt(`No: ${unitNo} olan bu Bağımsız Bölümün NİTELİĞİ nedir?\n(Tapu/İskan belgesindeki gibi. Örn: Dükkan, İmalathane, Ofis):`, "İmalathane");
    if (!name) return;
    try {
      const res = await fetch('/api/independent-units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structure_id: structureId, name, unit_no: unitNo })
      });
      if (res.ok) fetchParcels();
    } catch (err) { console.error(err); }
  };

  const deleteStructure = async (id: string, name: string) => {
    if (!window.confirm(`'${name}' isimli yapıyı silmek istediğinize emin misiniz? (İçindeki tüm bölümler silinir!)`)) return;
    try {
      const res = await fetch(`/api/structures/${id}`, { method: 'DELETE' });
      if (res.ok) fetchParcels();
    } catch (err) { console.error(err); }
  };

  const deleteUnit = async (id: string, name: string) => {
    if (!window.confirm(`'${name}' isimli bağımsız bölümü silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/independent-units/${id}`, { method: 'DELETE' });
      if (res.ok) fetchParcels();
    } catch (err) { console.error(err); }
  };

  const removeOccupant = async (linkId: string, type: 'unit' | 'parcel') => {
    if (!window.confirm('Bu kişiyi/firmayı buradan kaldırmak istediğinize emin misiniz?')) return;
    try {
      const endpoint = type === 'unit' ? `/api/unit-entities/${linkId}` : `/api/parcel-entities/${linkId}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) fetchParcels();
    } catch (err) { console.error(err); }
  };

  // --- ATAMA MODAL YÖNETİMİ ---
  const openAssignModal = (type: 'parcel' | 'unit', targetId: string) => {
    setAssignTarget({ type, id: targetId });
    setModalMode('select');
    setSelectedEntityId('');
    setEntityForm({ type: 'Şirket', name: '', tc_vkn: '', tax_office: '', phone: '', email: '' });
    setLinkForm({ role: 'Kiracı', has_work_license: false });
    setSharePercentage(100);
    setIsModalOpen(true);
  };

  const handleSaveOccupant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget) return;

    let targetEntityId = selectedEntityId;
    try {
      if (modalMode === 'create') {
        const entityRes = await fetch('/api/entities', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entityForm)
        });
        if (!entityRes.ok) throw new Error("Yeni paydaş oluşturulamadı.");
        const entityData = await entityRes.json();
        targetEntityId = entityData.id;
      }

      if (!targetEntityId) { alert("Lütfen bir firma/kişi seçin veya yenisini oluşturun."); return; }

      if (assignTarget.type === 'unit') {
        const res = await fetch('/api/unit-entities', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_id: assignTarget.id, entity_id: targetEntityId, role: linkForm.role, has_work_license: linkForm.has_work_license })
        });
        if (!res.ok) throw new Error("Bağımsız bölüme atama başarısız.");
      }
      else if (assignTarget.type === 'parcel') {
        const res = await fetch('/api/parcel-entities', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcel_id: assignTarget.id, entity_id: targetEntityId, share_percentage: sharePercentage })
        });
        if (!res.ok) throw new Error("Mülk sahibi ataması başarısız.");
      }

      setIsModalOpen(false); fetchParcels(); fetchEntities();
    } catch (err: any) { alert(`Hata: ${err.message}`); }
  };

  const filteredParcels = parcels.filter(p => {
    const matchesSearch = (p.ada_parsel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const calculateStats = () => {
    if (!selectedParcel) return { totalStructures: 0, totalUnits: 0, totalOccupants: 0, licenseRate: 0 };
    let totalStructures = selectedParcel.structures?.length || 0;
    let totalUnits = 0, totalOccupants = 0, licensedOccupants = 0;

    selectedParcel.structures?.forEach((s: any) => {
      s.units?.forEach((u: any) => {
        totalUnits++;
        if (u.occupants) {
          totalOccupants += u.occupants.length;
          u.occupants.forEach((o: any) => { if (o.has_work_license) licensedOccupants++; });
        }
      });
    });

    let licenseRate = totalOccupants > 0 ? Math.round((licensedOccupants / totalOccupants) * 100) : 0;
    return { totalStructures, totalUnits, totalOccupants, licenseRate };
  };

  const stats = calculateStats();

  return (
    <div className="absolute inset-0 bg-gray-900/60 z-[999] p-2 md:p-4 lg:p-6 flex flex-col overflow-hidden backdrop-blur-sm select-none font-sans">

      {/* ÜST PANEL / HEADER */}
      <div className="flex justify-between items-center mb-4 bg-[#1a2d42] p-3 rounded-xl shadow-lg border border-[#1a2d42] shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded shadow-sm h-10 w-10 flex items-center justify-center border border-gray-300">
            <img 
              src="https://static.wixstatic.com/media/0ded6e_0a74b2a1d6614c4b99998cde8a9d165c~mv2.png" 
              alt="OSB Logo" 
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
              OSB Yönetim ve Denetim Paneli
            </h2>
            <p className="text-[10px] text-gray-300 font-normal tracking-wide mt-0.5">
              Organize Sanayi Bölgesi Mülkiyet, Yapı ve Ruhsat Kontrol Merkezi
            </p>
          </div>
        </div>
        
        <button onClick={onClose} className="px-3 py-1.5 bg-transparent hover:bg-white hover:text-[#1a2d42] text-white border border-white rounded transition-colors cursor-pointer font-bold flex items-center gap-1.5 shadow-sm text-xs">
          <X size={16} /> Kapat
        </button>
      </div>

      {/* ANA GÖVDE (3 KOLONA BÖLÜNDÜ) */}
      <div className="flex flex-1 gap-4 lg:gap-5 overflow-hidden relative">

        {/* 1. SÜTUN: PARSEL LİSTELEME */}
        <div className="w-[300px] shrink-0 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xl">
          <div className="p-3 border-b border-gray-200 bg-gray-50 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ada/Parsel No veya Tanım Ara..."
                className="w-full bg-white border border-gray-300 rounded p-2 pl-9 text-xs text-gray-800 outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad] transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            {filteredParcels.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Parsel bulunamadı.</div>
            ) : (
              filteredParcels.map(parcel => (
                <div
                  key={parcel.id}
                  onClick={() => setSelectedParcel(parcel)}
                  className={`p-3 border-b border-gray-100 cursor-pointer transition-all flex items-center group ${selectedParcel?.id === parcel.id ? 'bg-blue-50 border-l-4 border-l-[#3a87ad]' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex items-center gap-2">
                    <Map size={14} className={selectedParcel?.id === parcel.id ? "text-[#3a87ad]" : "text-gray-400"} />
                    <h3 className={`font-bold text-xs ${selectedParcel?.id === parcel.id ? "text-[#3a87ad]" : "text-[#1a2d42]"}`}>
                      {parcel.ada_parsel ? `Ada/Parsel: ${parcel.ada_parsel}` : parcel.name}
                    </h3>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedParcel ? (
          <>
            {/* 2. SÜTUN: MALİKLER VE ÖZET */}
            <div className="w-[320px] shrink-0 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xl">
              
              {/* Parsel Başlığı ve Aksiyonlar */}
              <div className="p-4 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#3a87ad] mb-0.5">
                  <Map size={12} /> Seçili Parsel
                </div>
                <h3 className="text-lg font-bold text-[#1a2d42] mb-3">
                  {selectedParcel.ada_parsel || selectedParcel.name}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteParcel(selectedParcel.id)}
                    className="flex-1 flex justify-center items-center gap-1.5 bg-white text-[#8b0000] border border-[#8b0000] hover:bg-[#8b0000] hover:text-white px-2 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    <Trash2 size={14} /> Sil
                  </button>
                  <button
                    onClick={addStructure}
                    className="flex-1 flex justify-center items-center gap-1.5 bg-[#5cb85c] hover:bg-[#4cae4c] text-white px-2 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus size={14} /> Yapı Ekle
                  </button>
                </div>
              </div>

              {/* İstatistikler */}
              <div className="p-3 bg-gray-50 border-b border-gray-200 text-sm shrink-0 grid grid-cols-2 gap-2">
                <div className="bg-white border border-gray-200 px-2 py-1.5 rounded shadow-sm text-center">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Fiziksel Yapı</div>
                  <div className="font-bold text-[#1a2d42] text-sm">{stats.totalStructures}</div>
                </div>
                <div className="bg-white border border-gray-200 px-2 py-1.5 rounded shadow-sm text-center">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Bağımsız Birim</div>
                  <div className="font-bold text-[#1a2d42] text-sm">{stats.totalUnits}</div>
                </div>
                <div className="bg-white border border-gray-200 px-2 py-1.5 rounded shadow-sm text-center">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Aktif İşletme</div>
                  <div className="font-bold text-[#1a2d42] text-sm">{stats.totalOccupants}</div>
                </div>
                <div className="bg-white border border-gray-200 px-2 py-1.5 rounded shadow-sm text-center">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Ruhsat Oranı</div>
                  <div className={`font-bold text-sm ${stats.licenseRate === 100 ? 'text-[#5cb85c]' : stats.licenseRate > 0 ? 'text-amber-500' : 'text-[#8b0000]'}`}>
                    %{stats.licenseRate}
                  </div>
                </div>
              </div>

              {/* Malikler Listesi */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-3 bg-[#3a87ad] text-white shrink-0">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} /> Arsa Malikleri
                  </h4>
                  <button
                    onClick={() => openAssignModal('parcel', selectedParcel.id)}
                    className="flex items-center gap-1 bg-white text-[#3a87ad] hover:bg-gray-100 px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus size={12} /> Ekle
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 custom-scrollbar">
                  {(!selectedParcel.owners || selectedParcel.owners.length === 0) ? (
                    <p className="text-xs text-gray-500 italic text-center py-4">Kayıtlı malik bulunmamaktadır.</p>
                  ) : (
                    selectedParcel.owners.map((owner: any) => (
                      <div key={owner.id} className="bg-white border border-gray-200 p-2.5 rounded shadow-sm flex flex-col gap-1.5 hover:border-[#3a87ad] transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-xs font-bold text-[#1a2d42]">{owner.name}</div>
                            <div className="text-[10px] text-gray-600 mt-0.5">{owner.type} {owner.tc_vkn && `| ${owner.tc_vkn}`}</div>
                          </div>
                          <button onClick={() => removeOccupant(owner.id, 'parcel')} className="text-gray-400 hover:text-[#8b0000] transition-colors p-1" title="Maliki Çıkar">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="text-[10px] font-bold text-[#3a87ad] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-block w-fit mt-1">
                          Hisse: %{owner.share_percentage}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 3. SÜTUN: YAPILAR VE BÖLÜMLER */}
            <div className="flex-1 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xl">
              <div className="p-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-2">
                <Building size={16} className="text-[#3a87ad]" />
                <h3 className="text-lg font-bold text-[#1a2d42]">Mimari Yapılar ve Tesisler</h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50 custom-scrollbar">
                {selectedParcel.structures?.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-10 border border-dashed border-gray-300 rounded bg-white">
                    Bu parsel üzerinde henüz fiziksel bir yapı (bina) tanımlanmamış. Sol panelden "Yapı Ekle" butonunu kullanabilirsiniz.
                  </div>
                ) : (
                  selectedParcel.structures.map((structure: any) => (
                    <div key={structure.id} className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
                      {/* Bina Başlığı */}
                      <div className="flex justify-between items-center p-2.5 bg-gray-100 border-b border-gray-200 group">
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm text-[#1a2d42] flex items-center gap-1.5">
                            <Building2 size={14} className="text-[#3a87ad]" /> {structure.name}
                          </h5>
                          <button onClick={() => deleteStructure(structure.id, structure.name)} className="text-gray-400 hover:text-[#8b0000] opacity-0 group-hover:opacity-100 transition-opacity" title="Yapıyı Sil">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <button
                          onClick={() => addIndependentUnit(structure.id, structure.name)}
                          className="flex items-center gap-1 bg-[#1a2d42] hover:bg-[#2c4c70] text-white px-2.5 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer shadow-sm"
                        >
                          <Plus size={12} /> B. Bölüm Ekle
                        </button>
                      </div>

                      {/* Bağımsız Bölümler */}
                      <div className="p-3 space-y-3 bg-gray-50">
                        {(!structure.units || structure.units.length === 0) ? (
                          <p className="text-xs text-gray-500 italic p-2.5 text-center border border-dashed border-gray-300 rounded bg-white">Bina içerisinde bağımsız bölüm kaydı yok.</p>
                        ) : (
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {structure.units.map((unit: any) => (
                              <div key={unit.id} className="bg-white border border-gray-200 rounded p-2.5 group/unit shadow-sm flex flex-col">
                                <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-gray-100 shrink-0">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <DoorOpen size={14} className="text-[#3a87ad]" />
                                    <span className="font-bold text-[#1a2d42]">No: {unit.unit_no}</span>
                                    <span className="text-gray-500 font-normal text-[10px]">({unit.name})</span>
                                    <button
                                      onClick={() => deleteUnit(unit.id, unit.name)}
                                      className="text-gray-400 hover:text-[#8b0000] opacity-0 group-hover/unit:opacity-100 transition-opacity ml-1"
                                      title="Bölümü Sil"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => openAssignModal('unit', unit.id)}
                                    className="flex items-center gap-1 text-[#3a87ad] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                  >
                                    <Plus size={10} /> İşletme Ata
                                  </button>
                                </div>

                                {/* Sakinler / İşletmeler */}
                                <div className="flex-1 flex flex-col justify-center">
                                  {(!unit.occupants || unit.occupants.length === 0) ? (
                                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500 bg-gray-50 py-3 rounded border border-dashed border-gray-200">
                                      <AlertTriangle size={12} className="text-amber-500" /> Tesis boş.
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {unit.occupants.map((occ: any) => (
                                        <div key={occ.id} className="bg-white border border-gray-200 p-2 rounded group/occ flex flex-col gap-1.5 hover:border-[#3a87ad] transition-colors">
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold text-[#1a2d42]">{occ.name}</span>
                                            </div>
                                            <button onClick={() => removeOccupant(occ.id, 'unit')} className="text-gray-400 hover:text-[#8b0000] opacity-0 group-hover/occ:opacity-100 transition-opacity p-0.5">
                                              <X size={14} />
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${occ.role === 'Malik' ? 'text-[#1a2d42] bg-gray-100 border-gray-300' : 'text-[#3a87ad] bg-blue-50 border-blue-200'}`}>
                                              {occ.role}
                                            </span>
                                            <div className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${occ.has_work_license ? 'text-[#5cb85c] bg-green-50 border-green-200' : 'text-[#8b0000] bg-red-50 border-red-200'}`}>
                                              {occ.has_work_license ? <><CheckCircle2 size={10}/> ONAYLI</> : <><ShieldAlert size={10}/> RUHSATSIZ</>}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 rounded-xl shadow-xl">
            <div className="bg-gray-50 p-6 rounded-full mb-4 border border-gray-200">
              <BarChart3 size={48} className="text-gray-300" />
            </div>
            <p className="text-base font-bold text-[#1a2d42]">Sistem Yönetimi</p>
            <p className="text-sm mt-1 text-gray-500">Detayları görüntülemek için sol menüden bir parsel seçin.</p>
          </div>
        )}

        {/* ATAMA VE YENİ PAYDAŞ OLUŞTURMA MODALI */}
        {isModalOpen && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden">

              <div className="p-4 bg-[#3a87ad] border-b border-[#3a87ad] flex justify-between items-center text-white">
                <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
                  <User size={16} />
                  {assignTarget?.type === 'unit' ? 'Bağımsız Bölüme Kiracı Ata' : 'Arsa Mülkiyetine Malik Ata'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer bg-white/10 hover:bg-white/20 p-1 rounded transition-colors"><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveOccupant} className="p-5 space-y-4 bg-gray-50">

                <div className="flex bg-gray-200 p-1 rounded text-xs font-bold">
                  <button type="button" onClick={() => setModalMode('select')} className={`flex-1 py-2 rounded transition-all cursor-pointer ${modalMode === 'select' ? 'bg-white text-[#1a2d42] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>Kayıtlı Kurumlardan Seç</button>
                  <button type="button" onClick={() => setModalMode('create')} className={`flex-1 py-2 rounded transition-all cursor-pointer ${modalMode === 'create' ? 'bg-white text-[#1a2d42] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>Sisteme Yeni Kurum Ekle</button>
                </div>

                {modalMode === 'select' ? (
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">Kurum / Şahıs Listesi</label>
                    <select
                      required={modalMode === 'select'}
                      className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 text-xs outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad] transition-all"
                      value={selectedEntityId}
                      onChange={(e) => setSelectedEntityId(e.target.value)}
                    >
                      <option value="">-- Veritabanından Seçim Yapın --</option>
                      {entitiesList.map(ent => (
                        <option key={ent.id} value={ent.id}>{ent.name} {ent.tc_vkn ? `[VKN: ${ent.tc_vkn}]` : ''}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3 bg-white p-4 rounded border border-gray-200 text-xs">
                    <div className="flex gap-4 mb-1">
                      <label className="flex items-center gap-1.5 text-gray-800 font-bold cursor-pointer">
                        <input type="radio" checked={entityForm.type === 'Şirket'} onChange={() => setEntityForm({ ...entityForm, type: 'Şirket' })} className="accent-[#3a87ad] w-3 h-3" /> Şirket (Tüzel)
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-800 font-bold cursor-pointer">
                        <input type="radio" checked={entityForm.type === 'Kişi'} onChange={() => setEntityForm({ ...entityForm, type: 'Kişi' })} className="accent-[#3a87ad] w-3 h-3" /> Şahıs (Gerçek)
                      </label>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-600 font-bold uppercase tracking-wide mb-1">Unvan / Tam Ad Soyad</label>
                      <input required={modalMode === 'create'} type="text" className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad] transition-all" value={entityForm.name} onChange={e => setEntityForm({ ...entityForm, name: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-600 font-bold uppercase tracking-wide mb-1">{entityForm.type === 'Şirket' ? 'Vergi Kimlik No' : 'TC Kimlik No'}</label>
                        <input type="text" className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad]" value={entityForm.tc_vkn} onChange={e => setEntityForm({ ...entityForm, tc_vkn: e.target.value })} />
                      </div>
                      {entityForm.type === 'Şirket' && (
                        <div>
                          <label className="block text-[10px] text-gray-600 font-bold uppercase tracking-wide mb-1">Vergi Dairesi</label>
                          <input type="text" className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad]" value={entityForm.tax_office} onChange={e => setEntityForm({ ...entityForm, tax_office: e.target.value })} />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-600 font-bold uppercase tracking-wide mb-1">İletişim (Telefon)</label>
                        <input type="text" className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad]" value={entityForm.phone} onChange={e => setEntityForm({ ...entityForm, phone: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-600 font-bold uppercase tracking-wide mb-1">E-Posta Adresi</label>
                        <input type="email" className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad]" value={entityForm.email} onChange={e => setEntityForm({ ...entityForm, email: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                  {assignTarget?.type === 'unit' ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-1">Tesis İşletme Rolü</label>
                        <select className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 text-xs outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad]" value={linkForm.role} onChange={e => setLinkForm({ ...linkForm, role: e.target.value })}>
                          <option value="Kiracı">Kiracı (Faaliyet Gösteren)</option>
                          <option value="Malik">Mülk Sahibi (Kendi İşletiyor)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-1">Ruhsat Durumu</label>
                        <select className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 text-xs outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad]" value={linkForm.has_work_license ? "true" : "false"} onChange={e => setLinkForm({ ...linkForm, has_work_license: e.target.value === "true" })}>
                          <option value="false">Yok / Onay Aşamasında</option>
                          <option value="true">Var (Aktif ve Onaylı)</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-1">Tapu Hisse Oranı (%)</label>
                      <input type="number" min="1" max="100" className="w-full bg-white border border-gray-300 rounded p-2 text-[#1a2d42] outline-none focus:border-[#3a87ad] focus:ring-1 focus:ring-[#3a87ad] font-bold text-sm" value={sharePercentage} onChange={e => setSharePercentage(Number(e.target.value))} />
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2 text-xs font-bold">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 rounded transition-colors cursor-pointer border border-gray-300">İptal</button>
                  <button type="submit" className="bg-[#5cb85c] hover:bg-[#4cae4c] text-white px-5 py-2 rounded shadow-sm transition-colors cursor-pointer flex items-center gap-1.5">
                    <CheckCircle2 size={14}/> Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}