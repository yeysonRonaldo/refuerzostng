import { useAppContext } from '@/context/AppContext';
import { computeClientGroupFull } from '@/lib/clientGroups';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ClientGroupSummary() {
  const { currentData } = useAppContext();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groupStats = useMemo(() => computeClientGroupFull(currentData), [currentData]);

  const visible = groupStats.filter(g => g.total > 0);
  if (visible.length === 0) return null;

  return (
    <div className="col-span-full">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Resumen por Grupo de Cliente</h3>
      <div className="grid grid-cols-1 gap-3">
        {visible.map(g => (
          <div key={g.name} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-foreground">{g.name}</h4>
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [g.name]: !prev[g.name] }))}
                className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded[g.name] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {expanded[g.name] ? 'Ocultar meses' : 'Ver por mes'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center mb-3">
              <div>
                <div className="text-lg font-bold text-destructive">{g.alto}</div>
                <div className="text-[0.65rem] text-muted-foreground">Alto</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-500">{g.medio}</div>
                <div className="text-[0.65rem] text-muted-foreground">Medio</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-500">{g.bajo}</div>
                <div className="text-[0.65rem] text-muted-foreground">Bajo</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{g.total}</div>
                <div className="text-[0.65rem] text-muted-foreground">Total</div>
              </div>
            </div>

            {expanded[g.name] && g.monthly.length > 0 && (
              <div className="border-t border-border pt-3 mt-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1 font-medium">Mes</th>
                      <th className="text-center py-1 font-medium text-destructive">Alto</th>
                      <th className="text-center py-1 font-medium text-yellow-500">Medio</th>
                      <th className="text-center py-1 font-medium text-green-500">Bajo</th>
                      <th className="text-center py-1 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.monthly.map(m => (
                      <tr key={m.sortKey} className="border-t border-border/50">
                        <td className="py-1.5 text-foreground">{m.label}</td>
                        <td className="text-center py-1.5 font-semibold text-destructive">{m.alto}</td>
                        <td className="text-center py-1.5 font-semibold text-yellow-500">{m.medio}</td>
                        <td className="text-center py-1.5 font-semibold text-green-500">{m.bajo}</td>
                        <td className="text-center py-1.5 font-bold text-foreground">{m.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
