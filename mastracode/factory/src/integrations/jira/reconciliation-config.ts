import { optionalBoolean, optionalPositiveInteger } from '../reconciliation-config.js';

const RECONCILIATION_LABEL = 'Jira reconciliation';

export function jiraReconciliationEnabled(): boolean {
  return (
    optionalBoolean(
      'MASTRACODE_JIRA_RECONCILE_ENABLED',
      process.env.MASTRACODE_JIRA_RECONCILE_ENABLED,
      RECONCILIATION_LABEL,
    ) ?? true
  );
}

export function jiraReconciliationInterval(): number | undefined {
  const name = 'MASTRACODE_JIRA_RECONCILE_INTERVAL_MS';
  const value = process.env.MASTRACODE_JIRA_RECONCILE_INTERVAL_MS;
  const interval = optionalPositiveInteger(value);
  if (value?.trim() && interval === undefined) {
    console.warn(`[${RECONCILIATION_LABEL}] ${name} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  return interval;
}
