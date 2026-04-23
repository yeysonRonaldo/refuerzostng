import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { FileText, Menu, Cloud, CloudOff, Loader2, CheckCircle2, User } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

function SyncIndicator() {
  const { syncStatus } = useAppContext();
  if (syncStatus === 'idle') return null;

  const config = {
    loading: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: 'Cargando…', cls: 'text-white/80' },
    saving: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: 'Guardando…', cls: 'text-white/80' },
    saved: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Sincronizado', cls: 'text-emerald-300' },
    error: { icon: <CloudOff className="w-3.5 h-3.5" />, label: 'Error de sincronización', cls: 'text-red-300' },
  }[syncStatus];

  return (
    <div className={`hidden sm:flex items-center gap-1.5 text-xs ${config.cls}`} title={config.label}>
      {config.icon}
      <span className="hidden md:inline">{config.label}</span>
    </div>
  );
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { currentData, handleDrillDown } = useAppContext();
  const { user } = useAuth();

  const initials = user?.email
    ?.split('@')[0]
    .split(/[._-]/)
    .map(s => s[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('') || '?';

  return (
    <header className="bg-header text-header-foreground px-3 sm:px-5 h-[56px] sm:h-[60px] flex items-center justify-between shadow-soft flex-shrink-0 relative z-20">
      <div className="flex items-center gap-2 sm:gap-3">
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
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <FileText className="w-4 h-4" />
          </div>
          <span className="hidden xs:inline tracking-tight">Sistema de Refuerzos</span>
          <span className="xs:hidden">Refuerzos</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <SyncIndicator />
        {currentData.length > 0 && (
          <span className="flex items-center gap-1.5 bg-primary/90 text-primary-foreground text-xs sm:text-sm px-2.5 sm:px-3 py-1 rounded-full font-medium shadow-soft">
            <Cloud className="w-3.5 h-3.5" />
            {currentData.length.toLocaleString()}
          </span>
        )}
        {user && (
          <div
            className="hidden sm:flex w-8 h-8 rounded-full bg-white/10 items-center justify-center text-xs font-semibold ring-1 ring-white/20"
            title={user.email || ''}
          >
            {initials || <User className="w-4 h-4" />}
          </div>
        )}
      </div>
    </header>
  );
}
