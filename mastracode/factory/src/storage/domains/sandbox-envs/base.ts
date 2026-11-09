import { randomUUID } from 'node:crypto';

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';
import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';

/** Where a sandbox environment variable applies. */
export type SandboxEnvAppliesTo = 'build' | 'runtime' | 'both';

/** A variable's metadata. Values never leave the store through this shape. */
export interface SandboxEnvMetadata {
  name: string;
  appliesTo: SandboxEnvAppliesTo;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SandboxEnvRevisions {
  /** Changes on every add, edit or delete. */
  revision: string;
  /** Changes only when a Build-applicable variable is added, edited, deleted or moved into or out of build. */
  buildRevision: string;
}

export interface ResolvedSandboxEnvs extends SandboxEnvRevisions {
  runtime: Record<string, string>;
  build: Record<string, string>;
}

export interface SetSandboxEnvInput {
  name: string;
  value: string;
  appliesTo: SandboxEnvAppliesTo;
}

/**
 * The surface routes and sandbox wiring depend on, so another backend (for
 * example a vault) can replace {@link SandboxEnvsStorage} without touching them.
 */
export interface SandboxEnvStore {
  list(orgId: string, projectId: string): Promise<SandboxEnvMetadata[]>;
  set(orgId: string, projectId: string, input: SetSandboxEnvInput, actorId: string): Promise<SandboxEnvMetadata>;
  updateAppliesTo(
    orgId: string,
    projectId: string,
    name: string,
    appliesTo: SandboxEnvAppliesTo,
    actorId: string,
  ): Promise<SandboxEnvMetadata | null>;
  delete(orgId: string, projectId: string, name: string): Promise<boolean>;
  revisions(orgId: string, projectId: string): Promise<SandboxEnvRevisions | null>;
  resolve(orgId: string, projectId: string): Promise<ResolvedSandboxEnvs>;
}

const ENVS = 'factory_sandbox_envs';
const REVISIONS = 'factory_sandbox_env_revisions';

export const SANDBOX_ENVS_SCHEMA: CollectionSchema = {
  name: ENVS,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    project_id: { type: 'text' },
    name: { type: 'text' },
    value: { type: 'text' },
    applies_to: { type: 'text' },
    created_by: { type: 'text' },
    updated_by: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_sandbox_envs_org_project_name_key', columns: ['org_id', 'project_id', 'name'] }],
};

export const SANDBOX_ENV_REVISIONS_SCHEMA: CollectionSchema = {
  name: REVISIONS,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    project_id: { type: 'text' },
    revision: { type: 'text' },
    build_revision: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_sandbox_env_revisions_org_project_key', columns: ['org_id', 'project_id'] }],
};

interface SandboxEnvDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  value: string;
  applies_to: SandboxEnvAppliesTo;
  created_by: string;
  updated_by: string;
  created_at: Date;
  updated_at: Date;
}

interface SandboxEnvRevisionDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  project_id: string;
  revision: string;
  build_revision: string;
  updated_at: Date;
}

function appliesToBuild(appliesTo: SandboxEnvAppliesTo | undefined): boolean {
  return appliesTo === 'build' || appliesTo === 'both';
}

function appliesToRuntime(appliesTo: SandboxEnvAppliesTo): boolean {
  return appliesTo === 'runtime' || appliesTo === 'both';
}

function toMetadata(row: SandboxEnvDbRow): SandboxEnvMetadata {
  return {
    name: row.name,
    appliesTo: row.applies_to,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Factory-wide sandbox environment variables, values encrypted with
 * {@link FactorySecretEncryption}. Every write lands the variable row first
 * and the revision row second (there is no transaction primitive), so a
 * reader that sees a new revision always sees the rows behind it. Revisions
 * are random ids, never derived from values.
 */
export class SandboxEnvsStorage extends FactoryStorageDomain implements SandboxEnvStore {
  constructor(private readonly encryption: FactorySecretEncryption = createPlaintextFactorySecretEncryption()) {
    super('sandbox-envs');
  }

  async init(): Promise<void> {
    await this.ensureCollections([SANDBOX_ENVS_SCHEMA, SANDBOX_ENV_REVISIONS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(ENVS, {});
    await this.ops.deleteMany(REVISIONS, {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async list(orgId: string, projectId: string): Promise<SandboxEnvMetadata[]> {
    const rows = await this.#db.findMany<SandboxEnvDbRow>(
      ENVS,
      { org_id: orgId, project_id: projectId },
      { orderBy: [['name', 'asc']] },
    );
    return rows.map(toMetadata);
  }

  /** Create or replace a variable. Bumps the build revision whenever the old or new row applies to build. */
  async set(orgId: string, projectId: string, input: SetSandboxEnvInput, actorId: string): Promise<SandboxEnvMetadata> {
    const now = new Date();
    const value = await this.encryption.encrypt(input.value);
    const where = { org_id: orgId, project_id: projectId, name: input.name };
    let previous: SandboxEnvAppliesTo | undefined;
    const update = () =>
      this.#db.updateAtomic<SandboxEnvDbRow>(ENVS, where, row => {
        previous = row.applies_to;
        return { value, applies_to: input.appliesTo, updated_by: actorId, updated_at: now };
      });

    let row = await update();
    if (!row) {
      try {
        row = await this.#db.insertOne<SandboxEnvDbRow>(ENVS, {
          ...where,
          value,
          applies_to: input.appliesTo,
          created_by: actorId,
          updated_by: actorId,
          created_at: now,
          updated_at: now,
        });
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
        // Lost the insert race: apply this write to the winning row.
        row = await update();
        if (!row) throw error;
      }
    }
    await this.#bump(orgId, projectId, appliesToBuild(previous) || appliesToBuild(input.appliesTo), now);
    return toMetadata(row);
  }

  async updateAppliesTo(
    orgId: string,
    projectId: string,
    name: string,
    appliesTo: SandboxEnvAppliesTo,
    actorId: string,
  ): Promise<SandboxEnvMetadata | null> {
    const now = new Date();
    let previous: SandboxEnvAppliesTo | undefined;
    const row = await this.#db.updateAtomic<SandboxEnvDbRow>(
      ENVS,
      { org_id: orgId, project_id: projectId, name },
      current => {
        previous = current.applies_to;
        return { applies_to: appliesTo, updated_by: actorId, updated_at: now };
      },
    );
    if (!row) return null;
    if (previous !== appliesTo) {
      await this.#bump(orgId, projectId, appliesToBuild(previous) !== appliesToBuild(appliesTo), now);
    }
    return toMetadata(row);
  }

  async delete(orgId: string, projectId: string, name: string): Promise<boolean> {
    const where = { org_id: orgId, project_id: projectId, name };
    const existing = await this.#db.findOne<SandboxEnvDbRow>(ENVS, where);
    if (!existing) return false;
    const deleted = (await this.#db.deleteMany(ENVS, where)) > 0;
    if (deleted) await this.#bump(orgId, projectId, appliesToBuild(existing.applies_to), new Date());
    return deleted;
  }

  async revisions(orgId: string, projectId: string): Promise<SandboxEnvRevisions | null> {
    const row = await this.#db.findOne<SandboxEnvRevisionDbRow>(REVISIONS, { org_id: orgId, project_id: projectId });
    return row ? { revision: row.revision, buildRevision: row.build_revision } : null;
  }

  /**
   * Decrypted values split by where they apply, plus the revisions read
   * before them: if a write lands in between, the caller holds an older
   * revision than the values it got and simply reloads on its next check.
   */
  async resolve(orgId: string, projectId: string): Promise<ResolvedSandboxEnvs> {
    const revisions = (await this.revisions(orgId, projectId)) ?? { revision: '', buildRevision: '' };
    const rows = await this.#db.findMany<SandboxEnvDbRow>(ENVS, { org_id: orgId, project_id: projectId });
    const runtime: Record<string, string> = {};
    const build: Record<string, string> = {};
    for (const row of rows) {
      const { value } = await this.encryption.decrypt<string>(row.value);
      if (appliesToRuntime(row.applies_to)) runtime[row.name] = value;
      if (appliesToBuild(row.applies_to)) build[row.name] = value;
    }
    return { ...revisions, runtime, build };
  }

  async #bump(orgId: string, projectId: string, build: boolean, now: Date): Promise<void> {
    const where = { org_id: orgId, project_id: projectId };
    const revision = randomUUID();
    const bump = () =>
      this.#db.updateAtomic<SandboxEnvRevisionDbRow>(REVISIONS, where, () => ({
        revision,
        ...(build ? { build_revision: randomUUID() } : {}),
        updated_at: now,
      }));
    if (await bump()) return;
    try {
      await this.#db.insertOne<SandboxEnvRevisionDbRow>(REVISIONS, {
        ...where,
        revision,
        // Empty until a Build-applicable variable exists, so a runtime-only
        // first write doesn't look like a build change.
        build_revision: build ? randomUUID() : '',
        updated_at: now,
      });
    } catch (error) {
      if (!(error instanceof UniqueViolationError) || !(await bump())) throw error;
    }
  }
}
