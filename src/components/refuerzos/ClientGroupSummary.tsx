import { useAppContext } from '@/context/AppContext';
import { computeClientGroupStats } from '@/lib/clientGroups';
import { useMemo } from 'react';

export default function ClientGroupSummary() {
  const { currentData } = useAppContext();

  const groupStats = useMemo(() => computeClientGroupStats(currentData), [currentData]);

  const visible = groupStats.filter(g => g.total > 0);
  if (visible.length === 0) return null;

  return (
    <div className="col-span-full">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Resumen por Grupo de Cliente</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(g => (
          <div key={g.name} className="bg-card border border-border rounded-lg p-4">
            <h4 className="font-bold text-foreground mb-3">{g.name}</h4>
            <div className="grid grid-cols-4 gap-2 text-center">
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
          </div>
        ))}
      </div>
    </div>
  );
}
