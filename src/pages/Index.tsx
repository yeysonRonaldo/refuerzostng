import { lazy, Suspense, useState } from 'react';
import Header from '@/components/refuerzos/Header';
import Sidebar from '@/components/refuerzos/Sidebar';
import { useAppContext } from '@/context/AppContext';
import { Loader2 } from 'lucide-react';

const MetricsView = lazy(() => import('@/components/refuerzos/MetricsView'));
const AnalysisView = lazy(() => import('@/components/refuerzos/AnalysisView'));
const DatabaseView = lazy(() => import('@/components/refuerzos/DatabaseView'));
const UserManagement = lazy(() => import('@/components/refuerzos/UserManagement'));
const RoutesView = lazy(() => import('@/components/refuerzos/RoutesView'));
const ReportsView = lazy(() => import('@/components/refuerzos/ReportsView'));
const ExportView = lazy(() => import('@/components/refuerzos/ExportView'));

const TabFallback = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

export default function Index() {
  const { activeTab } = useAppContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header onToggleSidebar={() => setSidebarOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'metrics' && <MetricsView />}
            {activeTab === 'analysis' && <AnalysisView />}
            {activeTab === 'routes' && <RoutesView />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'database' && <DatabaseView />}
            {activeTab === 'export' && <ExportView />}
            {activeTab === 'users' && <UserManagement />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
