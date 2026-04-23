import { useAppContext } from '@/context/AppContext';

interface BarChartProps {
  title: string;
  data: Record<string, number>;
  limit?: number;
  color: string;
  drillType: string;
}

export default function BarChart({ title, data, limit = 5, color, drillType }: BarChartProps) {
  const { handleDrillDown } = useAppContext();

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (sorted.length === 0) {
    return (
      <div className="bg-card rounded-xl p-5 shadow-soft border border-border">
        <h3 className="text-sm font-semibold mb-3 tracking-tight">{title}</h3>
        <p className="text-center text-muted-foreground/40 py-5">Sin datos</p>
      </div>
    );
  }

  const maxVal = sorted[0][1];

  return (
    <div className="bg-card rounded-xl p-5 shadow-soft border border-border animate-fade-in-up hover:shadow-elegant transition-shadow">
      <h3 className="text-sm font-semibold mb-4 tracking-tight">{title}</h3>
      <div className="space-y-2.5">
        {sorted.map(([label, value], idx) => {
          const percent = (value / maxVal) * 100;
          return (
            <div
              key={label}
              onClick={() => handleDrillDown(drillType, label)}
              className="group flex items-center text-sm cursor-pointer rounded-md p-1.5 -m-1.5 hover:bg-accent transition-colors"
            >
              <div className="w-5 text-[10px] font-bold text-muted-foreground/60">{idx + 1}</div>
              <div className="w-[80px] sm:w-[120px] truncate text-foreground/80 text-xs sm:text-sm font-medium" title={label}>{label}</div>
              <div className="flex-1 bg-muted rounded-full h-2 mx-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                  style={{ width: `${percent}%`, background: color }}
                />
              </div>
              <div className="w-10 text-right font-bold text-foreground tabular-nums">{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
