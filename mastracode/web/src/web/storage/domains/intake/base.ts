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

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

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
  const ids = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0 && entry.length <= 128,
  );
  return ids.length === value.length ? ids : undefined;
}

/** Validate untrusted JSON into an `IntakeConfig`, rejecting the prerelease GitHub key. */
export function parseIntakeConfig(body: unknown): IntakeConfig | null {
  if (typeof body !== 'object' || body === null) return null;
  const { github, linear } = body as { github?: unknown; linear?: unknown };
  if (typeof github !== 'object' || github === null) return null;
  if (typeof linear !== 'object' || linear === null) return null;

  const githubSection = github as { enabled?: unknown; repositoryIds?: unknown; projectIds?: unknown };
  const linearSection = linear as { enabled?: unknown; projectIds?: unknown };
  if (typeof githubSection.enabled !== 'boolean' || typeof linearSection.enabled !== 'boolean') return null;
  if (Object.prototype.hasOwnProperty.call(githubSection, 'projectIds')) return null;

  const repositoryIds = sanitizeIdList(githubSection.repositoryIds ?? null);
  const projectIds = sanitizeIdList(linearSection.projectIds ?? null);
  if (repositoryIds === undefined || projectIds === undefined) return null;

  return {
    github: { enabled: githubSection.enabled, repositoryIds },
    linear: { enabled: linearSection.enabled, projectIds },
  };
}

export const INTAKE_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'intake_settings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    config: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'intake_settings_org_user_unique', columns: ['org_id', 'user_id'] }],
};

/**
 * Intake settings storage, written once against the generic
 * `FactoryStorageOps` surface — works on any `FactoryStorage` backend.
 */
export class IntakeStorage extends FactoryStorageDomain {
  constructor() {
    super('intake');
  }

  async init(): Promise<void> {
    await this.ensureCollections([INTAKE_SETTINGS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('intake_settings', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** Read the caller's intake config, falling back to {@link DEFAULT_INTAKE_CONFIG}. */
  async getConfig(orgId: string, userId: string): Promise<IntakeConfig> {
    const row = await this.#db.findOne<{ config: unknown }>('intake_settings', {
      org_id: orgId,
      user_id: userId,
    });
    return structuredClone(parseIntakeConfig(row?.config) ?? DEFAULT_INTAKE_CONFIG);
  }

  /** Upsert the caller's intake config (`created_at` is preserved on update). */
  async saveConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void> {
    const where = { org_id: orgId, user_id: userId };
    const updateExisting = () =>
      this.#db.updateAtomic('intake_settings', where, () => ({ config, updated_at: new Date() }));
    if (await updateExisting()) return;

    const now = new Date();
    try {
      await this.#db.insertOne('intake_settings', { ...where, config, created_at: now, updated_at: now });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      // Lost the insert race — update the winning row under the backend's serialized write primitive.
      if (!(await updateExisting())) throw error;
    }
  }
}
