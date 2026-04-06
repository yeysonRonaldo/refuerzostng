import { RefuerzoRecord } from '@/types/refuerzos';

export interface ClientGroup {
  name: string;
  keywords: string[]; // if client name contains any of these (case-insensitive), it matches
}

// Add more groups here as needed
export const CLIENT_GROUPS: ClientGroup[] = [
  {
    name: 'POLLO GRANJERO',
    keywords: ['pollo granjero', 'papa pollo'],
  },
];

export interface ClientGroupStats {
  name: string;
  alto: number;
  medio: number;
  bajo: number;
  total: number;
}

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
