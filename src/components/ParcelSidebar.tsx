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
    <div className="border-l border-[#444] ml-3 pl-2 mt-1">
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-[#333] p-1.5 rounded transition-colors group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5 text-gray-300">
          {isOpen ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
          {icon}
          <span className="text-xs font-medium font-mono">{title}</span>
        </div>
        {rightElement && <div>{rightElement}</div>}
      </div>
      {isOpen && <div className="ml-2 mt-1 space-y-1">{children}</div>}
    </div>
  );
};

export default function ParcelSidebar({ parcel, onClose, onManage }: ParcelSidebarProps) {
  if (!parcel) return null;

  const title = parcel.ada_parsel ? `Ada/Parsel: ${parcel.ada_parsel}` : parcel.name;

  return (
    <div className="absolute top-0 left-0 h-full w-80 bg-[#252526]/95 backdrop-blur-md border-r border-[#3c3c3c] shadow-2xl z-[500] flex flex-col text-gray-200 select-none transform transition-transform duration-300">
      
      <div className="p-4 border-b border-[#3c3c3c] bg-[#1e1e1e] flex justify-between items-start">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">
            <Layers size={12} /> Seçili Obje
          </div>
          <h2 className="text-lg font-bold font-mono text-gray-100 leading-tight">{title}</h2>
          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
            <MapPin size={10} /> Durum: {parcel.status || 'Aktif'}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white hover:bg-red-500/20 p-1 rounded transition-colors cursor-pointer">
          <X size={18} />
        </button>
      </div>

      <div className="p-3 border-b border-[#3c3c3c] bg-[#2d2d2d] flex gap-2">
        <button 
          onClick={onManage}
          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-bold transition-colors cursor-pointer shadow-md"
        >
          <Edit2 size={14} /> Detayları Yönet
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
        
        <div>
          <div className="text-[10px] font-bold uppercase text-gray-500 border-b border-[#444] pb-1 mb-2">Mülkiyet Bilgileri</div>
          {(!parcel.owners || parcel.owners.length === 0) ? (
            <p className="text-[10px] text-gray-600 italic pl-2">Kayıtlı malik yok.</p>
          ) : (
            parcel.owners.map((owner: any) => (
              <TreeNode key={owner.id} title={owner.name} icon={<User size={12} className="text-purple-400"/>} defaultOpen={true}
                rightElement={<span className="text-[9px] text-purple-400 border border-purple-500/30 px-1 rounded bg-purple-500/10">%{owner.share_percentage}</span>}
              >
                <div className="text-[9px] text-gray-400 pl-6 space-y-0.5">
                  <p>Tip: {owner.type}</p>
                  {owner.tc_vkn && <p>VKN/TC: {owner.tc_vkn}</p>}
                </div>
              </TreeNode>
            ))
          )}
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase text-gray-500 border-b border-[#444] pb-1 mb-2">Fiziksel Hiyerarşi (Katmanlar)</div>
          {(!parcel.structures || parcel.structures.length === 0) ? (
             <p className="text-[10px] text-gray-600 italic pl-2">Geometri içinde tanımlı yapı yok.</p>
          ) : (
            parcel.structures.map((structure: any) => (
              <TreeNode key={structure.id} title={structure.name} icon={<Building size={12} className="text-blue-400"/>} defaultOpen={true}>
                
                {(!structure.units || structure.units.length === 0) ? (
                  // YENİ: İÇ BİRİM YERİNE BAĞIMSIZ BÖLÜM YAZDIK
                  <p className="text-[9px] text-gray-600 italic pl-6">Bağımsız bölüm yok.</p>
                ) : (
                  structure.units.map((unit: any) => (
                    // YENİ: BB NO VE NİTELİĞİ DAHA OKUNAKLI FORMATTA GÖSTERİYORUZ
                    <TreeNode key={unit.id} title={`BB No: ${unit.unit_no} (${unit.name})`} icon={<DoorOpen size={12} className="text-amber-400"/>} defaultOpen={true}>
                      
                      {(!unit.occupants || unit.occupants.length === 0) ? (
                        <p className="text-[9px] text-gray-600 italic pl-6">İşletme/Kiracı atanmamış.</p>
                      ) : (
                        unit.occupants.map((occ: any) => (
                          <div key={occ.id} className="pl-6 py-1 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
                                <Users size={10} className="text-gray-400"/> {occ.name}
                              </div>
                              <span className="text-[8px] bg-[#333] px-1 rounded text-gray-400">{occ.role}</span>
                            </div>
                            <div className="flex items-center gap-1 pl-4 text-[9px]">
                              {occ.has_work_license ? (
                                <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={9}/> Ruhsatlı</span>
                              ) : (
                                <span className="text-red-400 flex items-center gap-1"><ShieldAlert size={9}/> Ruhsatsız</span>
                              )}
                            </div>
                          </div>
                        ))
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