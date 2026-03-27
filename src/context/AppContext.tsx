import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { RefuerzoRecord, TabName, DrillDownFilter, MetricCounts, TimelineEntry, PestTrendEntry } from '@/types/refuerzos';
import { getEffectivePestName, splitMultiTechRecords } from '@/lib/dataProcessor';

interface AppState {
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
}

interface AppContextType extends AppState {
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
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

const PEST_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
export { PEST_COLORS };

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function computeUniquePests(data: RefuerzoRecord[], isGrouped: boolean): string[] {
  const set = new Set<string>();
  data.forEach(r => {
    const name = getEffectivePestName(r.plaga, isGrouped);
    if (name && name !== '-' && name !== '---') set.add(name);
  });
  return Array.from(set).sort();
}

function computeDefaultPests(allPests: string[], isGrouped: boolean): string[] {
  const selected = allPests.filter(p => {
    const lower = p.toLowerCase();
    if (isGrouped) {
      return p === 'Roedores' || p === 'Voladores' || p === 'Hormigas' || lower.includes('cucaracha');
    }
    return lower.includes('alemana') || lower.includes('blatella') ||
      lower.includes('americana') || lower.includes('periplaneta') ||
      lower.includes('mosca') ||
      lower.includes('roedor') || lower.includes('rata') || lower.includes('ratón');
  });
  return selected.length === 0 ? allPests.slice(0, 3) : selected;
}

function computeMetrics(data: RefuerzoRecord[], isGrouped: boolean, selectedPests: string[]): MetricCounts {
  const counts: MetricCounts = {
    total: data.length, high: 0, mid: 0, low: 0,
    plagas: {}, tecnicos: {}, clients: {},
    timeline: {}, pestTrend: {},
    criticalCases: [],
  };

  data.forEach(r => {
    const grav = (r.gravedad || '').trim();
    let gKey = 'bajo';
    if (grav === 'Alto') { counts.high++; gKey = 'alto'; }
    else if (grav === 'Medio') { counts.mid++; gKey = 'medio'; }
    else { counts.low++; }

    const p = getEffectivePestName(r.plaga, isGrouped);
    if (p && p !== '---' && p !== '-') counts.plagas[p] = (counts.plagas[p] || 0) + 1;
    if (r.tecnico && r.tecnico !== '-') counts.tecnicos[r.tecnico] = (counts.tecnicos[r.tecnico] || 0) + 1;
    counts.clients[r.cliente] = (counts.clients[r.cliente] || 0) + 1;

    if (r.gravedad === 'Alto' && r.diasActivos > 15) counts.criticalCases.push(r);

    if (r.dateObj) {
      const y = r.dateObj.getFullYear();
      const m = r.dateObj.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (!counts.timeline[key]) {
        counts.timeline[key] = {
          alto: 0, medio: 0, bajo: 0,
          label: `${MONTHS[m]} ${String(y).substring(2)}`,
          sortKey: key, rawKey: key,
        };
      }
      counts.timeline[key][gKey as 'alto' | 'medio' | 'bajo']++;

      if (selectedPests.includes(p)) {
        if (!counts.pestTrend[key]) {
          counts.pestTrend[key] = { label: `${MONTHS[m]} ${String(y).substring(2)}`, sortKey: key, counts: {} };
        }
        counts.pestTrend[key].counts[p] = (counts.pestTrend[key].counts[p] || 0) + 1;
      }
    }
  });

  return counts;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [processedData, setProcessedDataRaw] = useState<RefuerzoRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabName>('metrics');
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [drillDownFilter, setDrillDownFilter] = useState<DrillDownFilter | null>(null);
  const [isGrouped, setIsGrouped] = useState(false);
  const [selectedPests, setSelectedPests] = useState<string[]>([]);
  const [allUniquePests, setAllUniquePests] = useState<string[]>([]);

  const setProcessedData = useCallback((data: RefuerzoRecord[]) => {
    const expanded = splitMultiTechRecords(data);
    setProcessedDataRaw(expanded);
    const pests = computeUniquePests(expanded, isGrouped);
    setAllUniquePests(pests);
    setSelectedPests(computeDefaultPests(pests, isGrouped));
    setDrillDownFilter(null);
  }, [isGrouped]);

  const currentData = useMemo(() => {
    return processedData.filter(d => {
      const matchesYear = !d.dateObj || yearFilter === 'all' || d.dateObj.getFullYear().toString() === yearFilter;
      const matchesMonth = !d.dateObj || monthFilter === 'all' || d.dateObj.getMonth().toString() === monthFilter;
      const matchesTech = techFilter === 'all' || d.tecnico === techFilter;
      return matchesYear && matchesMonth && matchesTech;
    });
  }, [processedData, yearFilter, monthFilter, techFilter]);

  const metrics = useMemo(() => {
    if (currentData.length === 0) return null;
    return computeMetrics(currentData, isGrouped, selectedPests);
  }, [currentData, isGrouped, selectedPests]);

  const toggleGrouping = useCallback(() => {
    const newGrouped = !isGrouped;
    setIsGrouped(newGrouped);
    const pests = computeUniquePests(processedData, newGrouped);
    setAllUniquePests(pests);
    setSelectedPests(computeDefaultPests(pests, newGrouped));
  }, [isGrouped, processedData]);

  const addPest = useCallback((pest: string) => {
    if (!selectedPests.includes(pest)) {
      setSelectedPests(prev => [...prev, pest]);
    }
  }, [selectedPests]);

  const removePest = useCallback((pest: string) => {
    setSelectedPests(prev => prev.filter(p => p !== pest));
  }, []);

  const handleDrillDown = useCallback((type: string, value: string, extra?: string) => {
    if (type === 'reset') {
      setDrillDownFilter(null);
    } else {
      setDrillDownFilter({ type, value, extra });
    }
    setActiveTab('database');
  }, []);

  const resetData = useCallback(() => {
    setProcessedDataRaw([]);
    setYearFilter('all');
    setMonthFilter('all');
    setTechFilter('all');
    setDrillDownFilter(null);
    setSelectedPests([]);
    setAllUniquePests([]);
  }, []);

  const getPestName = useCallback((raw: string) => getEffectivePestName(raw, isGrouped), [isGrouped]);

  return (
    <AppContext.Provider value={{
      processedData, currentData, activeTab, yearFilter, monthFilter, techFilter,
      drillDownFilter, isGrouped, selectedPests, allUniquePests, metrics,
      setProcessedData, setActiveTab, setYearFilter, setMonthFilter, setTechFilter,
      setDrillDownFilter, toggleGrouping, addPest, removePest,
      handleDrillDown, resetData, getPestName,
    }}>
      {children}
    </AppContext.Provider>
  );
};
