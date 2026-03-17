import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';

export default function SeverityLineChart() {
  const { metrics, handleDrillDown } = useAppContext();

  const dataArray = useMemo(() => {
    if (!metrics) return [];
    return Object.values(metrics.timeline)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(d => ({ ...d, total: d.alto + d.medio + d.bajo }));
  }, [metrics]);

  if (dataArray.length === 0) {
    return (
      <div className="bg-card rounded-lg p-5 shadow-sm border border-border col-span-full">
        <h3 className="text-sm font-semibold mb-3">Evolución General de Gravedad</h3>
        <p className="text-center text-muted-foreground/40 py-16">Carga datos para ver la gráfica</p>
      </div>
    );
  }

  const width = 900;
  const height = 280;
  const pad = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxVal = dataArray.reduce((m, d) => Math.max(m, d.total!), 0);
  const yMax = maxVal === 0 ? 10 : Math.ceil(maxVal * 1.1);

  const single = dataArray.length === 1;
  const stepX = single ? chartW / 2 : chartW / (dataArray.length - 1);
  const getX = (i: number) => single ? pad.left + chartW / 2 : pad.left + i * stepX;
  const getY = (v: number) => height - pad.bottom - (v / yMax) * chartH;

  const makeLine = (prop: string) =>
    dataArray.map((d, i) => `${getX(i)},${getY((d as unknown as Record<string, number>)[prop] || 0)}`).join(' ');

  const lines = [
    { prop: 'bajo', color: 'hsl(var(--chart-bajo))', label: 'Bajo' },
    { prop: 'medio', color: 'hsl(var(--chart-medio))', label: 'Medio' },
    { prop: 'alto', color: 'hsl(var(--chart-alto))', label: 'Alto' },
    { prop: 'total', color: 'hsl(var(--chart-total))', label: 'Total' },
  ];

  const gridLines = Array.from({ length: 6 }, (_, i) => {
    const val = Math.round((yMax / 5) * i);
    const y = getY(val);
    return { val, y };
  });

  const skipRate = Math.max(1, Math.ceil(dataArray.length / 12));

  return (
    <div className="bg-card rounded-lg p-5 shadow-sm border border-border col-span-full">
      <h3 className="text-sm font-semibold mb-3">Evolución General de Gravedad</h3>
      <div className="flex flex-wrap gap-4 justify-center mb-3 text-xs text-muted-foreground">
        {lines.map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
        {gridLines.map(g => (
          <g key={g.val}>
            <line x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y} stroke="#f1f5f9" strokeDasharray="4" />
            <text x={pad.left - 10} y={g.y} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-muted-foreground">{g.val}</text>
          </g>
        ))}
        <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="#cbd5e1" />

        {lines.map(l => (
          <g key={l.prop}>
            <polyline
              points={makeLine(l.prop)}
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
                    className="cursor-pointer hover:r-[7]"
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
        ))}

        {dataArray.map((d, i) => {
          if (i % skipRate !== 0 && i !== dataArray.length - 1) return null;
          return (
            <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" className="text-[10px] fill-muted-foreground">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
