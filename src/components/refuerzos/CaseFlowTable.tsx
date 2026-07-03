import { useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { buildCombinedPest } from '@/lib/pestUtils';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES');

export default function CaseFlowTable() {
  const { processedData, getPestName, yearFilter, techFilter, handleDrillDown } = useAppContext();

  const prevMonthKey = (k: string) => {
    const [yStr, mStr] = k.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, '0')}`;
  };

  const flow = useMemo(() => {
    const scoped = processedData.filter(r => {
      if (!r.dateObj) return false;
      if (techFilter !== 'all' && r.tecnico !== techFilter) return false;
      if (yearFilter !== 'all' && r.dateObj.getUTCFullYear().toString() !== yearFilter) return false;
      return true;
    });

    // Por mes: todos los registros con fecha, igual que la gráfica de gravedad.
    // La clave cliente|plaga solo se usa para clasificar arrastre/nuevo/reaparecido.
    interface MonthData { records: { key: string }[]; keys: Set<string> }
    const byMonth = new Map<string, MonthData>();
    scoped.forEach(r => {
      if (!r.dateObj) return;
      const p = buildCombinedPest(r, getPestName);
      const monthKey = `${r.dateObj.getUTCFullYear()}-${String(r.dateObj.getUTCMonth() + 1).padStart(2, '0')}`;
      let data = byMonth.get(monthKey);
      if (!data) { data = { records: [], keys: new Set() }; byMonth.set(monthKey, data); }
      const clientKey = (r.idCliente || r.codigoCliente || r.cliente || r._dedupeKey || r.id || 'sin-cliente').trim().toLowerCase();
      const pestKey = p && p !== '---' ? p : (r.plaga || 'sin-plaga');
      const caseKey = `${clientKey}|${pestKey}`.toLowerCase();
      data.records.push({ key: caseKey });
      data.keys.add(caseKey);
    });

    const sortedKeys = Array.from(byMonth.keys()).sort();
    const historyBefore = new Set<string>(); // claves vistas en meses previos
    const empty: MonthData = { records: [], keys: new Set() };

    return sortedKeys.map((k) => {
      const curr = byMonth.get(k)!;
      // Mes calendario anterior (literal)
      const [yStr, mStr] = k.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const prevY = m === 1 ? y - 1 : y;
      const prevM = m === 1 ? 12 : m - 1;
      const prevKey = `${prevY}-${String(prevM).padStart(2, '0')}`;
      const prev = byMonth.get(prevKey) ?? empty;

      // Conteo por registros: el total del mes debe coincidir con la línea "Total" de la gráfica.
      let nuevos = 0, arrastrados = 0, reaparecidos = 0;
      curr.records.forEach(rec => {
        if (prev.keys.has(rec.key)) {
          arrastrados++;
        } else if (historyBefore.has(rec.key)) {
          reaparecidos++;
        } else {
          nuevos++;
        }
      });

      const entramos = prev.records.length;
      const entraron = curr.records.length;
      const pendiente = curr.records.length;
      const suma = entramos + nuevos + reaparecidos;
      const cerraron = Math.max(0, suma - pendiente);
      const row = {
        key: k,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        entramos,
        entraron,
        nuevos,
        arrastrados,
        reaparecidos,
        suma,
        cerraron,
        pendiente,
      };
      curr.keys.forEach(x => historyBefore.add(x));
      return row;
    });
  }, [processedData, getPestName, yearFilter, techFilter]);


  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-primary" /> Flujo de Casos por Mes
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          El <strong>Pendiente</strong> es el mismo total mensual de la gráfica. <strong>Nuevos + Reaparecidos</strong> son los que ingresaron al flujo este mes.
        </p>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 sticky top-0 z-10">
            <tr className="text-left">
              <th className="p-2.5 font-semibold text-muted-foreground">Mes</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Pendientes que venían del mes anterior">Entramos con</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Nuevos (nunca antes vistos) + Reaparecidos (ya existieron antes pero no el mes pasado)">Nuevos + Reaparecidos</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Entramos con + Nuevos + Reaparecidos">A controlar</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Estaban antes y ya no aparecen">Se cerraron</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Pasará como 'Entramos con' al próximo mes">Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {flow.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground/50">Sin datos.</td></tr>
            ) : (
              [...flow].reverse().map(row => {
                const prev = prevMonthKey(row.key);
                const cellCls = "p-2.5 text-right cursor-pointer hover:underline";
                return (
                  <tr key={row.key} className="border-b border-border/50 hover:bg-accent/30">
                    <td
                      className="p-2.5 font-semibold cursor-pointer hover:underline"
                      onClick={() => handleDrillDown('flow-month', row.key, 'curr')}
                    >{row.label}</td>
                    <td
                      className={`${cellCls} text-muted-foreground`}
                      onClick={() => handleDrillDown('flow-month', prev, 'curr')}
                    >{fmtInt(row.entramos)}</td>
                    <td
                      className={`${cellCls} text-info font-semibold`}
                      onClick={() => handleDrillDown('flow-month', row.key, 'new_reap')}
                    >{fmtInt(row.nuevos + row.reaparecidos)}</td>
                    <td
                      className={`${cellCls} font-semibold`}
                      onClick={() => handleDrillDown('flow-month', row.key, 'a_controlar')}
                    >{fmtInt(row.suma)}</td>
                    <td
                      className={`${cellCls} text-success font-semibold`}
                      onClick={() => handleDrillDown('flow-month', row.key, 'closed')}
                    >-{fmtInt(row.cerraron)}</td>
                    <td
                      className="p-2.5 text-right cursor-pointer"
                      onClick={() => handleDrillDown('flow-month', row.key, 'curr')}
                    >
                      <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold hover:bg-primary/20">{fmtInt(row.pendiente)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
