import Header from '@/components/refuerzos/Header';
import Sidebar from '@/components/refuerzos/Sidebar';
import MetricsView from '@/components/refuerzos/MetricsView';
import AnalysisView from '@/components/refuerzos/AnalysisView';
import DatabaseView from '@/components/refuerzos/DatabaseView';
import UserManagement from '@/components/refuerzos/UserManagement';
import { useAppContext } from '@/context/AppContext';

export default function Index() {
  const { activeTab } = useAppContext();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-5">
          {activeTab === 'metrics' && <MetricsView />}
          {activeTab === 'analysis' && <AnalysisView />}
          {activeTab === 'database' && <DatabaseView />}
          {activeTab === 'users' && <UserManagement />}
        </main>
      </div>
    </div>
  );
}
