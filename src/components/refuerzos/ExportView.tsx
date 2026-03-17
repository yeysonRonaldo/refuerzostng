import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function ExportView() {
  const { currentData } = useAppContext();

  const [clientFilter, setClientFilter] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [gravityFilter, setGravityFilter] = useState<Record<string, boolean>>({
    Alto: true, Medio: true, Bajo: true,
  });

  const allClients = useMemo(() => {
    const set = new Set<string>();
    currentData.forEach(d => {
      if (d.cliente && d.cliente !== 'Desconocido') set.add(d.cliente);
    });
    return Array.from(set).sort();
  }, [currentData]);

  const allTechnicians = useMemo(() => {
    const set = new Set<string>();
    currentData.forEach(d => {
      if (d.tecnico && d.tecnico !== '-' && d.tecnico !== '---') {
        d.tecnico.split(/,| y /i).forEach(p => {
          const t = p.trim();
          if (t.length > 1) set.add(t);
        });
      }
    });
    return Array.from(set).sort();
  }, [currentData]);

  const getFilteredData = () => {
    const clientLower = clientFilter.toLowerCase().trim();
    const techLower = techFilter.toLowerCase().trim();
    const gravities = Object.entries(gravityFilter).filter(([, v]) => v).map(([k]) => k);

    return currentData.filter(d => {
      const matchClient = clientLower === '' || d.cliente.toLowerCase().includes(clientLower);
      const matchTech = techLower === '' || (d.tecnico || '').toLowerCase().includes(techLower);
      const matchGravity = gravities.includes(d.gravedad);
      return matchClient && matchTech && matchGravity;
    });
  };

  const exportFiltered = () => {
    const data = getFilteredData();
    if (data.length === 0) {
      toast.warning('No hay datos que coincidan con estos filtros.');
      return;
    }
    downloadExcel(data.map(d => d.originalData), 'Exportacion_Filtrada');
  };

  const exportAll = () => {
    if (currentData.length === 0) {
      toast.warning('No hay datos en el periodo seleccionado para exportar.');
      return;
    }
    downloadExcel(currentData.map(d => d.originalData), 'Exportacion_Periodo_Completo');
  };

  const downloadExcel = (rows: Record<string, unknown>[], prefix: string) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `${prefix}_${dateStr}.xlsx`);
    toast.success(`✅ ${rows.length} registros exportados.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <FileSpreadsheet className="w-5 h-5" />
          Descargar Base de Datos
        </h3>
        <p className="text-muted-foreground text-sm mb-5">
          Filtra la información que necesitas y descarga todos los detalles originales de los registros en formato Excel.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</label>
            <input
              type="text"
              list="export-clients"
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              placeholder="En blanco = Todos los clientes"
              className="text-sm p-2 rounded-md border border-border bg-card"
            />
            <datalist id="export-clients">
              {allClients.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Técnico</label>
            <input
              type="text"
              list="export-techs"
              value={techFilter}
              onChange={e => setTechFilter(e.target.value)}
              placeholder="En blanco = Todos los técnicos"
              className="text-sm p-2 rounded-md border border-border bg-card"
            />
            <datalist id="export-techs">
              {allTechnicians.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nivel Infestación</label>
            <div className="flex gap-3">
              {(['Alto', 'Medio', 'Bajo'] as const).map(g => (
                <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gravityFilter[g]}
                    onChange={e => setGravityFilter(prev => ({ ...prev, [g]: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 items-center pt-4 border-t border-border">
          <button
            onClick={exportFiltered}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-md font-medium text-sm hover:opacity-90 transition-all"
          >
            <Download className="w-4 h-4" />
            Descargar Filtrado
          </button>
          <button
            onClick={exportAll}
            className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2.5 rounded-md font-medium text-sm hover:bg-accent transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Descargar Todo el Periodo
          </button>
          <span className="text-sm text-muted-foreground ml-2">
            {currentData.length} registros en el periodo actual
          </span>
        </div>
      </div>
    </div>
  );
}
