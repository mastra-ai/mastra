import { optionalBoolean, optionalPositiveInteger } from '../reconciliation-config.js';

function configuredValue(primary: string | undefined, legacy: string | undefined): string | undefined {
  return primary?.trim() ? primary : legacy;
}

export function gitlabReconciliationEnabled(): boolean {
  const primary = process.env.MASTRACODE_GITLAB_RECONCILE_ENABLED;
  const value = configuredValue(primary, process.env.MASTRACODE_GITLAB_ISSUE_RECONCILE_ENABLED);
  const name = primary?.trim()
    ? 'MASTRACODE_GITLAB_RECONCILE_ENABLED'
    : 'MASTRACODE_GITLAB_ISSUE_RECONCILE_ENABLED';
  return optionalBoolean(name, value, 'gitlab') ?? true;
}

export function gitlabReconciliationInterval(): number | undefined {
  return optionalPositiveInteger(
    configuredValue(
      process.env.MASTRACODE_GITLAB_RECONCILE_INTERVAL_MS,
      process.env.MASTRACODE_GITLAB_ISSUE_RECONCILE_INTERVAL_MS,
    ),
  );
}
