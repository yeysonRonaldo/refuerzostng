import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Navigation, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function RoutesView() {
  const { currentData, getPestName } = useAppContext();

  const [techFilter, setTechFilter] = useState('');
  const [gravityFilter, setGravityFilter] = useState<Record<string, boolean>>({
    Alto: true, Medio: true, Bajo: true,
  });
  const [minDays, setMinDays] = useState('');
  const [maxDays, setMaxDays] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allTechnicians = useMemo(() => {
    const set = new Set<string>();
    currentData.forEach(d => {
      const raw = d.tecnico;
      if (raw && raw.length > 2 && raw !== '-' && raw !== '---') {
        raw.split(/,| y /i).forEach(p => {
          const t = p.trim();
          if (t.length > 1) set.add(t);
        });
      }
    });
    return Array.from(set).sort();
  }, [currentData]);

  const filteredData = useMemo(() => {
    const min = parseInt(minDays) || 0;
    const max = parseInt(maxDays) || 99999;
    const techLower = techFilter.toLowerCase().trim();

    return currentData
      .filter(d => {
        const techVal = (d.tecnico || '').toLowerCase();
        const matchTech = techLower === '' || techVal.includes(techLower);
        const matchGravity = gravityFilter[d.gravedad] === true;
        const matchDays = d.diasActivos >= min && d.diasActivos <= max;
        const pName = getPestName(d.plaga);
        const hasPest = pName && pName !== '-' && pName !== '---';
        return matchTech && matchGravity && matchDays && hasPest;
      })
      .sort((a, b) => {
        const gScore: Record<string, number> = { Alto: 3, Medio: 2, Bajo: 1 };
        const scoreA = (gScore[a.gravedad] || 0) * 1000 + a.diasActivos;
        const scoreB = (gScore[b.gravedad] || 0) * 1000 + b.diasActivos;
        return scoreB - scoreA;
      });
  }, [currentData, techFilter, gravityFilter, minDays, maxDays, getPestName]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openGoogleMapsRoute = () => {
    if (selectedIds.size === 0) {
      toast.warning('Selecciona al menos un cliente para generar la ruta.');
      return;
    }

    const selectedItems = filteredData.filter(d => selectedIds.has(d.id));
    const destinations = selectedItems
      .map(i => {
        let query = '';
        if (i.cliente && i.cliente !== 'Desconocido') query += i.cliente;
        const addr = (i.direccion || '').trim();
        if (addr && addr.length > 2 && addr !== '-' && addr !== '---') {
          query += ', ' + addr;
        }
        return query;
      })
      .filter(s => s.length > 0);

    if (destinations.length === 0) {
      toast.error('No se pudieron leer las direcciones de los registros seleccionados.');
      return;
    }

    const encoded = destinations.map(s => encodeURIComponent(s));

    if (encoded.length === 1) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encoded[0]}`, '_blank');
    } else {
      if (encoded.length > 10) {
        toast.info('Google Maps soporta máximo 10 paradas. Se usarán las primeras 10.');
      }
      const sliced = encoded.slice(0, 10);
      window.open(`https://www.google.com/maps/dir//${sliced.join('/')}`, '_blank');
    }
  };

  const gravityColor: Record<string, string> = {
    Alto: 'bg-destructive/10 text-destructive border-destructive/30',
    Medio: 'bg-warning/10 text-warning border-warning/30',
    Bajo: 'bg-success/10 text-success border-success/30',
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-card p-4 rounded-lg border border-border">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por Técnico</label>
          <input
            type="text"
            list="route-techs"
            value={techFilter}
            onChange={e => setTechFilter(e.target.value)}
            placeholder="Escribe para buscar..."
            className="text-sm p-2 rounded-md border border-border bg-card"
          />
          <datalist id="route-techs">
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

        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rango Días Activos</label>
          <div className="flex gap-1 items-center">
            <input type="number" placeholder="Min" value={minDays} onChange={e => setMinDays(e.target.value)} className="text-sm p-2 rounded-md border border-border bg-card w-[70px]" />
            <span className="text-muted-foreground">-</span>
            <input type="number" placeholder="Max" value={maxDays} onChange={e => setMaxDays(e.target.value)} className="text-sm p-2 rounded-md border border-border bg-card w-[70px]" />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm text-primary">
        <strong>Instrucciones:</strong> Filtra los registros y selecciona con las casillas los clientes a visitar. Luego pulsa "Ver Ruta en Google Maps".
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {filteredData.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No hay registros con estos filtros.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredData.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  className="w-5 h-5 rounded cursor-pointer flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{item.cliente}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {item.direccion && item.direccion !== '-'
                      ? <span className="truncate">{item.direccion}</span>
                      : <span className="text-destructive">Sin dirección exacta</span>
                    }
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.tecnico} • {item.diasActivos} días activos • <strong className="text-foreground">{getPestName(item.plaga)}</strong>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded border ${gravityColor[item.gravedad] || ''}`}>
                  {item.gravedad}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="fixed bottom-0 right-0 left-[260px] bg-card border-t border-border p-3 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-bold text-lg">{selectedIds.size}</span> Clientes seleccionados
        </div>
        <button
          onClick={openGoogleMapsRoute}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-md font-medium text-sm hover:opacity-90 transition-all"
        >
          <Navigation className="w-4 h-4" />
          Ver Ruta en Google Maps
        </button>
      </div>
    </div>
  );
}
