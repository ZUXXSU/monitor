# uptime-monitor

Pings `app.buzzit.in/health`, `beta.buzzit.in`, `stage.buzzit.in` every N minutes. Logs every check to Firestore, records up/down transitions as incidents, purges raw logs weekly.

## Setup

1. `npm install`
2. Get a Firebase **service account key** (not the web config you had):
   Firebase Console → Project Settings → Service Accounts → Generate new private key → save as `serviceAccountKey.json` in this folder.
3. `cp .env.example .env` — adjust interval/port if needed.
4. `npm start`

## Firestore layout

- `uptime_checks` — every ping result (site, up, statusCode, responseTimeMs, error, timestamp). Purged weekly, kept 7 days.
- `incidents` — only written when a site's status flips up→down or down→up. Kept forever — this is your real downtime history.

## Sites monitored

Edit `src/config.js` → `SITES` to add/remove/change URLs.

## Monitoring the monitor

This server is meant to run on a **different host** than the sites it watches, per your ask. To know when *this* server dies:

- It exposes `GET /health` — point a free external checker (UptimeRobot, cron-job.org, Better Uptime, etc.) at `https://<your-deploy-url>/health`. If that stops responding, the monitor itself is down.
- `GET /status` — last known up/down state per site, for a quick manual check.

## Deploy

Any Node host works (Railway, Render, Fly.io, a VPS). Set env vars from `.env.example`, upload/mount `serviceAccountKey.json` (or paste its contents into an env var and adjust `src/firebase.js` to `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)` if the platform doesn't support file uploads), then `npm start`.
