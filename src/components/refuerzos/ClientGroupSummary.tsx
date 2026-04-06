import { useAppContext } from '@/context/AppContext';
import { computeClientGroupFull } from '@/lib/clientGroups';
import { useMemo, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export default function ClientGroupSummary() {
  const { currentData } = useAppContext();
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const groupStats = useMemo(() => computeClientGroupFull(currentData), [currentData]);

  const visible = groupStats.filter(g => g.total > 0);
  if (visible.length === 0) return null;

  return (
    <div className="col-span-full">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Resumen por Grupo de Cliente</h3>
      <div className="grid grid-cols-1 gap-3">
        {visible.map(g => {
          const filtered = severityFilter && severityFilter !== 'total'
            ? g.records.filter(r => r.gravedad === severityFilter)
            : g.records;

          return (
            <Popover key={g.name} onOpenChange={() => setSeverityFilter(null)}>
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
              <PopoverContent className="w-[520px] max-h-80 overflow-y-auto" align="center">
                <h4 className="font-bold text-sm text-foreground mb-2">{g.name} — {severityFilter && severityFilter !== 'total' ? `Solo ${severityFilter}` : 'Todos'}</h4>
                <div className="flex gap-1 mb-2">
                  {[
                    { label: 'Alto', value: 'Alto', cls: 'bg-destructive/20 text-destructive' },
                    { label: 'Medio', value: 'Medio', cls: 'bg-yellow-500/20 text-yellow-500' },
                    { label: 'Bajo', value: 'Bajo', cls: 'bg-green-500/20 text-green-500' },
                    { label: 'Total', value: 'total', cls: 'bg-muted text-foreground' },
                  ].map(btn => (
                    <button
                      key={btn.value}
                      onClick={() => setSeverityFilter(btn.value === severityFilter ? null : btn.value)}
                      className={`text-[0.65rem] font-bold px-2 py-0.5 rounded cursor-pointer transition-opacity ${btn.cls} ${severityFilter === btn.value ? 'ring-1 ring-foreground/30' : 'opacity-60 hover:opacity-100'}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                {filtered.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left py-1 font-medium">Fecha</th>
                        <th className="text-left py-1 font-medium">Cliente</th>
                        <th className="text-left py-1 font-medium">Código</th>
                        <th className="text-left py-1 font-medium">Técnico</th>
                        <th className="text-center py-1 font-medium">Gravedad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((rec, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-1.5 text-foreground">{rec.displayDate}</td>
                          <td className="py-1.5 text-foreground max-w-[160px]" title={rec.cliente}>{rec.cliente}</td>
                          <td className="py-1.5 text-foreground">{rec.codigoCliente}</td>
                          <td className="py-1.5 text-foreground">{rec.tecnico}</td>
                          <td className="text-center py-1.5">
                            <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded ${rec.gravedad === 'Alto' ? 'bg-destructive/20 text-destructive' : rec.gravedad === 'Medio' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>{rec.gravedad}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin registros para este filtro.</p>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}