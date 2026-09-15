/**
 * Org-wide intake selections for every configured intake integration.
 *
 * Integration ids are dynamic. Each integration contributes provider-neutral
 * sources through `FactoryIntegration.intake`; this domain only persists which
 * source ids the organization selected. The selection feeds shared boards, so
 * every member reads the same one.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

export interface IntakeSelection {
  enabled: boolean;
  /** Provider-owned source ids; `null` means nothing is selected. */
  sourceIds: string[] | null;
}

export type IntakeConfig = Record<string, IntakeSelection>;

export const DEFAULT_INTAKE_CONFIG: IntakeConfig = {};

export const INTAKE_ORG_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'intake_org_settings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    config: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'intake_org_settings_org_unique', columns: ['org_id'] }],
};

/** Collection evolution is additive, so the per-member unique index cannot be narrowed: rows stay and are folded at boot. */
export const LEGACY_INTAKE_USER_SETTINGS_SCHEMA: CollectionSchema = {
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

/** What the org effectively saw while selections were personal: one member selecting a source polled it onto the shared board. */
export function mergeIntakeSelections(configs: readonly IntakeConfig[]): IntakeConfig {
  const merged: IntakeConfig = Object.create(null);
  for (const config of configs) {
    for (const [integrationId, selection] of Object.entries(config)) {
      const current = merged[integrationId] ?? { enabled: false, sourceIds: null };
      const sourceIds = [...new Set([...(current.sourceIds ?? []), ...(selection.sourceIds ?? [])])];
      merged[integrationId] = {
        enabled: current.enabled || selection.enabled,
        sourceIds: sourceIds.length ? sourceIds : null,
      };
    }
  }
  return merged;
}

/**
 * Binds an intake source to the Factory project its items belong to.
 *
 * Intake selections are per user and org-wide, so they cannot say *where* an
 * ingested item should land. GitHub items are naturally scoped by their linked
 * repository; providers without that link (Linear) need this explicit binding
 * so viewing one project's board cannot materialize another project's items.
 */
export const INTAKE_SOURCE_BINDINGS_SCHEMA: CollectionSchema = {
  name: 'intake_source_bindings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    integration_id: { type: 'text' },
    source_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    /** Installed board the source feeds; `null` keeps the legacy source-type routing (issues → work, PRs → review). */
    board: { type: 'text', nullable: true },
    created_by_user_id: { type: 'text', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'intake_source_bindings_project_idx', columns: ['org_id', 'factory_project_id'] }],
  uniqueIndexes: [
    {
      name: 'intake_source_bindings_org_integration_source_unique',
      columns: ['org_id', 'integration_id', 'source_id'],
    },
  ],
};

export interface IntakeSourceBinding {
  integrationId: string;
  sourceId: string;
  factoryProjectId: string;
  /** Installed board the source feeds, or `null` for legacy source-type routing. */
  board: string | null;
}

/**
 * Routes items carrying a label to an installed board, per Factory project.
 *
 * Repository-scoped providers (GitHub) already know which project an item
 * belongs to, but one repository can feed several boards: an issue labelled
 * `release` belongs on a release board while the rest stay on Work. Labels
 * without a route fall back to the provider's built-in board.
 */
export const INTAKE_LABEL_ROUTES_SCHEMA: CollectionSchema = {
  name: 'intake_label_routes',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    integration_id: { type: 'text' },
    /** Label as the provider reports it; matched case-insensitively. */
    label: { type: 'text' },
    board: { type: 'text' },
    created_by_user_id: { type: 'text', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'intake_label_routes_project_idx', columns: ['org_id', 'factory_project_id'] }],
  uniqueIndexes: [
    {
      name: 'intake_label_routes_org_project_integration_label_unique',
      columns: ['org_id', 'factory_project_id', 'integration_id', 'label'],
    },
  ],
};

export interface IntakeLabelRoute {
  factoryProjectId: string;
  integrationId: string;
  label: string;
  board: string;
}

type IntakeLabelRouteRow = {
  factory_project_id: string;
  integration_id: string;
  label: string;
  board: string;
};
function toIntakeLabelRoute(row: IntakeLabelRouteRow): IntakeLabelRoute {
  return {
    factoryProjectId: row.factory_project_id,
    integrationId: row.integration_id,
    label: row.label,
    board: row.board,
  };
}

/** Labels are matched the way GitHub treats them: case-insensitively. */
export function normalizeIntakeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * The board a labelled item should land on under `routes`, or `undefined` when
 * none of its labels is routed. Ties resolve to the first route in `routes`
 * order, so callers should pass a deterministically ordered list.
 */
export function resolveIntakeLabelRoute(
  routes: readonly IntakeLabelRoute[],
  labels: readonly string[] | undefined,
): IntakeLabelRoute | undefined {
  if (!labels?.length) return undefined;
  const normalized = new Set(labels.map(normalizeIntakeLabel));
  return routes.find(route => normalized.has(normalizeIntakeLabel(route.label)));
}

type IntakeSourceBindingRow = {
  integration_id: string;
  source_id: string;
  factory_project_id: string;
  board?: string | null;
};
function toIntakeSourceBinding(row: IntakeSourceBindingRow): IntakeSourceBinding {
  return {
    integrationId: row.integration_id,
    sourceId: row.source_id,
    factoryProjectId: row.factory_project_id,
    board: row.board ?? null,
  };
}

export class IntakeStorage extends FactoryStorageDomain {
  constructor() {
    super('intake');
  }

  async init(): Promise<void> {
    await this.ensureCollections([
      INTAKE_ORG_SETTINGS_SCHEMA,
      LEGACY_INTAKE_USER_SETTINGS_SCHEMA,
      INTAKE_SOURCE_BINDINGS_SCHEMA,
      INTAKE_LABEL_ROUTES_SCHEMA,
    ]);
    await this.#foldLegacyUserSelections();
  }

  async #foldLegacyUserSelections(): Promise<void> {
    const legacyRows = await this.ops.findMany<{ org_id: string; config: IntakeConfig }>('intake_settings', {});
    const byOrg = new Map<string, IntakeConfig[]>();
    for (const row of legacyRows) {
      byOrg.set(row.org_id, [...(byOrg.get(row.org_id) ?? []), row.config]);
    }
    for (const [orgId, configs] of byOrg) {
      const folded = await this.ops.findOne('intake_org_settings', { org_id: orgId });
      if (folded) continue;
      await this.saveConfig({ orgId, config: mergeIntakeSelections(configs) });
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('intake_org_settings', {});
    await this.ops.deleteMany('intake_settings', {});
    await this.ops.deleteMany('intake_source_bindings', {});
    await this.ops.deleteMany('intake_label_routes', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async getConfig({
    orgId,
    integrationIds,
  }: {
    orgId: string;
    /**
     * When provided, the result contains exactly these integration ids, with
     * unset integrations defaulting to `{ enabled: true, sourceIds: null }`.
     */
    integrationIds?: string[];
  }): Promise<IntakeConfig> {
    const row = await this.#db.findOne<{ config: IntakeConfig }>('intake_org_settings', { org_id: orgId });
    const saved = structuredClone(row?.config ?? DEFAULT_INTAKE_CONFIG);
    if (!integrationIds) return saved;
    return Object.fromEntries(
      integrationIds.map(integrationId => [integrationId, saved[integrationId] ?? { enabled: true, sourceIds: null }]),
    );
  }

  async saveConfig({ orgId, config }: { orgId: string; config: IntakeConfig }): Promise<void> {
    const now = new Date();
    const where = { org_id: orgId };
    const updated = await this.#db.updateMany('intake_org_settings', where, { config, updated_at: now });
    if (updated > 0) return;
    try {
      await this.#db.insertOne('intake_org_settings', { ...where, config, created_at: now, updated_at: now });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      await this.#db.updateMany('intake_org_settings', where, { config, updated_at: now });
    }
  }

  /** Every source binding in the org, optionally narrowed to one integration. */
  async listBindings({
    orgId,
    integrationId,
  }: {
    orgId: string;
    integrationId?: string;
  }): Promise<IntakeSourceBinding[]> {
    const rows = await this.#db.findMany<IntakeSourceBindingRow>('intake_source_bindings', {
      org_id: orgId,
      ...(integrationId ? { integration_id: integrationId } : {}),
    });
    return rows.map(toIntakeSourceBinding);
  }

  /** Source ids bound to one Factory project. Empty means "nothing bound". */
  async listBoundSourceIds({
    orgId,
    integrationId,
    factoryProjectId,
  }: {
    orgId: string;
    integrationId: string;
    factoryProjectId: string;
  }): Promise<string[]> {
    const rows = await this.#db.findMany<IntakeSourceBindingRow>('intake_source_bindings', {
      org_id: orgId,
      integration_id: integrationId,
      factory_project_id: factoryProjectId,
    });
    return rows.map(row => row.source_id);
  }

  /** The binding for one source, or `null` when it is unbound. */
  async getBinding({
    orgId,
    integrationId,
    sourceId,
  }: {
    orgId: string;
    integrationId: string;
    sourceId: string;
  }): Promise<IntakeSourceBinding | null> {
    const row = await this.#db.findOne<IntakeSourceBindingRow>('intake_source_bindings', {
      org_id: orgId,
      integration_id: integrationId,
      source_id: sourceId,
    });
    return row ? toIntakeSourceBinding(row) : null;
  }

  async clearBinding({
    orgId,
    integrationId,
    sourceId,
  }: {
    orgId: string;
    integrationId: string;
    sourceId: string;
  }): Promise<IntakeSourceBinding | null> {
    const where = { org_id: orgId, integration_id: integrationId, source_id: sourceId };
    return this.storage.withTransaction(
      async ops => {
        const row = await ops.findOne<IntakeSourceBindingRow>('intake_source_bindings', where);
        if (!row) return null;
        await ops.deleteMany('intake_source_bindings', where);
        return toIntakeSourceBinding(row);
      },
      { isolationLevel: 'serializable' },
    );
  }

  async setBinding({
    orgId,
    integrationId,
    sourceId,
    factoryProjectId,
    board = null,
    userId,
  }: {
    orgId: string;
    integrationId: string;
    sourceId: string;
    factoryProjectId: string;
    board?: string | null;
    userId?: string;
  }): Promise<void> {
    const where = { org_id: orgId, integration_id: integrationId, source_id: sourceId };
    const now = new Date();
    const patch = { factory_project_id: factoryProjectId, board, updated_at: now };
    const updated = await this.#db.updateMany('intake_source_bindings', where, patch);
    if (updated > 0) return;
    try {
      await this.#db.insertOne('intake_source_bindings', {
        ...where,
        factory_project_id: factoryProjectId,
        board,
        created_by_user_id: userId ?? null,
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      await this.#db.updateMany('intake_source_bindings', where, patch);
    }
  }

  /** Label routes in the org, optionally narrowed to one project and/or integration. Sorted by label. */
  async listLabelRoutes({
    orgId,
    factoryProjectId,
    integrationId,
  }: {
    orgId: string;
    factoryProjectId?: string;
    integrationId?: string;
  }): Promise<IntakeLabelRoute[]> {
    const rows = await this.#db.findMany<IntakeLabelRouteRow>('intake_label_routes', {
      org_id: orgId,
      ...(factoryProjectId ? { factory_project_id: factoryProjectId } : {}),
      ...(integrationId ? { integration_id: integrationId } : {}),
    });
    return rows.map(toIntakeLabelRoute).sort((a, b) => a.label.localeCompare(b.label));
  }

  async setLabelRoute({
    orgId,
    factoryProjectId,
    integrationId,
    label,
    board,
    userId,
  }: {
    orgId: string;
    factoryProjectId: string;
    integrationId: string;
    label: string;
    board: string;
    userId?: string;
  }): Promise<void> {
    const where = {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      integration_id: integrationId,
      label: normalizeIntakeLabel(label),
    };
    const now = new Date();
    const patch = { board, updated_at: now };
    const updated = await this.#db.updateMany('intake_label_routes', where, patch);
    if (updated > 0) return;
    try {
      await this.#db.insertOne('intake_label_routes', {
        ...where,
        board,
        created_by_user_id: userId ?? null,
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      await this.#db.updateMany('intake_label_routes', where, patch);
    }
  }

  /** Remove a label route; returns the route that was removed, or `null` when none existed. */
  async clearLabelRoute({
    orgId,
    factoryProjectId,
    integrationId,
    label,
  }: {
    orgId: string;
    factoryProjectId: string;
    integrationId: string;
    label: string;
  }): Promise<IntakeLabelRoute | null> {
    const where = {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      integration_id: integrationId,
      label: normalizeIntakeLabel(label),
    };
    return this.storage.withTransaction(
      async ops => {
        const row = await ops.findOne<IntakeLabelRouteRow>('intake_label_routes', where);
        if (!row) return null;
        await ops.deleteMany('intake_label_routes', where);
        return toIntakeLabelRoute(row);
      },
      { isolationLevel: 'serializable' },
    );
  }
}
