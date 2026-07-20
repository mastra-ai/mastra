/**
 * Intake source configuration: which sources feed the Factory Intake page.
 *
 * Validation of untrusted route bodies and stored JSON lives on the intake
 * storage domain (`parseIntakeConfig` in `../storage/domains/intake/base`);
 * this module re-exports it and delegates persistence to the seeded
 * {@link FactoryStore}.
 */

import { getFactoryStore } from '../runtime-config';
import { DEFAULT_INTAKE_CONFIG, parseIntakeConfig } from '../storage/domains/intake/base';
import type { IntakeConfig } from '../storage/domains/intake/base';

export { DEFAULT_INTAKE_CONFIG, parseIntakeConfig };
export type { IntakeConfig };

/** Read the caller's intake config, falling back to the defaults. */
export async function getIntakeConfig(orgId: string, userId: string): Promise<IntakeConfig> {
  const store = getFactoryStore();
  await store.ensureReady('intake');
  return store.intake.getConfig(orgId, userId);
}

/** Upsert the caller's intake config. */
export async function saveIntakeConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void> {
  const store = getFactoryStore();
  await store.ensureReady('intake');
  await store.intake.saveConfig(orgId, userId, config);
}
