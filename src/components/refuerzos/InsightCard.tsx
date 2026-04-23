import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, CalendarOff } from 'lucide-react';

export default function InsightCard() {
  const { currentData, metrics, recordsWithoutDate } = useAppContext();

  if (!metrics) {
    return (
      <div className="col-span-full bg-card border border-border rounded-xl p-5 shadow-soft">
        <div className="flex items-center gap-2 text-primary font-bold mb-2">
          <Sparkles className="w-4 h-4" />
          Análisis Inteligente
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
  let TrendIcon = Minus;
  let trendColorCls = 'text-muted-foreground';

  if (sortedMonths.length >= 2) {
    const last = sortedMonths[sortedMonths.length - 1];
    const prev = sortedMonths[sortedMonths.length - 2];
    const lastVal = monthlyCounts[last];
    const prevVal = monthlyCounts[prev];

    if (lastVal > prevVal) {
      trendText = `La actividad SUBIÓ de ${prevVal} a ${lastVal} entre ${prev} y ${last}.`;
      TrendIcon = TrendingUp;
      trendColorCls = 'text-destructive';
    } else if (lastVal < prevVal) {
      trendText = `La actividad BAJÓ de ${prevVal} a ${lastVal} entre ${prev} y ${last}.`;
      TrendIcon = TrendingDown;
      trendColorCls = 'text-success';
    } else {
      trendText = `La actividad se mantiene estable entre ${prev} y ${last}.`;
    }
  }

  const priorityCases = currentData.filter(d => d.diasActivos > 15);
  const highPriority = priorityCases.filter(d => d.gravedad === 'Alto');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="col-span-full bg-card border border-border rounded-xl p-5 shadow-soft relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary" />
      <div className="flex items-center gap-2 text-primary font-bold mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
        Análisis Inteligente
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-accent/40">
          <TrendIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${trendColorCls}`} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Tendencia</div>
            <p className={`leading-snug ${trendColorCls}`}>{trendText}</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-accent/40">
          {priorityCases.length > 0 ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-warning" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-success" />
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Atención Prioritaria</div>
            {priorityCases.length > 0 ? (
              <p className="leading-snug">
                <strong>{priorityCases.length}</strong> registros con +15 días activos.
                {highPriority.length > 0 && (
                  <> <strong className="text-destructive">{highPriority.length} de Gravedad Alta</strong>.</>
                )}
              </p>
            ) : (
              <p className="leading-snug text-success">Sin casos críticos prolongados.</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-accent/40">
          <CalendarOff className={`w-4 h-4 mt-0.5 flex-shrink-0 ${recordsWithoutDate > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Sin Fecha</div>
            <p className="leading-snug">
              {recordsWithoutDate > 0 ? (
                <><strong>{recordsWithoutDate}</strong> registros no aparecen en gráficas temporales (sin fecha válida).</>
              ) : (
                <span className="text-muted-foreground">Todos los registros tienen fecha válida.</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
