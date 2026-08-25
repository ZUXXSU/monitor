import { db } from './firebase.js';
import { RAW_LOG_RETENTION_DAYS } from './config.js';

// Deletes raw uptime_checks older than the retention window.
// Incidents (up/down transitions) are kept forever — they're the meaningful history.
export async function cleanupOldLogs() {
  const cutoff = new Date(Date.now() - RAW_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let deleted = 0;

  while (true) {
    const snap = await db.collection('uptime_checks')
      .where('timestamp', '<', cutoff)
      .limit(500)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;

    if (snap.size < 500) break;
  }

  console.log(`[cleanup] deleted ${deleted} uptime_checks older than ${RAW_LOG_RETENTION_DAYS}d`);
  return deleted;
}
