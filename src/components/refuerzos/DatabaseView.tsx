import { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { RefuerzoRecord } from '@/types/refuerzos';
import { toast } from 'sonner';

const ROWS_PER_PAGE = 100;

function EditableCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className="w-full px-1 py-0.5 text-xs border border-primary rounded bg-card focus:outline-none"
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className="cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded block truncate"
      title={`${value || '-'} (clic para editar)`}
    >
      {value || '-'}
    </span>
  );
}

export default function DatabaseView() {
  const { currentData, drillDownFilter, setDrillDownFilter, getPestName, handleDrillDown, updateRecordField, reparseDates } = useAppContext();
  const [page, setPage] = useState(1);
  const [tableFilters, setTableFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [reparsing, setReparsing] = useState(false);

  const handleReparse = useCallback(async () => {
    if (reparsing) return;
    if (!confirm('Esto recalculará la fecha de TODOS los registros en Firestore usando el parser actualizado (formato mm/dd/yyyy). ¿Continuar?')) return;
    setReparsing(true);
    const tid = toast.loading('Reparseando fechas en Firestore...');
    try {
      const r = await reparseDates();
      toast.success(`Fechas reparseadas: ${r.updated} actualizadas, ${r.unchanged} sin cambios, ${r.failed} sin fecha válida (de ${r.scanned}).`, { id: tid });
    } catch (err) {
      toast.error(`Error al reparsear: ${err instanceof Error ? err.message : 'desconocido'}`, { id: tid });
    } finally {
      setReparsing(false);
    }
  }, [reparseDates, reparsing]);

  const handleFilterInput = useCallback((key: string, value: string) => {
    setTableFilters(prev => {
      const next = { ...prev };
      if (!value) delete next[key];
      else next[key] = value.toLowerCase();
      return next;
    });
    setPage(1);
  }, []);

  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key && prev.dir === 'asc') return { key, dir: 'desc' };
      return { key, dir: 'asc' };
    });
  }, []);

  const filteredData = useMemo(() => {
    let data = [...currentData];

    // Drill-down filter
    if (drillDownFilter) {
      const { type, value, extra } = drillDownFilter;
      data = data.filter(d => {
        const effectivePlaga = getPestName(d.plaga);
        if (type === 'gravedad') return d.gravedad === value;
        if (type === 'plaga') return effectivePlaga === value;
        if (type === 'tecnico') return (d.tecnico || '').includes(value);
        if (type === 'cliente') return d.cliente === value;
        if (type === 'priority') return d.diasActivos > 15;
        if (type === 'pest-trend') {
          if (!d.dateObj) return false;
          const key = `${d.dateObj.getFullYear()}-${String(d.dateObj.getMonth() + 1).padStart(2, '0')}`;
          return key === value && effectivePlaga === extra;
        }
        if (type === 'timeline') {
          if (!d.dateObj) return false;
          const key = `${d.dateObj.getFullYear()}-${String(d.dateObj.getMonth() + 1).padStart(2, '0')}`;
          if (extra === 'total') return key === value;
          const gravMatch = (extra === 'alto' && d.gravedad === 'Alto') ||
            (extra === 'medio' && d.gravedad === 'Medio') ||
            (extra === 'bajo' && d.gravedad !== 'Alto' && d.gravedad !== 'Medio');
          return key === value && gravMatch;
        }
        return true;
      });
    }

    // Table column filters
    Object.entries(tableFilters).forEach(([key, val]) => {
      data = data.filter(d => {
        let cellVal = '';
        if (key === 'dateObj') cellVal = d.displayDate;
        else if (key === 'plaga') cellVal = getPestName(d.plaga);
        else cellVal = String((d as unknown as Record<string, unknown>)[key] || '');
        return cellVal.toLowerCase().includes(val);
      });
    });

    // Sort
    if (sortConfig) {
      const { key, dir } = sortConfig;
      const mult = dir === 'asc' ? 1 : -1;
      data.sort((a, b) => {
        let valA: unknown = (a as unknown as Record<string, unknown>)[key];
        let valB: unknown = (b as unknown as Record<string, unknown>)[key];
        if (key === 'plaga') { valA = getPestName(a.plaga); valB = getPestName(b.plaga); }
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (key === 'dateObj') return ((valA as Date).getTime() - (valB as Date).getTime()) * mult;
        if (typeof valA === 'string') return (valA as string).localeCompare(valB as string) * mult;
        return ((valA as number) - (valB as number)) * mult;
      });
    }

    return data;
  }, [currentData, drillDownFilter, tableFilters, sortConfig, getPestName]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const pageData = filteredData.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const getFilterLabel = () => {
    if (!drillDownFilter) return '';
    const { type, value, extra } = drillDownFilter;
    if (type === 'gravedad') return `Gravedad: ${value}`;
    if (type === 'plaga') return `Plaga: ${value}`;
    if (type === 'tecnico') return `Técnico: ${value}`;
    if (type === 'cliente') return `Cliente: ${value}`;
    if (type === 'pest-trend') return `${extra} en ${value}`;
    if (type === 'timeline') return `${extra} en ${value}`;
    return '';
  };

  const columns: { key: string; label: string }[] = [
    { key: 'id', label: 'ID' },
    { key: 'dateObj', label: 'Fecha' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'diasActivos', label: 'Días' },
    { key: 'plaga', label: 'Plaga' },
    { key: 'gravedad', label: 'Gravedad' },
    { key: 'direccion', label: 'Dirección' },
    { key: 'causaRefuerzo', label: 'Causa de Refuerzo' },
    { key: 'observaciones', label: 'Observaciones' },
    { key: 'fechaCarga', label: 'Fecha Carga' },
  ];

  const gravTagClass = (g: string) => {
    if (g === 'Alto') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (g === 'Medio') return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-success/10 text-success border-success/20';
  };

  return (
    <div className="bg-card rounded-xl border border-border flex flex-col h-full max-h-[calc(100vh-100px)] shadow-soft overflow-hidden">
      {/* Filter banner */}
      {drillDownFilter && (
        <div className="bg-primary/5 text-primary px-4 py-2.5 border-b border-primary/20 flex justify-between items-center text-sm">
          <span><strong>Filtro Activo:</strong> {getFilterLabel()} ({filteredData.length} regs)</span>
          <button
            onClick={() => setDrillDownFilter(null)}
            className="text-xs px-2.5 py-1 rounded-md border border-primary/30 bg-card hover:bg-accent transition-colors"
          >
            ✕ Quitar Filtro
          </button>
        </div>
      )}

      {/* Pagination */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border flex flex-wrap justify-between items-center gap-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-card disabled:opacity-40 hover:bg-accent transition-colors font-medium"
          >
            ← Anterior
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">
            <strong className="text-foreground">{page}</strong> / {totalPages || 1}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-card disabled:opacity-40 hover:bg-accent transition-colors font-medium"
          >
            Siguiente →
          </button>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          <strong className="text-foreground">{filteredData.length.toLocaleString()}</strong> registros
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {currentData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 py-16">
            <Database className="w-16 h-16 mb-4 opacity-30" />
            <p>Carga un archivo Excel/CSV para ver la base de datos.</p>
          </div>
        ) : (
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[900px]">
            <thead className="bg-muted/40 sticky top-0 z-10 backdrop-blur shadow-sm">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="text-left p-2.5 font-semibold text-muted-foreground whitespace-nowrap border-b border-border">
                    <div className="flex items-center justify-between cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort(col.key)}>
                      {col.label}
                      <span className={`text-xs ml-1 ${sortConfig?.key === col.key ? 'text-primary' : 'text-border'}`}>
                        {sortConfig?.key === col.key ? (sortConfig.dir === 'asc' ? '↑' : '↓') : '⇅'}
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Filtrar…"
                      onChange={e => handleFilterInput(col.key, e.target.value)}
                      className="w-full mt-1 px-1.5 py-1 text-xs border border-border rounded bg-card focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground/40">No hay resultados</td></tr>
              ) : (
                pageData.map((r, idx) => (
                  <tr
                    key={r._dedupeKey + r.id}
                    className={`border-b border-border/40 hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                  >
                    <td className="p-2 font-bold text-foreground/80">{r.id}</td>
                    <td className="p-2 whitespace-nowrap text-muted-foreground">{r.displayDate}</td>
                    <td className="p-2 max-w-[200px] truncate font-medium">{r.cliente}</td>
                    <td className="p-2 whitespace-nowrap">
                      {r.diasActivos > 15 && <span className="bg-destructive/15 text-destructive text-[10px] px-1.5 py-0.5 rounded mr-1 font-bold">!</span>}
                      <span className="tabular-nums">{r.diasActivos}d</span>
                    </td>
                    <td className="p-2 max-w-[200px] truncate">{getPestName(r.plaga)}</td>
                    <td className="p-2">
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${gravTagClass(r.gravedad)}`}>{r.gravedad}</span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate">{r.direccion}</td>
                    <td className="p-2 text-xs max-w-[180px]">
                      <EditableCell
                        value={r.causaRefuerzo}
                        onSave={v => updateRecordField(r._dedupeKey, 'causaRefuerzo', v)}
                      />
                    </td>
                    <td className="p-2 text-xs max-w-[200px]">
                      <EditableCell
                        value={r.observaciones}
                        onSave={v => updateRecordField(r._dedupeKey, 'observaciones', v)}
                      />
                    </td>
                    <td className="p-2 text-xs whitespace-nowrap text-muted-foreground/70">{r.fechaCarga || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Database({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}
