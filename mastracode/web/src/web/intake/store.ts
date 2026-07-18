/**
 * Intake source configuration: which sources feed the Factory Intake page.
 *
 * Validation of untrusted route bodies lives here; persistence is delegated
 * to the `intake` domain registered on the seeded `FactoryStorage` (see
 * `../storage/domains/intake`).
 */

import { getFactoryStorage } from '../runtime-config';
import { getIntakeStorage } from '../storage/domains';
import { DEFAULT_INTAKE_CONFIG } from '../storage/domains/intake/base';
import type { IntakeConfig } from '../storage/domains/intake/base';

export { DEFAULT_INTAKE_CONFIG };
export type { IntakeConfig };

/** Bounded list of non-empty ids, or `null` for "nothing selected". */
function sanitizeIdList(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const ids = value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128);
  return ids.length === value.length ? ids : undefined;
}

/**
 * Validate an untrusted PUT body into an `IntakeConfig`, or `null` when the
 * shape is invalid. Unknown keys are dropped; both sections are required.
 */
export function parseIntakeConfig(body: unknown): IntakeConfig | null {
  if (typeof body !== 'object' || body === null) return null;
  const { github, linear } = body as { github?: unknown; linear?: unknown };
  if (typeof github !== 'object' || github === null) return null;
  if (typeof linear !== 'object' || linear === null) return null;

  const githubSection = github as { enabled?: unknown; projectIds?: unknown };
  const linearSection = linear as { enabled?: unknown; projectIds?: unknown };
  if (typeof githubSection.enabled !== 'boolean' || typeof linearSection.enabled !== 'boolean') return null;

  const githubProjectIds = sanitizeIdList(githubSection.projectIds ?? null);
  const linearProjectIds = sanitizeIdList(linearSection.projectIds ?? null);
  if (githubProjectIds === undefined || linearProjectIds === undefined) return null;

  return {
    github: { enabled: githubSection.enabled, projectIds: githubProjectIds },
    linear: { enabled: linearSection.enabled, projectIds: linearProjectIds },
  };
}

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
