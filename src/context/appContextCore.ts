import { createContext, useContext } from 'react';
import { RefuerzoRecord, TabName, DrillDownFilter, MetricCounts } from '@/types/refuerzos';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export interface AppState {
  processedData: RefuerzoRecord[];
  currentData: RefuerzoRecord[];
  activeTab: TabName;
  yearFilter: string;
  monthFilter: string;
  techFilter: string;
  drillDownFilter: DrillDownFilter | null;
  isGrouped: boolean;
  selectedPests: string[];
  allUniquePests: string[];
  metrics: MetricCounts | null;
  syncStatus: SyncStatus;
  loadError: string | null;
  recordsWithoutDate: number;
}

export interface AppContextType extends AppState {
  setProcessedData: (data: RefuerzoRecord[]) => void;
  setActiveTab: (tab: TabName) => void;
  setYearFilter: (year: string) => void;
  setMonthFilter: (month: string) => void;
  setTechFilter: (tech: string) => void;
  setDrillDownFilter: (filter: DrillDownFilter | null) => void;
  toggleGrouping: () => void;
  addPest: (pest: string) => void;
  removePest: (pest: string) => void;
  handleDrillDown: (type: string, value: string, extra?: string) => void;
  resetData: () => void;
  getPestName: (raw: string) => string;
  updateRecordField: (dedupeKey: string, field: 'observaciones' | 'causaRefuerzo', value: string) => void;
  retryLoad: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
