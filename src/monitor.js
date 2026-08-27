import { db, FieldValue } from './firebase.js';
import { SITES, CHECK_TIMEOUT_MS } from './config.js';

// site_state doc per site is the source of truth for last-known status —
// an in-memory Map would reset on every cold start when run as a serverless function.
async function pingSite(site) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(site.url, { signal: controller.signal });
    clearTimeout(timer);
    return {
      up: res.ok,
      statusCode: res.status,
      responseTimeMs: Date.now() - started,
      error: null,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      up: false,
      statusCode: null,
      responseTimeMs: Date.now() - started,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
    };
  }
}

export async function checkAllSites() {
  const results = await Promise.all(SITES.map(async (site) => {
    const result = await pingSite(site);
    const timestamp = new Date();

    await db.collection('uptime_checks').add({
      site: site.name,
      url: site.url,
      up: result.up,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      error: result.error,
      timestamp,
    });

    const stateRef = db.collection('site_state').doc(site.name);
    const prevSnap = await stateRef.get();
    const prevUp = prevSnap.exists ? prevSnap.data().up : undefined;

    if (prevUp !== result.up) {
      await db.collection('incidents').add({
        site: site.name,
        url: site.url,
        event: result.up ? 'up' : 'down',
        statusCode: result.statusCode,
        error: result.error,
        timestamp,
      });
      console.log(`[${timestamp.toISOString()}] ${site.name} changed state -> ${result.up ? 'UP' : 'DOWN'}`);
    }
    await stateRef.set({ up: result.up, statusCode: result.statusCode, updatedAt: timestamp });

    const today = timestamp.toISOString().slice(0, 10);
    await db.collection('daily_stats').doc(`${site.name}__${today}`).set({
      site: site.name,
      day: today,
      total: FieldValue.increment(1),
      up: FieldValue.increment(result.up ? 1 : 0),
      totalMs: FieldValue.increment(result.responseTimeMs || 0),
    }, { merge: true });

    console.log(`[${timestamp.toISOString()}] ${site.name} (${site.url}) up=${result.up} status=${result.statusCode} ${result.responseTimeMs}ms ${result.error || ''}`);

    return { site: site.name, url: site.url, ...result };
  }));

  return results;
}

export async function getLastState() {
  const snap = await db.collection('site_state').get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data().up]));
}
