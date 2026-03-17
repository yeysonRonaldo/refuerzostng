export interface RefuerzoRecord {
  id: string;
  displayDate: string;
  dateObj: Date | null;
  cliente: string;
  tecnico: string;
  plaga: string;
  gravedad: 'Alto' | 'Medio' | 'Bajo';
  direccion: string;
  anio: number | undefined;
  diasActivos: number;
  originalData: Record<string, unknown>;
}

export type TabName = 'metrics' | 'analysis' | 'database';

export interface DrillDownFilter {
  type: string;
  value: string;
  extra?: string;
}

export interface TimelineEntry {
  alto: number;
  medio: number;
  bajo: number;
  total?: number;
  label: string;
  sortKey: string;
  rawKey: string;
}

export interface PestTrendEntry {
  label: string;
  sortKey: string;
  counts: Record<string, number>;
}

export interface MetricCounts {
  total: number;
  high: number;
  mid: number;
  low: number;
  plagas: Record<string, number>;
  tecnicos: Record<string, number>;
  clients: Record<string, number>;
  timeline: Record<string, TimelineEntry>;
  pestTrend: Record<string, PestTrendEntry>;
  criticalCases: RefuerzoRecord[];
}
