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
      <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        <p className="text-center text-muted-foreground/40 py-5">Sin datos</p>
      </div>
    );
  }

  const maxVal = sorted[0][1];

  return (
    <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="space-y-2">
        {sorted.map(([label, value]) => {
          const percent = (value / maxVal) * 100;
          return (
            <div
              key={label}
              onClick={() => handleDrillDown(drillType, label)}
              className="flex items-center text-sm cursor-pointer rounded p-1 hover:bg-accent transition-colors"
            >
              <div className="w-[120px] truncate text-foreground/80">{label}</div>
              <div className="flex-1 bg-accent rounded h-2 mx-2.5 overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{ width: `${percent}%`, background: color }}
                />
              </div>
              <div className="w-10 text-right font-semibold text-foreground">{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
