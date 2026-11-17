import { optionalPositiveInteger } from '../reconciliation-config.js';

const RECONCILIATION_LABEL = 'Linear reconciliation';

function optionalPositiveInterval(name: string, value: string | undefined): number | undefined {
  const interval = optionalPositiveInteger(value);
  if (value?.trim() && interval === undefined) {
    console.warn(`[${RECONCILIATION_LABEL}] ${name} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  return interval;
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
