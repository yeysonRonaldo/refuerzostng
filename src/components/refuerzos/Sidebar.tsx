import { useState, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { parseExcelFile } from '@/lib/dataProcessor';
import { uploadToFirestore, clearFirestoreData, deleteYearFromFirestore } from '@/lib/firestoreService';
import {
  LayoutDashboard, Activity, Database, Upload, Loader2, Users, LogOut, Navigation, FileText,
  FileSpreadsheet, X, ClipboardList, Trash2, AlertCircle, RefreshCw, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { TabName } from '@/types/refuerzos';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const getRecordYear = (date: Date) => date.getUTCFullYear();

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const {
    processedData, activeTab, yearFilter, monthFilter, techFilter, syncStatus, loadError,
    setProcessedData, setActiveTab, setYearFilter, setMonthFilter, setTechFilter, resetData, retryLoad,
  } = useAppContext();
  const { isAdmin, logout, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navItems: { id: TabName; label: string; icon: React.ReactNode }[] = [
    { id: 'metrics', label: 'Métricas', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { id: 'analysis', label: 'Análisis de Cambios', icon: <Activity className="w-[18px] h-[18px]" /> },
    { id: 'projection', label: 'Proyección Mensual', icon: <TrendingUp className="w-[18px] h-[18px]" /> },
    { id: 'routes', label: 'Rutas & Asignación', icon: <Navigation className="w-[18px] h-[18px]" /> },
    { id: 'reports', label: 'Generador Reportes PDF', icon: <FileText className="w-[18px] h-[18px]" /> },
    { id: 'techReports', label: 'Reportes por Técnico', icon: <ClipboardList className="w-[18px] h-[18px]" /> },
    { id: 'database', label: 'Base de Datos', icon: <Database className="w-[18px] h-[18px]" /> },
    { id: 'export', label: 'Exportar a Excel', icon: <FileSpreadsheet className="w-[18px] h-[18px]" /> },
    ...(isAdmin ? [{ id: 'users' as TabName, label: 'Usuarios', icon: <Users className="w-[18px] h-[18px]" /> }] : []),
  ];

  const years = Array.from(new Set(
    processedData.map(d => d.dateObj ? getRecordYear(d.dateObj) : d.anio).filter(Boolean)
  )).sort((a, b) => (b as number) - (a as number));

  const technicians = Array.from(new Set(
    processedData.map(d => d.tecnico).filter(t => t && t !== '-')
  )).sort();

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      const { records, duplicatesSkipped } = await parseExcelFile(file);
      toast.info(`Procesando ${records.length} registros…`);
      const { uploaded, skipped, newRecords } = await uploadToFirestore(records);
      if (newRecords.length > 0) {
        setProcessedData([...processedData, ...newRecords]);
      }
      const totalSkipped = duplicatesSkipped + skipped;
      toast.success(
        `${uploaded} nuevos · ${totalSkipped} duplicados omitidos`,
        { description: `Total en BD: ${processedData.length + newRecords.length}` }
      );
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar el archivo. Revisa la consola.');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleReset = async () => {
    if (!confirm('¿Estás seguro? Esto eliminará TODOS los datos.')) return;
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
    if (!confirm(`¿Eliminar TODOS los registros del año ${year}?`)) return;
    setLoading(true);
    try {
      const deleted = await deleteYearFromFirestore(year);
      setProcessedData(processedData.filter(r => {
        const rYear = r.dateObj ? getRecordYear(r.dateObj) : r.anio;
        return rYear !== year;
      }));
      toast.success(`${deleted} registros del año ${year} eliminados.`);
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
        <label className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
          1 · Cargar Datos
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-border hover:border-primary/50 hover:bg-accent/50'
          } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-xs text-primary py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Procesando…
            </div>
          ) : (
            <>
              <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xs font-medium text-foreground">Subir Excel/CSV</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">o arrastra aquí</div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            disabled={loading}
            className="hidden"
          />
        </div>
        {processedData.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-success">
            <CheckCircle2 className="w-3 h-3" />
            <span>{processedData.length.toLocaleString()} registros cargados</span>
          </div>
        )}
        {syncStatus === 'error' && loadError && (
          <button
            onClick={retryLoad}
            className="flex items-center justify-center gap-1.5 text-xs text-destructive border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 rounded-md py-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Reintentar carga
          </button>
        )}
      </div>

      {/* Filters */}
      {processedData.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
            2 · Filtros Globales
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="text-sm w-full p-2 rounded-md border border-border bg-card hover:border-primary/50 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="all">Todos los Años</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="text-sm w-full p-2 rounded-md border border-border bg-card hover:border-primary/50 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="all">Todos los Meses</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="text-sm w-full p-2 rounded-md border border-border bg-card hover:border-primary/50 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="all">Todos los Técnicos</option>
            {technicians.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <details className="text-xs text-muted-foreground group">
            <summary className="cursor-pointer hover:text-foreground transition-colors select-none flex items-center gap-1 py-1">
              <AlertCircle className="w-3 h-3" />
              Gestión avanzada
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
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                Borrar todo
              </button>
            </div>
          </details>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col gap-1">
        <label className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
          3 · Navegación
        </label>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md font-medium text-sm transition-all
              ${activeTab === item.id
                ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* User & Logout */}
      <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground truncate px-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="truncate">{user?.email}</span>
          {isAdmin && <span className="text-primary font-semibold text-[10px] uppercase tracking-wider">Admin</span>}
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 border border-border text-muted-foreground p-2 rounded-md font-medium text-sm hover:bg-accent hover:text-foreground transition-colors"
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
          <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
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
