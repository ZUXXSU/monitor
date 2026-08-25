import { db } from './firebase.js';
import { SITES, CHECK_TIMEOUT_MS } from './config.js';

// last known state per site, kept in memory to detect up/down transitions
const lastState = new Map();

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

    const prevUp = lastState.get(site.name);
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
    lastState.set(site.name, result.up);

    console.log(`[${timestamp.toISOString()}] ${site.name} (${site.url}) up=${result.up} status=${result.statusCode} ${result.responseTimeMs}ms ${result.error || ''}`);

    return { site: site.name, url: site.url, ...result };
  }));

  return results;
}

export function getLastState() {
  return Object.fromEntries(lastState);
}
