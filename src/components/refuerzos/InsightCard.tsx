import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';

export default function InsightCard() {
  const { currentData, metrics } = useAppContext();

  if (!metrics) {
    return (
      <div className="col-span-full bg-insight-bg border border-insight-border border-l-4 border-l-insight-accent rounded-lg p-5">
        <div className="flex items-center gap-2.5 text-insight-accent font-bold mb-2">
          📊 Análisis Inteligente
        </div>
        <p className="text-sm text-muted-foreground">Carga datos para obtener sugerencias automáticas.</p>
      </div>
    );
  }

  // Compute trend
  const monthlyCounts: Record<string, number> = {};
  currentData.forEach(d => {
    if (d.dateObj) {
      const k = `${d.dateObj.getFullYear()}-${String(d.dateObj.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[k] = (monthlyCounts[k] || 0) + 1;
    }
  });

  const sortedMonths = Object.keys(monthlyCounts).sort();
  let trendText = 'No hay datos suficientes para determinar una tendencia temporal.';
  let trendColor = '';

  if (sortedMonths.length >= 2) {
    const last = sortedMonths[sortedMonths.length - 1];
    const prev = sortedMonths[sortedMonths.length - 2];
    const lastVal = monthlyCounts[last];
    const prevVal = monthlyCounts[prev];

    if (lastVal > prevVal) {
      trendText = `La actividad ha SUBIDO comparando ${last} (${lastVal}) contra el mes anterior (${prevVal}).`;
      trendColor = 'text-destructive font-bold';
    } else if (lastVal < prevVal) {
      trendText = `La actividad ha BAJADO comparando ${last} (${lastVal}) contra el mes anterior (${prevVal}).`;
      trendColor = 'text-success font-bold';
    } else {
      trendText = `La actividad se mantiene estable entre ${prev} y ${last}.`;
    }
  }

  const priorityCases = currentData.filter(d => d.diasActivos > 15);
  const highPriority = priorityCases.filter(d => d.gravedad === 'Alto');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full bg-insight-bg border border-insight-border border-l-4 border-l-insight-accent rounded-lg p-5"
    >
      <div className="flex items-center gap-2.5 text-insight-accent font-bold mb-2">
        📊 Análisis Inteligente
      </div>
      <div className="text-sm text-foreground/80 leading-relaxed space-y-2">
        <p className={trendColor || undefined}>{trendText}</p>
        {priorityCases.length > 0 ? (
          <p>
            <strong>Atención Prioritaria:</strong> Se detectaron <strong>{priorityCases.length}</strong> registros con más de 15 días activos.
            {highPriority.length > 0 && (
              <> De estos, <strong className="text-destructive">{highPriority.length} son de Gravedad Alta</strong>.</>
            )}
          </p>
        ) : (
          <p className="text-success">¡Buen trabajo! No hay casos activos con más de 15 días de antigüedad.</p>
        )}
      </div>
    </motion.div>
  );
}
