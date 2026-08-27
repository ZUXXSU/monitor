import 'dotenv/config';
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// On Vercel there's no file to mount, so the key is set as a raw JSON string in
// FIREBASE_SERVICE_ACCOUNT_JSON. Locally, FIREBASE_SERVICE_ACCOUNT_PATH points at the file.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json', 'utf-8'));

const app = initializeApp({ credential: cert(serviceAccount) });

export const db = getFirestore();
export const authAdmin = getAuth(app);
export { FieldValue };
