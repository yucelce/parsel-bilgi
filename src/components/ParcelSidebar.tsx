// src/components/ParcelSidebar.tsx
import React, { useState } from 'react';
import { 
  X, Building, DoorOpen, Users, User, ShieldAlert, CheckCircle2, 
  ChevronRight, ChevronDown, Edit2, MapPin, Layers
} from 'lucide-react';

interface ParcelSidebarProps {
  parcel: any;
  onClose: () => void;
  onManage: () => void;
}

const TreeNode = ({ title, icon, defaultOpen = false, children, rightElement }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-l-2 border-slate-700/50 ml-3 pl-3 mt-2">
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 p-2 rounded-md transition-all group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-slate-200">
          {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          {icon}
          <span className="text-sm font-semibold tracking-wide">{title}</span>
        </div>
        {rightElement && <div>{rightElement}</div>}
      </div>
      {isOpen && <div className="ml-4 mt-2 space-y-2">{children}</div>}
    </div>
  );
};

export default function ParcelSidebar({ parcel, onClose, onManage }: ParcelSidebarProps) {
  if (!parcel) return null;

  const title = parcel.ada_parsel ? `Ada/Parsel: ${parcel.ada_parsel}` : parcel.name;

  return (
    <div className="absolute top-0 left-0 h-full w-[350px] bg-slate-900 border-r border-slate-700 shadow-2xl z-[500] flex flex-col text-slate-200 select-none transform transition-transform duration-300">
      
      {/* Üst Bilgi Başlığı */}
      <div className="p-5 border-b border-slate-700 bg-slate-800/80 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-widest mb-1.5">
            <Layers size={14} /> Seçili Parsel Bilgisi
          </div>
          <h2 className="text-lg font-bold text-slate-50 leading-tight">{title}</h2>
          
          {/* YENİ GÜNCELLENEN DURUM VE ALAN BİLGİSİ SATIRI */}
          {/* İSTATİSTİK KARTLARI (Kompakt Tek Satır) */}
              <div className="flex flex-wrap items-center gap-6 px-5 py-2.5 bg-slate-800/50 border-b border-slate-700 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Fiziksel Yapı:</span>
                  <span className="font-bold text-blue-400">{stats.totalStructures}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Bağımsız Birim:</span>
                  <span className="font-bold text-indigo-400">{stats.totalUnits}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Aktif İşletme:</span>
                  <span className="font-bold text-amber-400">{stats.totalOccupants}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Ruhsat Oranı:</span>
                  <span className={`font-bold ${stats.licenseRate === 100 ? 'text-emerald-400' : stats.licenseRate > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                    %{stats.licenseRate}
                  </span>
                </div>
              </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white hover:bg-red-500/20 p-1.5 rounded-md transition-colors cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {/* Aksiyon Butonu */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/40">
        <button 
          onClick={onManage}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-md text-sm font-bold transition-colors shadow-sm"
        >
          <Edit2 size={16} /> Paneli Aç ve Yönet
        </button>
      </div>

      {/* Ağaç İçeriği */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Mülkiyet Bilgileri */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-2 mb-3">Mülkiyet Bilgileri</div>
          {(!parcel.owners || parcel.owners.length === 0) ? (
            <p className="text-sm text-slate-500 italic pl-2 bg-slate-800/50 p-3 rounded-md">Kayıtlı malik bulunmamaktadır.</p>
          ) : (
            parcel.owners.map((owner: any) => (
              <TreeNode key={owner.id} title={owner.name} icon={<User size={14} className="text-indigo-400"/>} defaultOpen={true}
                rightElement={<span className="text-xs font-mono font-bold text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded bg-indigo-500/10">%{owner.share_percentage}</span>}
              >
                <div className="text-xs text-slate-400 pl-8 space-y-1 bg-slate-800/30 p-2 rounded-md border border-slate-700/50">
                  <p><span className="font-semibold text-slate-300">Kurum/Şahıs Tipi:</span> {owner.type}</p>
                  {owner.tc_vkn && <p><span className="font-semibold text-slate-300">VKN/TC:</span> {owner.tc_vkn}</p>}
                </div>
              </TreeNode>
            ))
          )}
        </div>

        {/* Fiziksel Hiyerarşi */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-2 mb-3">Fiziksel Yapı Hiyerarşisi</div>
          {(!parcel.structures || parcel.structures.length === 0) ? (
             <p className="text-sm text-slate-500 italic pl-2 bg-slate-800/50 p-3 rounded-md">Geometri içinde tanımlı yapı bulunmamaktadır.</p>
          ) : (
            parcel.structures.map((structure: any) => (
              <TreeNode key={structure.id} title={structure.name} icon={<Building size={14} className="text-blue-400"/>} defaultOpen={true}>
                
                {(!structure.units || structure.units.length === 0) ? (
                  <p className="text-xs text-slate-500 italic pl-8">Bağımsız bölüm bulunmamaktadır.</p>
                ) : (
                  structure.units.map((unit: any) => (
                    <TreeNode key={unit.id} title={`BB No: ${unit.unit_no} (${unit.name})`} icon={<DoorOpen size={14} className="text-amber-400"/>} defaultOpen={true}>
                      
                      {(!unit.occupants || unit.occupants.length === 0) ? (
                        <p className="text-xs text-slate-500 italic pl-8">İşletme/Kiracı atanmamış.</p>
                      ) : (
                        <div className="space-y-2">
                          {unit.occupants.map((occ: any) => (
                            <div key={occ.id} className="ml-8 pl-3 py-2 border-l-2 border-slate-600 bg-slate-800/40 rounded-r-md flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                                  <Users size={12} className="text-slate-400"/> {occ.name}
                                </div>
                                <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 border border-slate-600">{occ.role}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                {occ.has_work_license ? (
                                  <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 w-fit"><CheckCircle2 size={12}/> Çalışma Ruhsatı Var</span>
                                ) : (
                                  <span className="text-rose-400 flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 w-fit"><ShieldAlert size={12}/> Ruhsatsız İşletme</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    </TreeNode>
                  ))
                )}
              </TreeNode>
            ))
          )}
        </div>
      </div>
    </div>
  );
}