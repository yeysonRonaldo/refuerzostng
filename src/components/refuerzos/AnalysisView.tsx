import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const SHORT_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function AnalysisView() {
  const { processedData, getPestName } = useAppContext();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [analysisResult, setAnalysisResult] = useState<{
    newCases: { cliente: string; plaga: string; tecnico: string; gravedad: string }[];
    solvedCases: { cliente: string; plaga: string; tecnico: string; gravedad: string }[];
    periodLabel: string;
  } | null>(null);

  // Available months
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    processedData.forEach(d => {
      if (d.dateObj) {
        const y = d.dateObj.getUTCFullYear();
        const m = d.dateObj.getUTCMonth();
        set.add(`${y}-${String(m + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(set).sort().reverse();
  }, [processedData]);

  // Recurrence
  const recurrence = useMemo(() => {
    const map: Record<string, { cliente: string; plaga: string; months: Set<string>; lastDate: Date | null }> = {};
    processedData.forEach(r => {
      if (!r.cliente || !r.plaga) return;
      const pName = getPestName(r.plaga);
      const key = `${r.cliente}|${pName}`;
      if (!map[key]) map[key] = { cliente: r.cliente, plaga: pName, months: new Set(), lastDate: r.dateObj };
      if (r.dateObj) {
        map[key].months.add(`${r.dateObj.getUTCFullYear()}-${r.dateObj.getUTCMonth()}`);
        if (!map[key].lastDate || r.dateObj > map[key].lastDate!) map[key].lastDate = r.dateObj;
      }
    });
    return Object.values(map)
      .map(item => ({ ...item, count: item.months.size }))
      .filter(item => item.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }, [processedData, getPestName]);

  // History trends for chart
  const historyTrends = useMemo(() => {
    const monthMap: Record<string, { keys: Set<string> }> = {};
    processedData.forEach(d => {
      if (!d.dateObj) return;
      const y = d.dateObj.getUTCFullYear();
      const m = d.dateObj.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { keys: new Set() };
      monthMap[key].keys.add(`${d.cliente}|${getPestName(d.plaga)}`);
    });

    const sortedKeys = Object.keys(monthMap).sort();
    const trendData: { key: string; label: string; newCount: number; solvedCount: number }[] = [];

    for (let i = 0; i < sortedKeys.length; i++) {
      const currentKey = sortedKeys[i];
      const currentSet = monthMap[currentKey].keys;
      let nc = 0, sc = 0;
      if (i > 0) {
        const prevSet = monthMap[sortedKeys[i - 1]].keys;
        currentSet.forEach(k => { if (!prevSet.has(k)) nc++; });
        prevSet.forEach(k => { if (!currentSet.has(k)) sc++; });
      } else {
        nc = currentSet.size;
      }
      const [y, mStr] = currentKey.split('-');
      trendData.push({ key: currentKey, label: `${SHORT_MONTHS[parseInt(mStr) - 1]} ${y.substring(2)}`, newCount: nc, solvedCount: sc });
    }
    return trendData;
  }, [processedData, getPestName]);

  const analyzeChanges = () => {
    if (!selectedMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);

    const currentData = processedData.filter(d => d.dateObj && d.dateObj.getUTCFullYear() === y && (d.dateObj.getUTCMonth() + 1) === m);
    let prevY = y, prevM = m - 1;
    if (prevM === 0) { prevM = 12; prevY = y - 1; }
    const prevData = processedData.filter(d => d.dateObj && d.dateObj.getUTCFullYear() === prevY && (d.dateObj.getUTCMonth() + 1) === prevM);

    const getKeys = (data: typeof processedData) => {
      const set = new Set<string>();
      data.forEach(d => set.add(`${d.cliente}|${getPestName(d.plaga)}`));
      return set;
    };

    const currentKeys = getKeys(currentData);
    const prevKeys = getKeys(prevData);

    const newCases: { cliente: string; plaga: string }[] = [];
    const solvedCases: { cliente: string; plaga: string }[] = [];

    currentKeys.forEach(key => {
      if (!prevKeys.has(key)) {
        const [c, p] = key.split('|');
        newCases.push({ cliente: c, plaga: p });
      }
    });

    prevKeys.forEach(key => {
      if (!currentKeys.has(key)) {
        const [c, p] = key.split('|');
        solvedCases.push({ cliente: c, plaga: p });
      }
    });

    setAnalysisResult({
      newCases, solvedCases,
      periodLabel: `${SHORT_MONTHS[prevM - 1]} ${prevY} vs ${SHORT_MONTHS[m - 1]} ${y}`,
    });
  };

  // Chart rendering
  const renderHistoryChart = () => {
    if (historyTrends.length === 0) return <p className="text-center text-muted-foreground/40 py-16">Carga datos para ver la gráfica histórica</p>;

    const data = historyTrends;
    const width = 900, height = 280;
    const pad = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const maxVal = data.reduce((m, d) => Math.max(m, d.newCount, d.solvedCount), 0);
    const yMax = maxVal === 0 ? 10 : Math.ceil(maxVal * 1.1);

    const single = data.length === 1;
    const stepX = single ? chartW / 2 : chartW / (data.length - 1);
    const getX = (i: number) => single ? pad.left + chartW / 2 : pad.left + i * stepX;
    const getY = (v: number) => height - pad.bottom - (v / yMax) * chartH;

    const pointsNew = data.map((d, i) => `${getX(i)},${getY(d.newCount)}`).join(' ');
    const pointsSolved = data.map((d, i) => `${getX(i)},${getY(d.solvedCount)}`).join(' ');

    const gridLines = Array.from({ length: 6 }, (_, i) => {
      const val = Math.round((yMax / 5) * i);
      return { val, y: getY(val) };
    });

    const skipRate = Math.max(1, Math.ceil(data.length / 12));

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
        {gridLines.map(g => (
          <g key={g.val}>
            <line x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y} stroke="#f1f5f9" strokeDasharray="4" />
            <text x={pad.left - 10} y={g.y} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-muted-foreground">{g.val}</text>
          </g>
        ))}
        <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="#cbd5e1" />
        <polyline points={pointsNew} fill="none" stroke="hsl(var(--primary))" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pointsSolved} fill="none" stroke="hsl(var(--chart-bajo))" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            {d.newCount > 0 && (
              <>
                <circle cx={getX(i)} cy={getY(d.newCount)} r={4} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />
                <text x={getX(i)} y={getY(d.newCount) - 10} textAnchor="middle" className="text-[10px] font-bold" style={{ fill: 'hsl(var(--primary))' }}>{d.newCount}</text>
              </>
            )}
            {d.solvedCount > 0 && (
              <>
                <circle cx={getX(i)} cy={getY(d.solvedCount)} r={4} fill="hsl(var(--chart-bajo))" stroke="white" strokeWidth={2} />
                <text x={getX(i)} y={getY(d.solvedCount) - 10} textAnchor="middle" className="text-[10px] font-bold" style={{ fill: 'hsl(var(--chart-bajo))' }}>{d.solvedCount}</text>
              </>
            )}
          </g>
        ))}
        {data.map((d, i) => {
          if (i % skipRate !== 0 && i !== data.length - 1) return null;
          return <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" className="text-[10px] fill-muted-foreground">{d.label}</text>;
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-card p-4 rounded-lg border border-border flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Comparar Mes vs Anterior</label>
          <div className="flex gap-2">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="flex-1 text-sm p-2 rounded-md border border-border bg-card">
              <option value="">Selecciona un mes...</option>
              {monthOptions.map(key => {
                const [y, m] = key.split('-');
                return <option key={key} value={key}>{MONTH_NAMES[parseInt(m) - 1]} {y}</option>;
              })}
            </select>
            <button onClick={analyzeChanges} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
              Analizar
            </button>
          </div>
        </div>
        {analysisResult && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Comparación</div>
            <div className="font-bold text-foreground">{analysisResult.periodLabel}</div>
          </div>
        )}
      </div>

      {/* History Chart */}
      <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold mb-3">Tendencia de Rotación (Nuevos vs Solventados)</h3>
        <div className="flex flex-wrap gap-4 justify-center mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary" />Nuevos</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-success" />Solventados</div>
        </div>
        {renderHistoryChart()}
      </div>

      {/* Comparison Lists */}
      {analysisResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Solved */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-3 bg-accent/50 border-b border-border border-l-4 border-l-success">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Solventados / Desaparecieron</span>
                <span className="bg-success/10 text-success px-2 py-0.5 rounded-full text-xs font-bold">{analysisResult.solvedCases.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Estaban el mes anterior, no aparecen este mes.</p>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {analysisResult.solvedCases.length === 0 ? (
                <p className="text-center text-muted-foreground/40 py-8">Ningún caso resuelto.</p>
              ) : (
                analysisResult.solvedCases.map((item, i) => (
                  <div key={i} className="px-3 py-2 border-b border-border/50 text-sm hover:bg-accent/30">
                    <span className="font-semibold block">{item.cliente}</span>
                    <span className="text-xs text-muted-foreground">{item.plaga}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* New */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-3 bg-accent/50 border-b border-border border-l-4 border-l-primary">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Nuevos Incidentes</span>
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">{analysisResult.newCases.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">No estaban el mes anterior, aparecieron este mes.</p>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {analysisResult.newCases.length === 0 ? (
                <p className="text-center text-muted-foreground/40 py-8">Sin nuevos incidentes.</p>
              ) : (
                analysisResult.newCases.map((item, i) => (
                  <div key={i} className="px-3 py-2 border-b border-border/50 text-sm hover:bg-accent/30">
                    <span className="font-semibold block">{item.cliente}</span>
                    <span className="text-xs text-muted-foreground">{item.plaga}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recurrence Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Ranking de Recurrencia (Histórico Completo)</h3>
          <p className="text-xs text-muted-foreground mt-1">Muestra en cuántos meses distintos ha aparecido el mismo problema.</p>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/50 sticky top-0">
              <tr>
                <th className="text-left p-2.5 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left p-2.5 font-semibold text-muted-foreground">Plaga</th>
                <th className="text-center p-2.5 font-semibold text-muted-foreground">Meses</th>
                <th className="text-left p-2.5 font-semibold text-muted-foreground">Última</th>
              </tr>
            </thead>
            <tbody>
              {recurrence.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground/40">No se encontraron casos recurrentes.</td></tr>
              ) : (
                recurrence.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="p-2.5 font-semibold">{r.cliente}</td>
                    <td className="p-2.5">{r.plaga}</td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.count >= 3 ? 'bg-destructive/10 text-destructive' : 'bg-accent text-total'}`}>
                        {r.count} meses
                      </span>
                    </td>
                    <td className="p-2.5 text-xs text-muted-foreground">
                      {r.lastDate?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
