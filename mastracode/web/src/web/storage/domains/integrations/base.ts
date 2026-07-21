/**
 * Generic integration storage — the default persistence surface for
 * `FactoryIntegration`s.
 *
 * Most integrations persist the same three shapes: an org-owned OAuth
 * **connection**, **subscriptions** binding external objects to
 * sessions/threads, and per-`(org, user)` **settings**. This built-in domain
 * stores all three in shared collections keyed by `integration_id`, so an
 * integration author writes zero schema, zero DDL, and zero queries — and
 * org scoping is enforced by construction through the pre-scoped handle
 * returned by {@link IntegrationStorage.forIntegration}.
 *
 * Source-control integrations additionally use the shared, provider-scoped
 * source-control domain for installations, projects, worktrees, and sandboxes.
 *
 * Payloads (`data` / `config`) are JSON documents typed per-integration via
 * the handle's generics. JSON round-trips exactly what JSON can represent:
 * store timestamps inside payloads as epoch millis or ISO strings, not
 * `Date`s.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

export const INTEGRATION_CONNECTIONS_SCHEMA: CollectionSchema = {
  name: 'integration_connections',
  columns: {
    id: { type: 'uuid-pk' },
    integration_id: { type: 'text' },
    org_id: { type: 'text' },
    /** Who connected it (audit only — never scopes reads). */
    user_id: { type: 'text', nullable: true },
    data: { type: 'json' },
    metadata: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'integration_connections_integration_org_unique', columns: ['integration_id', 'org_id'] }],
};

export const INTEGRATION_SUBSCRIPTIONS_SCHEMA: CollectionSchema = {
  name: 'integration_subscriptions',
  columns: {
    id: { type: 'uuid-pk' },
    integration_id: { type: 'text' },
    org_id: { type: 'text' },
    /** Canonical external-object key the integration derives (e.g. `pr:{installation}:{repo}:{number}`). */
    target_key: { type: 'text' },
    session_id: { type: 'text', nullable: true },
    resource_id: { type: 'text', nullable: true },
    thread_id: { type: 'text', nullable: true },
    session_scope: { type: 'text', nullable: true },
    status: { type: 'text' },
    data: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [
    { name: 'integration_subscriptions_target_idx', columns: ['integration_id', 'target_key'] },
    { name: 'integration_subscriptions_org_idx', columns: ['integration_id', 'org_id'] },
  ],
};

export const INTEGRATION_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'integration_settings',
  columns: {
    id: { type: 'uuid-pk' },
    integration_id: { type: 'text' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    config: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    { name: 'integration_settings_integration_org_user_unique', columns: ['integration_id', 'org_id', 'user_id'] },
  ],
};

/** An integration's org-owned connection (typically the OAuth grant). */
export interface IntegrationConnection<TData> {
  id: string;
  orgId: string;
  /** Who connected it (audit only). */
  userId: string | null;
  data: TData;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** A subscription binding an external object to a session/thread. */
export interface IntegrationSubscription<TData> {
  id: string;
  orgId: string;
  targetKey: string;
  sessionId: string | null;
  resourceId: string | null;
  threadId: string | null;
  sessionScope: string | null;
  status: string;
  data: TData;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateIntegrationSubscriptionInput<TData> = {
  orgId: string;
  targetKey: string;
  sessionId?: string | null;
  resourceId?: string | null;
  threadId?: string | null;
  sessionScope?: string | null;
  /** Defaults to `'active'`. */
  status?: string;
} & ({} extends TData ? { data?: TData } : { data: TData });

/**
 * Typed query surface pre-scoped to one `integration_id`. Every read and
 * write is automatically filtered/stamped with the integration id, so an
 * integration cannot reach another integration's rows.
 */
export interface IntegrationStorageHandle<
  TConnection = Record<string, unknown>,
  TSettings = Record<string, unknown>,
  TSubscription = Record<string, unknown>,
> {
  readonly integrationId: string;
  connections: {
    /** The org's connection, or `null` when not connected. */
    get(orgId: string): Promise<IntegrationConnection<TConnection> | null>;
    /** Insert or replace the org's connection (one per org; `created_at` preserved on update). */
    upsert(
      orgId: string,
      input: { userId?: string | null; data: TConnection; metadata?: Record<string, unknown> },
    ): Promise<void>;
    /**
     * Atomic read-modify-write of the connection's `data` payload (token
     * rotation etc.). Returns the updated connection, or `null` when the org
     * has no connection.
     */
    update(orgId: string, fn: (data: TConnection) => TConnection): Promise<IntegrationConnection<TConnection> | null>;
    /** Remove the org's connection. Returns whether a row was deleted. */
    delete(orgId: string): Promise<boolean>;
  };
  subscriptions: {
    create(input: CreateIntegrationSubscriptionInput<TSubscription>): Promise<IntegrationSubscription<TSubscription>>;
    /** All subscriptions for an external object (webhook fan-out), optionally filtered by status. */
    listByTarget(targetKey: string, opts?: { status?: string }): Promise<IntegrationSubscription<TSubscription>[]>;
    listBySession(sessionId: string): Promise<IntegrationSubscription<TSubscription>[]>;
    listByThread(resourceId: string, threadId: string): Promise<IntegrationSubscription<TSubscription>[]>;
    updateStatus(id: string, status: string): Promise<void>;
    delete(id: string): Promise<boolean>;
    /** Targeted cleanup, always org-scoped. Returns the number of rows deleted. */
    deleteWhere(where: { orgId: string; targetKey?: string; sessionId?: string }): Promise<number>;
  };
  settings: {
    /** The `(org, user)` config, or `null` when never saved. */
    get(orgId: string, userId: string): Promise<TSettings | null>;
    /** Upsert the `(org, user)` config (`created_at` preserved on update). */
    save(orgId: string, userId: string, config: TSettings): Promise<void>;
  };
}

interface ConnectionRow extends Record<string, unknown> {
  id: string;
  integration_id: string;
  org_id: string;
  user_id: string | null;
  data: unknown;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface SubscriptionRow extends Record<string, unknown> {
  id: string;
  integration_id: string;
  org_id: string;
  target_key: string;
  session_id: string | null;
  resource_id: string | null;
  thread_id: string | null;
  session_scope: string | null;
  status: string;
  data: unknown;
  created_at: Date;
  updated_at: Date;
}

/**
 * The built-in generic integration domain, written once against the
 * `FactoryStorageOps` surface — works on any `FactoryStorage` backend.
 */
export class IntegrationStorage extends FactoryStorageDomain {
  constructor() {
    super('integrations');
  }

  async init(): Promise<void> {
    await this.ensureCollections([
      INTEGRATION_CONNECTIONS_SCHEMA,
      INTEGRATION_SUBSCRIPTIONS_SCHEMA,
      INTEGRATION_SETTINGS_SCHEMA,
    ]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('integration_subscriptions', {});
    await this.ops.deleteMany('integration_settings', {});
    await this.ops.deleteMany('integration_connections', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** A typed handle pre-scoped to `integrationId`. */
  forIntegration<
    TConnection = Record<string, unknown>,
    TSettings = Record<string, unknown>,
    TSubscription = Record<string, unknown>,
  >(integrationId: string): IntegrationStorageHandle<TConnection, TSettings, TSubscription> {
    if (!integrationId) throw new Error('[IntegrationStorage] integrationId is required.');
    const db = () => this.#db;
    const scoped = { integration_id: integrationId };

    const mapConnection = (row: ConnectionRow): IntegrationConnection<TConnection> => ({
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      data: row.data as TConnection,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });

    const mapSubscription = (row: SubscriptionRow): IntegrationSubscription<TSubscription> => ({
      id: row.id,
      orgId: row.org_id,
      targetKey: row.target_key,
      sessionId: row.session_id,
      resourceId: row.resource_id,
      threadId: row.thread_id,
      sessionScope: row.session_scope,
      status: row.status,
      data: row.data as TSubscription,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });

    return {
      integrationId,
      connections: {
        get: async orgId => {
          const row = await db().findOne<ConnectionRow>('integration_connections', { ...scoped, org_id: orgId });
          return row ? mapConnection(row) : null;
        },
        upsert: async (orgId, input) => {
          const where = { ...scoped, org_id: orgId };
          const update = async () =>
            db().updateMany('integration_connections', where, {
              user_id: input.userId ?? null,
              data: input.data,
              metadata: input.metadata ?? {},
              updated_at: new Date(),
            });

          let lastError: unknown;
          for (let attempt = 0; attempt < 2; attempt++) {
            if ((await update()) > 0) return;

            const now = new Date();
            try {
              await db().insertOne<ConnectionRow>('integration_connections', {
                ...where,
                user_id: input.userId ?? null,
                data: input.data,
                metadata: input.metadata ?? {},
                created_at: now,
                updated_at: now,
              });
              return;
            } catch (error) {
              if (!(error instanceof UniqueViolationError)) throw error;
              lastError = error;
            }
          }
          throw lastError;
        },
        update: async (orgId, fn) => {
          const row = await db().updateAtomic<ConnectionRow>(
            'integration_connections',
            { ...scoped, org_id: orgId },
            current => ({ data: fn(current.data as TConnection), updated_at: new Date() }),
          );
          return row ? mapConnection(row) : null;
        },
        delete: async orgId => {
          const deleted = await db().deleteMany('integration_connections', { ...scoped, org_id: orgId });
          return deleted > 0;
        },
      },
      subscriptions: {
        create: async input => {
          const now = new Date();
          const row = await db().insertOne<SubscriptionRow>('integration_subscriptions', {
            ...scoped,
            org_id: input.orgId,
            target_key: input.targetKey,
            session_id: input.sessionId ?? null,
            resource_id: input.resourceId ?? null,
            thread_id: input.threadId ?? null,
            session_scope: input.sessionScope ?? null,
            status: input.status ?? 'active',
            data: input.data ?? {},
            created_at: now,
            updated_at: now,
          });
          return mapSubscription(row);
        },
        listByTarget: async (targetKey, opts) => {
          const rows = await db().findMany<SubscriptionRow>(
            'integration_subscriptions',
            { ...scoped, target_key: targetKey, ...(opts?.status !== undefined ? { status: opts.status } : {}) },
            { orderBy: [['created_at', 'asc']] },
          );
          return rows.map(mapSubscription);
        },
        listBySession: async sessionId => {
          const rows = await db().findMany<SubscriptionRow>(
            'integration_subscriptions',
            { ...scoped, session_id: sessionId },
            { orderBy: [['created_at', 'asc']] },
          );
          return rows.map(mapSubscription);
        },
        listByThread: async (resourceId, threadId) => {
          const rows = await db().findMany<SubscriptionRow>(
            'integration_subscriptions',
            { ...scoped, resource_id: resourceId, thread_id: threadId },
            { orderBy: [['created_at', 'asc']] },
          );
          return rows.map(mapSubscription);
        },
        updateStatus: async (id, status) => {
          await db().updateMany('integration_subscriptions', { ...scoped, id }, { status, updated_at: new Date() });
        },
        delete: async id => {
          const deleted = await db().deleteMany('integration_subscriptions', { ...scoped, id });
          return deleted > 0;
        },
        deleteWhere: async where => {
          return db().deleteMany('integration_subscriptions', {
            ...scoped,
            org_id: where.orgId,
            ...(where.targetKey !== undefined ? { target_key: where.targetKey } : {}),
            ...(where.sessionId !== undefined ? { session_id: where.sessionId } : {}),
          });
        },
      },
      settings: {
        get: async (orgId, userId) => {
          const row = await db().findOne<{ config: TSettings }>('integration_settings', {
            ...scoped,
            org_id: orgId,
            user_id: userId,
          });
          return row ? structuredClone(row.config) : null;
        },
        save: async (orgId, userId, config) => {
          const where = { ...scoped, org_id: orgId, user_id: userId };
          const update = async () =>
            db().updateMany('integration_settings', where, {
              config,
              updated_at: new Date(),
            });

          let lastError: unknown;
          for (let attempt = 0; attempt < 2; attempt++) {
            if ((await update()) > 0) return;

            const now = new Date();
            try {
              await db().insertOne('integration_settings', {
                ...where,
                config,
                created_at: now,
                updated_at: now,
              });
              return;
            } catch (error) {
              if (!(error instanceof UniqueViolationError)) throw error;
              lastError = error;
            }
          }
          throw lastError;
        },
      },
    };
  }
}
