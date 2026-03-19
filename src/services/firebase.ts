import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // or use json from env
  });
}

export const auth = admin.auth();
export const messaging = admin.messaging();
