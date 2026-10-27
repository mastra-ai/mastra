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
  repositoryByLinearProject?: Record<string, string>;
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

/** What the org effectively saw while selections were personal: a member's sources fed the shared board only while their switch was on. */
export function mergeIntakeSelections(configs: readonly IntakeConfig[]): IntakeConfig {
  const merged: IntakeConfig = Object.create(null);
  for (const config of configs) {
    for (const [integrationId, selection] of Object.entries(config)) {
      const current = merged[integrationId] ?? { enabled: false, sourceIds: null };
      const syncing = selection.enabled ? (selection.sourceIds ?? []) : [];
      const sourceIds = [...new Set([...(current.sourceIds ?? []), ...syncing])];
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
 * Intake selections are org-wide, so they cannot say *where* an
 * ingested item should land. GitHub items are naturally scoped by their linked
 * repository; providers without that link (Linear) need this explicit binding
 * so viewing one project's board cannot materialize another project's items.
 *
 * Frozen: its unique index allows one binding per source, and indexes cannot be
 * narrowed, so bindings moved to {@link INTAKE_SOURCE_SUBSCRIPTIONS_SCHEMA}. Rows
 * are copied once at boot and never written again; the collection stays
 * registered so an earlier build that is rolled back to still finds them.
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

/**
 * Binds an intake source to a Factory project, one row per (source, Factory
 * project). Most integrations keep one binding per source and rebinding moves
 * it; integrations with `Intake.bindingLabelFilters` let several Factory
 * projects share a source, each taking the issues carrying its own labels.
 */
export const INTAKE_SOURCE_SUBSCRIPTIONS_SCHEMA: CollectionSchema = {
  name: 'intake_source_subscriptions',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    integration_id: { type: 'text' },
    source_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    /** Installed board the source feeds; `null` keeps the legacy source-type routing (issues → work, PRs → review). */
    board: { type: 'text', nullable: true },
    /** Labels whose issues this binding takes, as the user typed them; `null` takes every unclaimed issue. */
    labels: { type: 'json', nullable: true },
    created_by_user_id: { type: 'text', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'intake_source_subscriptions_project_idx', columns: ['org_id', 'factory_project_id'] }],
  uniqueIndexes: [
    {
      name: 'intake_source_subscriptions_org_integration_source_project_unique',
      columns: ['org_id', 'integration_id', 'source_id', 'factory_project_id'],
    },
  ],
};

/** One-time data migrations that have run, so none re-runs over rows users have changed since. */
export const INTAKE_DATA_MIGRATIONS_SCHEMA: CollectionSchema = {
  name: 'intake_data_migrations',
  columns: {
    name: { type: 'text', primaryKey: true },
    completed_at: { type: 'timestamp' },
  },
};

const COPY_LEGACY_BINDINGS_MIGRATION = 'copy_intake_source_bindings_to_subscriptions';

export interface IntakeSourceBinding {
  integrationId: string;
  sourceId: string;
  factoryProjectId: string;
  /** Installed board the source feeds, or `null` for legacy source-type routing. */
  board: string | null;
  /** Labels whose issues this binding takes; `null` takes every issue no other binding's labels claim. */
  labels: string[] | null;
  createdAt: Date;
}

/** Another Factory project's binding that already takes some of the requested issues. */
export interface IntakeBindingConflict {
  factoryProjectId: string;
  /** The overlapping labels, or `null` when both bindings take all unclaimed issues. */
  labels: string[] | null;
}

/** Bindings on one source in precedence order: the oldest binding wins an issue two of them match. */
function inPrecedenceOrder<T extends Pick<IntakeSourceBinding, 'createdAt' | 'factoryProjectId'>>(
  bindings: readonly T[],
): T[] {
  return [...bindings].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.factoryProjectId.localeCompare(right.factoryProjectId),
  );
}

/**
 * The slice of a shared source's issues `binding` takes, given every binding
 * on that source (`siblings` may include `binding` itself). Label bindings beat
 * the all-issues binding, and an issue carrying labels of two label bindings
 * goes to the older one.
 */
export function bindingLabelSlice(
  binding: Pick<IntakeSourceBinding, 'factoryProjectId' | 'labels' | 'createdAt'>,
  siblings: readonly Pick<IntakeSourceBinding, 'factoryProjectId' | 'labels' | 'createdAt'>[],
): { include: string[] | null; exclude: string[] } {
  const labelled = inPrecedenceOrder(
    siblings.filter(sibling => sibling.labels !== null && sibling.factoryProjectId !== binding.factoryProjectId),
  );
  if (binding.labels === null) {
    return { include: null, exclude: labelled.flatMap(sibling => sibling.labels ?? []) };
  }
  const older = labelled.filter(sibling => inPrecedenceOrder([sibling, binding])[0] === sibling);
  return { include: binding.labels, exclude: older.flatMap(sibling => sibling.labels ?? []) };
}

/** Whether an issue carrying `labels` falls in `binding`'s slice of its source. */
export function bindingTakesIssue(
  binding: Pick<IntakeSourceBinding, 'factoryProjectId' | 'labels' | 'createdAt'>,
  siblings: readonly Pick<IntakeSourceBinding, 'factoryProjectId' | 'labels' | 'createdAt'>[],
  labels: readonly string[],
): boolean {
  const carried = new Set(labels.map(normalizeIntakeLabel));
  const { include, exclude } = bindingLabelSlice(binding, siblings);
  if (exclude.some(label => carried.has(normalizeIntakeLabel(label)))) return false;
  return include === null || include.some(label => carried.has(normalizeIntakeLabel(label)));
}

/** Trim and de-duplicate case-insensitively, keeping the first spelling the user typed. */
export function normalizeBindingLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const label of labels) {
    const trimmed = label.trim();
    const key = normalizeIntakeLabel(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed);
  }
  return kept;
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
  org_id: string;
  integration_id: string;
  source_id: string;
  factory_project_id: string;
  board?: string | null;
  labels?: string[] | null;
  created_by_user_id?: string | null;
  created_at: Date;
};
function toIntakeSourceBinding(row: IntakeSourceBindingRow): IntakeSourceBinding {
  return {
    integrationId: row.integration_id,
    sourceId: row.source_id,
    factoryProjectId: row.factory_project_id,
    board: row.board ?? null,
    labels: row.labels ?? null,
    createdAt: row.created_at,
  };
}

/** Overlap between a requested binding and the other Factory projects' bindings on the same source. */
function bindingConflicts(
  factoryProjectId: string,
  labels: string[] | null,
  rows: readonly IntakeSourceBindingRow[],
): IntakeBindingConflict[] {
  const requested = new Set(labels?.map(normalizeIntakeLabel));
  return rows.flatMap((row): IntakeBindingConflict[] => {
    if (row.factory_project_id === factoryProjectId) return [];
    const theirs = row.labels ?? null;
    if (labels === null || theirs === null) {
      return labels === null && theirs === null ? [{ factoryProjectId: row.factory_project_id, labels: null }] : [];
    }
    const overlap = theirs.filter(label => requested.has(normalizeIntakeLabel(label)));
    return overlap.length > 0 ? [{ factoryProjectId: row.factory_project_id, labels: overlap }] : [];
  });
}

/** Update one (source, Factory project) binding in place, keeping its age, or insert it. */
async function upsertBinding(
  ops: FactoryStorageOps,
  key: { org_id: string; integration_id: string; source_id: string; factory_project_id: string },
  patch: { board: string | null; labels: string[] | null },
  userId: string | undefined,
): Promise<void> {
  const now = new Date();
  const updated = await ops.updateMany('intake_source_subscriptions', key, { ...patch, updated_at: now });
  if (updated > 0) return;
  await ops.insertOne('intake_source_subscriptions', {
    ...key,
    ...patch,
    created_by_user_id: userId ?? null,
    created_at: now,
    updated_at: now,
  });
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
      INTAKE_SOURCE_SUBSCRIPTIONS_SCHEMA,
      INTAKE_DATA_MIGRATIONS_SCHEMA,
      INTAKE_LABEL_ROUTES_SCHEMA,
    ]);
    await this.#foldLegacyUserSelections();
    await this.#copyLegacyBindings();
  }

  /**
   * Copy `intake_source_bindings` into `intake_source_subscriptions` as
   * all-issues bindings, once. The migration marker stops a later boot from
   * resurrecting bindings users removed after the copy. Concurrent boots both
   * copy; the unique index keeps one row per binding.
   */
  async #copyLegacyBindings(): Promise<void> {
    if (await this.ops.findOne('intake_data_migrations', { name: COPY_LEGACY_BINDINGS_MIGRATION })) return;
    const legacyRows = await this.ops.findMany<IntakeSourceBindingRow & { updated_at: Date }>(
      'intake_source_bindings',
      {},
    );
    for (const row of legacyRows) {
      try {
        await this.ops.insertOne('intake_source_subscriptions', {
          org_id: row.org_id,
          integration_id: row.integration_id,
          source_id: row.source_id,
          factory_project_id: row.factory_project_id,
          board: row.board ?? null,
          labels: null,
          created_by_user_id: row.created_by_user_id ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
      }
    }
    try {
      await this.ops.insertOne('intake_data_migrations', {
        name: COPY_LEGACY_BINDINGS_MIGRATION,
        completed_at: new Date(),
      });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
    }
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
      await this.#insertConfigIfAbsent(orgId, mergeIntakeSelections(configs));
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('intake_org_settings', {});
    await this.ops.deleteMany('intake_settings', {});
    await this.ops.deleteMany('intake_source_bindings', {});
    await this.ops.deleteMany('intake_source_subscriptions', {});
    await this.ops.deleteMany('intake_data_migrations', {});
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
    if (await this.#insertConfigIfAbsent(orgId, config)) return;
    await this.#db.updateMany('intake_org_settings', where, { config, updated_at: now });
  }

  /** Overlay `config` onto the stored selections; integrations it omits keep their stored value. */
  async mergeConfig({ orgId, config }: { orgId: string; config: IntakeConfig }): Promise<IntakeConfig> {
    const merged: IntakeConfig = Object.assign(Object.create(null), await this.getConfig({ orgId }), config);
    await this.saveConfig({ orgId, config: merged });
    return merged;
  }

  async #insertConfigIfAbsent(orgId: string, config: IntakeConfig): Promise<boolean> {
    const now = new Date();
    try {
      await this.#db.insertOne('intake_org_settings', { org_id: orgId, config, created_at: now, updated_at: now });
      return true;
    } catch (error) {
      if (error instanceof UniqueViolationError) return false;
      throw error;
    }
  }

  /** Every source binding in the org, optionally narrowed to one integration, oldest first. */
  async listBindings({
    orgId,
    integrationId,
  }: {
    orgId: string;
    integrationId?: string;
  }): Promise<IntakeSourceBinding[]> {
    const rows = await this.#db.findMany<IntakeSourceBindingRow>('intake_source_subscriptions', {
      org_id: orgId,
      ...(integrationId ? { integration_id: integrationId } : {}),
    });
    return inPrecedenceOrder(rows.map(toIntakeSourceBinding));
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
    const rows = await this.#db.findMany<IntakeSourceBindingRow>('intake_source_subscriptions', {
      org_id: orgId,
      integration_id: integrationId,
      factory_project_id: factoryProjectId,
    });
    return rows.map(row => row.source_id);
  }

  /**
   * One Factory project's binding of a source, or `null` when it has none.
   * Without `factoryProjectId`, the source's oldest binding — for integrations
   * that keep one binding per source.
   */
  async getBinding({
    orgId,
    integrationId,
    sourceId,
    factoryProjectId,
  }: {
    orgId: string;
    integrationId: string;
    sourceId: string;
    factoryProjectId?: string;
  }): Promise<IntakeSourceBinding | null> {
    const rows = await this.#db.findMany<IntakeSourceBindingRow>('intake_source_subscriptions', {
      org_id: orgId,
      integration_id: integrationId,
      source_id: sourceId,
      ...(factoryProjectId ? { factory_project_id: factoryProjectId } : {}),
    });
    return inPrecedenceOrder(rows.map(toIntakeSourceBinding))[0] ?? null;
  }

  /**
   * Remove one Factory project's binding of a source, or — without
   * `factoryProjectId` — every binding of it. Returns the (oldest) removed
   * binding, or `null` when there was none.
   */
  async clearBinding({
    orgId,
    integrationId,
    sourceId,
    factoryProjectId,
  }: {
    orgId: string;
    integrationId: string;
    sourceId: string;
    factoryProjectId?: string;
  }): Promise<IntakeSourceBinding | null> {
    const where = {
      org_id: orgId,
      integration_id: integrationId,
      source_id: sourceId,
      ...(factoryProjectId ? { factory_project_id: factoryProjectId } : {}),
    };
    return this.storage.withTransaction(
      async ops => {
        const rows = await ops.findMany<IntakeSourceBindingRow>('intake_source_subscriptions', where);
        if (rows.length === 0) return null;
        await ops.deleteMany('intake_source_subscriptions', where);
        return inPrecedenceOrder(rows.map(toIntakeSourceBinding))[0]!;
      },
      { isolationLevel: 'serializable' },
    );
  }

  /**
   * Bind a source to one Factory project, moving it away from any other: the
   * source keeps a single binding, which takes all of its issues.
   */
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
    const source = { org_id: orgId, integration_id: integrationId, source_id: sourceId };
    await this.storage.withTransaction(
      async ops => {
        const rows = await ops.findMany<IntakeSourceBindingRow>('intake_source_subscriptions', source);
        for (const row of rows) {
          if (row.factory_project_id === factoryProjectId) continue;
          await ops.deleteMany('intake_source_subscriptions', {
            ...source,
            factory_project_id: row.factory_project_id,
          });
        }
        await upsertBinding(ops, { ...source, factory_project_id: factoryProjectId }, { board, labels: null }, userId);
      },
      { isolationLevel: 'serializable' },
    );
  }

  /**
   * Bind a source to one Factory project alongside other Factory projects'
   * bindings of it, taking the issues carrying one of `labels` — or, with
   * `labels: null`, every issue no label binding claims. Rejected with the
   * overlapping bindings when another Factory project already takes some of
   * those labels, or already takes all unclaimed issues.
   */
  async setSharedBinding({
    orgId,
    integrationId,
    sourceId,
    factoryProjectId,
    board = null,
    labels,
    userId,
  }: {
    orgId: string;
    integrationId: string;
    sourceId: string;
    factoryProjectId: string;
    board?: string | null;
    labels: string[] | null;
    userId?: string;
  }): Promise<{ conflicts: IntakeBindingConflict[] }> {
    const source = { org_id: orgId, integration_id: integrationId, source_id: sourceId };
    const kept = labels === null ? null : normalizeBindingLabels(labels);
    return this.storage.withTransaction(
      async ops => {
        const rows = await ops.findMany<IntakeSourceBindingRow>('intake_source_subscriptions', source);
        const conflicts = bindingConflicts(factoryProjectId, kept, rows);
        if (conflicts.length > 0) return { conflicts };
        await upsertBinding(ops, { ...source, factory_project_id: factoryProjectId }, { board, labels: kept }, userId);
        return { conflicts: [] };
      },
      { isolationLevel: 'serializable' },
    );
  }

  /** Atomically replace legacy provider source ids in both selection and routing state. */
  async migrateSourceIds({
    orgId,
    integrationId,
    migrations,
  }: {
    orgId: string;
    integrationId: string;
    migrations: Array<{ from: string; to: string }>;
  }): Promise<{ migrations: Array<{ from: string; to: string }>; conflicts: Array<{ from: string; to: string }> }> {
    if (migrations.length === 0) return { migrations: [], conflicts: [] };
    return this.storage.withTransaction(
      async ops => {
        const bindings = await ops.findMany<IntakeSourceBindingRow>('intake_source_subscriptions', {
          org_id: orgId,
          integration_id: integrationId,
        });
        const bindingsBySource = new Map<string, IntakeSourceBindingRow[]>();
        for (const binding of bindings) {
          bindingsBySource.set(binding.source_id, [...(bindingsBySource.get(binding.source_id) ?? []), binding]);
        }
        // Where a source's issues land: every Factory project, board and label slice bound to it.
        const destination = (rows: IntakeSourceBindingRow[]) =>
          rows
            .map(row => `${row.factory_project_id}\0${row.board ?? ''}\0${JSON.stringify(row.labels ?? null)}`)
            .sort()
            .join('\n');
        const grouped = new Map<string, Array<{ from: string; to: string }>>();
        for (const migration of migrations) {
          grouped.set(migration.to, [...(grouped.get(migration.to) ?? []), migration]);
        }
        const conflicts: Array<{ from: string; to: string }> = [];
        for (const [to, group] of grouped) {
          const candidates = [bindingsBySource.get(to), ...group.map(({ from }) => bindingsBySource.get(from))].filter(
            (rows): rows is IntakeSourceBindingRow[] => rows !== undefined,
          );
          if (new Set(candidates.map(destination)).size > 1) conflicts.push(...group);
        }
        if (conflicts.length > 0) return { migrations: [], conflicts };

        const now = new Date();
        for (const [to, group] of grouped) {
          const legacy = group.filter(({ from }) => bindingsBySource.has(from));
          const scope = { org_id: orgId, integration_id: integrationId };
          if (!bindingsBySource.has(to) && legacy.length > 0) {
            const [first, ...duplicates] = legacy;
            await ops.updateMany(
              'intake_source_subscriptions',
              { ...scope, source_id: first!.from },
              { source_id: to, updated_at: now },
            );
            for (const duplicate of duplicates) {
              await ops.deleteMany('intake_source_subscriptions', { ...scope, source_id: duplicate.from });
            }
          } else {
            for (const entry of legacy) {
              await ops.deleteMany('intake_source_subscriptions', { ...scope, source_id: entry.from });
            }
          }
        }

        const configRow = await ops.findOne<{ config: IntakeConfig }>('intake_org_settings', { org_id: orgId });
        if (configRow) {
          const replacements = new Map(migrations.map(({ from, to }) => [from, to] as const));
          const selected = configRow.config[integrationId]?.sourceIds ?? [];
          const nextSelected = [...new Set(selected.map(sourceId => replacements.get(sourceId) ?? sourceId))];
          if (
            nextSelected.length !== selected.length ||
            nextSelected.some((sourceId, index) => sourceId !== selected[index])
          ) {
            const config = structuredClone(configRow.config);
            config[integrationId] = {
              ...(config[integrationId] ?? { enabled: true }),
              sourceIds: nextSelected.length > 0 ? nextSelected : null,
            };
            await ops.updateMany('intake_org_settings', { org_id: orgId }, { config, updated_at: now });
          }
        }
        return { migrations, conflicts: [] };
      },
      { isolationLevel: 'serializable' },
    );
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
