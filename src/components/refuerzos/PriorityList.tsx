import { useAppContext } from '@/context/AppContext';

export default function PriorityList() {
  const { metrics, handleDrillDown } = useAppContext();

  const cases = metrics?.criticalCases
    .sort((a, b) => b.diasActivos - a.diasActivos)
    .slice(0, 5) || [];

  return (
    <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
      <h3 className="text-sm font-semibold text-destructive mb-1">Top Críticos (&gt;15 Días)</h3>
      <p className="text-xs text-muted-foreground mb-3">Casos de gravedad Alta con mayor antigüedad</p>

      {cases.length === 0 ? (
        <p className="text-center text-muted-foreground/40 py-5">Sin casos críticos recientes</p>
      ) : (
        <ul className="space-y-1.5">
          {cases.map(r => (
            <li
              key={r.id}
              onClick={() => handleDrillDown('cliente', r.cliente)}
              className="flex justify-between items-center bg-destructive/5 border-l-4 border-l-destructive p-2.5 rounded-md text-sm cursor-pointer hover:bg-destructive/10 transition-colors"
            >
              <div className="overflow-hidden">
                <span className="font-semibold block truncate">{r.cliente}</span>
                <span className="text-xs text-muted-foreground">{r.plaga}</span>
              </div>
              <strong className="text-destructive whitespace-nowrap ml-2">{r.diasActivos} días</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
