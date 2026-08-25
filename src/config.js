import 'dotenv/config';

export const SITES = [
  { name: 'buzzit-prod', url: 'https://app.buzzit.in/health' },
  { name: 'buzzit-beta', url: 'https://beta.buzzit.in' },
  { name: 'buzzit-stage', url: 'https://stage.buzzit.in' },
];

export const CHECK_INTERVAL_MINUTES = Number(process.env.CHECK_INTERVAL_MINUTES || 5);
export const CHECK_TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS || 10000);
export const PORT = Number(process.env.PORT || 3000);
export const RAW_LOG_RETENTION_DAYS = 7;
