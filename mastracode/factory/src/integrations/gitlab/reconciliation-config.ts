import { optionalPositiveInteger } from '../reconciliation-config.js';

function configuredValue(primary: string | undefined, legacy: string | undefined): string | undefined {
  return primary?.trim() ? primary : legacy;
}

export function gitlabReconciliationInterval(): number | undefined {
  return optionalPositiveInteger(
    configuredValue(
      process.env.MASTRACODE_GITLAB_RECONCILE_INTERVAL_MS,
      process.env.MASTRACODE_GITLAB_ISSUE_RECONCILE_INTERVAL_MS,
    ),
  );
}
