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
  const [focusPest, setFocusPest] = useState<string | null>(null);

  const dataArray = useMemo(() => {
    if (!metrics) return [];
    return Object.values(metrics.pestTrend).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [metrics]);

  const availableToAdd = allUniquePests.filter(p => !selectedPests.includes(p));

  const width = 900;
  const height = 320;
  const pad = { top: 28, right: 30, bottom: 44, left: 48 };
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

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const val = Math.round((yMax / 4) * i);
    return { val, y: getY(val) };
  });

  const skipRate = Math.max(1, Math.ceil(dataArray.length / 12));

  return (
    <div className="relative bg-card rounded-2xl p-5 sm:p-6 border border-border/60 col-span-full animate-fade-in-up overflow-hidden"
      style={{ boxShadow: '0 1px 3px hsl(220 43% 11% / 0.04), 0 12px 40px -12px hsl(220 43% 11% / 0.08)' }}>
      {/* Decorative gradient blob */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary)), transparent 70%)' }} />

      <div className="relative flex justify-between items-start mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
            <Bug className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Tendencia por Tipo de Plaga</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Evolución temporal · {dataArray.length} períodos</p>
          </div>
        </div>
        <button
          onClick={toggleGrouping}
          className={`text-xs px-3.5 py-2 rounded-lg transition-all font-medium ${
            isGrouped
              ? 'bg-primary text-primary-foreground shadow-sm hover:opacity-90'
              : 'bg-muted/60 text-foreground hover:bg-muted'
          }`}
        >
          {isGrouped ? 'Desenglobar' : 'Englobar Plagas'}
        </button>
      </div>

      {/* Pest chips */}
      <div className="relative flex flex-wrap gap-1.5 items-center mb-5">
        <button
          onMouseEnter={() => setFocusPest('__total__')}
          onMouseLeave={() => setFocusPest(null)}
          className="flex items-center gap-1.5 bg-background border rounded-full px-2.5 py-1 text-[11px] font-medium transition-all hover:shadow-sm"
          style={{ borderColor: 'hsl(215 16% 47% / 0.3)' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(215 16% 47%)' }} />
          Total Plagas
        </button>
        {selectedPests.map((p, idx) => {
          const color = PEST_COLORS[idx % PEST_COLORS.length];
          return (
            <span key={p}
              onMouseEnter={() => setFocusPest(p)}
              onMouseLeave={() => setFocusPest(null)}
              className="flex items-center gap-1.5 bg-background border rounded-full pl-2.5 pr-1 py-1 text-[11px] font-medium transition-all hover:shadow-sm"
              style={{ borderColor: `${color}55` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {p}
              <button onClick={() => removePest(p)} className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" aria-label={`Quitar ${p}`}>
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}
        {availableToAdd.length > 0 && (
          <div className="relative inline-flex items-center">
            <Plus className="absolute left-2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <select
              onChange={(e) => { addPest(e.target.value); e.target.value = ''; }}
              className="text-[11px] pl-6 pr-2 py-1 rounded-full border border-dashed border-border bg-transparent hover:bg-muted/50 hover:border-solid transition-all cursor-pointer text-muted-foreground"
              value=""
            >
              <option value="">Agregar plaga</option>
              {availableToAdd.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
      </div>

      {dataArray.length === 0 || selectedPests.length === 0 ? (
        <p className="text-center text-muted-foreground/50 py-20 text-sm">Selecciona plagas para ver su evolución</p>
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
                <stop offset="0%" stopColor="hsl(215 16% 47%)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="hsl(215 16% 47%)" stopOpacity="0" />
              </linearGradient>
              {selectedPests.map((pest, idx) => {
                const color = PEST_COLORS[idx % PEST_COLORS.length];
                return (
                  <linearGradient key={`grad-${pest}`} id={`pestGrad-${idx}`} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor={color} stopOpacity="0.85" />
                    <stop offset="100%" stopColor={color} stopOpacity="1" />
                  </linearGradient>
                );
              })}
              <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {gridLines.map(g => (
              <g key={g.val}>
                <line x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y}
                  stroke="hsl(var(--border))" strokeOpacity={0.5} strokeDasharray="2 5" />
                <text x={pad.left - 12} y={g.y} textAnchor="end" alignmentBaseline="middle"
                  className="text-[10px] fill-muted-foreground/70 font-medium">{g.val}</text>
              </g>
            ))}

            {/* Total area + smooth dashed line */}
            {(() => {
              const pts = dataArray.map((_, i) => ({ x: getX(i), y: getY(totals[i]) }));
              const path = smoothPath(pts);
              const area = path + ` L ${getX(dataArray.length - 1)},${height - pad.bottom} L ${getX(0)},${height - pad.bottom} Z`;
              const dim = focusPest && focusPest !== '__total__';
              return (
                <g style={{ opacity: dim ? 0.15 : 1, transition: 'opacity 0.2s' }}>
                  <path d={area} fill="url(#totalGradient)" />
                  <path d={path} fill="none" stroke="hsl(215 16% 47%)" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })()}

            {/* Individual pest smooth lines */}
            {selectedPests.map((pest, idx) => {
              const color = PEST_COLORS[idx % PEST_COLORS.length];
              const pts = dataArray.map((d, i) => ({ x: getX(i), y: getY(d.counts[pest] || 0) }));
              const path = smoothPath(pts);
              const dim = focusPest && focusPest !== pest;
              return (
                <g key={pest} style={{ opacity: dim ? 0.12 : 1, transition: 'opacity 0.2s' }}>
                  <path d={path} fill="none" stroke={color} strokeWidth={2.25}
                    strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)" />
                </g>
              );
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
              <line x1={hover.x} x2={hover.x} y1={pad.top} y2={height - pad.bottom}
                stroke="hsl(var(--foreground))" strokeWidth={1} strokeDasharray="3 3" opacity={0.25} />
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

              const sorted = [...items].sort((a, b) => a.cy - b.cy);
              const clusters: Item[][] = [];
              sorted.forEach(it => {
                const last = clusters[clusters.length - 1];
                if (last && Math.abs(last[last.length - 1].cy - it.cy) < 12) last.push(it);
                else clusters.push([it]);
              });

              const labelPositions = new Map<string, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }>();
              clusters.forEach(cluster => {
                if (cluster.length === 1) {
                  const it = cluster[0];
                  labelPositions.set(it.pest, { x: cx, y: it.cy - 11, anchor: 'middle' });
                } else {
                  const ordered = [...cluster].sort((a, b) => b.val - a.val);
                  const baseY = Math.min(...cluster.map(c => c.cy)) - 13;
                  ordered.forEach((it, k) => {
                    let offsetX = 0;
                    let anchor: 'start' | 'middle' | 'end' = 'middle';
                    if (k === 0) {
                      offsetX = 0;
                    } else {
                      const side = k % 2 === 1 ? 1 : -1;
                      const dist = Math.ceil(k / 2) * 18;
                      offsetX = side * dist;
                      anchor = side === 1 ? 'start' : 'end';
                    }
                    let labelX = cx + offsetX;
                    if (isFirst && offsetX < 0) { labelX = cx; anchor = 'start'; }
                    if (isLast && offsetX > 0) { labelX = cx; anchor = 'end'; }
                    labelPositions.set(it.pest, { x: labelX, y: baseY, anchor });
                  });
                }
              });

              return (
                <g key={i}>
                  {items.map(it => {
                    const color = it.isTotal ? 'hsl(215 16% 47%)' : PEST_COLORS[it.idx % PEST_COLORS.length];
                    const pos = labelPositions.get(it.pest)!;
                    const showLeader = pos.x !== cx;
                    const isFocused = !focusPest || focusPest === it.pest || (it.isTotal && focusPest === '__total__');
                    return (
                      <g key={it.pest} style={{ opacity: isFocused ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                        {showLeader && (
                          <line
                            x1={cx} y1={it.cy}
                            x2={pos.x} y2={pos.y + 3}
                            stroke={color}
                            strokeWidth={1}
                            opacity={0.4}
                          />
                        )}
                        {/* Outer halo */}
                        <circle cx={cx} cy={it.cy} r={it.isTotal ? 7 : 6} fill={color} opacity={0.18} />
                        {/* Inner dot */}
                        <circle cx={cx} cy={it.cy} r={it.isTotal ? 4 : 3.5} fill={color}
                          stroke="hsl(var(--card))" strokeWidth={2}
                          className={it.isTotal ? '' : 'cursor-pointer'}
                          onClick={it.isTotal ? undefined : () => handleDrillDown('pest-trend', d.sortKey, it.pest)}>
                          <title>{it.pest}: {it.val}</title>
                        </circle>
                        {/* Label background for readability */}
                        <text x={pos.x} y={pos.y} textAnchor={pos.anchor}
                          stroke="hsl(var(--card))" strokeWidth={3.5} strokeLinejoin="round"
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
              return <text key={i} x={getX(i)} y={height - 14} textAnchor="middle"
                className="text-[10px] fill-muted-foreground font-medium tracking-wide uppercase">{d.label}</text>;
            })}
          </svg>

          {/* Floating tooltip — glassmorphism */}
          {hover && dataArray[hover.i] && (() => {
            const d = dataArray[hover.i];
            const tot = totals[hover.i];
            const leftPct = (hover.x / width) * 100;
            const flipLeft = leftPct > 70;
            return (
              <div
                className="absolute pointer-events-none z-10 rounded-xl px-3.5 py-2.5 text-xs min-w-[160px] backdrop-blur-xl border border-border/60"
                style={{
                  left: `${leftPct}%`,
                  top: 8,
                  transform: flipLeft ? 'translateX(-100%) translateX(-8px)' : 'translateX(8px)',
                  background: 'hsl(var(--card) / 0.92)',
                  boxShadow: '0 10px 40px -10px hsl(220 43% 11% / 0.25), 0 0 0 1px hsl(var(--border) / 0.5)',
                }}
              >
                <div className="font-semibold text-foreground mb-2 text-[13px] tracking-tight">{d.label}</div>
                <div className="flex items-center justify-between gap-4 py-1 border-b border-border/40">
                  <span className="flex items-center gap-2 text-muted-foreground text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(215 16% 47%)' }} /> Total
                  </span>
                  <span className="font-bold text-foreground tabular-nums">{tot}</span>
                </div>
                {selectedPests.map((pest, idx) => {
                  const v = d.counts[pest] || 0;
                  if (v === 0) return null;
                  const color = PEST_COLORS[idx % PEST_COLORS.length];
                  return (
                    <div key={pest} className="flex items-center justify-between gap-4 mt-1.5">
                      <span className="flex items-center gap-2 truncate text-[11px] text-foreground/80">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} /> {pest}
                      </span>
                      <span className="font-bold tabular-nums" style={{ color }}>{v}</span>
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
