import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { parseExcelFile } from '@/lib/dataProcessor';
import { uploadToFirestore, loadFromFirestore, clearFirestoreData, deleteYearFromFirestore } from '@/lib/firestoreService';
import { LayoutDashboard, Activity, Database, Upload, Download, Loader2, Users, LogOut, Navigation, FileText, FileSpreadsheet, X, ClipboardList, Trash2 } from 'lucide-react';
import { TabName } from '@/types/refuerzos';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const {
    processedData, activeTab, yearFilter, monthFilter, techFilter,
    setProcessedData, setActiveTab, setYearFilter, setMonthFilter, setTechFilter, resetData,
  } = useAppContext();
  const { isAdmin, logout, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingFirestore, setLoadingFirestore] = useState(false);

  // Auto-load from Firebase on mount
  useEffect(() => {
    if (processedData.length === 0) {
      setLoadingFirestore(true);
      loadFromFirestore()
        .then(data => {
          if (data.length > 0) {
            setProcessedData(data);
            console.log(`[App] Loaded ${data.length} records from Firestore`);
          } else {
            console.warn('[App] No records found in Firestore');
          }
        })
        .catch(err => {
          console.error('Auto-load error:', err);
          toast.error('Error al cargar datos de Firebase. Intenta recargar la página.');
        })
        .finally(() => setLoadingFirestore(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navItems: { id: TabName; label: string; icon: React.ReactNode }[] = [
    { id: 'metrics', label: 'Métricas', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { id: 'analysis', label: 'Análisis de Cambios', icon: <Activity className="w-[18px] h-[18px]" /> },
    { id: 'routes', label: 'Rutas & Asignación', icon: <Navigation className="w-[18px] h-[18px]" /> },
    { id: 'reports', label: 'Generador Reportes PDF', icon: <FileText className="w-[18px] h-[18px]" /> },
    { id: 'techReports', label: 'Reportes por Técnico', icon: <ClipboardList className="w-[18px] h-[18px]" /> },
    { id: 'database', label: 'Base de Datos', icon: <Database className="w-[18px] h-[18px]" /> },
    { id: 'export', label: 'Exportar a Excel', icon: <FileSpreadsheet className="w-[18px] h-[18px]" /> },
    ...(isAdmin ? [{ id: 'users' as TabName, label: 'Usuarios', icon: <Users className="w-[18px] h-[18px]" /> }] : []),
  ];

  const years = Array.from(new Set(
    processedData
      .map(d => d.dateObj?.getFullYear() ?? d.anio)
      .filter(Boolean)
  )).sort((a, b) => (b as number) - (a as number));

  const technicians = Array.from(new Set(
    processedData
      .map(d => d.tecnico)
      .filter(t => t && t !== '-')
  )).sort();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { records, duplicatesSkipped } = await parseExcelFile(file);
      toast.info(`Subiendo ${records.length} registros a Firebase...`);
      const { uploaded, skipped, newRecords } = await uploadToFirestore(records);
      if (newRecords.length > 0) {
        setProcessedData([...processedData, ...newRecords]);
      }
      const totalSkipped = duplicatesSkipped + skipped;
      const totalInDB = processedData.length + newRecords.length;
      toast.success(
        `✅ ${uploaded} registros nuevos subidos. ${totalSkipped > 0 ? `${totalSkipped} duplicados omitidos.` : ''} Total en BD: ${totalInDB}`
      );
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar archivo. Revisa la consola.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleLoadFromFirestore = async () => {
    setLoadingFirestore(true);
    try {
      const data = await loadFromFirestore();
      if (data.length === 0) {
        toast.info('No hay datos en Firebase. Sube un archivo Excel primero.');
      } else {
        setProcessedData(data);
        toast.success(`✅ ${data.length} registros cargados desde Firebase.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar datos de Firebase.');
    } finally {
      setLoadingFirestore(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('¿Estás seguro? Esto eliminará TODOS los datos de Firebase.')) return;
    setLoading(true);
    try {
      await clearFirestoreData();
      resetData();
      toast.success('Datos eliminados correctamente.');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteYear = async (year: number) => {
    if (!confirm(`¿Estás seguro? Esto eliminará TODOS los registros del año ${year} de Firebase.`)) return;
    setLoading(true);
    try {
      const deleted = await deleteYearFromFirestore(year);
      // Remove from local state
      setProcessedData(processedData.filter(r => {
        const rYear = r.dateObj?.getFullYear() ?? r.anio;
        return rYear !== year;
      }));
      toast.success(`✅ ${deleted} registros del año ${year} eliminados.`);
    } catch (err) {
      console.error(err);
      toast.error(`Error al eliminar registros del año ${year}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleNavClick = (id: TabName) => {
    setActiveTab(id);
    onClose?.();
  };

  const sidebarContent = (
    <>
      {/* File Upload */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          1. Cargar Datos
        </label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          disabled={loading}
          className="text-sm w-full p-2 rounded-md border border-border bg-card disabled:opacity-50"
        />
        {loading && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="w-3 h-3 animate-spin" /> Procesando y subiendo...
          </div>
        )}
      </div>

      {/* Filters */}
      {processedData.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
            2. Filtros Globales
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="text-sm w-full p-2 rounded-md border border-border bg-card"
          >
            <option value="all">Todos los Años</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground transition-colors select-none">
              Gestión de datos...
            </summary>
            <div className="flex flex-wrap gap-1 mt-2">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => handleDeleteYear(y as number)}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  title={`Eliminar registros del año ${y}`}
                >
                  <Trash2 className="w-3 h-3" />
                  {y}
                </button>
              ))}
            </div>
          </details>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="text-sm w-full p-2 rounded-md border border-border bg-card"
          >
            <option value="all">Todos los Meses</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="text-sm w-full p-2 rounded-md border border-border bg-card"
          >
            <option value="all">Todos los Técnicos</option>
            {technicians.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col gap-1">
        <label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          3. Navegación
        </label>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md font-medium text-sm transition-colors
              ${activeTab === item.id
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-primary'
              }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* User & Logout */}
      <div className="mt-auto flex flex-col gap-2">
        <div className="text-xs text-muted-foreground truncate px-1">
          {user?.email}
          {isAdmin && <span className="ml-1 text-primary font-semibold">(Admin)</span>}
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 border border-border text-muted-foreground p-2.5 rounded-md font-medium text-sm hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[260px] bg-card border-r border-border p-5 flex-col gap-5 flex-shrink-0 overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile/Tablet overlay drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={onClose}
          />
          {/* Drawer */}
          <aside className="relative w-[280px] max-w-[85vw] bg-card p-5 flex flex-col gap-5 overflow-y-auto z-50 shadow-xl animate-in slide-in-from-left duration-200">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-accent transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
