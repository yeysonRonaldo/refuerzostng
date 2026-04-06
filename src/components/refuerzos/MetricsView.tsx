import InsightCard from './InsightCard';
import StatsCards from './StatsCards';
import SeverityLineChart from './SeverityLineChart';
import PestTrendChart from './PestTrendChart';
import PriorityList from './PriorityList';
import BarChart from './BarChart';
import ClientGroupSummary from './ClientGroupSummary';
import { useAppContext } from '@/context/AppContext';

export default function MetricsView() {
  const { metrics } = useAppContext();

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
      <InsightCard />
      <StatsCards />
      <ClientGroupSummary />
      <PestTrendChart />
      <SeverityLineChart />
      <PriorityList />
      {metrics && (
        <>
          <BarChart title="Top Clientes Recurrentes" data={metrics.clients} color="hsl(var(--info))" drillType="cliente" />
          <BarChart title="Top 5 Plagas Internas" data={metrics.plagas} color="#8b5cf6" drillType="plaga" />
          <BarChart title="Técnicos con Más Servicios" data={metrics.tecnicos} color="hsl(var(--primary))" drillType="tecnico" />
        </>
      )}
    </div>
  );
}
