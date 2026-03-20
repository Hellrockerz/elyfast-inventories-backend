/**
 * Set Firebase Custom Claims for Admin Users
 * 
 * Usage: npx ts-node src/scripts/set-admin.ts <firebase-uid>
 * 
 * This sets the 'admin: true' custom claim on the specified Firebase user,
 * which is checked by the admin routes middleware.
 */
import "dotenv/config";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

async function setAdmin() {
  const uid = process.argv[2];

  if (!uid) {
    console.error("Usage: npx ts-node src/scripts/set-admin.ts <firebase-uid>");
    process.exit(1);
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`✅ Admin claim set for user: ${uid}`);
    console.log("The user must sign out and sign back in for the claim to take effect.");
  } catch (err) {
    console.error("❌ Failed to set admin claim:", err);
    process.exit(1);
  }

  process.exit(0);
}

setAdmin();
