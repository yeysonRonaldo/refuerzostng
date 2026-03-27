import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { RefuerzoRecord } from '@/types/refuerzos';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface TechMonthData {
  alto: number;
  medio: number;
  bajo: number;
  total: number;
}

interface ClientDetail {
  cliente: string;
  direccion: string;
  lastDate: string;
  months: Record<string, TechMonthData>;
  totals: TechMonthData;
}

export default function TechReportsView() {
  const { currentData } = useAppContext();
  const [selectedTech, setSelectedTech] = useState<string>('all');
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<{ tech: string; month: string } | null>(null);

  const technicians = useMemo(() => {
    const set = new Set<string>();
    currentData.forEach(r => {
      if (r.tecnico && r.tecnico !== '-') set.add(r.tecnico);
    });
    return Array.from(set).sort();
  }, [currentData]);

  const { monthKeys, techData, techClientData } = useMemo(() => {
    const data: Record<string, Record<string, TechMonthData>> = {};
    const clientData: Record<string, Record<string, ClientDetail>> = {}; // tech -> clientKey -> detail
    const monthSet = new Set<string>();

    currentData.forEach(r => {
      const tech = r.tecnico || '-';
      if (tech === '-') return;
      if (!r.dateObj) return;

      const y = r.dateObj.getFullYear();
      const m = r.dateObj.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthSet.add(key);

      // Tech-level monthly data
      if (!data[tech]) data[tech] = {};
      if (!data[tech][key]) data[tech][key] = { alto: 0, medio: 0, bajo: 0, total: 0 };

      const grav = (r.gravedad || '').trim();
      const gravKey = grav === 'Alto' ? 'alto' : grav === 'Medio' ? 'medio' : 'bajo';
      data[tech][key][gravKey]++;
      data[tech][key].total++;

      // Client-level detail per tech
      const clientKey = `${r.cliente}||${r.direccion || '-'}`;
      if (!clientData[tech]) clientData[tech] = {};
      if (!clientData[tech][clientKey]) {
        clientData[tech][clientKey] = {
          cliente: r.cliente,
          direccion: r.direccion || '-',
          lastDate: r.displayDate,
          months: {},
          totals: { alto: 0, medio: 0, bajo: 0, total: 0 },
        };
      }
      const cd = clientData[tech][clientKey];
      // Update last date
      if (r.dateObj && (!cd.lastDate || r.displayDate > cd.lastDate)) {
        cd.lastDate = r.displayDate;
      }
      if (!cd.months[key]) cd.months[key] = { alto: 0, medio: 0, bajo: 0, total: 0 };
      cd.months[key][gravKey]++;
      cd.months[key].total++;
      cd.totals[gravKey]++;
      cd.totals.total++;
    });

    const sorted = Array.from(monthSet).sort();
    return { monthKeys: sorted, techData: data, techClientData: clientData };
  }, [currentData]);

  const formatMonthKey = (key: string) => {
    const [y, m] = key.split('-');
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`;
  };

  const techsToShow = selectedTech === 'all' ? technicians : [selectedTech];

  const techTotals = useMemo(() => {
    const totals: Record<string, TechMonthData> = {};
    techsToShow.forEach(tech => {
      const t = { alto: 0, medio: 0, bajo: 0, total: 0 };
      monthKeys.forEach(mk => {
        const d = techData[tech]?.[mk];
        if (d) { t.alto += d.alto; t.medio += d.medio; t.bajo += d.bajo; t.total += d.total; }
      });
      totals[tech] = t;
    });
    return totals;
  }, [techsToShow, monthKeys, techData]);

  const toggleTechExpand = (tech: string) => {
    setExpandedTech(prev => prev === tech ? null : tech);
    setExpandedMonth(null);
  };

  const toggleMonthExpand = (tech: string, month: string) => {
    setExpandedMonth(prev =>
      prev?.tech === tech && prev?.month === month ? null : { tech, month }
    );
  };

  // Get clients for a specific tech+month, sorted by total desc
  const getClientsForMonth = (tech: string, month: string): ClientDetail[] => {
    const clients = techClientData[tech] || {};
    return Object.values(clients)
      .filter(c => c.months[month])
      .sort((a, b) => (b.months[month]?.total || 0) - (a.months[month]?.total || 0));
  };

  // Get all clients for a tech, sorted by total desc
  const getAllClientsForTech = (tech: string): ClientDetail[] => {
    const clients = techClientData[tech] || {};
    return Object.values(clients).sort((a, b) => b.totals.total - a.totals.total);
  };

  const SeverityBadge = ({ value, type }: { value: number; type: 'alto' | 'medio' | 'bajo' }) => {
    if (value === 0) return <span className="text-muted-foreground">0</span>;
    const styles = {
      alto: 'bg-destructive/10 text-destructive',
      medio: 'bg-warning/10 text-warning',
      bajo: 'bg-success/10 text-success',
    };
    return (
      <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full font-semibold text-xs ${styles[type]}`}>
        {value}
      </span>
    );
  };

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

      {techsToShow.map(tech => {
        const isExpanded = expandedTech === tech;
        const clients = isExpanded ? getAllClientsForTech(tech) : [];

        return (
          <div key={tech} className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Tech header */}
            <div
              className="px-4 py-3 bg-muted/50 border-b border-border cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => toggleTechExpand(tech)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <h3 className="font-semibold text-foreground">{tech}</h3>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Total: {techTotals[tech]?.total || 0} refuerzos —
                <span className="text-destructive ml-1">Alta: {techTotals[tech]?.alto || 0}</span>
                <span className="text-warning ml-2">Media: {techTotals[tech]?.medio || 0}</span>
                <span className="text-success ml-2">Baja: {techTotals[tech]?.bajo || 0}</span>
              </p>
            </div>

            {/* Monthly summary table */}
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
                    const isMonthExpanded = expandedMonth?.tech === tech && expandedMonth?.month === mk;
                    const monthClients = isMonthExpanded ? getClientsForMonth(tech, mk) : [];

                    return (
                      <>
                        <tr
                          key={mk}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => toggleMonthExpand(tech, mk)}
                        >
                          <td className="px-4 py-2 font-medium text-foreground flex items-center gap-1.5">
                            {isMonthExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            {formatMonthKey(mk)}
                          </td>
                          <td className="text-center px-3 py-2"><SeverityBadge value={d.alto} type="alto" /></td>
                          <td className="text-center px-3 py-2"><SeverityBadge value={d.medio} type="medio" /></td>
                          <td className="text-center px-3 py-2"><SeverityBadge value={d.bajo} type="bajo" /></td>
                          <td className="text-center px-3 py-2 font-bold text-foreground">{d.total}</td>
                        </tr>
                        {/* Expanded: show clients for this month */}
                        {isMonthExpanded && monthClients.length > 0 && (
                          <tr key={`${mk}-detail`}>
                            <td colSpan={5} className="p-0">
                              <div className="bg-muted/10 border-y border-border/30">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-muted/20">
                                      <th className="text-left px-4 py-1.5 font-medium text-muted-foreground">Cliente</th>
                                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Sucursal</th>
                                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Últ. Servicio</th>
                                      <th className="text-center px-2 py-1.5 font-medium text-destructive">Alta</th>
                                      <th className="text-center px-2 py-1.5 font-medium text-warning">Media</th>
                                      <th className="text-center px-2 py-1.5 font-medium text-success">Baja</th>
                                      <th className="text-center px-2 py-1.5 font-medium text-foreground">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {monthClients.map((c, i) => {
                                      const cm = c.months[mk];
                                      return (
                                        <tr key={i} className="border-b border-border/20 hover:bg-muted/30">
                                          <td className="px-4 py-1.5 text-foreground font-medium">{c.cliente}</td>
                                          <td className="px-3 py-1.5 text-muted-foreground">{c.direccion}</td>
                                          <td className="px-3 py-1.5 text-muted-foreground">{c.lastDate}</td>
                                          <td className="text-center px-2 py-1.5"><SeverityBadge value={cm?.alto || 0} type="alto" /></td>
                                          <td className="text-center px-2 py-1.5"><SeverityBadge value={cm?.medio || 0} type="medio" /></td>
                                          <td className="text-center px-2 py-1.5"><SeverityBadge value={cm?.bajo || 0} type="bajo" /></td>
                                          <td className="text-center px-2 py-1.5 font-bold text-foreground">{cm?.total || 0}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Expanded tech: show all clients summary */}
            {isExpanded && clients.length > 0 && (
              <div className="border-t border-border">
                <div className="px-4 py-2 bg-primary/5 border-b border-border">
                  <h4 className="text-sm font-semibold text-primary">Resumen por Cliente — {tech}</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cliente</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Sucursal</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Últ. Servicio</th>
                        <th className="text-center px-2 py-2 font-medium text-destructive">Alta</th>
                        <th className="text-center px-2 py-2 font-medium text-warning">Media</th>
                        <th className="text-center px-2 py-2 font-medium text-success">Baja</th>
                        <th className="text-center px-2 py-2 font-medium text-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="px-4 py-2 text-foreground font-medium">{c.cliente}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.direccion}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.lastDate}</td>
                          <td className="text-center px-2 py-2"><SeverityBadge value={c.totals.alto} type="alto" /></td>
                          <td className="text-center px-2 py-2"><SeverityBadge value={c.totals.medio} type="medio" /></td>
                          <td className="text-center px-2 py-2"><SeverityBadge value={c.totals.bajo} type="bajo" /></td>
                          <td className="text-center px-2 py-2 font-bold text-foreground">{c.totals.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
