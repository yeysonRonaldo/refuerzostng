import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '@/context/AppContext';
import { buildCombinedPest } from '@/lib/pestUtils';
import { ArrowDown, ArrowUp, ArrowLeftRight, Minus, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Download, X, User, Building2, Hash, MapPin, Bug, ShieldAlert } from 'lucide-react';
import { RefuerzoRecord } from '@/types/refuerzos';

type DetailContext =
  | { kind: 'tecnico'; name: string }
  | { kind: 'plaga'; name: string }
  | { kind: 'cliente'; name: string };

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type Direction = 'lowerIsBetter' | 'higherIsBetter' | 'neutral';

interface KpiCardData {
  label: string;
  current: number;
  previous: number;
  format?: (n: number) => string;
  direction: Direction;
  hint?: string;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES');
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtFloat = (n: number) => n.toFixed(2);

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

function deltaTone(delta: number, direction: Direction): 'good' | 'bad' | 'flat' {
  if (delta === 0) return 'flat';
  if (direction === 'neutral') return 'flat';
  if (direction === 'lowerIsBetter') return delta < 0 ? 'good' : 'bad';
  return delta > 0 ? 'good' : 'bad';
}

function KpiCard({ data }: { data: KpiCardData }) {
  const delta = data.current - data.previous;
  const pct = pctChange(data.current, data.previous);
  const tone = deltaTone(delta, data.direction);
  const fmt = data.format ?? fmtInt;

  const toneClasses =
    tone === 'good' ? 'text-success bg-success/10 border-success/20'
    : tone === 'bad' ? 'text-destructive bg-destructive/10 border-destructive/20'
    : 'text-muted-foreground bg-muted/40 border-border';

  const Icon = tone === 'good' ? ArrowDown : tone === 'bad' ? ArrowUp : Minus;
  // Flip arrow direction by semantics: if higherIsBetter and good → up arrow
  const ArrowIcon = (() => {
    if (delta === 0) return Minus;
    return delta > 0 ? ArrowUp : ArrowDown;
  })();

  return (
    <div className="bg-card rounded-lg border border-border p-4 flex flex-col gap-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{data.label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-2xl font-bold text-foreground">{fmt(data.current)}</div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md border ${toneClasses}`}>
          <ArrowIcon className="w-3 h-3" />
          {pct === null ? 'N/D' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Anterior: <span className="font-medium text-foreground/80">{fmt(data.previous)}</span>
        {' · '}Δ <span className={`font-semibold ${tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-destructive' : ''}`}>
          {delta > 0 ? '+' : ''}{fmt(Math.abs(delta) === Math.round(Math.abs(delta)) ? delta : Number(delta.toFixed(2)))}
        </span>
      </div>
      {data.hint && <div className="text-[10px] text-muted-foreground/70 italic">{data.hint}</div>}
    </div>
  );
}

interface PeriodStats {
  total: number;
  high: number;
  mid: number;
  low: number;
  uniqueClients: number;
  avgDiasActivos: number;
  severityIndex: number;
  pestKeys: Set<string>; // cliente|plaga
  byTech: Map<string, { total: number; high: number }>;
  byPest: Map<string, number>;
  byClient: Map<string, number>;
  records: RefuerzoRecord[];
}

function emptyStats(): PeriodStats {
  return {
    total: 0, high: 0, mid: 0, low: 0, uniqueClients: 0, avgDiasActivos: 0, severityIndex: 0,
    pestKeys: new Set(), byTech: new Map(), byPest: new Map(), byClient: new Map(), records: [],
  };
}

export default function MonthlyProjectionView() {
  const { processedData, getPestName, yearFilter, techFilter, isGrouped, handleDrillDown } = useAppContext();
  const getCombinedPest = (r: RefuerzoRecord) => buildCombinedPest(r, getPestName);
  const [detail, setDetail] = useState<DetailContext | null>(null);

  // Available months (respecting year filter)
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    processedData.forEach(d => {
      if (!d.dateObj) return;
      const y = d.dateObj.getUTCFullYear();
      if (yearFilter !== 'all' && y.toString() !== yearFilter) return;
      const m = d.dateObj.getUTCMonth();
      set.add(`${y}-${String(m + 1).padStart(2, '0')}`);
    });
    return Array.from(set).sort().reverse();
  }, [processedData, yearFilter]);

  const [currentMonth, setCurrentMonth] = useState('');
  const [compareMonth, setCompareMonth] = useState('');

  // Default selection: latest + previous
  useEffect(() => {
    if (monthOptions.length === 0) return;
    if (!currentMonth || !monthOptions.includes(currentMonth)) {
      setCurrentMonth(monthOptions[0]);
    }
    if (!compareMonth || !monthOptions.includes(compareMonth)) {
      setCompareMonth(monthOptions[1] ?? monthOptions[0]);
    }
  }, [monthOptions, currentMonth, compareMonth]);

  const techScoped = useMemo(
    () => techFilter === 'all' ? processedData : processedData.filter(r => r.tecnico === techFilter),
    [processedData, techFilter],
  );

  // Pre-index records by month key — single pass over all data, reused everywhere.
  const recordsByMonth = useMemo(() => {
    const idx = new Map<string, RefuerzoRecord[]>();
    techScoped.forEach(r => {
      if (!r.dateObj) return;
      const key = `${r.dateObj.getUTCFullYear()}-${String(r.dateObj.getUTCMonth() + 1).padStart(2, '0')}`;
      const arr = idx.get(key);
      if (arr) arr.push(r); else idx.set(key, [r]);
    });
    return idx;
  }, [techScoped]);

  const buildStats = useMemo(() => (key: string): PeriodStats => {
    if (!key) return emptyStats();
    const recs = recordsByMonth.get(key);
    if (!recs || recs.length === 0) return emptyStats();
    const stats = emptyStats();
    const clients = new Set<string>();
    let diasSum = 0, diasCount = 0;
    recs.forEach(r => {
      stats.records.push(r);
      stats.total++;
      if (r.gravedad === 'Alto') stats.high++;
      else if (r.gravedad === 'Medio') stats.mid++;
      else stats.low++;
      if (r.cliente) clients.add(r.cliente);
      if (typeof r.diasActivos === 'number' && !isNaN(r.diasActivos)) {
        diasSum += r.diasActivos; diasCount++;
      }
      const pest = buildCombinedPest(r, getPestName);
      stats.pestKeys.add(`${r.cliente}|${pest}`);
      if (pest && pest !== '---') {
        stats.byPest.set(pest, (stats.byPest.get(pest) ?? 0) + 1);
      }
      if (r.cliente) {
        stats.byClient.set(r.cliente, (stats.byClient.get(r.cliente) ?? 0) + 1);
      }
      if (r.tecnico && r.tecnico !== '-') {
        const t = stats.byTech.get(r.tecnico) ?? { total: 0, high: 0 };
        t.total++;
        if (r.gravedad === 'Alto') t.high++;
        stats.byTech.set(r.tecnico, t);
      }
    });
    stats.uniqueClients = clients.size;
    stats.avgDiasActivos = diasCount > 0 ? diasSum / diasCount : 0;
    stats.severityIndex = stats.total > 0
      ? (stats.high * 3 + stats.mid * 2 + stats.low * 1) / stats.total
      : 0;
    return stats;
  }, [recordsByMonth, getPestName]);

  const currStats = useMemo(() => buildStats(currentMonth), [buildStats, currentMonth]);
  const prevStats = useMemo(() => buildStats(compareMonth), [buildStats, compareMonth]);

  // Cases new / solved / persistent
  const movement = useMemo(() => {
    let nuevos = 0, solventados = 0, persistentes = 0;
    currStats.pestKeys.forEach(k => {
      if (prevStats.pestKeys.has(k)) persistentes++; else nuevos++;
    });
    prevStats.pestKeys.forEach(k => { if (!currStats.pestKeys.has(k)) solventados++; });
    const denom = persistentes + solventados;
    const tasaResolucion = denom > 0 ? (solventados / denom) * 100 : 0;
    return { nuevos, solventados, persistentes, tasaResolucion };
  }, [currStats, prevStats]);

  const prevMovement = useMemo(() => {
    if (!compareMonth) return { nuevos: 0, solventados: 0, persistentes: 0, tasaResolucion: 0 };
    const idx = monthOptions.indexOf(compareMonth);
    const earlierKey = monthOptions[idx + 1];
    if (!earlierKey) return { nuevos: prevStats.pestKeys.size, solventados: 0, persistentes: 0, tasaResolucion: 0 };
    const earlier = buildStats(earlierKey);
    let nuevos = 0, solventados = 0, persistentes = 0;
    prevStats.pestKeys.forEach(k => {
      if (earlier.pestKeys.has(k)) persistentes++; else nuevos++;
    });
    earlier.pestKeys.forEach(k => { if (!prevStats.pestKeys.has(k)) solventados++; });
    const denom = persistentes + solventados;
    return { nuevos, solventados, persistentes, tasaResolucion: denom > 0 ? (solventados / denom) * 100 : 0 };
  }, [compareMonth, prevStats, monthOptions, buildStats]);

  const kpis: KpiCardData[] = [
    { label: 'Total Refuerzos', current: currStats.total, previous: prevStats.total, direction: 'lowerIsBetter' },
    { label: 'Casos Alto', current: currStats.high, previous: prevStats.high, direction: 'lowerIsBetter' },
    { label: 'Casos Medio', current: currStats.mid, previous: prevStats.mid, direction: 'lowerIsBetter' },
    { label: 'Casos Bajo', current: currStats.low, previous: prevStats.low, direction: 'lowerIsBetter' },
    { label: 'Clientes Únicos', current: currStats.uniqueClients, previous: prevStats.uniqueClients, direction: 'lowerIsBetter' },
    { label: 'Casos Nuevos', current: movement.nuevos, previous: prevMovement.nuevos, direction: 'lowerIsBetter', hint: 'Cliente+Plaga sin antecedente el mes previo' },
    { label: 'Casos Solventados', current: movement.solventados, previous: prevMovement.solventados, direction: 'higherIsBetter', hint: 'Estaban antes y ya no aparecen' },
    { label: 'Casos Persistentes', current: movement.persistentes, previous: prevMovement.persistentes, direction: 'lowerIsBetter' },
    { label: 'Tasa Resolución', current: movement.tasaResolucion, previous: prevMovement.tasaResolucion, direction: 'higherIsBetter', format: fmtPct, hint: 'Solventados / (Persistentes + Solventados)' },
    { label: 'Promedio Días Activos', current: currStats.avgDiasActivos, previous: prevStats.avgDiasActivos, direction: 'lowerIsBetter', format: fmtFloat },
    { label: 'Índice de Severidad', current: currStats.severityIndex, previous: prevStats.severityIndex, direction: 'lowerIsBetter', format: fmtFloat, hint: '(Alto×3 + Medio×2 + Bajo×1) / total' },
  ];

  // Projection (only if currentMonth is the calendar month in progress)
  const projection = useMemo(() => {
    if (!currentMonth) return null;
    const [yStr, mStr] = currentMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const today = new Date();
    if (today.getUTCFullYear() !== y || today.getUTCMonth() !== m) return null;
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const dayOfMonth = today.getUTCDate();
    const fraction = dayOfMonth / daysInMonth;
    const projected = fraction > 0 ? currStats.total / fraction : currStats.total;
    const vsPrev = prevStats.total > 0 ? ((projected - prevStats.total) / prevStats.total) * 100 : null;
    return { daysInMonth, dayOfMonth, projected, vsPrev };
  }, [currentMonth, currStats, prevStats]);

  // Tech ranking
  const techRanking = useMemo(() => {
    const allTechs = new Set<string>([...currStats.byTech.keys(), ...prevStats.byTech.keys()]);
    const rows = Array.from(allTechs).map(name => {
      const c = currStats.byTech.get(name) ?? { total: 0, high: 0 };
      const p = prevStats.byTech.get(name) ?? { total: 0, high: 0 };
      const delta = c.total - p.total;
      const pct = pctChange(c.total, p.total);
      const flag: 'nuevo' | 'sin-casos' | null = p.total === 0 && c.total > 0 ? 'nuevo'
        : c.total === 0 && p.total > 0 ? 'sin-casos'
        : null;
      return { name, current: c.total, previous: p.total, delta, pct, currHigh: c.high, prevHigh: p.high, flag };
    });
    return {
      mejoraron: rows.filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta),
      empeoraron: rows.filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta),
      iguales: rows.filter(r => r.delta === 0 && r.current > 0),
    };
  }, [currStats, prevStats]);

  // Pest ranking
  const pestRanking = useMemo(() => {
    const all = new Set<string>([...currStats.byPest.keys(), ...prevStats.byPest.keys()]);
    const rows = Array.from(all).map(name => {
      const c = currStats.byPest.get(name) ?? 0;
      const p = prevStats.byPest.get(name) ?? 0;
      return { name, current: c, previous: p, delta: c - p, pct: pctChange(c, p) };
    });
    const maxVal = Math.max(1, ...rows.map(r => Math.max(r.current, r.previous)));
    return {
      creciendo: rows.filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 12),
      disminuyendo: rows.filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 12),
      maxVal,
    };
  }, [currStats, prevStats]);

  // Client ranking
  const clientRanking = useMemo(() => {
    const all = new Set<string>([...currStats.byClient.keys(), ...prevStats.byClient.keys()]);
    const rows = Array.from(all).map(name => {
      const c = currStats.byClient.get(name) ?? 0;
      const p = prevStats.byClient.get(name) ?? 0;
      return { name, current: c, previous: p, delta: c - p, pct: pctChange(c, p) };
    });
    return {
      empeoraron: rows.filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10),
      mejoraron: rows.filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10),
    };
  }, [currStats, prevStats]);

  // Multi-month trend (last 12 months up to currentMonth)
  const trend = useMemo(() => {
    if (!currentMonth) return [];
    const idx = monthOptions.indexOf(currentMonth);
    const window = monthOptions.slice(idx, idx + 12).reverse(); // chronological asc
    return window.map(key => {
      const s = buildStats(key);
      const [y, m] = key.split('-');
      return {
        key,
        label: `${SHORT_MONTHS[parseInt(m) - 1]} ${y.substring(2)}`,
        total: s.total,
        high: s.high,
        mid: s.mid,
        low: s.low,
      };
    });
  }, [currentMonth, monthOptions, buildStats]);

  // Insights
  const insights = useMemo(() => {
    const out: { tone: 'good' | 'bad' | 'info'; text: string }[] = [];
    if (!currentMonth || !compareMonth) return out;

    const totalPct = pctChange(currStats.total, prevStats.total);
    if (totalPct !== null && Math.abs(totalPct) >= 1) {
      out.push({
        tone: totalPct < 0 ? 'good' : 'bad',
        text: `Los refuerzos ${totalPct < 0 ? 'bajaron' : 'subieron'} ${Math.abs(totalPct).toFixed(1)}% (${prevStats.total} → ${currStats.total}).`,
      });
    }
    const altoPct = pctChange(currStats.high, prevStats.high);
    if (altoPct !== null && Math.abs(altoPct) >= 5) {
      out.push({
        tone: altoPct < 0 ? 'good' : 'bad',
        text: `Casos de gravedad Alta ${altoPct < 0 ? 'disminuyeron' : 'aumentaron'} ${Math.abs(altoPct).toFixed(1)}% (${prevStats.high} → ${currStats.high}).`,
      });
    }
    if (pestRanking.creciendo[0]) {
      const p = pestRanking.creciendo[0];
      out.push({ tone: 'bad', text: `Plaga en mayor crecimiento: ${p.name} (+${p.delta} casos${p.pct !== null ? `, ${p.pct.toFixed(0)}%` : ''}).` });
    }
    if (pestRanking.disminuyendo[0]) {
      const p = pestRanking.disminuyendo[0];
      out.push({ tone: 'good', text: `Plaga con mayor reducción: ${p.name} (${p.delta} casos${p.pct !== null ? `, ${p.pct.toFixed(0)}%` : ''}).` });
    }
    if (techRanking.mejoraron[0] && techRanking.mejoraron[0].previous > 0) {
      const t = techRanking.mejoraron[0];
      out.push({ tone: 'good', text: `Técnico con mayor mejora: ${t.name} (${t.previous} → ${t.current}${t.pct !== null ? `, ${t.pct.toFixed(0)}%` : ''}).` });
    }
    if (techRanking.empeoraron[0]) {
      const t = techRanking.empeoraron[0];
      out.push({ tone: 'bad', text: `Técnico con mayor incremento: ${t.name} (${t.previous} → ${t.current}${t.pct !== null ? `, +${t.pct.toFixed(0)}%` : ''}).` });
    }
    if (movement.nuevos > 0) {
      const altosNuevos = currStats.records.filter(r => {
        const k = `${r.cliente}|${getCombinedPest(r)}`;
        return r.gravedad === 'Alto' && !prevStats.pestKeys.has(k);
      }).length;
      if (altosNuevos > 0) {
        out.push({ tone: 'bad', text: `Alerta: ${altosNuevos} caso(s) nuevo(s) con gravedad Alta.` });
      }
    }
    return out;
  }, [currStats, prevStats, pestRanking, techRanking, movement, currentMonth, compareMonth]);

  const swapMonths = () => {
    setCurrentMonth(compareMonth);
    setCompareMonth(currentMonth);
  };

  const labelOf = (key: string) => {
    if (!key) return '';
    const [y, m] = key.split('-');
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  };

  const exportToExcel = () => {
    if (!currentMonth || !compareMonth) return;
    const wb = XLSX.utils.book_new();
    const labelA = labelOf(currentMonth), labelB = labelOf(compareMonth);

    // KPIs
    const kpiRows = kpis.map(k => ({
      Métrica: k.label,
      [labelB]: typeof k.previous === 'number' ? +k.previous.toFixed(2) : k.previous,
      [labelA]: typeof k.current === 'number' ? +k.current.toFixed(2) : k.current,
      'Δ Absoluto': +(k.current - k.previous).toFixed(2),
      'Δ %': pctChange(k.current, k.previous) ?? 'N/D',
    }));
    const wsKpi = XLSX.utils.json_to_sheet(kpiRows);
    wsKpi['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsKpi, 'Resumen KPIs');

    const buildRows = <T extends { name: string; previous: number; current: number; delta: number; pct: number | null }>(rows: T[]) =>
      rows.map(r => ({
        Nombre: r.name,
        [labelB]: r.previous,
        [labelA]: r.current,
        'Δ': r.delta,
        'Δ %': r.pct === null ? 'N/D' : +r.pct.toFixed(1),
      }));

    const wsTech = XLSX.utils.json_to_sheet(
      [...techRanking.empeoraron, ...techRanking.mejoraron, ...techRanking.iguales].map(r => ({
        Técnico: r.name,
        [labelB]: r.previous,
        [labelA]: r.current,
        'Δ': r.delta,
        'Δ %': r.pct === null ? 'N/D' : +r.pct.toFixed(1),
        'Alto Anterior': r.prevHigh,
        'Alto Actual': r.currHigh,
        Estado: r.flag === 'nuevo' ? 'Nuevo' : r.flag === 'sin-casos' ? 'Sin casos' : '',
      })),
    );
    wsTech['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsTech, 'Técnicos');

    const wsPest = XLSX.utils.json_to_sheet(buildRows([...pestRanking.creciendo, ...pestRanking.disminuyendo]));
    wsPest['!cols'] = [{ wch: 35 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsPest, 'Plagas');

    const wsClient = XLSX.utils.json_to_sheet(buildRows([...clientRanking.empeoraron, ...clientRanking.mejoraron]));
    wsClient['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsClient, 'Clientes');

    const wsTrend = XLSX.utils.json_to_sheet(trend.map(t => ({
      Mes: t.label, Total: t.total, Alto: t.high, Medio: t.mid, Bajo: t.low,
    })));
    wsTrend['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsTrend, 'Tendencia');

    if (projection) {
      const wsProj = XLSX.utils.json_to_sheet([{
        'Mes en curso': labelA,
        'Día actual': projection.dayOfMonth,
        'Días del mes': projection.daysInMonth,
        'Refuerzos al día': currStats.total,
        'Proyección fin de mes': Math.round(projection.projected),
        'Mes anterior': prevStats.total,
        'Δ % proyectada': projection.vsPrev === null ? 'N/D' : +projection.vsPrev.toFixed(1),
      }]);
      XLSX.utils.book_append_sheet(wb, wsProj, 'Proyección');
    }

    XLSX.writeFile(wb, `proyeccion-${currentMonth}-vs-${compareMonth}.xlsx`);
  };

  if (processedData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
        Carga datos para ver la proyección mensual.
      </div>
    );
  }

  // ----- Trend chart (SVG) -----
  const renderTrendChart = () => {
    if (trend.length < 2) return <p className="text-center text-muted-foreground/50 py-10 text-sm">Se necesitan al menos 2 meses para graficar la tendencia.</p>;
    const width = 900, height = 260;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxVal = Math.max(...trend.map(t => t.total), 10);
    const yMax = Math.ceil(maxVal * 1.1);
    const stepX = chartW / (trend.length - 1);
    const getX = (i: number) => pad.left + i * stepX;
    const getY = (v: number) => height - pad.bottom - (v / yMax) * chartH;

    // Moving average (3-month)
    const ma = trend.map((_, i) => {
      const slice = trend.slice(Math.max(0, i - 2), i + 1);
      return slice.reduce((s, x) => s + x.total, 0) / slice.length;
    });

    const grids = Array.from({ length: 6 }, (_, i) => {
      const v = Math.round((yMax / 5) * i);
      return { v, y: getY(v) };
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
        {grids.map(g => (
          <g key={g.v}>
            <line x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y} stroke="#f1f5f9" strokeDasharray="4" />
            <text x={pad.left - 8} y={g.y} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-muted-foreground">{g.v}</text>
          </g>
        ))}
        <polyline
          points={trend.map((t, i) => `${getX(i)},${getY(t.total)}`).join(' ')}
          fill="none" stroke="hsl(var(--primary))" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round"
        />
        <polyline
          points={trend.map((t, i) => `${getX(i)},${getY(t.high)}`).join(' ')}
          fill="none" stroke="hsl(var(--destructive))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
        />
        <polyline
          points={ma.map((v, i) => `${getX(i)},${getY(v)}`).join(' ')}
          fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="6 4"
        />
        {trend.map((t, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={getY(t.total)} r={4} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />
            <text x={getX(i)} y={getY(t.total) - 10} textAnchor="middle" className="text-[10px] font-bold" style={{ fill: 'hsl(var(--primary))' }}>{t.total}</text>
            <text x={getX(i)} y={height - 12} textAnchor="middle" className="text-[10px] fill-muted-foreground">{t.label}</text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Mes Actual (A)</label>
          <select value={currentMonth} onChange={e => setCurrentMonth(e.target.value)}
            className="text-sm p-2 rounded-md border border-border bg-card">
            <option value="">Selecciona...</option>
            {monthOptions.map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
          </select>
        </div>
        <button onClick={swapMonths} title="Intercambiar"
          className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition">
          <ArrowLeftRight className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Mes Comparación (B)</label>
          <select value={compareMonth} onChange={e => setCompareMonth(e.target.value)}
            className="text-sm p-2 rounded-md border border-border bg-card">
            <option value="">Selecciona...</option>
            {monthOptions.map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
          </select>
        </div>
        <button onClick={exportToExcel}
          className="bg-success text-success-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5">
          <Download className="w-4 h-4" /> Excel
        </button>
      </div>

      {techFilter !== 'all' && (
        <div className="bg-warning/10 border border-warning/30 text-warning rounded-md px-3 py-2 text-xs">
          Filtro de técnico activo (<strong>{techFilter}</strong>): la sección "Técnicos" se oculta porque no aplica.
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-br from-primary/5 to-accent/30 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-foreground">
            <Sparkles className="w-4 h-4 text-primary" /> Resumen Ejecutivo · {labelOf(compareMonth)} → {labelOf(currentMonth)}
          </div>
          <ul className="space-y-1 text-sm">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  ins.tone === 'good' ? 'bg-success' : ins.tone === 'bad' ? 'bg-destructive' : 'bg-primary'
                }`} />
                <span className="text-foreground/90">{ins.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Projection */}
      {projection && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <TrendingUp className="w-4 h-4 text-primary" /> Proyección del mes en curso
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Llevamos</div>
              <div className="text-2xl font-bold">{currStats.total} <span className="text-sm font-normal text-muted-foreground">refuerzos</span></div>
              <div className="text-xs text-muted-foreground">Día {projection.dayOfMonth} de {projection.daysInMonth}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Proyección fin de mes</div>
              <div className="text-2xl font-bold text-primary">{Math.round(projection.projected)}</div>
              {projection.vsPrev !== null && (
                <div className={`text-xs font-semibold ${projection.vsPrev > 0 ? 'text-destructive' : 'text-success'}`}>
                  {projection.vsPrev > 0 ? '+' : ''}{projection.vsPrev.toFixed(1)}% vs mes anterior ({prevStats.total})
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Avance del mes</div>
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${(projection.dayOfMonth / projection.daysInMonth) * 100}%` }} />
                {prevStats.total > 0 && (
                  <div
                    className="absolute inset-y-0 w-0.5 bg-foreground"
                    style={{ left: `${Math.min(100, (prevStats.total / Math.max(projection.projected, prevStats.total)) * 100)}%` }}
                    title={`Mes anterior: ${prevStats.total}`}
                  />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Línea negra = total mes anterior como referencia</div>
            </div>
          </div>
          {projection.vsPrev !== null && projection.vsPrev > 10 && (
            <div className="mt-3 flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-3 py-2 text-xs">
              <AlertTriangle className="w-4 h-4" />
              La proyección supera el mes anterior en más de 10%. Considere reforzar la operación.
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} data={k} />)}
      </div>

      {/* Tech ranking */}
      {techFilter === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TechBlock
            title="Técnicos que mejoraron"
            tone="good"
            rows={techRanking.mejoraron}
            onSelect={(name) => setDetail({ kind: 'tecnico', name })}
          />
          <TechBlock
            title="Técnicos que empeoraron"
            tone="bad"
            rows={techRanking.empeoraron}
            onSelect={(name) => setDetail({ kind: 'tecnico', name })}
          />
        </div>
      )}

      {/* Pest ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PestBlock title="Plagas en crecimiento" tone="bad" rows={pestRanking.creciendo} maxVal={pestRanking.maxVal} onSelect={(name) => setDetail({ kind: 'plaga', name })} />
        <PestBlock title="Plagas en disminución" tone="good" rows={pestRanking.disminuyendo} maxVal={pestRanking.maxVal} onSelect={(name) => setDetail({ kind: 'plaga', name })} />
      </div>

      {/* Trend chart */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Tendencia (últimos {trend.length} meses)</h3>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary" /> Total</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-destructive" /> Alto</span>
          <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-muted-foreground" /> Promedio móvil 3m</span>
        </div>
        {renderTrendChart()}
      </div>

      {/* Client ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClientBlock title="Clientes que empeoraron" tone="bad" rows={clientRanking.empeoraron} onSelect={(name) => setDetail({ kind: 'cliente', name })} />
        <ClientBlock title="Clientes que mejoraron" tone="good" rows={clientRanking.mejoraron} onSelect={(name) => setDetail({ kind: 'cliente', name })} />
      </div>

      {/* Detail modal */}
      {detail && (
        <DetailModal
          context={detail}
          monthLabel={labelOf(currentMonth)}
          records={currStats.records}
          getPestName={getPestName}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ---------- Sub-components ----------

interface TechRow {
  name: string; current: number; previous: number; delta: number; pct: number | null;
  currHigh: number; prevHigh: number; flag: 'nuevo' | 'sin-casos' | null;
}

function TechBlock({ title, tone, rows }: { title: string; tone: 'good' | 'bad'; rows: TechRow[] }) {
  const accent = tone === 'good' ? 'border-l-success' : 'border-l-destructive';
  const badge = tone === 'good' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive';
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className={`p-3 border-b border-border border-l-4 ${accent} flex justify-between items-center`}>
        <span className="font-semibold text-sm">{title}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge}`}>{rows.length}</span>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground/50 py-8 text-sm">Sin datos.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-muted-foreground text-xs sticky top-0">
              <tr>
                <th className="text-left p-2 font-semibold">Técnico</th>
                <th className="text-center p-2 font-semibold">Anterior</th>
                <th className="text-center p-2 font-semibold">Actual</th>
                <th className="text-center p-2 font-semibold">Δ</th>
                <th className="text-center p-2 font-semibold">Δ%</th>
                <th className="text-center p-2 font-semibold" title="Casos Alto">Alto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name} className="border-t border-border/50 hover:bg-accent/30">
                  <td className="p-2 font-medium">
                    {r.name}
                    {r.flag === 'nuevo' && <span className="ml-2 text-[10px] uppercase font-bold text-primary">Nuevo</span>}
                    {r.flag === 'sin-casos' && <span className="ml-2 text-[10px] uppercase font-bold text-muted-foreground">Sin casos</span>}
                  </td>
                  <td className="p-2 text-center text-muted-foreground">{r.previous}</td>
                  <td className="p-2 text-center font-semibold">{r.current}</td>
                  <td className={`p-2 text-center font-bold ${r.delta < 0 ? 'text-success' : r.delta > 0 ? 'text-destructive' : ''}`}>
                    {r.delta > 0 ? '+' : ''}{r.delta}
                  </td>
                  <td className={`p-2 text-center text-xs ${r.delta < 0 ? 'text-success' : r.delta > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {r.pct === null ? 'N/D' : `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(0)}%`}
                  </td>
                  <td className="p-2 text-center text-xs">
                    {r.prevHigh}→<span className="font-bold">{r.currHigh}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface PestRow { name: string; current: number; previous: number; delta: number; pct: number | null; }

function PestBlock({ title, tone, rows, maxVal }: { title: string; tone: 'good' | 'bad'; rows: PestRow[]; maxVal: number }) {
  const accent = tone === 'good' ? 'border-l-success' : 'border-l-destructive';
  const badge = tone === 'good' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive';
  const Icon = tone === 'good' ? TrendingDown : TrendingUp;
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className={`p-3 border-b border-border border-l-4 ${accent} flex justify-between items-center`}>
        <span className="font-semibold text-sm flex items-center gap-2"><Icon className="w-4 h-4" /> {title}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge}`}>{rows.length}</span>
      </div>
      <div className="max-h-[360px] overflow-y-auto p-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground/50 py-6 text-sm">Sin datos.</p>
        ) : rows.map(r => {
          const prevW = (r.previous / maxVal) * 100;
          const currW = (r.current / maxVal) * 100;
          return (
            <div key={r.name} className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-foreground truncate pr-2">{r.name}</span>
                <span className={`font-bold ${tone === 'good' ? 'text-success' : 'text-destructive'}`}>
                  {r.delta > 0 ? '+' : ''}{r.delta} {r.pct !== null && `(${r.pct > 0 ? '+' : ''}${r.pct.toFixed(0)}%)`}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] text-muted-foreground">Antes</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-muted-foreground/40" style={{ width: `${prevW}%` }} />
                  </div>
                  <span className="w-8 text-right tabular-nums">{r.previous}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] text-muted-foreground">Ahora</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${tone === 'good' ? 'bg-success' : 'bg-destructive'}`} style={{ width: `${currW}%` }} />
                  </div>
                  <span className="w-8 text-right tabular-nums font-semibold">{r.current}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ClientRow { name: string; current: number; previous: number; delta: number; pct: number | null; }

function ClientBlock({ title, tone, rows, onClick }: { title: string; tone: 'good' | 'bad'; rows: ClientRow[]; onClick: (name: string) => void }) {
  const accent = tone === 'good' ? 'border-l-success' : 'border-l-destructive';
  const badge = tone === 'good' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive';
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className={`p-3 border-b border-border border-l-4 ${accent} flex justify-between items-center`}>
        <span className="font-semibold text-sm">{title}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge}`}>{rows.length}</span>
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground/50 py-6 text-sm">Sin datos.</p>
        ) : rows.map(r => (
          <button
            key={r.name}
            onClick={() => onClick(r.name)}
            className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-accent/40 transition text-sm flex justify-between items-center gap-2"
          >
            <span className="font-medium truncate flex-1">{r.name}</span>
            <span className="text-xs text-muted-foreground">{r.previous} → <span className="font-bold text-foreground">{r.current}</span></span>
            <span className={`text-xs font-bold tabular-nums w-16 text-right ${tone === 'good' ? 'text-success' : 'text-destructive'}`}>
              {r.delta > 0 ? '+' : ''}{r.delta}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
