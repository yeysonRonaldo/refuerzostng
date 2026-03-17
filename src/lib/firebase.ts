import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyA5JKx3omY0Ou_CKRXeH2JW3wdgo6z6iQA",
  authDomain: "gestion-reclamos-c3c40.firebaseapp.com",
  projectId: "gestion-reclamos-c3c40",
  storageBucket: "gestion-reclamos-c3c40.firebasestorage.app",
  messagingSenderId: "156403493584",
  appId: "1:156403493584:web:6cae7b8fcc762686aeccd5",
  measurementId: "G-K1RWN0DVWC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export default app;
