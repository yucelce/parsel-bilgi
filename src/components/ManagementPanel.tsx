// src/components/ManagementPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  X, Search, Plus, Building, Users, Phone, Mail,
  FileCheck, Trash2, DoorOpen, ShieldAlert, BarChart3,
  Layers, CheckCircle2, AlertTriangle
} from 'lucide-react';

interface ManagementPanelProps {
  onClose: () => void;
  initialEditId?: string | null;
}

export default function ManagementPanel({ onClose, initialEditId }: ManagementPanelProps) {
  // --- STATE TANIMLAMALARI ---
  const [parcels, setParcels] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'empty' | 'unlicensed'>('all');
  const [selectedParcel, setSelectedParcel] = useState<any | null>(null);
  const hasInitializedEdit = useRef(false);

  // Modal ve Atama State'leri
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ type: 'parcel' | 'unit', id: string } | null>(null);
  const [sharePercentage, setSharePercentage] = useState<number>(100);

  // Paydaş (Firma/Kişi) State'leri
  const [entitiesList, setEntitiesList] = useState<any[]>([]);
  const [modalMode, setModalMode] = useState<'select' | 'create'>('select');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  // Form State'leri
  const [entityForm, setEntityForm] = useState({
    type: 'Şirket',
    name: '',
    tc_vkn: '',
    tax_office: '',
    phone: '',
    email: '',
  });

  const [linkForm, setLinkForm] = useState({
    role: 'Kiracı',
    has_work_license: false
  });

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
          // Eğer ekranda açık bir parsel varsa verilerini canlı güncelle
          if (selectedParcel) {
            const updated = data.find((p: any) => p.id === selectedParcel.id);
            if (updated) setSelectedParcel(updated);
          }
        }
      })
      .catch(err => console.error("Hata:", err));
  };

  const fetchEntities = () => {
    fetch('/api/entities')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setEntitiesList(data);
      })
      .catch(err => console.error("Paydaş hatası:", err));
  };

  // --- YAŞAM DÖNGÜSÜ (EFFECTS) ---
  useEffect(() => {
    fetchParcels();
    fetchEntities();
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

  // --- SİLME VE EKLEME EYLEMLERİ ---
  const deleteParcel = async (id: string) => {
    if (!window.confirm('DİKKAT! Bu parseli sildiğinizde içindeki tüm binalar, bağımsız bölümler ve ruhsat ilişkileri KALICI olarak silinecektir. Emin misiniz?')) return;
    try {
      const res = await fetch(`/api/parcels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedParcel(null);
        fetchParcels();
      } else {
        alert("Parsel silinemedi.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addStructure = async () => {
    const name = prompt("Yeni Yapı/Bina Adı Giriniz (Örn: İdari Bina, Fabrika Hol-1, Depo):");
    if (!name || !selectedParcel) return;

    try {
      const res = await fetch('/api/structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcel_id: selectedParcel.id, name, building_type: 'Bina' })
      });
      if (res.ok) fetchParcels();
    } catch (err) {
      console.error(err);
    }
  };

  const addIndependentUnit = async (structureId: string, structureName: string) => {
    // 1. Resmi Bağımsız Bölüm Numarası
    const unitNo = prompt(`${structureName} içerisine eklenecek olan Bağımsız Bölüm Numarasını giriniz (Örn: 1, 3B, Z-02):`);
    if (!unitNo) return;

    // 2. Resmi Nitelik
    const name = prompt(`No: ${unitNo} olan bu Bağımsız Bölümün NİTELİĞİ nedir?\n(Tapu/İskan belgesindeki gibi. Örn: Dükkan, İmalathane, Ofis, Laboratuvar, Depo):`, "İmalathane");
    if (!name) return;

    try {
      const res = await fetch('/api/independent-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structure_id: structureId, name, unit_no: unitNo })
      });
      if (res.ok) fetchParcels();
    } catch (err) {
      console.error(err);
    }
  };

  // src/components/ManagementPanel.tsx içerisine eklenecek fonksiyonlar

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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entityForm)
        });
        if (!entityRes.ok) throw new Error("Yeni paydaş oluşturulamadı.");
        const entityData = await entityRes.json();
        targetEntityId = entityData.id;
      }

      if (!targetEntityId) {
        alert("Lütfen bir firma/kişi seçin veya yenisini oluşturun.");
        return;
      }

      if (assignTarget.type === 'unit') {
        const res = await fetch('/api/unit-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unit_id: assignTarget.id,
            entity_id: targetEntityId,
            role: linkForm.role,
            has_work_license: linkForm.has_work_license
          })
        });
        if (!res.ok) throw new Error("Bağımsız bölüme atama başarısız.");
      }
      else if (assignTarget.type === 'parcel') {
        const res = await fetch('/api/parcel-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parcel_id: assignTarget.id,
            entity_id: targetEntityId,
            share_percentage: sharePercentage
          })
        });
        if (!res.ok) throw new Error("Mülk sahibi ataması başarısız.");
      }

      setIsModalOpen(false);
      fetchParcels();
      fetchEntities();

    } catch (err: any) {
      alert(`Hata: ${err.message}`);
    }
  };

  // --- DİNAMİK FİLTRELEME VE ARAMA MANTIĞI ---
  const filteredParcels = parcels.filter(p => {
    const matchesSearch = (p.ada_parsel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Bağımsız bölüm hesaplamaları
    let totalUnits = 0;
    let occupiedUnits = 0;
    let missingLicense = false;

    p.structures?.forEach((s: any) => {
      s.units?.forEach((u: any) => {
        totalUnits++;
        if (u.occupants && u.occupants.length > 0) {
          occupiedUnits++;
          const hasUnlicensed = u.occupants.some((occ: any) => !occ.has_work_license);
          if (hasUnlicensed) missingLicense = true;
        }
      });
    });

    if (filterType === 'empty') return totalUnits === 0 || occupiedUnits === 0;
    if (filterType === 'unlicensed') return missingLicense;

    return true;
  });

  // --- İSTATİSTİK HESAPLAYICI (SEÇİLİ PARSEL İÇİN) ---
  const calculateStats = () => {
    if (!selectedParcel) return { totalStructures: 0, totalUnits: 0, totalOccupants: 0, licenseRate: 0 };
    let totalStructures = selectedParcel.structures?.length || 0;
    let totalUnits = 0;
    let totalOccupants = 0;
    let licensedOccupants = 0;

    selectedParcel.structures?.forEach((s: any) => {
      s.units?.forEach((u: any) => {
        totalUnits++;
        if (u.occupants) {
          totalOccupants += u.occupants.length;
          u.occupants.forEach((o: any) => {
            if (o.has_work_license) licensedOccupants++;
          });
        }
      });
    });

    let licenseRate = totalOccupants > 0 ? Math.round((licensedOccupants / totalOccupants) * 100) : 0;
    return { totalStructures, totalUnits, totalOccupants, licenseRate };
  };

  const stats = calculateStats();

  return (
    <div className="absolute inset-0 bg-[#1e1e1e]/95 z-[999] p-6 flex flex-col overflow-hidden backdrop-blur-sm select-none">

      {/* ÜST PANEL / HEADER */}
     {/* ÜST PANEL / HEADER */}
      <div className="flex justify-between items-center mb-6 border-b border-[#3c3c3c] pb-4">
        {/* SOL: Kurumsal Logo ve Uygulama Adı Düzenlemesi */}
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-md shadow-sm h-10 w-10 flex items-center justify-center">
            <img 
              src="https://static.wixstatic.com/media/0ded6e_0a74b2a1d6614c4b99998cde8a9d165c~mv2.png" 
              alt="OSB Logo" 
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-100 tracking-wide uppercase leading-tight font-sans">
              OSB PARSEL BİLGİ SİSTEMİ — YÖNETİM PANELİ
            </h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5 font-mono">
              Mülkiyet, Yapı, İmar ve Ruhsat Kontrol Merkezi
            </p>
          </div>
        </div>
        
        {/* SAĞ: Kapatma Butonu (Mevcut yapı korundu) */}
        <button onClick={onClose} className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {/* ANA GÖVDE */}
      <div className="flex flex-1 gap-6 overflow-hidden relative">

        {/* SOL KOLON: PARSEL LİSTELEME VE FİLTRELER */}
        <div className="w-1/3 flex flex-col border border-[#3c3c3c] rounded-lg bg-[#252526] overflow-hidden shadow-xl">

          {/* Arama Kutusu */}
          <div className="p-3 bg-[#2d2d2d] border-b border-[#3c3c3c]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Ada/Parsel No veya Tanım Ara..."
                className="w-full bg-[#1e1e1e] border border-[#444] text-sm rounded pl-9 p-2 text-white outline-none focus:border-blue-500 transition-colors font-mono"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Gelişmiş CAD Tarzı Filtre Butonları */}
          <div className="grid grid-cols-3 gap-1 p-2 bg-[#2a2a2b] border-b border-[#3c3c3c] text-[11px] font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`py-1.5 rounded border transition-colors cursor-pointer ${filterType === 'all' ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#1e1e1e] text-gray-400 border-[#444] hover:bg-[#333]'}`}
            >
              Tümü ({parcels.length})
            </button>
            <button
              onClick={() => setFilterType('empty')}
              className={`py-1.5 rounded border transition-colors cursor-pointer ${filterType === 'empty' ? 'bg-amber-600/30 text-amber-400 border-amber-500/40' : 'bg-[#1e1e1e] text-gray-400 border-[#444] hover:bg-[#333]'}`}
            >
              Boş Tesisler
            </button>
            <button
              onClick={() => setFilterType('unlicensed')}
              className={`py-1.5 rounded border transition-colors cursor-pointer ${filterType === 'unlicensed' ? 'bg-red-600/30 text-red-400 border-red-500/40' : 'bg-[#1e1e1e] text-gray-400 border-[#444] hover:bg-[#333]'}`}
            >
              Ruhsatsızlar
            </button>
          </div>

          {/* Parsel Listesi */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
            {filteredParcels.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs italic">Kriterlere uygun parsel kaydı bulunamadı.</div>
            ) : (
              filteredParcels.map(parcel => {
                let uCount = 0;
                let missingLic = false;
                parcel.structures?.forEach((s: any) => {
                  s.units?.forEach((u: any) => {
                    uCount++;
                    if (u.occupants?.some((o: any) => !o.has_work_license)) missingLic = true;
                  });
                });

                return (
                  <div
                    key={parcel.id}
                    onClick={() => setSelectedParcel(parcel)}
                    className={`p-3 border-b border-[#2d2d2d] cursor-pointer transition-colors flex justify-between items-center ${selectedParcel?.id === parcel.id ? 'bg-blue-950/40 border-l-4 border-l-blue-500' : 'hover:bg-[#252526]'}`}
                  >
                    <div>
                      <h3 className="font-bold text-sm text-gray-200 font-mono">
                        {parcel.ada_parsel ? `Ada/Parsel: ${parcel.ada_parsel}` : parcel.name}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>{parcel.structures?.length || 0} Yapı</span>
                        <span>•</span>
                        <span>{uCount} Bağımsız Bölüm</span>
                      </p>
                    </div>
                    {missingLic && (
                      <span title="Ruhsatsız işletme var!" className="text-red-400 bg-red-500/10 p-1 rounded-full border border-red-500/20">
                        <ShieldAlert size={14} />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SAĞ KOLON: SEÇİLİ PARSEL DETAYLARI, YAPILAR VE BAĞIMSIZ BÖLÜMLER */}
        <div className="w-2/3 flex flex-col border border-[#3c3c3c] rounded-lg bg-[#252526] overflow-hidden shadow-xl">
          {selectedParcel ? (
            <div className="flex flex-col h-full bg-[#1e1e1e]">

              {/* SAĞ PANEL ÜST AKSİYON BARBARI */}
              <div className="p-4 bg-[#2d2d2d] border-b border-[#3c3c3c] flex justify-between items-center">
                <div>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Detay Görünümü</span>
                  <h3 className="text-base font-bold text-gray-100 font-mono mt-1">
                    {selectedParcel.ada_parsel || selectedParcel.name}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteParcel(selectedParcel.id)}
                    className="flex items-center gap-1.5 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    <Trash2 size={14} /> Parseli Sil
                  </button>
                  <button
                    onClick={addStructure}
                    className="flex items-center gap-1.5 bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    <Plus size={14} /> Yeni Yapı/Bina Ekle
                  </button>
                </div>
              </div>

              {/* CANLI DETAY VE ANALİZ KARTLARI (YENİ ÖZELLİK) */}
              <div className="grid grid-cols-4 gap-2 p-4 bg-[#222224] border-b border-[#3c3c3c]">
                <div className="bg-[#1e1e1e] border border-[#333] p-2.5 rounded text-center">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Yapı Sayısı</p>
                  <p className="text-xl font-mono font-bold text-blue-400 mt-1">{stats.totalStructures}</p>
                </div>
                <div className="bg-[#1e1e1e] border border-[#333] p-2.5 rounded text-center">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Bağımsız Birim</p>
                  <p className="text-xl font-mono font-bold text-purple-400 mt-1">{stats.totalUnits}</p>
                </div>
                <div className="bg-[#1e1e1e] border border-[#333] p-2.5 rounded text-center">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Aktif İşletme</p>
                  <p className="text-xl font-mono font-bold text-amber-400 mt-1">{stats.totalOccupants}</p>
                </div>
                <div className="bg-[#1e1e1e] border border-[#333] p-2.5 rounded text-center">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Ruhsat Oranı</p>
                  <p className={`text-xl font-mono font-bold mt-1 ${stats.licenseRate === 100 ? 'text-green-400' : stats.licenseRate > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    %{stats.licenseRate}
                  </p>
                </div>
              </div>

              {/* İÇERİK ALANI */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-[#1e1e1e]">

                {/* BÖLÜM 1: ARSA MALİKLERİ */}
                <div className="bg-[#1e1e1e] border border-[#444] rounded-sm p-0 shadow-sm">
                  <div className="flex justify-between items-center p-2 bg-[#2d2d2d] border-b border-[#444]">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Users size={14} /> Arsa Malikleri Bilgileri
                    </h4>
                    <button
                      onClick={() => openAssignModal('parcel', selectedParcel.id)}
                      className="flex items-center gap-1 hover:bg-purple-600/30 text-purple-400 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer"
                    >
                      <Plus size={12} /> Malik Ekle
                    </button>
                  </div>

                  <div className="p-2 space-y-1">
                    {(!selectedParcel.owners || selectedParcel.owners.length === 0) ? (
                      <p className="text-[10px] text-gray-500 italic text-center py-2">Kayıtlı malik bulunamadı.</p>
                    ) : (
                      selectedParcel.owners.map((owner: any) => (
                        <div key={owner.id} className="group bg-[#252526] border border-[#333] hover:border-[#555] p-1.5 flex justify-between items-center font-mono text-[10px] transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-200">{owner.name}</span>
                            <span className="text-gray-500">[{owner.type}]</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-purple-400">HİSSE: %{owner.share_percentage}</span>
                            <button onClick={() => removeOccupant(owner.id, 'parcel')} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* BÖLÜM 2: YAPILAR VE BAĞIMSIZ BÖLÜMLER (MİMARİ HİYERARŞİ) */}
                <div className="mt-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5 border-b border-[#444] pb-1">
                    <Building size={14} /> Fiziksel Yapı Hiyerarşisi
                  </div>

                  {selectedParcel.structures?.length === 0 ? (
                    <div className="text-center text-gray-600 text-[10px] py-8 bg-[#1e1e1e] border border-dashed border-[#444]">
                      Geometri içerisinde tanımlı yapı yok.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedParcel.structures.map((structure: any) => (
                        <div key={structure.id} className="bg-[#1e1e1e] border border-[#444] rounded-sm overflow-hidden">

                          {/* Bina Başlık Alanı */}
                          <div className="flex justify-between items-center p-1.5 bg-[#252526] border-b border-[#444] group">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-[11px] font-mono text-blue-400 flex items-center gap-1.5">
                                <Building size={12} /> {structure.name}
                              </h5>
                              <button onClick={() => deleteStructure(structure.id, structure.name)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Yapıyı Sil">
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {/* Eski kodunuzdaki İç Birim Ekle butonunun yerine bunu yapıştırın */}
                            <button
                              onClick={() => addIndependentUnit(structure.id, structure.name)}
                              className="flex items-center gap-1 hover:bg-[#333] text-gray-300 px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer"
                            >
                              <Plus size={10} /> Bağ. Bölüm Ekle
                            </button>
                          </div>

                          {/* Binanın İçindeki Bağımsız Bölümler */}
                          <div className="p-1.5 space-y-1.5 bg-[#1e1e1e]">
                            {(!structure.units || structure.units.length === 0) ? (
                              <p className="text-[10px] text-gray-600 italic pl-6">Bağımsız bölüm tanımlanmamış.</p>
                            ) : (
                              structure.units.map((unit: any) => (
                                <div key={unit.id} className="ml-4 border-l border-dashed border-[#555] pl-2 py-1 group/unit">

                                  {/* Bağımsız Bölüm Bilgisi */}
                                  <div className="flex justify-between items-center mb-1">
                                    {/* Eski kodunuzda sadece unit.name yazan kısmı aşağıdaki yapıyla değiştirin */}
                                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                      <DoorOpen size={12} className="text-gray-400" />
                                      <span className="font-bold text-blue-400">BB No: {unit.unit_no}</span>
                                      <span className="text-gray-400">({unit.name})</span>
                                      <button
                                        onClick={() => deleteUnit(unit.id, unit.name)}
                                        className="text-gray-600 hover:text-red-500 opacity-0 group-hover/unit:opacity-100 transition-opacity ml-1"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                    <button
                                      onClick={() => openAssignModal('unit', unit.id)}
                                      className="flex items-center gap-1 text-blue-400 hover:bg-blue-900/30 px-1.5 py-0.5 rounded text-[9px] transition-colors cursor-pointer"
                                    >
                                      <Plus size={10} /> İşletme Ata
                                    </button>
                                  </div>

                                  {/* Bağımsız Bölüm Sakinleri */}
                                  {(!unit.occupants || unit.occupants.length === 0) ? (
                                    <p className="text-[9px] text-gray-600 italic m-0 flex items-center gap-1"><AlertTriangle size={10} className="text-amber-700" /> Boş</p>
                                  ) : (
                                    <div className="space-y-1 mt-1">
                                      {unit.occupants.map((occ: any) => (
                                        <div key={occ.id} className="bg-[#252526] border border-[#333] p-1.5 font-mono group/occ flex flex-col gap-1 hover:border-[#555] transition-colors">
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-gray-300 text-[10px]">{occ.name}</span>
                                              <span className={`text-[8px] px-1 py-0.5 border ${occ.role === 'Malik' ? 'text-purple-400 border-purple-500/30' : 'text-orange-400 border-orange-500/30'}`}>
                                                {occ.role}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className={`flex items-center gap-1 text-[9px] px-1 py-0.5 border ${occ.has_work_license ? 'text-green-400 border-green-500/20' : 'text-red-400 border-red-500/20'}`}>
                                                {occ.has_work_license ? 'RUHSATLI' : 'RUHSATSIZ'}
                                              </div>
                                              <button onClick={() => removeOccupant(occ.id, 'unit')} className="text-gray-600 hover:text-red-500 opacity-0 group-hover/occ:opacity-100 transition-opacity">
                                                <X size={12} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e]">
              <BarChart3 size={44} className="text-[#2d2d2d] mb-3" />
              <p className="text-xs font-medium">Lütfen detayları, mimari yapıları ve sakinleri görmek için soldan bir parsel seçin.</p>
            </div>
          )}

          {/* ATAMA VE YENİ PAYDAŞ OLUŞTURMA MODALI */}
          {isModalOpen && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden">

                <div className="p-4 bg-[#2d2d2d] border-b border-[#3c3c3c] flex justify-between items-center">
                  <h3 className="font-bold text-xs font-mono uppercase tracking-wider text-blue-400">
                    {assignTarget?.type === 'unit' ? 'Bağımsız Bölüme Sakin/Firma Ata' : 'Arsa Sahipliği / Malik Ata'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer"><X size={18} /></button>
                </div>

                <form onSubmit={handleSaveOccupant} className="p-5 space-y-4">

                  {/* Sistem Seçimi / Yeni Oluştur Sekmesi */}
                  <div className="flex bg-[#1e1e1e] p-1 rounded border border-[#444] text-xs font-bold">
                    <button type="button" onClick={() => setModalMode('select')} className={`flex-1 py-2 rounded transition-all cursor-pointer ${modalMode === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Kayıtlı Havuzdan Seç</button>
                    <button type="button" onClick={() => setModalMode('create')} className={`flex-1 py-2 rounded transition-all cursor-pointer ${modalMode === 'create' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Sisteme Sıfırdan Ekle</button>
                  </div>

                  {modalMode === 'select' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Paydaş Listesi</label>
                      <select
                        required={modalMode === 'select'}
                        className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white text-xs outline-none focus:border-blue-500 font-mono"
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                      >
                        <option value="">-- Havuzdan Seçim Yapın --</option>
                        {entitiesList.map(ent => (
                          <option key={ent.id} value={ent.id}>{ent.name} {ent.tc_vkn ? `[VKN/TC: ${ent.tc_vkn}]` : ''}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-[#1e1e1e] p-3 rounded border border-[#333] text-xs font-mono">
                      <div className="flex gap-4 mb-1">
                        <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                          <input type="radio" checked={entityForm.type === 'Şirket'} onChange={() => setEntityForm({ ...entityForm, type: 'Şirket' })} /> Şirket (Tüzel Kişi)
                        </label>
                        <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                          <input type="radio" checked={entityForm.type === 'Kişi'} onChange={() => setEntityForm({ ...entityForm, type: 'Kişi' })} /> Şahıs (Gerçek Kişi)
                        </label>
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Unvan / Tam Ad Soyad</label>
                        <input required={modalMode === 'create'} type="text" className="w-full bg-[#252526] border border-[#444] rounded p-2 text-white outline-none focus:border-blue-500" value={entityForm.name} onChange={e => setEntityForm({ ...entityForm, name: e.target.value })} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{entityForm.type === 'Şirket' ? 'Vergi Kimlik No' : 'TC Kimlik No'}</label>
                          <input type="text" className="w-full bg-[#252526] border border-[#444] rounded p-2 text-white outline-none" value={entityForm.tc_vkn} onChange={e => setEntityForm({ ...entityForm, tc_vkn: e.target.value })} />
                        </div>
                        {entityForm.type === 'Şirket' && (
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Vergi Dairesi</label>
                            <input type="text" className="w-full bg-[#252526] border border-[#444] rounded p-2 text-white outline-none" value={entityForm.tax_office} onChange={e => setEntityForm({ ...entityForm, tax_office: e.target.value })} />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Telefon Numarası</label>
                          <input type="text" className="w-full bg-[#252526] border border-[#444] rounded p-2 text-white outline-none" value={entityForm.phone} onChange={e => setEntityForm({ ...entityForm, phone: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">E-Posta Adresi</label>
                          <input type="email" className="w-full bg-[#252526] border border-[#444] rounded p-2 text-white outline-none" value={entityForm.email} onChange={e => setEntityForm({ ...entityForm, email: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* KİLİT BAĞLANTI PARAMETRELERİ (ORTAK ALAN) */}
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#333] text-xs">
                    {assignTarget?.type === 'unit' ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Birimdeki Rolü</label>
                          <select className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white outline-none focus:border-blue-500" value={linkForm.role} onChange={e => setLinkForm({ ...linkForm, role: e.target.value })}>
                            <option value="Kiracı">Kiracı</option>
                            <option value="Malik">Mülk Sahibi (Kendi İşletiyor)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">GSM/İşyeri Çalışma Ruhsatı</label>
                          <select className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white outline-none focus:border-blue-500" value={linkForm.has_work_license ? "true" : "false"} onChange={e => setLinkForm({ ...linkForm, has_work_license: e.target.value === "true" })}>
                            <option value="false">Yok / Onay Bekliyor</option>
                            <option value="true">Var (Onaylı/Aktif)</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Arsa Üzerindeki Hisse Oranı (%)</label>
                        <input type="number" min="1" max="100" className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-white outline-none focus:border-blue-500 font-mono" value={sharePercentage} onChange={e => setSharePercentage(Number(e.target.value))} />
                      </div>
                    )}
                  </div>

                  {/* MODAL ETKİLEŞİM BUTONLARI */}
                  <div className="pt-3 border-t border-[#3c3c3c] flex justify-end gap-2 text-xs font-bold">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors cursor-pointer">İptal</button>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded shadow-lg transition-colors cursor-pointer">Değişiklikleri Uygula & Bağla</button>
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