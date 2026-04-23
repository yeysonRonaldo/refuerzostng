import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { LayoutGrid, AlertOctagon, AlertTriangle, ShieldCheck, LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  colorClass?: string;
  bgClass?: string;
  onClick?: () => void;
  delay?: number;
}

function StatCard({ label, value, icon: Icon, colorClass, bgClass, onClick, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      onClick={onClick}
      className="group bg-card rounded-xl p-4 sm:p-5 shadow-soft border border-border cursor-pointer transition-all hover:-translate-y-1 hover:shadow-elegant hover:border-primary/40"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${bgClass || 'bg-muted'}`}>
          <Icon className={`w-4 h-4 ${colorClass || 'text-foreground'}`} />
        </div>
      </div>
      <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${colorClass || 'text-foreground'}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-wider">Clic para filtrar</div>
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
        icon={LayoutGrid}
        colorClass="text-primary"
        bgClass="bg-primary/10"
        onClick={() => handleDrillDown('reset', '')}
        delay={0.05}
      />
      <StatCard
        label="Gravedad Alta"
        value={metrics.high}
        icon={AlertOctagon}
        colorClass="text-destructive"
        bgClass="bg-destructive/10"
        onClick={() => handleDrillDown('gravedad', 'Alto')}
        delay={0.1}
      />
      <StatCard
        label="Gravedad Media"
        value={metrics.mid}
        icon={AlertTriangle}
        colorClass="text-warning"
        bgClass="bg-warning/10"
        onClick={() => handleDrillDown('gravedad', 'Medio')}
        delay={0.15}
      />
      <StatCard
        label="Gravedad Baja"
        value={metrics.low}
        icon={ShieldCheck}
        colorClass="text-success"
        bgClass="bg-success/10"
        onClick={() => handleDrillDown('gravedad', 'Bajo')}
        delay={0.2}
      />
    </>
  );
}
