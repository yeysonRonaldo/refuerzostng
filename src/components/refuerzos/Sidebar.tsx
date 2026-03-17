import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { parseExcelFile } from '@/lib/dataProcessor';
import { uploadToFirestore, loadFromFirestore, clearFirestoreData } from '@/lib/firestoreService';
import { LayoutDashboard, Activity, Database, Trash2, Upload, Download, Loader2, Users, LogOut } from 'lucide-react';
import { TabName } from '@/types/refuerzos';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function Sidebar() {
  const {
    processedData, activeTab, yearFilter, monthFilter,
    setProcessedData, setActiveTab, setYearFilter, setMonthFilter, resetData,
  } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [loadingFirestore, setLoadingFirestore] = useState(false);

  const years = Array.from(new Set(
    processedData
      .map(d => d.dateObj?.getFullYear() ?? d.anio)
      .filter(Boolean)
  )).sort((a, b) => (b as number) - (a as number));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { records, duplicatesSkipped } = await parseExcelFile(file);

      // Upload to Firestore
      toast.info(`Subiendo ${records.length} registros a Firebase...`);
      const { uploaded, skipped } = await uploadToFirestore(records);

      // Load all data from Firestore (includes previous data)
      const allData = await loadFromFirestore();
      setProcessedData(allData);

      const totalSkipped = duplicatesSkipped + skipped;
      toast.success(
        `✅ ${uploaded} registros nuevos subidos. ${totalSkipped > 0 ? `${totalSkipped} duplicados omitidos.` : ''} Total en BD: ${allData.length}`
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
          disabled={loading}
          className="text-sm w-full p-2 rounded-md border border-border bg-card disabled:opacity-50"
        />
        {loading && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="w-3 h-3 animate-spin" /> Procesando y subiendo...
          </div>
        )}
        <p className="text-xs text-muted-foreground">Sube Excel → se guarda en Firebase</p>

        <button
          onClick={handleLoadFromFirestore}
          disabled={loadingFirestore}
          className="flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md border border-border bg-card text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {loadingFirestore ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Cargar desde Firebase
        </button>
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
          onClick={handleReset}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-destructive text-destructive-foreground p-2.5 rounded-md font-medium text-sm hover:opacity-90 transition-all hover:-translate-y-0.5 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Limpiar Datos
        </button>
      </div>
    </aside>
  );
}
