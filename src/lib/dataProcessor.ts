import * as XLSX from 'xlsx';
import { RefuerzoRecord } from '@/types/refuerzos';

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    const date = new Date((raw - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const str = String(raw);
  // Try mm/dd/yy or mm/dd/yyyy (US format from Excel)
  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    let year = parseInt(slashParts[2]);
    if (year < 100) year += 2000;
    const month = parseInt(slashParts[0]) - 1;
    const day = parseInt(slashParts[1]);
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) return parsed;
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
 * Uses: Cliente + IdServicio + PlagaInterna + PlagaExterna + Fecha
 */
function createDedupeKey(row: Record<string, unknown>): string {
  const cliente = String(row['Cliente'] || '').trim().toLowerCase();
  const idServicio = String(row['Id Servicio'] || '').trim();
  const plagaInt = String(row['Plagas Internas'] || '').trim().toLowerCase();
  const plagaExt = String(row['Plagas Externas'] || '').trim().toLowerCase();
  const fecha = String(row['Fecha del Último Servicio'] || '').trim();
  return `${cliente}|${idServicio}|${plagaInt}|${plagaExt}|${fecha}`;
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

        const seen = new Set<string>();
        const processed: RefuerzoRecord[] = [];
        let duplicatesSkipped = 0;
        let counter = 1;

        for (const row of rawData) {
          const dedupeKey = createDedupeKey(row);

          if (seen.has(dedupeKey)) {
            duplicatesSkipped++;
            continue;
          }
          seen.add(dedupeKey);

          const rawDate = row['Fecha del Último Servicio'] || row['Fecha'];
          const parsedDateObj = parseDate(rawDate);
          const plagaInterna = String(row['Plagas Internas'] || row['Plaga'] || '-');
          const plagaExterna = String(row['Plagas Externas'] || '-');

          // Auto-generate ID like TN1, TN2...
          const id = `TN${counter}`;
          counter++;

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
            originalData: row,
            _dedupeKey: dedupeKey,
          });
        }

        // Split records with multiple technicians
        const expanded = splitMultiTechRecords(processed);

        resolve({ records: expanded, duplicatesSkipped });
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
function splitMultiTechRecords(records: RefuerzoRecord[]): RefuerzoRecord[] {
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
