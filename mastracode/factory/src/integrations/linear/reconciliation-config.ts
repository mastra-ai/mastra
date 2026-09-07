import { optionalPositiveInteger } from '../reconciliation-config.js';

function reconciliationEnabled(
  childName: string,
  childValue: string | undefined,
  legacyName: string,
  legacyValue: string | undefined,
): boolean {
  return parseBoolean(childName, childValue) ?? parseBoolean(legacyName, legacyValue) ?? true;
}

function optionalPositiveInterval(name: string, value: string | undefined): number | undefined {
  const interval = optionalPositiveInteger(value);
  if (value?.trim() && interval === undefined) {
    console.warn(`[Linear reconciliation] ${name} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  return interval;
}

function parseBoolean(name: string, value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  console.warn(`[Linear reconciliation] ${name} must be true or false; received ${JSON.stringify(value)}.`);
  return undefined;
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
    optionalPositiveInterval('MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS', process.env.MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS)
  );
}
