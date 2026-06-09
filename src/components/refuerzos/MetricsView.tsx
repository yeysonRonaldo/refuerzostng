import InsightCard from './InsightCard';
import StatsCards from './StatsCards';
import SeverityLineChart from './SeverityLineChart';
import PestTrendChart from './PestTrendChart';
import PriorityList from './PriorityList';
import BarChart from './BarChart';
import ClientGroupSummary from './ClientGroupSummary';
import CaseFlowTable from './CaseFlowTable';
import { useAppContext } from '@/context/AppContext';

export default function MetricsView() {
  const { metrics } = useAppContext();

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Row 1 - KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCards />
      </div>

      {/* Row 2 - Insight banner */}
      <InsightCard />

      {/* Row 3 - Big charts (full width each) */}
      <PestTrendChart />
      <SeverityLineChart />

      {/* Flow table */}
      <CaseFlowTable />


      {/* Row 4 - Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClientGroupSummary />
        <PriorityList />
      </div>

      {/* Row 5 - Top lists */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <BarChart title="Top Clientes Recurrentes" data={metrics.clients} color="hsl(var(--info))" drillType="cliente" />
          <BarChart title="Top 5 Plagas Internas" data={metrics.plagas} color="hsl(262 83% 58%)" drillType="plaga" />
          <BarChart title="Técnicos con Más Servicios" data={metrics.tecnicos} color="hsl(var(--primary))" drillType="tecnico" />
        </div>
      )}
    </div>
  );
}
