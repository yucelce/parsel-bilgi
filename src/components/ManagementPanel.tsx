// src/components/ManagementPanel.tsx
import React, { useState, useEffect } from 'react';
import { X, Search, Edit2, Save, XCircle } from 'lucide-react';

export default function ManagementPanel({ onClose }: { onClose: () => void }) {
  const [parcels, setParcels] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    fetchParcels();
  }, []);

  const fetchParcels = () => {
    fetch('/api/parcels')
      .then(res => res.json())
      .then(data => setParcels(data))
      .catch(err => console.error(err));
  };

  const handleEditClick = (parcel: any) => {
    setEditingId(parcel.id);
    setEditForm({ ...parcel });
  };

  const handleSave = async (id: string) => {
    try {
      await fetch(`/api/parcels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          adaParsel: editForm.ada_parsel,
          ownerName: editForm.owner_name,
          ownerPhone: editForm.owner_phone,
          ownerEmail: editForm.owner_email,
          status: editForm.status,
          hasWorkLicense: editForm.has_work_license
        })
      });
      setEditingId(null);
      fetchParcels();
    } catch (err) {
      console.error(err);
      alert('Kaydedilirken hata oluştu.');
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
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            Ada/Parsel Yönetim Paneli
          </h2>
          <p className="text-sm text-gray-400">Veritabanındaki parselleri listeleyin ve düzenleyin.</p>
        </div>
        <button onClick={onClose} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="mb-4 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-500" />
        </div>
        <input
          type="text"
          placeholder="Ada/Parsel veya İsim ile ara..."
          className="bg-[#2d2d2d] border border-[#444] text-gray-200 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-auto border border-[#333] rounded-lg">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-[#252526] sticky top-0 shadow-md">
            <tr>
              <th className="px-4 py-3">Ada/Parsel</th>
              <th className="px-4 py-3">Adı/Açıklama</th>
              <th className="px-4 py-3">Sahip/Nitelik</th>
              <th className="px-4 py-3">Çalışma Ruhsatı</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredParcels.map(parcel => (
              <tr key={parcel.id} className="border-b border-[#333] hover:bg-[#2a2a2b] transition-colors">
                {editingId === parcel.id ? (
                  <>
                    <td className="px-4 py-2"><input type="text" className="w-full bg-[#1e1e1e] border border-[#444] p-1 rounded" value={editForm.ada_parsel || ''} onChange={e => setEditForm({...editForm, ada_parsel: e.target.value})} /></td>
                    <td className="px-4 py-2"><input type="text" className="w-full bg-[#1e1e1e] border border-[#444] p-1 rounded" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                    <td className="px-4 py-2"><input type="text" className="w-full bg-[#1e1e1e] border border-[#444] p-1 rounded" value={editForm.owner_name || ''} onChange={e => setEditForm({...editForm, owner_name: e.target.value})} /></td>
                    <td className="px-4 py-2">
                      <select className="bg-[#1e1e1e] border border-[#444] p-1 rounded w-full" value={editForm.has_work_license ? 'true' : 'false'} onChange={e => setEditForm({...editForm, has_work_license: e.target.value === 'true'})}>
                        <option value="true">Var</option>
                        <option value="false">Yok</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select className="bg-[#1e1e1e] border border-[#444] p-1 rounded w-full" value={editForm.status || 'Aktif'} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                        <option value="Aktif">Aktif</option>
                        <option value="Pasif">Pasif</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={() => handleSave(parcel.id)} className="text-green-500 hover:text-green-400 p-1"><Save size={18} /></button>
                      <button onClick={() => setEditingId(null)} className="text-red-500 hover:text-red-400 p-1"><XCircle size={18} /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-semibold text-white">{parcel.ada_parsel || '-'}</td>
                    <td className="px-4 py-3">{parcel.name}</td>
                    <td className="px-4 py-3">{parcel.owner_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${parcel.has_work_license ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                        {parcel.has_work_license ? 'Var' : 'Yok'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${parcel.status === 'Aktif' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {parcel.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEditClick(parcel)} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 ml-auto">
                        <Edit2 size={16} /> Düzenle
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filteredParcels.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-gray-500">Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}