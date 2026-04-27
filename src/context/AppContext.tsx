import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { RefuerzoRecord, TabName, DrillDownFilter, MetricCounts } from '@/types/refuerzos';
import { getEffectivePestName, splitMultiTechRecords, parseDate, formatDate } from '@/lib/dataProcessor';
import { updateRecordFieldInFirestore, loadFromFirestore, reparseAllDatesInFirestore } from '@/lib/firestoreService';
import { toast } from 'sonner';
import { AppContext, MONTHS, SyncStatus } from './appContextCore';

export { useAppContext } from './appContextCore';
export type { SyncStatus } from './appContextCore';


const getRecordYear = (date: Date) => date.getUTCFullYear();
const getRecordMonth = (date: Date) => date.getUTCMonth();

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
      const y = getRecordYear(r.dateObj);
      const m = getRecordMonth(r.dateObj);
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const setProcessedData = useCallback((data: RefuerzoRecord[]) => {
    setProcessedDataRaw(data);
    const pests = computeUniquePests(data, isGrouped);
    setAllUniquePests(pests);
    setSelectedPests(computeDefaultPests(pests, isGrouped));
    setDrillDownFilter(null);
  }, [isGrouped]);

  // Auto-load from Firestore on mount (resilient)
  const loadData = useCallback(async () => {
    setSyncStatus('loading');
    setLoadError(null);
    try {
      const data = await loadFromFirestore();
      if (data.length > 0) {
        setProcessedData(data);
        console.log(`[App] Loaded ${data.length} records from Firestore`);
      }
      setSyncStatus('saved');
    } catch (err) {
      console.error('Auto-load error:', err);
      setLoadError(err instanceof Error ? err.message : 'Error desconocido al cargar datos');
      setSyncStatus('error');
      toast.error('Error al cargar datos. Usa el botón Reintentar.');
    }
  }, [setProcessedData]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentData = useMemo(() => {
    return processedData.filter(d => {
      // When a specific year/month filter is set, exclude records without dates
      const matchesYear = yearFilter === 'all'
        ? true
        : !!d.dateObj && getRecordYear(d.dateObj).toString() === yearFilter;
      const matchesMonth = monthFilter === 'all'
        ? true
        : !!d.dateObj && getRecordMonth(d.dateObj).toString() === monthFilter;
      const matchesTech = techFilter === 'all' || d.tecnico === techFilter;
      return matchesYear && matchesMonth && matchesTech;
    });
  }, [processedData, yearFilter, monthFilter, techFilter]);

  // Records without a valid date (informational only)
  const recordsWithoutDate = useMemo(
    () => currentData.filter(d => !d.dateObj).length,
    [currentData]
  );

  // Expanded data splits multi-tech records for per-technician metrics
  const expandedData = useMemo(() => splitMultiTechRecords(currentData), [currentData]);

  const metrics = useMemo(() => {
    if (currentData.length === 0) return null;
    const m = computeMetrics(currentData, isGrouped, selectedPests);
    const techCounts: Record<string, number> = {};
    expandedData.forEach(r => {
      if (r.tecnico && r.tecnico !== '-') techCounts[r.tecnico] = (techCounts[r.tecnico] || 0) + 1;
    });
    m.tecnicos = techCounts;
    return m;
  }, [currentData, expandedData, isGrouped, selectedPests]);

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

  const updateRecordField = useCallback((dedupeKey: string, field: 'observaciones' | 'causaRefuerzo', value: string) => {
    // Optimistic update
    let prevValue: string | null = null;
    setProcessedDataRaw(prev => prev.map(r => {
      if (r._dedupeKey === dedupeKey) {
        prevValue = r[field];
        return { ...r, [field]: value };
      }
      return r;
    }));
    setSyncStatus('saving');
    updateRecordFieldInFirestore(dedupeKey, field, value)
      .then(() => setSyncStatus('saved'))
      .catch(err => {
        console.warn('Failed to update Firestore:', err);
        // Rollback
        if (prevValue !== null) {
          setProcessedDataRaw(prev => prev.map(r =>
            r._dedupeKey === dedupeKey ? { ...r, [field]: prevValue! } : r
          ));
        }
        setSyncStatus('error');
        toast.error('No se pudo guardar el cambio. Se revirtió.');
      });
  }, []);

  const reparseDates = useCallback(async () => {
    setSyncStatus('saving');
    try {
      const result = await reparseAllDatesInFirestore(parseDate, formatDate);
      // Refresh local state from Firestore so UI reflects new dates
      await loadData();
      setSyncStatus('saved');
      return result;
    } catch (err) {
      console.error('Reparse error:', err);
      setSyncStatus('error');
      throw err;
    }
  }, [loadData]);

  return (
    <AppContext.Provider value={{
      processedData, currentData, activeTab, yearFilter, monthFilter, techFilter,
      drillDownFilter, isGrouped, selectedPests, allUniquePests, metrics,
      syncStatus, loadError, recordsWithoutDate,
      setProcessedData, setActiveTab, setYearFilter, setMonthFilter, setTechFilter,
      setDrillDownFilter, toggleGrouping, addPest, removePest,
      handleDrillDown, resetData, getPestName, updateRecordField,
      retryLoad: loadData,
      reparseDates,
    }}>
      {children}
    </AppContext.Provider>
  );
};
