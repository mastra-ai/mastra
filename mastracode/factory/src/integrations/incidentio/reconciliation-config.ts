import { optionalPositiveInteger } from '../reconciliation-config.js';

function parseBoolean(name: string, value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  console.warn(`[incident.io reconciliation] ${name} must be true or false; received ${JSON.stringify(value)}.`);
  return undefined;
}

export function incidentioReconciliationEnabled(): boolean {
  return parseBoolean(
    'MASTRACODE_INCIDENT_IO_RECONCILE_ENABLED',
    process.env.MASTRACODE_INCIDENT_IO_RECONCILE_ENABLED,
  ) ?? true;
}

export function incidentioReconciliationInterval(): number | undefined {
  const name = 'MASTRACODE_INCIDENT_IO_RECONCILE_INTERVAL_MS';
  const value = process.env.MASTRACODE_INCIDENT_IO_RECONCILE_INTERVAL_MS;
  const interval = optionalPositiveInteger(value);
  if (value?.trim() && interval === undefined) {
    console.warn(`[incident.io reconciliation] ${name} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  return interval;
}
