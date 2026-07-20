/**
 * Intake source configuration domain: which sources feed the Factory Intake
 * page.
 *
 * Stored per `(org, user)` — each user picks their own intake sources within
 * the org's connected integrations:
 *  - GitHub: which connected repositories contribute issues.
 *  - Linear: which Linear projects contribute issues.
 *
 * Id lists of `null` mean "nothing selected" — the source syncs nothing until
 * the user explicitly picks entries. An `enabled` flag of `false` hides the
 * source entirely regardless of selection.
 *
 * GitHub uses `repositoryIds` (connected repository UUIDs). Linear keeps
 * `projectIds` because Linear Project is the external provider concept. A
 * prerelease row still carrying `github.projectIds` is treated as missing
 * config and returns the defaults — no migration or key translation.
 */

import type { FactoryStorageContext, FactoryStorageDomain } from '../../domain';

export interface IntakeConfig {
  github: {
    enabled: boolean;
    /** Connected GitHub repository ids (app DB uuids) to sync; `null` = nothing selected. */
    repositoryIds: string[] | null;
  };
  linear: {
    enabled: boolean;
    /** Linear project ids to sync; `null` = nothing selected. */
    projectIds: string[] | null;
  };
}

/** Default: both sources on, but nothing synced until repositories/projects are picked. */
export const DEFAULT_INTAKE_CONFIG: IntakeConfig = {
  github: { enabled: true, repositoryIds: null },
  linear: { enabled: true, projectIds: null },
};

/** Bounded list of non-empty ids, or `null` for "nothing selected". */
function sanitizeIdList(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const ids = value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128);
  return ids.length === value.length ? ids : undefined;
}

/**
 * Validate untrusted JSON (route bodies or stored rows) into an `IntakeConfig`,
 * or `null` when the shape is invalid. Unknown keys are dropped; both sections
 * are required. The prerelease GitHub key `projectIds` is rejected outright so
 * callers never translate it into `repositoryIds`.
 */
export function parseIntakeConfig(body: unknown): IntakeConfig | null {
  if (typeof body !== 'object' || body === null) return null;
  const { github, linear } = body as { github?: unknown; linear?: unknown };
  if (typeof github !== 'object' || github === null) return null;
  if (typeof linear !== 'object' || linear === null) return null;

  const githubSection = github as { enabled?: unknown; repositoryIds?: unknown; projectIds?: unknown };
  const linearSection = linear as { enabled?: unknown; projectIds?: unknown };
  if (typeof githubSection.enabled !== 'boolean' || typeof linearSection.enabled !== 'boolean') return null;

  // Prerelease shape — do not accept or translate `github.projectIds`.
  if (Object.prototype.hasOwnProperty.call(githubSection, 'projectIds')) return null;

  const githubRepositoryIds = sanitizeIdList(githubSection.repositoryIds ?? null);
  const linearProjectIds = sanitizeIdList(linearSection.projectIds ?? null);
  if (githubRepositoryIds === undefined || linearProjectIds === undefined) return null;

  return {
    github: { enabled: githubSection.enabled, repositoryIds: githubRepositoryIds },
    linear: { enabled: linearSection.enabled, projectIds: linearProjectIds },
  };
}

/**
 * Abstract intake settings storage. Backends own their DDL in `init()`;
 * query methods are the typed surface the intake routes consume.
 */
export abstract class IntakeStorage implements FactoryStorageDomain {
  readonly name = 'intake';

  abstract init(ctx: FactoryStorageContext): Promise<void>;

  /**
   * Read the caller's intake config. Missing, malformed, or prerelease
   * (old-key) rows fall back to {@link DEFAULT_INTAKE_CONFIG}.
   */
  abstract getConfig(orgId: string, userId: string): Promise<IntakeConfig>;

  /** Upsert the caller's intake config. */
  abstract saveConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void>;
}
