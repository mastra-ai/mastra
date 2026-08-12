function reconciliationEnabled(childValue: string | undefined, legacyValue: string | undefined): boolean {
  return parseBoolean(childValue) ?? parseBoolean(legacyValue) ?? true;
}

function optionalPositiveInterval(value: string | undefined): number | undefined {
  const parsed = Number(value?.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

export function linearIssueReconciliationEnabled(): boolean {
  return reconciliationEnabled(
    process.env.MASTRACODE_LINEAR_ISSUE_RECONCILE_ENABLED,
    process.env.MASTRACODE_LINEAR_RECONCILE_ENABLED,
  );
}

export function linearIssueReconciliationInterval(): number | undefined {
  return (
    optionalPositiveInterval(process.env.MASTRACODE_LINEAR_ISSUE_RECONCILE_INTERVAL_MS) ??
    optionalPositiveInterval(process.env.MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS)
  );
}
