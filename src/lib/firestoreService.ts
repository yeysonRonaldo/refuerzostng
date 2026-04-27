import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import { RefuerzoRecord } from '@/types/refuerzos';

const getDataCollection = () => collection(db, 'refuezo', 'public', 'data');

// In-memory cache of dedupe keys to avoid re-reading all docs
let dedupeKeyCache: Set<string> | null = null;

function serializeRecord(record: RefuerzoRecord): Record<string, unknown> {
  return {
    id: record.id,
    idServicio: record.idServicio,
    displayDate: record.displayDate,
    dateTimestamp: record.dateObj ? record.dateObj.getTime() : null,
    cliente: record.cliente,
    idCliente: record.idCliente,
    codigoCliente: record.codigoCliente,
    tecnico: record.tecnico,
    inicialesTecnicos: record.inicialesTecnicos,
    programador: record.programador,
    plaga: record.plaga,
    plagasExternas: record.plagasExternas,
    gravedad: record.gravedad,
    direccion: record.direccion,
    anio: record.dateObj ? record.dateObj.getUTCFullYear() : record.anio || null,
    diasActivos: record.diasActivos,
    recomendaciones: record.recomendaciones,
    recomendacionesTotales: record.recomendacionesTotales,
    observaciones: record.observaciones,
    causaRefuerzo: record.causaRefuerzo,
    fechaCarga: record.fechaCarga || '-',
    _dedupeKey: record._dedupeKey,
  };
}

function deserializeRecord(data: Record<string, unknown>): RefuerzoRecord {
  const dateObj = data.dateTimestamp ? new Date(data.dateTimestamp as number) : null;
  return {
    id: String(data.id || ''),
    idServicio: String(data.idServicio || ''),
    displayDate: String(data.displayDate || '-'),
    dateObj,
    cliente: String(data.cliente || 'Desconocido'),
    idCliente: String(data.idCliente || ''),
    codigoCliente: String(data.codigoCliente || ''),
    tecnico: String(data.tecnico || '-'),
    inicialesTecnicos: String(data.inicialesTecnicos || '-'),
    programador: String(data.programador || '-'),
    plaga: String(data.plaga || '-'),
    plagasExternas: String(data.plagasExternas || '-'),
    gravedad: (String(data.gravedad || 'Bajo')) as 'Alto' | 'Medio' | 'Bajo',
    direccion: String(data.direccion || '-'),
    anio: data.anio as number | undefined,
    diasActivos: Number(data.diasActivos) || 0,
    recomendaciones: String(data.recomendaciones || '-'),
    recomendacionesTotales: Number(data.recomendacionesTotales) || 0,
    observaciones: String(data.observaciones || '-'),
    causaRefuerzo: String(data.causaRefuerzo || '-'),
    fechaCarga: String(data.fechaCarga || '-'),
    originalData: data,
    _dedupeKey: String(data._dedupeKey || ''),
  };
}

/**
 * Build dedupe key cache from existing data (only fetches keys, not full records)
 */
async function ensureDedupeCache(): Promise<Set<string>> {
  if (dedupeKeyCache) return dedupeKeyCache;
  const dataCol = getDataCollection();
  const snapshot = await getDocs(dataCol);
  dedupeKeyCache = new Set<string>();
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data._dedupeKey) dedupeKeyCache!.add(data._dedupeKey as string);
  });
  return dedupeKeyCache;
}

/**
 * Upload ALL records to Firestore without any deduplication filter.
 * Every row from the Excel is imported as-is. Firestore assigns its own doc IDs.
 */
export async function uploadToFirestore(records: RefuerzoRecord[]): Promise<{ uploaded: number; skipped: number; newRecords: RefuerzoRecord[] }> {
  const dataCol = getDataCollection();

  // No filtering: import every record
  const newRecords = records;

  const BATCH_SIZE = 500;
  for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = newRecords.slice(i, i + BATCH_SIZE);
    for (const record of chunk) {
      const docRef = doc(dataCol);
      batch.set(docRef, serializeRecord(record));
    }
    await batch.commit();
  }

  // Keep cache in sync (best-effort, used elsewhere for edits)
  if (dedupeKeyCache) {
    newRecords.forEach(r => { if (r._dedupeKey) dedupeKeyCache!.add(r._dedupeKey); });
  }

  return { uploaded: newRecords.length, skipped: 0, newRecords };
}

/**
 * Load all records from Firestore and populate dedupe cache
 */
export async function loadFromFirestore(): Promise<RefuerzoRecord[]> {
  const dataCol = getDataCollection();
  
  // Always fetch from server to avoid stale local cache issues
  console.log('[Firestore] Fetching from server (skipping local cache)...');
  const snapshot = await getDocs(query(dataCol));
  console.log(`[Firestore] Loaded ${snapshot.size} docs from server`);

  const records: RefuerzoRecord[] = [];
  dedupeKeyCache = new Set<string>();
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    records.push(deserializeRecord(data));
    if (data._dedupeKey) dedupeKeyCache!.add(data._dedupeKey as string);
  });

  records.sort((a, b) => {
    const numA = parseInt(a.id.replace('TN', '')) || 0;
    const numB = parseInt(b.id.replace('TN', '')) || 0;
    return numA - numB;
  });

  return records;
}

/**
 * Clear all records from Firestore and reset cache
 */
export async function clearFirestoreData(): Promise<void> {
  const dataCol = getDataCollection();
  const snapshot = await getDocs(dataCol);
  const BATCH_SIZE = 500;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + BATCH_SIZE);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  dedupeKeyCache = null;
}

/**
 * Update a single field on a record identified by its _dedupeKey
 */
/**
 * Delete all records for a specific year from Firestore
 */
export async function deleteYearFromFirestore(year: number): Promise<number> {
  const dataCol = getDataCollection();
  const q = query(dataCol, where('anio', '==', year));
  const snapshot = await getDocs(q);
  const BATCH_SIZE = 500;
  const docs = snapshot.docs;
  let deleted = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + BATCH_SIZE);
    chunk.forEach(d => {
      batch.delete(d.ref);
      const key = d.data()._dedupeKey as string;
      if (key && dedupeKeyCache) dedupeKeyCache.delete(key);
    });
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

/**
 * Update a single field on a record identified by its _dedupeKey
 */
export async function updateRecordFieldInFirestore(
  dedupeKey: string,
  field: string,
  value: string
): Promise<void> {
  const dataCol = getDataCollection();
  const q = query(dataCol, where('_dedupeKey', '==', dedupeKey));
  const snapshot = await getDocs(q);
  for (const docSnap of snapshot.docs) {
    await updateDoc(docSnap.ref, { [field]: value });
  }
}

/**
 * Re-parse the date of every document using the (current) parser logic.
 * Reads the raw value from `originalData['Fecha del Último Servicio']` (or 'Fecha'),
 * recomputes dateTimestamp / displayDate / anio, and updates docs that changed.
 *
 * Useful after a parser fix to repair previously misinterpreted dates without
 * re-uploading the source Excel.
 */
export async function reparseAllDatesInFirestore(
  parseDateFn: (raw: unknown) => Date | null,
  formatDateFn: (d: Date | null) => string
): Promise<{ scanned: number; updated: number; unchanged: number; failed: number }> {
  const dataCol = getDataCollection();
  const snapshot = await getDocs(dataCol);
  const docs = snapshot.docs;

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  const BATCH_SIZE = 400;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    let writes = 0;
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const docSnap of chunk) {
      const data = docSnap.data() as Record<string, unknown>;
      const original = (data.originalData ?? {}) as Record<string, unknown>;
      const rawDate = original['Fecha del Último Servicio'] ?? original['Fecha'];

      const newDate = parseDateFn(rawDate);
      if (!newDate) {
        failed++;
        continue;
      }

      const newTs = newDate.getTime();
      const currentTs = data.dateTimestamp as number | null;
      if (currentTs === newTs) {
        unchanged++;
        continue;
      }

      batch.update(docSnap.ref, {
        dateTimestamp: newTs,
        displayDate: formatDateFn(newDate),
        anio: newDate.getUTCFullYear(),
      });
      writes++;
      updated++;
    }

    if (writes > 0) await batch.commit();
  }

  return { scanned: docs.length, updated, unchanged, failed };
}

