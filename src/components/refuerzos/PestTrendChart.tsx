import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { PEST_COLORS } from '@/lib/pestColors';

export default function PestTrendChart() {
  const { metrics, selectedPests, allUniquePests, isGrouped, toggleGrouping, addPest, removePest, handleDrillDown } = useAppContext();

  const dataArray = useMemo(() => {
    if (!metrics) return [];
    return Object.values(metrics.pestTrend).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [metrics]);

  const availableToAdd = allUniquePests.filter(p => !selectedPests.includes(p));

  const width = 900;
  const height = 280;
  const pad = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  let maxVal = 0;
  dataArray.forEach(d => {
    selectedPests.forEach(p => { maxVal = Math.max(maxVal, d.counts[p] || 0); });
  });
  const yMax = maxVal === 0 ? 10 : Math.ceil(maxVal * 1.1);

  const single = dataArray.length === 1;
  const stepX = single ? chartW / 2 : chartW / Math.max(dataArray.length - 1, 1);
  const getX = (i: number) => single ? pad.left + chartW / 2 : pad.left + i * stepX;
  const getY = (v: number) => height - pad.bottom - (v / yMax) * chartH;

  const gridLines = Array.from({ length: 6 }, (_, i) => {
    const val = Math.round((yMax / 5) * i);
    return { val, y: getY(val) };
  });

  const skipRate = Math.max(1, Math.ceil(dataArray.length / 12));

  return (
    <div className="bg-card rounded-lg p-5 shadow-sm border border-border col-span-full">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">Tendencia por Tipo de Plaga</h3>
        <button
          onClick={toggleGrouping}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
            isGrouped ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-accent'
          }`}
        >
          {isGrouped ? '✕ Desenglobar' : '⊞ Englobar Plagas'}
        </button>
      </div>

      {/* Pest chips */}
      <div className="flex flex-wrap gap-2 items-center mb-4 p-2.5 bg-accent/50 rounded-md border border-border">
        {selectedPests.map((p, idx) => {
          const color = PEST_COLORS[idx % PEST_COLORS.length];
          return (
            <span key={p} className="flex items-center gap-1.5 bg-card border rounded-full px-2.5 py-1 text-xs" style={{ borderColor: color }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {p}
              <button onClick={() => removePest(p)} className="text-muted-foreground hover:text-destructive font-bold ml-0.5">×</button>
            </span>
          );
        })}
        {availableToAdd.length > 0 && (
          <select
            onChange={(e) => { addPest(e.target.value); e.target.value = ''; }}
            className="text-xs p-1 rounded border border-border bg-card"
            value=""
          >
            <option value="">+ Agregar Plaga</option>
            {availableToAdd.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {dataArray.length === 0 || selectedPests.length === 0 ? (
        <p className="text-center text-muted-foreground/40 py-16">Selecciona plagas para ver su evolución</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
          {gridLines.map(g => (
            <g key={g.val}>
              <line x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y} stroke="#f1f5f9" strokeDasharray="4" />
              <text x={pad.left - 10} y={g.y} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-muted-foreground">{g.val}</text>
            </g>
          ))}
          <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="#cbd5e1" />

          {/* Lines */}
          {selectedPests.map((pest, idx) => {
            const color = PEST_COLORS[idx % PEST_COLORS.length];
            const points = dataArray.map((d, i) => `${getX(i)},${getY(d.counts[pest] || 0)}`).join(' ');
            return <polyline key={pest} points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
          })}

          {/* Dots & labels with collision avoidance */}
          {dataArray.map((d, i) => {
            const items = selectedPests
              .map((pest, idx) => ({ pest, idx, val: d.counts[pest] || 0 }))
              .filter(it => it.val > 0)
              .sort((a, b) => b.val - a.val);

            // Spread labels so they don't overlap (min 14px apart)
            const labelYs: number[] = [];
            items.forEach(it => {
              let ly = getY(it.val) - 10;
              for (const prev of labelYs) {
                if (Math.abs(ly - prev) < 14) {
                  ly = prev - 14;
                }
              }
              labelYs.push(ly);
            });

            return (
              <g key={i}>
                {items.map((it, j) => {
                  const color = PEST_COLORS[it.idx % PEST_COLORS.length];
                  return (
                    <g key={it.pest}>
                      <circle cx={getX(i)} cy={getY(it.val)} r={4} fill={color} stroke="white" strokeWidth={2}
                        className="cursor-pointer" onClick={() => handleDrillDown('pest-trend', d.sortKey, it.pest)}>
                        <title>{it.pest}: {it.val}</title>
                      </circle>
                      <text x={getX(i)} y={labelYs[j]} textAnchor="middle" className="text-[10px] font-bold cursor-pointer"
                        style={{ fill: color }} onClick={() => handleDrillDown('pest-trend', d.sortKey, it.pest)}>{it.val}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {dataArray.map((d, i) => {
            if (i % skipRate !== 0 && i !== dataArray.length - 1) return null;
            return <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" className="text-[10px] fill-muted-foreground">{d.label}</text>;
          })}
        </svg>
      )}
    </div>
  );
}
