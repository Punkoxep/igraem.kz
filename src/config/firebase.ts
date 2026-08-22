import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID || 'igraemkz-45cdc';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@igraemkz-45cdc.iam.gserviceaccount.com';
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;

if (!admin.apps.length) {
  try {
    if (privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      console.log('[FirebaseAdmin] Initialized successfully with Service Account Certificate.');
    } else {
      admin.initializeApp({
        projectId,
      });
      console.log(`[FirebaseAdmin] Initialized successfully with Project ID: ${projectId}.`);
    }
  } catch (err: any) {
    console.error('[FirebaseAdmin] Initialization error:', err.message);
  }
}

export const firebaseAdmin = admin;
