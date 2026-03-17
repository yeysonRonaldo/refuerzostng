import { useAppContext } from '@/context/AppContext';
import { parseExcelFile } from '@/lib/dataProcessor';
import { LayoutDashboard, Activity, Database, Trash2 } from 'lucide-react';
import { TabName } from '@/types/refuerzos';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const navItems: { id: TabName; label: string; icon: React.ReactNode }[] = [
  { id: 'metrics', label: 'Métricas', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'analysis', label: 'Análisis de Cambios', icon: <Activity className="w-[18px] h-[18px]" /> },
  { id: 'database', label: 'Base de Datos', icon: <Database className="w-[18px] h-[18px]" /> },
];

export default function Sidebar() {
  const {
    processedData, activeTab, yearFilter, monthFilter,
    setProcessedData, setActiveTab, setYearFilter, setMonthFilter, resetData,
  } = useAppContext();

  const years = Array.from(new Set(
    processedData
      .map(d => d.dateObj?.getFullYear() ?? d.anio)
      .filter(Boolean)
  )).sort((a, b) => (b as number) - (a as number));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseExcelFile(file);
      setProcessedData(data);
    } catch {
      alert('Error al leer archivo. Asegúrate de que sea un Excel o CSV válido.');
    }
  };

  return (
    <aside className="w-[260px] bg-card border-r border-border p-5 flex flex-col gap-5 flex-shrink-0 overflow-y-auto">
      {/* File Upload */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          1. Cargar Datos
        </label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          className="text-sm w-full p-2 rounded-md border border-border bg-card"
        />
        <p className="text-xs text-muted-foreground">Soporta archivos grandes (12k+)</p>
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
            onClick={() => setActiveTab(item.id)}
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

      {/* Reset */}
      <div className="mt-auto">
        <button
          onClick={resetData}
          className="w-full flex items-center justify-center gap-2 bg-destructive text-destructive-foreground p-2.5 rounded-md font-medium text-sm hover:opacity-90 transition-all hover:-translate-y-0.5"
        >
          <Trash2 className="w-4 h-4" />
          Limpiar Datos
        </button>
      </div>
    </aside>
  );
}
