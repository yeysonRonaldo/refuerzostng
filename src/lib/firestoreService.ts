import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  deleteDoc,
} from 'firebase/firestore';
import { RefuerzoRecord } from '@/types/refuerzos';

// Firestore path: refuezo (document) > public (subcollection? or document) > data (subcollection)
// Based on user's path: refuezo > public > data
// We'll use: collection "refuezo" > doc "public" > subcollection "data"
const getDataCollection = () => collection(db, 'refuezo', 'public', 'data');

/**
 * Serialize a RefuerzoRecord for Firestore (no Date objects, no functions)
 */
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
    _dedupeKey: record._dedupeKey,
  };
}

/**
 * Deserialize a Firestore document back to RefuerzoRecord
 */
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
    originalData: data,
    _dedupeKey: String(data._dedupeKey || ''),
  };
}

/**
 * Upload records to Firestore, skipping duplicates already in DB
 */
export async function uploadToFirestore(records: RefuerzoRecord[]): Promise<{ uploaded: number; skipped: number }> {
  const dataCol = getDataCollection();

  // Get existing dedupe keys
  const existingSnapshot = await getDocs(dataCol);
  const existingKeys = new Set<string>();
  existingSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data._dedupeKey) existingKeys.add(data._dedupeKey as string);
  });

  // Filter out duplicates
  const newRecords = records.filter(r => !existingKeys.has(r._dedupeKey));
  const skipped = records.length - newRecords.length;

  // Upload in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500;
  for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = newRecords.slice(i, i + BATCH_SIZE);

    for (const record of chunk) {
      const docRef = doc(dataCol);  // Auto-generate unique Firestore doc ID
      batch.set(docRef, serializeRecord(record));
    }

    await batch.commit();
  }

  return { uploaded: newRecords.length, skipped };
}

/**
 * Load all records from Firestore
 */
export async function loadFromFirestore(): Promise<RefuerzoRecord[]> {
  const dataCol = getDataCollection();
  const snapshot = await getDocs(query(dataCol));

  const records: RefuerzoRecord[] = [];
  snapshot.forEach(docSnap => {
    records.push(deserializeRecord(docSnap.data()));
  });

  // Sort by ID (TN1, TN2...)
  records.sort((a, b) => {
    const numA = parseInt(a.id.replace('TN', '')) || 0;
    const numB = parseInt(b.id.replace('TN', '')) || 0;
    return numA - numB;
  });

  return records;
}

/**
 * Clear all records from Firestore
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
}
