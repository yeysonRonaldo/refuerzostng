import * as XLSX from 'xlsx';
import { RefuerzoRecord } from '@/types/refuerzos';

export function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number') {
    const date = new Date((raw - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const str = String(raw).trim();

  // Prefer Spanish/LatAm dates from the uploaded Excel: dd/mm/yyyy.
  // Also accepts dd-mm-yyyy and avoids JS auto-overflow (e.g. 31/04 -> May).
  const parts = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (parts) {
    const first = parseInt(parts[1], 10);
    const second = parseInt(parts[2], 10);
    let year = parseInt(parts[3], 10);
    if (year < 100) year += 2000;

    // Excel source uses US format mm/dd/yyyy. When ambiguous (both <=12),
    // prefer mm/dd; fall back to dd/mm only as a safety net.
    const candidates = first > 12
      ? [{ day: first, month: second - 1 }]                     // dd/mm forced
      : second > 12
        ? [{ day: second, month: first - 1 }]                   // mm/dd forced
        : [{ day: second, month: first - 1 },                   // ambiguous: mm/dd first (US)
           { day: first, month: second - 1 }];                  // fallback dd/mm

    for (const candidate of candidates) {
      const parsed = new Date(year, candidate.month, candidate.day);
      if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === candidate.month &&
        parsed.getDate() === candidate.day
      ) return parsed;
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function formatDate(d: Date | null): string {
  if (!d) return '-';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Creates a dedupe key from a record to identify duplicates.
 * Uses ALL relevant fields so only 100% identical rows collapse.
 */
function createDedupeKey(row: Record<string, unknown>): string {
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const parts = [
    norm(row['Cliente']),
    norm(row['Id Servicio']),
    norm(row['Id Cliente']),
    norm(row['Código Cliente']),
    norm(row['Plagas Internas']),
    norm(row['Plagas Externas']),
    norm(row['Fecha del Último Servicio']),
    norm(row['Gravedad']),
    norm(row['Tecnicos'] ?? row['Tecnico']),
    norm(row['Iniciales Tecnicos']),
    norm(row['Programador']),
    norm(row['Dirección']),
    norm(row['Días Activos']),
    norm(row['Recomendaciones']),
    norm(row['Recomendaciones totales']),
    norm(row['Observaciones'] ?? row['Observacion']),
    norm(row['Causa de Refuerzo'] ?? row['Causa Refuerzo']),
    norm(row['Año']),
  ];
  return parts.join('|');
}

export function parseExcelFile(file: File): Promise<{ records: RefuerzoRecord[]; duplicatesSkipped: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(firstSheet);

        const processed: RefuerzoRecord[] = [];
        const duplicatesSkipped = 0;
        let counter = 1;

        for (const row of rawData) {
          const dedupeKey = createDedupeKey(row);

          const rawDate = row['Fecha del Último Servicio'] || row['Fecha'];
          const parsedDateObj = parseDate(rawDate);
          const plagaInterna = String(row['Plagas Internas'] || row['Plaga'] || '-');
          const plagaExterna = String(row['Plagas Externas'] || '-');

          // Auto-generate ID like TN1, TN2...
         const id = `TN${counter}`;
          counter++;

          const hoy = new Date();
          const fechaCarga = hoy.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

          processed.push({
            id,
            idServicio: String(row['Id Servicio'] || ''),
            displayDate: formatDate(parsedDateObj),
            dateObj: parsedDateObj,
            cliente: String(row['Cliente'] || 'Desconocido'),
            idCliente: String(row['Id Cliente'] || ''),
            codigoCliente: String(row['Código Cliente'] || ''),
            tecnico: String(row['Tecnicos'] || row['Tecnico'] || '-'),
            inicialesTecnicos: String(row['Iniciales Tecnicos'] || '-'),
            programador: String(row['Programador'] || '-'),
            plaga: plagaInterna,
            plagasExternas: plagaExterna,
            gravedad: (String(row['Gravedad'] || 'Bajo')) as 'Alto' | 'Medio' | 'Bajo',
            direccion: String(row['Dirección'] || '-'),
            anio: parsedDateObj ? parsedDateObj.getFullYear() : (row['Año'] as number | undefined),
            diasActivos: parseInt(String(row['Días Activos'])) || 0,
            recomendaciones: String(row['Recomendaciones'] || '-'),
            recomendacionesTotales: parseInt(String(row['Recomendaciones totales'])) || 0,
            observaciones: String(row['Observaciones'] || row['Observacion'] || '-'),
            causaRefuerzo: String(row['Causa de Refuerzo'] || row['Causa Refuerzo'] || '-'),
            fechaCarga,
            originalData: row,
            _dedupeKey: dedupeKey,
          });
        }

        resolve({ records: processed, duplicatesSkipped });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Splits records that have multiple technicians (separated by /, comma, " y ")
 * into individual records, one per technician.
 */
export function splitMultiTechRecords(records: RefuerzoRecord[]): RefuerzoRecord[] {
  const result: RefuerzoRecord[] = [];
  let counter = 1;

  for (const rec of records) {
    const tecnico = rec.tecnico?.trim() || '-';
    // Split by common separators: slash, comma, " y "
    const techs = tecnico
      .split(/[\/,]|\s+y\s+/i)
      .map(t => t.trim())
      .filter(t => t.length > 0 && t !== '-');

    if (techs.length <= 1) {
      result.push({ ...rec, id: `TN${counter}` });
      counter++;
    } else {
      for (const tech of techs) {
        result.push({
          ...rec,
          id: `TN${counter}`,
          tecnico: tech,
        });
        counter++;
      }
    }
  }

  return result;
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
