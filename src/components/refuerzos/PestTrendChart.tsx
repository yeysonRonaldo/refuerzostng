import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { PEST_COLORS } from '@/lib/pestColors';
import { Bug, X, Plus } from 'lucide-react';

// Catmull-Rom to Bezier smoothing
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function PestTrendChart() {
  const { metrics, selectedPests, allUniquePests, isGrouped, toggleGrouping, addPest, removePest, handleDrillDown } = useAppContext();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const dataArray = useMemo(() => {
    if (!metrics) return [];
    return Object.values(metrics.pestTrend).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [metrics]);

  const availableToAdd = allUniquePests.filter(p => !selectedPests.includes(p));

  const width = 900;
  const height = 300;
  const pad = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const totals = dataArray.map(d => {
    const tl = metrics?.timeline[d.sortKey];
    return tl ? tl.alto + tl.medio + tl.bajo : 0;
  });

  let maxVal = 0;
  dataArray.forEach((d, i) => {
    selectedPests.forEach(p => { maxVal = Math.max(maxVal, d.counts[p] || 0); });
    maxVal = Math.max(maxVal, totals[i]);
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
    <div className="bg-card rounded-xl p-5 shadow-soft border border-border col-span-full animate-fade-in-up">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bug className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight">Tendencia por Tipo de Plaga</h3>
        </div>
        <button
          onClick={toggleGrouping}
          className={`text-xs px-3 py-1.5 rounded-md border transition-all font-medium ${
            isGrouped ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card border-border text-foreground hover:bg-accent'
          }`}
        >
          {isGrouped ? '✕ Desenglobar' : '⊞ Englobar Plagas'}
        </button>
      </div>

      {/* Pest chips */}
      <div className="flex flex-wrap gap-1.5 items-center mb-4 p-2.5 bg-accent/40 rounded-lg border border-border">
        <span className="flex items-center gap-1.5 bg-card border rounded-full px-2.5 py-1 text-xs font-medium" style={{ borderColor: '#64748b' }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#64748b' }} />
          Total Plagas
        </span>
        {selectedPests.map((p, idx) => {
          const color = PEST_COLORS[idx % PEST_COLORS.length];
          return (
            <span key={p} className="flex items-center gap-1.5 bg-card border rounded-full px-2.5 py-1 text-xs font-medium" style={{ borderColor: color }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {p}
              <button onClick={() => removePest(p)} className="text-muted-foreground hover:text-destructive ml-0.5 transition-colors" aria-label={`Quitar ${p}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        {availableToAdd.length > 0 && (
          <div className="relative inline-flex items-center">
            <Plus className="absolute left-2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <select
              onChange={(e) => { addPest(e.target.value); e.target.value = ''; }}
              className="text-xs pl-6 pr-2 py-1.5 rounded-full border border-border bg-card hover:bg-accent transition-colors cursor-pointer"
              value=""
            >
              <option value="">Agregar Plaga</option>
              {availableToAdd.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
      </div>

      {dataArray.length === 0 || selectedPests.length === 0 ? (
        <p className="text-center text-muted-foreground/40 py-16">Selecciona plagas para ver su evolución</p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto"
            style={{ overflow: 'visible' }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="totalGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#64748b" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
              </linearGradient>
            </defs>

            {gridLines.map(g => (
              <g key={g.val}>
                <line x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y} stroke="hsl(var(--border))" strokeDasharray="3 4" />
                <text x={pad.left - 10} y={g.y} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-muted-foreground">{g.val}</text>
              </g>
            ))}
            <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="hsl(var(--border))" />

            {/* Total area + smooth line */}
            {(() => {
              const pts = dataArray.map((_, i) => ({ x: getX(i), y: getY(totals[i]) }));
              const path = smoothPath(pts);
              const area = path + ` L ${getX(dataArray.length - 1)},${height - pad.bottom} L ${getX(0)},${height - pad.bottom} Z`;
              return (
                <>
                  <path d={area} fill="url(#totalGradient)" />
                  <path d={path} fill="none" stroke="#64748b" strokeWidth={2.5} strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
                </>
              );
            })()}

            {/* Individual pest smooth lines */}
            {selectedPests.map((pest, idx) => {
              const color = PEST_COLORS[idx % PEST_COLORS.length];
              const pts = dataArray.map((d, i) => ({ x: getX(i), y: getY(d.counts[pest] || 0) }));
              return <path key={pest} d={smoothPath(pts)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
            })}

            {/* Hover capture columns */}
            {dataArray.map((d, i) => (
              <rect
                key={`hover-${i}`}
                x={getX(i) - stepX / 2}
                y={pad.top}
                width={stepX}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHover({ i, x: getX(i), y: pad.top })}
              />
            ))}

            {/* Hover indicator line */}
            {hover && (
              <line x1={hover.x} x2={hover.x} y1={pad.top} y2={height - pad.bottom} stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
            )}

            {/* Dots & labels with smart fan-out positioning */}
            {dataArray.map((d, i) => {
              const totalVal = totals[i];
              type Item = { pest: string; idx: number; val: number; isTotal: boolean; cy: number };
              const items: Item[] = [];

              if (totalVal > 0) items.push({ pest: 'Total', idx: -1, val: totalVal, isTotal: true, cy: getY(totalVal) });
              selectedPests.forEach((pest, idx) => {
                const val = d.counts[pest] || 0;
                if (val > 0) items.push({ pest, idx, val, isTotal: false, cy: getY(val) });
              });

              const cx = getX(i);
              const isLast = i === dataArray.length - 1;
              const isFirst = i === 0;

              // Group items whose dots are within 12px vertically (visually overlapping)
              const sorted = [...items].sort((a, b) => a.cy - b.cy);
              const clusters: Item[][] = [];
              sorted.forEach(it => {
                const last = clusters[clusters.length - 1];
                if (last && Math.abs(last[last.length - 1].cy - it.cy) < 12) last.push(it);
                else clusters.push([it]);
              });

              // For each cluster, fan out labels horizontally on alternating sides
              const labelPositions = new Map<string, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }>();
              clusters.forEach(cluster => {
                if (cluster.length === 1) {
                  const it = cluster[0];
                  labelPositions.set(it.pest, { x: cx, y: it.cy - 10, anchor: 'middle' });
                } else {
                  // Sort cluster by value desc so biggest gets center spot
                  const ordered = [...cluster].sort((a, b) => b.val - a.val);
                  const baseY = Math.min(...cluster.map(c => c.cy)) - 12;
                  ordered.forEach((it, k) => {
                    // Alternate: 0=center, 1=right, 2=left, 3=right2, 4=left2
                    let offsetX = 0;
                    let anchor: 'start' | 'middle' | 'end' = 'middle';
                    if (k === 0) {
                      offsetX = 0;
                    } else {
                      const side = k % 2 === 1 ? 1 : -1;
                      const dist = Math.ceil(k / 2) * 16;
                      offsetX = side * dist;
                      anchor = side === 1 ? 'start' : 'end';
                    }
                    let labelX = cx + offsetX;
                    // Edge clamping
                    if (isFirst && offsetX < 0) { labelX = cx; anchor = 'start'; }
                    if (isLast && offsetX > 0) { labelX = cx; anchor = 'end'; }
                    labelPositions.set(it.pest, { x: labelX, y: baseY - (k > 0 ? 0 : 0), anchor });
                  });
                }
              });

              return (
                <g key={i}>
                  {items.map(it => {
                    const color = it.isTotal ? '#64748b' : PEST_COLORS[it.idx % PEST_COLORS.length];
                    const pos = labelPositions.get(it.pest)!;
                    const showLeader = pos.x !== cx;
                    return (
                      <g key={it.pest}>
                        {showLeader && (
                          <line
                            x1={cx} y1={it.cy}
                            x2={pos.x} y2={pos.y + 3}
                            stroke={color}
                            strokeWidth={1}
                            opacity={0.5}
                          />
                        )}
                        <circle cx={cx} cy={it.cy} r={it.isTotal ? 5 : 4} fill={color} stroke="white" strokeWidth={2}
                          className={it.isTotal ? '' : 'cursor-pointer'}
                          onClick={it.isTotal ? undefined : () => handleDrillDown('pest-trend', d.sortKey, it.pest)}>
                          <title>{it.pest}: {it.val}</title>
                        </circle>
                        {/* Label background for readability */}
                        <text x={pos.x} y={pos.y} textAnchor={pos.anchor}
                          stroke="hsl(var(--card))" strokeWidth={3} strokeLinejoin="round"
                          className="text-[10px] font-bold pointer-events-none select-none"
                          style={{ paintOrder: 'stroke' }}>
                          {it.val}
                        </text>
                        <text x={pos.x} y={pos.y} textAnchor={pos.anchor}
                          className={`text-[10px] font-bold ${it.isTotal ? '' : 'cursor-pointer'}`}
                          style={{ fill: color }}
                          onClick={it.isTotal ? undefined : () => handleDrillDown('pest-trend', d.sortKey, it.pest)}>
                          {it.val}
                        </text>
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

          {/* Floating tooltip */}
          {hover && dataArray[hover.i] && (() => {
            const d = dataArray[hover.i];
            const tot = totals[hover.i];
            const leftPct = (hover.x / width) * 100;
            const flipLeft = leftPct > 70;
            return (
              <div
                className="absolute pointer-events-none z-10 bg-card border border-border rounded-lg shadow-elegant px-3 py-2 text-xs min-w-[140px]"
                style={{
                  left: `${leftPct}%`,
                  top: 8,
                  transform: flipLeft ? 'translateX(-100%) translateX(-8px)' : 'translateX(8px)',
                }}
              >
                <div className="font-semibold text-foreground mb-1">{d.label}</div>
                <div className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#64748b' }} /> Total</span>
                  <span className="font-bold text-foreground">{tot}</span>
                </div>
                {selectedPests.map((pest, idx) => {
                  const v = d.counts[pest] || 0;
                  if (v === 0) return null;
                  const color = PEST_COLORS[idx % PEST_COLORS.length];
                  return (
                    <div key={pest} className="flex items-center justify-between gap-3 mt-0.5">
                      <span className="flex items-center gap-1.5 truncate"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} /> {pest}</span>
                      <span className="font-semibold" style={{ color }}>{v}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
