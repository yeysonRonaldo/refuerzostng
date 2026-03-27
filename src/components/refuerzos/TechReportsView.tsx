import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface TechMonthData {
  alto: number;
  medio: number;
  bajo: number;
  total: number;
}

export default function TechReportsView() {
  const { currentData } = useAppContext();
  const [selectedTech, setSelectedTech] = useState<string>('all');

  const technicians = useMemo(() => {
    const set = new Set<string>();
    currentData.forEach(r => {
      if (r.tecnico && r.tecnico !== '-') set.add(r.tecnico);
    });
    return Array.from(set).sort();
  }, [currentData]);

  // Build month keys sorted chronologically
  const { monthKeys, techData } = useMemo(() => {
    const data: Record<string, Record<string, TechMonthData>> = {};
    const monthSet = new Set<string>();

    currentData.forEach(r => {
      const tech = r.tecnico || '-';
      if (tech === '-') return;
      if (!r.dateObj) return;

      const y = r.dateObj.getFullYear();
      const m = r.dateObj.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthSet.add(key);

      if (!data[tech]) data[tech] = {};
      if (!data[tech][key]) data[tech][key] = { alto: 0, medio: 0, bajo: 0, total: 0 };

      const grav = (r.gravedad || '').trim();
      if (grav === 'Alto') data[tech][key].alto++;
      else if (grav === 'Medio') data[tech][key].medio++;
      else data[tech][key].bajo++;
      data[tech][key].total++;
    });

    const sorted = Array.from(monthSet).sort();
    return { monthKeys: sorted, techData: data };
  }, [currentData]);

  const formatMonthKey = (key: string) => {
    const [y, m] = key.split('-');
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`;
  };

  const techsToShow = selectedTech === 'all' ? technicians : [selectedTech];

  // Totals per tech
  const techTotals = useMemo(() => {
    const totals: Record<string, TechMonthData> = {};
    techsToShow.forEach(tech => {
      const t = { alto: 0, medio: 0, bajo: 0, total: 0 };
      monthKeys.forEach(mk => {
        const d = techData[tech]?.[mk];
        if (d) {
          t.alto += d.alto;
          t.medio += d.medio;
          t.bajo += d.bajo;
          t.total += d.total;
        }
      });
      totals[tech] = t;
    });
    return totals;
  }, [techsToShow, monthKeys, techData]);

  if (currentData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No hay datos cargados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <h2 className="text-lg font-bold text-foreground">Reporte por Técnico</h2>
        <select
          value={selectedTech}
          onChange={e => setSelectedTech(e.target.value)}
          className="text-sm p-2 rounded-md border border-border bg-card"
        >
          <option value="all">Todos los Técnicos</option>
          {technicians.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {techsToShow.map(tech => (
        <div key={tech} className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="font-semibold text-foreground">{tech}</h3>
            <p className="text-xs text-muted-foreground">
              Total: {techTotals[tech]?.total || 0} refuerzos — 
              <span className="text-destructive ml-1">Alta: {techTotals[tech]?.alto || 0}</span>
              <span className="text-warning ml-2">Media: {techTotals[tech]?.medio || 0}</span>
              <span className="text-success ml-2">Baja: {techTotals[tech]?.bajo || 0}</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Mes</th>
                  <th className="text-center px-3 py-2 font-medium text-destructive">Alta</th>
                  <th className="text-center px-3 py-2 font-medium text-warning">Media</th>
                  <th className="text-center px-3 py-2 font-medium text-success">Baja</th>
                  <th className="text-center px-3 py-2 font-medium text-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthKeys.map(mk => {
                  const d = techData[tech]?.[mk];
                  if (!d) return null;
                  return (
                    <tr key={mk} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium text-foreground">{formatMonthKey(mk)}</td>
                      <td className="text-center px-3 py-2">
                        {d.alto > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold text-xs">
                            {d.alto}
                          </span>
                        ) : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center px-3 py-2">
                        {d.medio > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-semibold text-xs">
                            {d.medio}
                          </span>
                        ) : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center px-3 py-2">
                        {d.bajo > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold text-xs">
                            {d.bajo}
                          </span>
                        ) : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center px-3 py-2 font-bold text-foreground">{d.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
