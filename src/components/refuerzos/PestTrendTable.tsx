import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { PEST_COLORS } from '@/lib/pestColors';
import { Table as TableIcon } from 'lucide-react';

export default function PestTrendTable() {
  const { metrics, selectedPests, handleDrillDown } = useAppContext();

  const rows = useMemo(() => {
    if (!metrics) return [];
    return Object.values(metrics.pestTrend).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );
  }, [metrics]);

  if (!metrics || rows.length === 0 || selectedPests.length === 0) return null;

  const fmt = (n: number) => n.toLocaleString('es-ES');

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-primary" /> Tabla de Tendencia por Plaga
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          Conteo mensual por tipo de plaga. Clic en cualquier valor para filtrar.
        </p>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-accent/50 sticky top-0 z-10">
            <tr>
              <th className="p-2.5 font-semibold text-muted-foreground text-left whitespace-nowrap">
                Periodo
              </th>
              {selectedPests.map((pest, idx) => (
                <th
                  key={pest}
                  className="p-2.5 font-bold text-center whitespace-nowrap"
                  style={{ color: PEST_COLORS[idx % PEST_COLORS.length] }}
                >
                  {pest}
                </th>
              ))}
              <th className="p-2.5 font-bold text-center whitespace-nowrap text-muted-foreground">Otros</th>
              <th className="p-2.5 font-bold text-foreground text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(d => {
              const selectedSum = selectedPests.reduce(
                (sum, p) => sum + (d.counts[p] || 0),
                0
              );
              const otros = d.counts['Otros'] || 0;
              const rowTotal = selectedSum + otros;
              return (
                <tr
                  key={d.sortKey}
                  className="border-b border-border/50 hover:bg-accent/30"
                >
                  <td className="p-2.5 font-semibold whitespace-nowrap">
                    {d.label}
                  </td>
                  {selectedPests.map((pest, idx) => {
                    const v = d.counts[pest] || 0;
                    const color = PEST_COLORS[idx % PEST_COLORS.length];
                    return (
                      <td
                        key={pest}
                        onClick={() =>
                          v > 0 && handleDrillDown('pest-trend', d.sortKey, pest)
                        }
                        className={`p-2.5 text-center tabular-nums ${
                          v > 0
                            ? 'cursor-pointer hover:underline font-medium'
                            : 'text-muted-foreground/40'
                        }`}
                        style={v > 0 ? { color } : undefined}
                      >
                        {fmt(v)}
                      </td>
                    );
                  })}
                  <td
                    onClick={() =>
                      otros > 0 && handleDrillDown('pest-trend', d.sortKey, 'Otros')
                    }
                    className={`p-2.5 text-center tabular-nums ${
                      otros > 0
                        ? 'cursor-pointer hover:underline font-medium text-muted-foreground'
                        : 'text-muted-foreground/40'
                    }`}
                  >
                    {fmt(otros)}
                  </td>
                  <td
                    onClick={() =>
                      rowTotal > 0 &&
                      handleDrillDown('timeline', d.sortKey, 'total')
                    }
                    className={`p-2.5 text-center font-bold tabular-nums ${
                      rowTotal > 0 ? 'cursor-pointer hover:underline' : ''
                    }`}
                  >
                    {fmt(rowTotal)}
                  </td>
                </tr>
              );
            })}

          </tbody>
        </table>
      </div>
    </div>
  );
}
