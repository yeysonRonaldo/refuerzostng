import { useAppContext } from '@/context/AppContext';
import { FileText, Menu } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { currentData, handleDrillDown } = useAppContext();

  return (
    <header className="bg-header text-header-foreground px-3 sm:px-5 h-[56px] sm:h-[60px] flex items-center justify-between shadow-sm flex-shrink-0">
      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div
          className="flex items-center gap-2 text-base sm:text-lg font-semibold cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => handleDrillDown('reset', '')}
          title="Ver todos los registros"
        >
          <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="hidden xs:inline">Sistema de Refuerzos</span>
          <span className="xs:hidden">Refuerzos</span>
        </div>
      </div>
      {currentData.length > 0 && (
        <span className="bg-primary text-primary-foreground text-xs sm:text-sm px-2.5 sm:px-3 py-0.5 rounded-xl">
          {currentData.length.toLocaleString()} Filtrados
        </span>
      )}
    </header>
  );
}
