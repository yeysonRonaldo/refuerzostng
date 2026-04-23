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
    anio: record.anio || null,
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
 * Upload records to Firestore, skipping duplicates by `_dedupeKey`.
 * Uses the in-memory dedupe cache (built from existing data) to avoid
 * re-uploading records that are already present.
 */
export async function uploadToFirestore(records: RefuerzoRecord[]): Promise<{ uploaded: number; skipped: number; newRecords: RefuerzoRecord[] }> {
  const dataCol = getDataCollection();

  // Ensure dedupe cache is populated from existing Firestore data
  const cache = await ensureDedupeCache();

  // Filter out records already in DB (by _dedupeKey) and de-dup within the batch itself
  const newRecords: RefuerzoRecord[] = [];
  let skipped = 0;
  const seenInBatch = new Set<string>();
  for (const r of records) {
    const key = r._dedupeKey;
    if (!key) {
      newRecords.push(r);
      continue;
    }
    if (cache.has(key) || seenInBatch.has(key)) {
      skipped++;
      continue;
    }
    seenInBatch.add(key);
    newRecords.push(r);
  }

  // Upload only new records
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

  // Update cache with newly uploaded keys
  newRecords.forEach(r => { if (r._dedupeKey) cache.add(r._dedupeKey); });

  return { uploaded: newRecords.length, skipped, newRecords };
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
