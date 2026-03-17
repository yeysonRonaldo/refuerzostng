import * as XLSX from 'xlsx';
import { RefuerzoRecord } from '@/types/refuerzos';

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    // Excel serial date
    const date = new Date((raw - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const str = String(raw);
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try dd/mm/yyyy
  const parts = str.split('/');
  if (parts.length === 3) {
    const parsed = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function formatDate(d: Date | null): string {
  if (!d) return '-';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function parseExcelFile(file: File): Promise<RefuerzoRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(firstSheet);

        const processed: RefuerzoRecord[] = rawData.map((row: Record<string, unknown>) => {
          const rawDate = row['Fecha del Último Servicio'] || row['Fecha'];
          const parsedDateObj = parseDate(rawDate);
          const plaga = String(row['Plagas Internas'] || row['Plaga'] || '-');

          return {
            id: String(row['Id Servicio'] || row['No.'] || Math.random().toString(36).substr(2, 9)),
            displayDate: formatDate(parsedDateObj),
            dateObj: parsedDateObj,
            cliente: String(row['Cliente'] || 'Desconocido'),
            tecnico: String(row['Tecnicos'] || row['Tecnico'] || '-'),
            plaga,
            gravedad: (String(row['Gravedad'] || 'Bajo')) as 'Alto' | 'Medio' | 'Bajo',
            direccion: String(row['Dirección'] || '-'),
            anio: row['Año'] as number | undefined,
            diasActivos: parseInt(String(row['Días Activos'])) || 0,
            originalData: row,
          };
        });

        resolve(processed);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function getEffectivePestName(rawName: string, isGrouped: boolean): string {
  if (!isGrouped) return rawName;
  const lower = rawName.toLowerCase();
  if (lower.includes('rat') || lower.includes('roedor') || lower.includes('mouse')) return 'Roedores';
  if (lower.includes('mosca') || lower.includes('mosco') || lower.includes('mosquito') || lower.includes('mosquita')) return 'Voladores';
  if (lower.includes('hormiga')) return 'Hormigas';
  return rawName;
}

export function exportToExcel(data: RefuerzoRecord[], filename: string) {
  const rowsToExport = data.map(d => d.originalData);
  const worksheet = XLSX.utils.json_to_sheet(rowsToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
  XLSX.writeFile(workbook, filename);
}
