import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: number;
  colorClass?: string;
  onClick?: () => void;
  delay?: number;
}

function StatCard({ label, value, colorClass, onClick, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="bg-card rounded-lg p-3 sm:p-5 shadow-sm border border-border cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary"
    >
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl sm:text-3xl font-bold ${colorClass || 'text-foreground'}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground/60 mt-1">Clic para filtrar</div>
    </motion.div>
  );
}

export default function StatsCards() {
  const { metrics, handleDrillDown } = useAppContext();

  if (!metrics) return null;

  return (
    <>
      <StatCard
        label="Total Filtrado"
        value={metrics.total}
        onClick={() => handleDrillDown('reset', '')}
        delay={0.05}
      />
      <StatCard
        label="Gravedad Alta"
        value={metrics.high}
        colorClass="text-destructive"
        onClick={() => handleDrillDown('gravedad', 'Alto')}
        delay={0.1}
      />
      <StatCard
        label="Gravedad Media"
        value={metrics.mid}
        colorClass="text-warning"
        onClick={() => handleDrillDown('gravedad', 'Medio')}
        delay={0.15}
      />
      <StatCard
        label="Gravedad Baja"
        value={metrics.low}
        colorClass="text-success"
        onClick={() => handleDrillDown('gravedad', 'Bajo')}
        delay={0.2}
      />
    </>
  );
}
