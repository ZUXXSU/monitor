import express from 'express';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkAllSites, getLastState } from './monitor.js';
import { cleanupOldLogs } from './cleanup.js';
import { db } from './firebase.js';
import { PORT, CHECK_INTERVAL_MINUTES, SITES } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const startedAt = new Date();

app.use(express.static(path.join(__dirname, '..', 'public')));

// Self health-check — point an external uptime service (UptimeRobot, cron-job.org, etc.)
// at this route so you know when THIS monitor server goes down.
app.get('/health', (req, res) => {
  res.json({ ok: true, uptimeSec: process.uptime(), startedAt });
});

app.get('/status', async (req, res) => {
  res.json({ sites: SITES.map((s) => s.name), lastState: await getLastState() });
});

// Trigger a check cycle on demand. On Vercel, node-cron can't run (each request is a
// fresh, short-lived instance) — point an external scheduler (cron-job.org, etc.) at
// this route every CHECK_INTERVAL_MINUTES instead. Optionally gate it with CRON_SECRET.
app.get('/api/cron', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const results = await checkAllSites();
  res.json({ ok: true, results });
});

// recent raw checks, newest first
app.get('/api/checks', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  let q = db.collection('uptime_checks').orderBy('timestamp', 'desc').limit(limit);
  if (req.query.site) q = q.where('site', '==', req.query.site);
  const snap = await q.get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() })));
});

// up/down transitions, newest first
app.get('/api/incidents', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  let q = db.collection('incidents').orderBy('timestamp', 'desc').limit(limit);
  if (req.query.site) q = q.where('site', '==', req.query.site);
  const snap = await q.get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() })));
});

// Vercel (or any serverless host) tears the process down between requests, so an
// in-process cron schedule never fires — only run node-cron when this is a real
// long-lived process (VPS, your own machine, `npm start`).
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`monitor server listening on :${PORT}`);
  });

  checkAllSites().catch((err) => console.error('[monitor] initial check failed', err));

  cron.schedule(`*/${CHECK_INTERVAL_MINUTES} * * * *`, () => {
    checkAllSites().catch((err) => console.error('[monitor] check failed', err));
  });

  // weekly purge of raw check logs, Sunday 00:00
  cron.schedule('0 0 * * 0', () => {
    cleanupOldLogs().catch((err) => console.error('[cleanup] failed', err));
  });
}

export default app;
