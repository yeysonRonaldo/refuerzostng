import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Navigation, MapPin, Search, Filter, Route, ExternalLink, ChevronDown, ChevronUp, MapPinOff } from 'lucide-react';
import { toast } from 'sonner';

const GRAVITY_COLORS: Record<string, string> = {
  Alto: '#ef4444',
  Medio: '#f59e0b',
  Bajo: '#22c55e',
};

export default function RoutesView() {
  const { currentData, getPestName } = useAppContext();

  const [techFilter, setTechFilter] = useState('');
  const [gravityFilter, setGravityFilter] = useState<Record<string, boolean>>({
    Alto: true, Medio: true, Bajo: true,
  });
  const [minDays, setMinDays] = useState('');
  const [maxDays, setMaxDays] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(true);
  const [mapQuery, setMapQuery] = useState('');

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
        return (gScore[b.gravedad] || 0) * 1000 + b.diasActivos - ((gScore[a.gravedad] || 0) * 1000 + a.diasActivos);
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

  const selectAll = () => setSelectedIds(new Set(filteredData.map(d => d.id)));
  const clearSelection = () => { setSelectedIds(new Set()); setMapQuery(''); };

  const getDestinations = () => {
    const selectedItems = filteredData.filter(d => selectedIds.has(d.id));
    return selectedItems
      .map(i => {
        let query = '';
        if (i.cliente && i.cliente !== 'Desconocido') query += i.cliente;
        const addr = (i.direccion || '').trim();
        if (addr && addr.length > 2 && addr !== '-') query += ', ' + addr;
        return query;
      })
      .filter(s => s.length > 0);
  };

  const showOnMap = () => {
    if (selectedIds.size === 0) {
      toast.warning('Selecciona al menos un cliente.');
      return;
    }
    const destinations = getDestinations();
    if (destinations.length === 0) {
      toast.error('No se pudieron leer las direcciones.');
      return;
    }
    // Show first selected on embedded map
    setMapQuery(destinations[0]);
  };

  const openGoogleMapsRoute = () => {
    const destinations = getDestinations();
    if (destinations.length === 0) {
      toast.warning('Selecciona al menos un cliente.');
      return;
    }

    const encoded = destinations.map(s => encodeURIComponent(s));
    if (encoded.length > 10) toast.info('Google Maps soporta máximo 10 paradas.');

    if (encoded.length === 1) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encoded[0]}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir//${encoded.slice(0, 10).join('/')}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Planificador de Rutas</h2>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border"
        >
          <Filter className="w-3 h-3" />
          Filtros
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 items-end bg-card/80 backdrop-blur p-3 rounded-lg border border-border">
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Técnico</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                list="route-techs"
                value={techFilter}
                onChange={e => setTechFilter(e.target.value)}
                placeholder="Buscar técnico..."
                className="text-sm pl-7 pr-2 py-1.5 w-full rounded-md border border-border bg-background"
              />
              <datalist id="route-techs">
                {allTechnicians.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gravedad</label>
            <div className="flex gap-1.5">
              {(['Alto', 'Medio', 'Bajo'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGravityFilter(prev => ({ ...prev, [g]: !prev[g] }))}
                  className={`text-xs px-2.5 py-1.5 rounded-md border font-medium transition-all ${
                    gravityFilter[g]
                      ? g === 'Alto' ? 'bg-destructive/10 text-destructive border-destructive/30'
                        : g === 'Medio' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      : 'bg-muted/30 text-muted-foreground border-border opacity-50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Días Activos</label>
            <div className="flex gap-1 items-center">
              <input type="number" placeholder="Min" value={minDays} onChange={e => setMinDays(e.target.value)} className="text-sm py-1.5 px-2 rounded-md border border-border bg-background w-[60px]" />
              <span className="text-muted-foreground text-xs">→</span>
              <input type="number" placeholder="Max" value={maxDays} onChange={e => setMaxDays(e.target.value)} className="text-sm py-1.5 px-2 rounded-md border border-border bg-background w-[60px]" />
            </div>
          </div>
        </div>
      )}

      {/* Main content: split view */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: List */}
        <div className="w-[380px] flex-shrink-0 flex flex-col bg-card rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground">
              {filteredData.length} registros • {selectedIds.size} seleccionados
            </span>
            <div className="flex gap-1">
              <button onClick={selectAll} className="text-[10px] text-primary hover:underline">Todos</button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <button onClick={clearSelection} className="text-[10px] text-muted-foreground hover:text-foreground">Ninguno</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <MapPinOff className="w-8 h-8 opacity-30" />
                <span className="text-sm">Sin resultados</span>
              </div>
            ) : (
              filteredData.map((item, idx) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelection(item.id)}
                    className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-border/50 cursor-pointer transition-all hover:bg-accent/50 ${
                      isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
                        isSelected ? 'text-white' : 'bg-muted text-muted-foreground'
                      }`}
                      style={isSelected ? { background: GRAVITY_COLORS[item.gravedad] || '#64748b' } : {}}
                    >
                      {isSelected ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate">{item.cliente}</span>
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: GRAVITY_COLORS[item.gravedad] }}
                          title={item.gravedad}
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {item.direccion && item.direccion !== '-' ? item.direccion : 'Sin dirección'}
                        </span>
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                        <span>{item.diasActivos}d activos</span>
                        <span className="font-medium text-foreground/70">{getPestName(item.plaga)}</span>
                        <span>{item.tecnico}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-border p-3 flex flex-col gap-2 bg-card">
            <button
              onClick={showOnMap}
              disabled={selectedIds.size === 0}
              className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-2 rounded-md font-medium text-sm hover:bg-primary/20 transition-all disabled:opacity-40"
            >
              <MapPin className="w-4 h-4" />
              Ver en Mapa
            </button>
            <button
              onClick={openGoogleMapsRoute}
              disabled={selectedIds.size === 0}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-all disabled:opacity-40"
            >
              <Navigation className="w-4 h-4" />
              Ruta en Google Maps
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right: Map */}
        <div className="flex-1 rounded-lg border border-border overflow-hidden relative bg-card">
          {mapQuery ? (
            <iframe
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
              title="Mapa de ubicación"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <MapPin className="w-8 h-8 opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Selecciona clientes y pulsa "Ver en Mapa"</p>
                <p className="text-xs mt-1 opacity-70">O usa "Ruta en Google Maps" para navegación completa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
