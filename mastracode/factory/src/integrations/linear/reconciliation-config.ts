import { optionalBoolean, optionalPositiveInteger } from '../reconciliation-config.js';

const RECONCILIATION_LABEL = 'Linear reconciliation';

function reconciliationEnabled(
  childName: string,
  childValue: string | undefined,
  legacyName: string,
  legacyValue: string | undefined,
): boolean {
  return (
    optionalBoolean(childName, childValue, RECONCILIATION_LABEL) ??
    optionalBoolean(legacyName, legacyValue, RECONCILIATION_LABEL) ??
    true
  );
}

function optionalPositiveInterval(name: string, value: string | undefined): number | undefined {
  const interval = optionalPositiveInteger(value);
  if (value?.trim() && interval === undefined) {
    console.warn(`[${RECONCILIATION_LABEL}] ${name} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  return interval;
}

export function linearIssueReconciliationEnabled(): boolean {
  return reconciliationEnabled(
    'MASTRACODE_LINEAR_ISSUE_RECONCILE_ENABLED',
    process.env.MASTRACODE_LINEAR_ISSUE_RECONCILE_ENABLED,
    'MASTRACODE_LINEAR_RECONCILE_ENABLED',
    process.env.MASTRACODE_LINEAR_RECONCILE_ENABLED,
  );
}

export function linearIssueReconciliationInterval(): number | undefined {
  return (
    optionalPositiveInterval(
      'MASTRACODE_LINEAR_ISSUE_RECONCILE_INTERVAL_MS',
      process.env.MASTRACODE_LINEAR_ISSUE_RECONCILE_INTERVAL_MS,
    ) ??
    optionalPositiveInterval(
      'MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS',
      process.env.MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS,
    )
  );
}
