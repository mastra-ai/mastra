/**
 * Intake source configuration: which sources feed the Factory Intake page.
 *
 * Validation of untrusted route bodies lives here; persistence is delegated
 * to the `intake` domain registered on the seeded `FactoryStorage` (see
 * `../storage/domains/intake`).
 */

import { getFactoryStorage } from '../runtime-config';
import { getIntakeStorage } from '../storage/domains';
import { DEFAULT_INTAKE_CONFIG, parseIntakeConfig } from '../storage/domains/intake/base';
import type { IntakeConfig } from '../storage/domains/intake/base';

export { DEFAULT_INTAKE_CONFIG, parseIntakeConfig };
export type { IntakeConfig };

/** Read the caller's intake config, falling back to the defaults. */
export async function getIntakeConfig(orgId: string, userId: string): Promise<IntakeConfig> {
  const storage = getFactoryStorage();
  await storage.ensureDomainReady('intake');
  return getIntakeStorage().getConfig(orgId, userId);
}

/** Upsert the caller's intake config. */
export async function saveIntakeConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void> {
  const storage = getFactoryStorage();
  await storage.ensureDomainReady('intake');
  await getIntakeStorage().saveConfig(orgId, userId, config);
}
