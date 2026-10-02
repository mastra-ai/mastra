import { optionalBoolean, optionalPositiveInteger } from '../reconciliation-config.js';

const RECONCILIATION_LABEL = 'incident.io reconciliation';

export function incidentioReconciliationEnabled(): boolean {
  return (
    optionalBoolean(
      'MASTRACODE_INCIDENT_IO_RECONCILE_ENABLED',
      process.env.MASTRACODE_INCIDENT_IO_RECONCILE_ENABLED,
      RECONCILIATION_LABEL,
    ) ?? true
  );
}

export function incidentioReconciliationInterval(): number | undefined {
  const name = 'MASTRACODE_INCIDENT_IO_RECONCILE_INTERVAL_MS';
  const value = process.env.MASTRACODE_INCIDENT_IO_RECONCILE_INTERVAL_MS;
  const interval = optionalPositiveInteger(value);
  if (value?.trim() && interval === undefined) {
    console.warn(`[${RECONCILIATION_LABEL}] ${name} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  return interval;
}
