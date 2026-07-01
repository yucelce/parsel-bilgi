// src/components/ParcelSidebar.tsx
import React, { useState } from 'react';
import { 
  X, Building, DoorOpen, Users, User, ShieldAlert, CheckCircle2, 
  ChevronRight, ChevronDown, Edit2, Layers
} from 'lucide-react';

interface ParcelSidebarProps {
  parcel: any;
  onClose: () => void;
  onManage: () => void;
}

const TreeNode = ({ title, icon, defaultOpen = false, children, rightElement }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-l-2 border-gray-200 ml-3 pl-3 mt-2">
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-all group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-gray-800">
          {isOpen ? <ChevronDown size={16} className="text-[#3a87ad]" /> : <ChevronRight size={16} className="text-[#3a87ad]" />}
          {icon}
          <span className="text-sm font-bold tracking-wide">{title}</span>
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
  const areaText = parcel.calculated_area_m2 ? `${parcel.calculated_area_m2} m²` : (parcel.area_m2 ? `${parcel.area_m2} m²` : 'Alan Yok');

  return (
    <div className="absolute top-0 left-0 h-full w-[350px] bg-white border-r border-gray-200 shadow-2xl z-[500] flex flex-col font-sans select-none transform transition-transform duration-300">
      
      {/* Üst Bilgi Başlığı ve m2 Alanı - Primary Dark */}
      <div className="p-5 border-b border-[#1a2d42] bg-[#1a2d42] flex justify-between items-start text-white">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-200 uppercase tracking-widest mb-1.5">
            <Layers size={14} /> Seçili Parsel Bilgisi
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-lg font-bold leading-tight">{title}</h2>
            <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded border border-white/30 whitespace-nowrap">
              {areaText}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-white hover:bg-[#8b0000] p-1.5 rounded transition-colors cursor-pointer ml-2 shrink-0">
          <X size={20} />
        </button>
      </div>

      {/* Aksiyon Butonu - Action Green */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <button 
          onClick={onManage}
          className="w-full flex items-center justify-center gap-2 bg-[#5cb85c] hover:bg-[#4cae4c] text-white py-2.5 rounded text-sm font-bold transition-colors shadow-sm"
        >
          <Edit2 size={16} /> Paneli Aç ve Yönet
        </button>
      </div>

      {/* Ağaç İçeriği */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Mülkiyet Bilgileri */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider bg-[#3a87ad] text-white px-3 py-2 rounded-t-md">Mülkiyet Bilgileri</div>
          <div className="border border-gray-200 border-t-0 p-2 rounded-b-md bg-white">
            {(!parcel.owners || parcel.owners.length === 0) ? (
              <p className="text-sm text-gray-500 italic pl-2 bg-gray-50 p-3 rounded-md">Kayıtlı malik bulunmamaktadır.</p>
            ) : (
              parcel.owners.map((owner: any) => (
                <TreeNode key={owner.id} title={owner.name} icon={<User size={14} className="text-[#3a87ad]"/>} defaultOpen={true}
                  rightElement={<span className="text-xs font-mono font-bold text-[#1a2d42] border border-gray-300 px-2 py-0.5 rounded bg-gray-100">%{owner.share_percentage}</span>}
                >
                  <div className="text-xs text-gray-700 pl-8 space-y-1 bg-gray-50 p-2 rounded border border-gray-200">
                    <p><span className="font-bold text-gray-900">Kurum/Şahıs Tipi:</span> {owner.type}</p>
                    {owner.tc_vkn && <p><span className="font-bold text-gray-900">VKN/TC:</span> {owner.tc_vkn}</p>}
                  </div>
                </TreeNode>
              ))
            )}
          </div>
        </div>

        {/* Fiziksel Hiyerarşi */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider bg-[#3a87ad] text-white px-3 py-2 rounded-t-md">Fiziksel Yapı Hiyerarşisi</div>
          <div className="border border-gray-200 border-t-0 p-2 rounded-b-md bg-white">
            {(!parcel.structures || parcel.structures.length === 0) ? (
               <p className="text-sm text-gray-500 italic pl-2 bg-gray-50 p-3 rounded-md">Geometri içinde tanımlı yapı bulunmamaktadır.</p>
            ) : (
              parcel.structures.map((structure: any) => (
                <TreeNode key={structure.id} title={structure.name} icon={<Building size={14} className="text-[#1a2d42]"/>} defaultOpen={true}>
                  
                  {(!structure.units || structure.units.length === 0) ? (
                    <p className="text-xs text-gray-500 italic pl-8">Bağımsız bölüm bulunmamaktadır.</p>
                  ) : (
                    structure.units.map((unit: any) => (
                      <TreeNode key={unit.id} title={`BB No: ${unit.unit_no} (${unit.name})`} icon={<DoorOpen size={14} className="text-[#3a87ad]"/>} defaultOpen={true}>
                        
                        {(!unit.occupants || unit.occupants.length === 0) ? (
                          <p className="text-xs text-gray-500 italic pl-8">İşletme/Kiracı atanmamış.</p>
                        ) : (
                          <div className="space-y-2">
                            {unit.occupants.map((occ: any) => (
                              <div key={occ.id} className="ml-8 pl-3 py-2 border-l-2 border-[#3a87ad] bg-gray-50 rounded-r-md flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                    <Users size={12} className="text-gray-500"/> {occ.name}
                                  </div>
                                  <span className="text-[10px] uppercase font-bold tracking-wider bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 border border-gray-300">{occ.role}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-medium">
                                  {occ.has_work_license ? (
                                    <span className="text-[#5cb85c] font-bold flex items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded border border-green-200 w-fit"><CheckCircle2 size={12}/> Çalışma Ruhsatı Var</span>
                                  ) : (
                                    <span className="text-[#8b0000] font-bold flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded border border-red-200 w-fit"><ShieldAlert size={12}/> Ruhsatsız İşletme</span>
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
    </div>
  );
}