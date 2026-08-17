import { optionalPositiveInteger } from '../reconciliation-config.js';

export function reconciliationEnabled(child: string | undefined, legacy: string | undefined): boolean {
  return parseOptionalBoolean(child) ?? parseOptionalBoolean(legacy) ?? true;
}

export function reconcileInterval(value: string | undefined): number | undefined {
  return optionalPositiveInteger(value);
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  switch (value?.trim().toLowerCase()) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return undefined;
  }
}
