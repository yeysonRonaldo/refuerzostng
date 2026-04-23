import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { LineChart } from 'lucide-react';

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

export default function SeverityLineChart() {
  const { metrics, handleDrillDown } = useAppContext();
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);

  const dataArray = useMemo(() => {
    if (!metrics) return [];
    return Object.values(metrics.timeline)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(d => ({ ...d, total: d.alto + d.medio + d.bajo }));
  }, [metrics]);

  if (dataArray.length === 0) {
    return (
      <div className="bg-card rounded-xl p-5 shadow-soft border border-border col-span-full">
        <h3 className="text-sm font-semibold mb-3">Evolución General de Gravedad</h3>
        <p className="text-center text-muted-foreground/40 py-16">Carga datos para ver la gráfica</p>
      </div>
    );
  }

  const width = 900;
  const height = 300;
  const pad = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxVal = dataArray.reduce((m, d) => Math.max(m, d.total!), 0);
  const yMax = maxVal === 0 ? 10 : Math.ceil(maxVal * 1.1);

  const single = dataArray.length === 1;
  const stepX = single ? chartW / 2 : chartW / (dataArray.length - 1);
  const getX = (i: number) => single ? pad.left + chartW / 2 : pad.left + i * stepX;
  const getY = (v: number) => height - pad.bottom - (v / yMax) * chartH;

  const lines = [
    { prop: 'bajo', color: 'hsl(var(--chart-bajo))', label: 'Bajo' },
    { prop: 'medio', color: 'hsl(var(--chart-medio))', label: 'Medio' },
    { prop: 'alto', color: 'hsl(var(--chart-alto))', label: 'Alto' },
    { prop: 'total', color: 'hsl(var(--chart-total))', label: 'Total' },
  ];

  const gridLines = Array.from({ length: 6 }, (_, i) => {
    const val = Math.round((yMax / 5) * i);
    return { val, y: getY(val) };
  });

  const skipRate = Math.max(1, Math.ceil(dataArray.length / 12));

  return (
    <div className="bg-card rounded-xl p-5 shadow-soft border border-border col-span-full animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <LineChart className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold tracking-tight">Evolución General de Gravedad</h3>
      </div>
      <div className="flex flex-wrap gap-3 justify-center mb-3 text-xs text-muted-foreground">
        {lines.map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          style={{ overflow: 'visible' }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="totalSeverityGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-total))" stopOpacity="0.20" />
              <stop offset="100%" stopColor="hsl(var(--chart-total))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map(g => (
            <g key={g.val}>
              <line x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y} stroke="hsl(var(--border))" strokeDasharray="3 4" />
              <text x={pad.left - 10} y={g.y} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-muted-foreground">{g.val}</text>
            </g>
          ))}
          <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="hsl(var(--border))" />

          {/* Total area gradient */}
          {(() => {
            const pts = dataArray.map((d, i) => ({ x: getX(i), y: getY(d.total!) }));
            const path = smoothPath(pts);
            const area = path + ` L ${getX(dataArray.length - 1)},${height - pad.bottom} L ${getX(0)},${height - pad.bottom} Z`;
            return <path d={area} fill="url(#totalSeverityGradient)" />;
          })()}

          {lines.map(l => {
            const pts = dataArray.map((d, i) => ({
              x: getX(i),
              y: getY((d as unknown as Record<string, number>)[l.prop] || 0),
            }));
            const path = smoothPath(pts);
            return (
              <g key={l.prop}>
                <path
                  d={path}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={l.prop === 'total' ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {dataArray.map((d, i) => {
                  const val = (d as unknown as Record<string, number>)[l.prop] || 0;
                  if (val === 0 && l.prop !== 'total') return null;
                  return (
                    <g key={i}>
                      <circle
                        cx={getX(i)}
                        cy={getY(val)}
                        r={4}
                        fill={l.prop === 'total' ? l.color : 'white'}
                        stroke={l.color}
                        strokeWidth={2}
                        className="cursor-pointer"
                        onClick={() => handleDrillDown('timeline', d.rawKey, l.prop)}
                      >
                        <title>{d.label} - {l.label}: {val}</title>
                      </circle>
                      {val > 0 && (
                        <text
                          x={getX(i)}
                          y={getY(val) - 12}
                          textAnchor="middle"
                          className="text-[10px] font-bold cursor-pointer"
                          style={{ fill: l.color }}
                          onClick={() => handleDrillDown('timeline', d.rawKey, l.prop)}
                        >
                          {val}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Hover capture columns */}
          {dataArray.map((d, i) => (
            <rect
              key={`hov-${i}`}
              x={getX(i) - stepX / 2}
              y={pad.top}
              width={stepX}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHover({ i, x: getX(i) })}
            />
          ))}
          {hover && (
            <line x1={hover.x} x2={hover.x} y1={pad.top} y2={height - pad.bottom} stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
          )}

          {dataArray.map((d, i) => {
            if (i % skipRate !== 0 && i !== dataArray.length - 1) return null;
            return (
              <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" className="text-[10px] fill-muted-foreground">
                {d.label}
              </text>
            );
          })}
        </svg>

        {hover && dataArray[hover.i] && (() => {
          const d = dataArray[hover.i];
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
              {lines.map(l => (
                <div key={l.prop} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: l.color }} /> {l.label}</span>
                  <span className="font-semibold" style={{ color: l.color }}>{(d as unknown as Record<string, number>)[l.prop] || 0}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
