export interface RefuerzoRecord {
  id: string;
  idServicio: string;
  displayDate: string;
  dateObj: Date | null;
  cliente: string;
  idCliente: string;
  codigoCliente: string;
  tecnico: string;
  inicialesTecnicos: string;
  programador: string;
  plaga: string;
  plagasExternas: string;
  gravedad: 'Alto' | 'Medio' | 'Bajo';
  direccion: string;
  anio: number | undefined;
  diasActivos: number;
  recomendaciones: string;
  recomendacionesTotales: number;
  originalData: Record<string, unknown>;
  // Composite key for dedup
  _dedupeKey: string;
}

export type TabName = 'metrics' | 'analysis' | 'routes' | 'reports' | 'techReports' | 'database' | 'export' | 'users';

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
