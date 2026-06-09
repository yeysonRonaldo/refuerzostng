import { useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { buildCombinedPest } from '@/lib/pestUtils';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES');

export default function CaseFlowTable() {
  const { processedData, getPestName, yearFilter, techFilter } = useAppContext();

  const flow = useMemo(() => {
    const scoped = processedData.filter(r => {
      if (!r.dateObj) return false;
      if (techFilter !== 'all' && r.tecnico !== techFilter) return false;
      if (yearFilter !== 'all' && r.dateObj.getUTCFullYear().toString() !== yearFilter) return false;
      return true;
    });

    const byMonth = new Map<string, Set<string>>();
    scoped.forEach(r => {
      if (!r.dateObj || !r.cliente) return;
      const p = buildCombinedPest(r, getPestName);
      if (p === '---') return;
      const key = `${r.dateObj.getUTCFullYear()}-${String(r.dateObj.getUTCMonth() + 1).padStart(2, '0')}`;
      let set = byMonth.get(key);
      if (!set) { set = new Set(); byMonth.set(key, set); }
      set.add(`${r.cliente}|${p}`);
    });

    const sortedKeys = Array.from(byMonth.keys()).sort();
    const historyBefore = new Set<string>(); // todos los casos vistos antes del mes en curso
    return sortedKeys.map((k) => {
      const curr = byMonth.get(k)!;
      // Use the literal previous calendar month, not just the prior key with data.
      const [yStr, mStr] = k.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const prevY = m === 1 ? y - 1 : y;
      const prevM = m === 1 ? 12 : m - 1;
      const prevKey = `${prevY}-${String(prevM).padStart(2, '0')}`;
      const prev = byMonth.get(prevKey) ?? new Set<string>();
      let entraron = 0, nuevos = 0, reaparecidos = 0;
      curr.forEach(x => {
        if (!prev.has(x)) {
          entraron++;
          if (historyBefore.has(x)) reaparecidos++;
          else nuevos++;
        }
      });
      let cerraron = 0;
      prev.forEach(x => { if (!curr.has(x)) cerraron++; });
      const entramos = prev.size;
      const [y, m] = k.split('-');
      const row = {
        key: k,
        label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
        entramos,
        entraron,
        nuevos,
        reaparecidos,
        suma: entramos + entraron,
        cerraron,
        pendiente: curr.size,
      };
      curr.forEach(x => historyBefore.add(x));
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
          Casos únicos (cliente + plaga). El <strong>Pendiente</strong> de un mes pasa como <strong>Entramos con</strong> al siguiente.
        </p>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 sticky top-0 z-10">
            <tr className="text-left">
              <th className="p-2.5 font-semibold text-muted-foreground">Mes</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Pendientes que venían del mes anterior">Entramos con</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Casos de este mes que NO estaban el mes anterior (nuevos + reaparecidos)">Entraron</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Nunca antes vistos en la historia">Nuevos</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Ya existieron antes pero no el mes pasado">Reaparecidos</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right">Suma</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Estaban antes y ya no aparecen">Se cerraron</th>
              <th className="p-2.5 font-semibold text-muted-foreground text-right" title="Pasará como 'Entramos con' al próximo mes">Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {flow.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground/50">Sin datos.</td></tr>
            ) : (
              [...flow].reverse().map(row => (
                <tr key={row.key} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="p-2.5 font-semibold">{row.label}</td>
                  <td className="p-2.5 text-right text-muted-foreground">{fmtInt(row.entramos)}</td>
                  <td className="p-2.5 text-right text-primary font-semibold">+{fmtInt(row.entraron)}</td>
                  <td className="p-2.5 text-right text-info font-semibold">{fmtInt(row.nuevos)}</td>
                  <td className="p-2.5 text-right text-warning font-semibold">{fmtInt(row.reaparecidos)}</td>
                  <td className="p-2.5 text-right font-semibold">{fmtInt(row.suma)}</td>
                  <td className="p-2.5 text-right text-success font-semibold">-{fmtInt(row.cerraron)}</td>
                  <td className="p-2.5 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">{fmtInt(row.pendiente)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
