import { useAppContext } from '@/context/AppContext';
import { FileText } from 'lucide-react';

export default function Header() {
  const { currentData, handleDrillDown } = useAppContext();

  return (
    <header className="bg-header text-header-foreground px-5 h-[60px] flex items-center justify-between shadow-sm flex-shrink-0">
      <div
        className="flex items-center gap-2.5 text-lg font-semibold cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => handleDrillDown('reset', '')}
        title="Ver todos los registros"
      >
        <FileText className="w-6 h-6" />
        Sistema de Refuerzos
      </div>
      {currentData.length > 0 && (
        <span className="bg-primary text-primary-foreground text-sm px-3 py-0.5 rounded-xl">
          {currentData.length.toLocaleString()} Filtrados
        </span>
      )}
    </header>
  );
}
