import { RefuerzoRecord } from '@/types/refuerzos';

export interface ClientGroup {
  name: string;
  keywords: string[];
}

export const CLIENT_GROUPS: ClientGroup[] = [
  {
    name: 'POLLO GRANJERO',
    keywords: ['pollo granjero', 'papa pollo'],
  },
  {
    name: 'BANCOS',
    keywords: ['banco'],
  },
];

export interface ClientGroupStats {
  name: string;
  alto: number;
  medio: number;
  bajo: number;
  total: number;
}

export interface ClientGroupMonthly {
  label: string;
  sortKey: string;
  alto: number;
  medio: number;
  bajo: number;
  total: number;
}

export interface ClientGroupRecord {
  cliente: string;
  codigoCliente: string;
  tecnico: string;
  gravedad: string;
  displayDate: string;
  plaga: string;
}

export interface ClientGroupFull {
  name: string;
  alto: number;
  medio: number;
  bajo: number;
  total: number;
  monthly: ClientGroupMonthly[];
  records: ClientGroupRecord[];
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function computeClientGroupStats(data: RefuerzoRecord[]): ClientGroupStats[] {
  return CLIENT_GROUPS.map(group => {
    const stats: ClientGroupStats = { name: group.name, alto: 0, medio: 0, bajo: 0, total: 0 };
    data.forEach(r => {
      const clientLower = (r.cliente || '').toLowerCase();
      const matches = group.keywords.some(kw => clientLower.includes(kw));
      if (matches) {
        stats.total++;
        if (r.gravedad === 'Alto') stats.alto++;
        else if (r.gravedad === 'Medio') stats.medio++;
        else stats.bajo++;
      }
    });
    return stats;
  });
}

export function computeClientGroupFull(data: RefuerzoRecord[]): ClientGroupFull[] {
  return CLIENT_GROUPS.map(group => {
    const stats: ClientGroupFull = { name: group.name, alto: 0, medio: 0, bajo: 0, total: 0, monthly: [], records: [] };
    const monthMap: Record<string, ClientGroupMonthly> = {};

    data.forEach(r => {
      const clientLower = (r.cliente || '').toLowerCase();
      const matches = group.keywords.some(kw => clientLower.includes(kw));
      if (!matches) return;

      stats.total++;
      if (r.gravedad === 'Alto') stats.alto++;
      else if (r.gravedad === 'Medio') stats.medio++;
      else stats.bajo++;
      stats.records.push({ cliente: r.cliente, codigoCliente: r.codigoCliente, tecnico: r.tecnico, gravedad: r.gravedad, displayDate: r.displayDate, plaga: r.plaga });

      if (r.dateObj) {
        const y = r.dateObj.getUTCFullYear();
        const m = r.dateObj.getUTCMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        if (!monthMap[key]) {
          monthMap[key] = { label: `${MONTHS[m]} ${String(y).substring(2)}`, sortKey: key, alto: 0, medio: 0, bajo: 0, total: 0 };
        }
        monthMap[key].total++;
        if (r.gravedad === 'Alto') monthMap[key].alto++;
        else if (r.gravedad === 'Medio') monthMap[key].medio++;
        else monthMap[key].bajo++;
      }
    });

    stats.monthly = Object.values(monthMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return stats;
  });
}
