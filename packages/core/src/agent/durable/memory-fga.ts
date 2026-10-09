import type { MastraFGAPermissionInput } from '../../auth/ee';
import type { CheckThreadFGAOptions } from '../../memory/thread-fga';
import { checkThreadFGA } from '../../memory/thread-fga';
import type { RunRegistryEntry } from './types';

export function getDurableMemoryAuthorizationChecks(
  entry?: RunRegistryEntry,
): Map<MastraFGAPermissionInput, Promise<void>> {
  if (!entry) return new Map();
  return (entry.memoryAuthorizationChecks ??= new Map());
}

export function authorizeDurableMemory(
  checks: Map<MastraFGAPermissionInput, Promise<void>>,
  options: CheckThreadFGAOptions & { permission: MastraFGAPermissionInput },
): Promise<void> {
  const existingCheck = checks.get(options.permission);
  if (existingCheck) return existingCheck;

  const check = checkThreadFGA(options).catch(error => {
    checks.delete(options.permission);
    throw error;
  });
  checks.set(options.permission, check);
  return check;
}
