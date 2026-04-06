import { useAppContext } from '@/context/AppContext';
import { computeClientGroupFull } from '@/lib/clientGroups';
import { useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export default function ClientGroupSummary() {
  const { currentData } = useAppContext();

  const groupStats = useMemo(() => computeClientGroupFull(currentData), [currentData]);

  const visible = groupStats.filter(g => g.total > 0);
  if (visible.length === 0) return null;

  return (
    <div className="col-span-full">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Resumen por Grupo de Cliente</h3>
      <div className="grid grid-cols-1 gap-3">
        {visible.map(g => (
          <Popover key={g.name}>
            <PopoverTrigger asChild>
              <div className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-foreground">{g.name}</h4>
                  <span className="text-xs text-muted-foreground">Clic para ver detalle</span>
                </div>
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
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-72 overflow-y-auto" align="center">
              <h4 className="font-bold text-sm text-foreground mb-2">{g.name} — Desglose Mensual</h4>
              {g.monthly.length > 0 ? (
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
              ) : (
                <p className="text-xs text-muted-foreground">Sin datos mensuales disponibles.</p>
              )}
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}