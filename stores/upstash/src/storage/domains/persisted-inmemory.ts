import { NotificationsStorage } from '@mastra/core/notifications';
import type {
  CreateNotificationInput,
  ListDueNotificationsInput,
  ListNotificationsInput,
  NotificationRecord,
  NotificationStatus,
  UpdateNotificationInput,
} from '@mastra/core/notifications';
import {
  BlobStore,
  ChannelsStorage,
  InMemoryDB,
  InMemoryAgentsStorage,
  DatasetsInMemory,
  ExperimentsInMemory,
  InMemoryFavoritesStorage,
  InMemoryMCPClientsStorage,
  InMemoryMCPServersStorage,
  ObservabilityInMemory,
  InMemoryPromptBlocksStorage,
  InMemorySchedulesStorage,
  InMemoryScorerDefinitionsStorage,
  InMemorySkillsStorage,
  InMemoryWorkspacesStorage,
} from '@mastra/core/storage';
import type {
  StorageDeleteToolProviderConnectionInput,
  StorageListToolProviderConnectionsInput,
  StorageToolProviderConnection,
  StorageToolProviderConnectionKey,
  StorageUpsertToolProviderConnectionInput,
  StorageBlobEntry,
  ChannelConfig,
  ChannelInstallation,
} from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import { resolveUpstashConfig } from '../db';
import type { UpstashDomainConfig } from '../db';

type PersistedConfig = UpstashDomainConfig & {
  namespace?: string;
  db?: InMemoryDB;
};

const MAP_FIELDS = [
  'threads',
  'messages',
  'resources',
  'workflows',
  'scores',
  'traces',
  'traceCursorIds',
  'branchCursorIds',
  'agents',
  'agentVersions',
  'promptBlocks',
  'promptBlockVersions',
  'scorerDefinitions',
  'scorerDefinitionVersions',
  'mcpClients',
  'mcpClientVersions',
  'mcpServers',
  'mcpServerVersions',
  'workspaces',
  'workspaceVersions',
  'skills',
  'skillVersions',
  'favorites',
  'observationalMemory',
  'datasets',
  'datasetItems',
  'datasetVersions',
  'experiments',
  'experimentResults',
  'backgroundTasks',
  'schedules',
] as const;

const ARRAY_FIELDS = [
  'metricRecords',
  'logRecords',
  'scoreRecords',
  'feedbackRecords',
  'scheduleTriggers',
] as const;

type Snapshot = {
  maps?: Partial<Record<(typeof MAP_FIELDS)[number], [string, unknown][]>>;
  arrays?: Partial<Record<(typeof ARRAY_FIELDS)[number], unknown[]>>;
  observabilityNextCursorId?: number;
};

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
}

function reviveDates<T>(value: T): T {
  if (typeof value === 'string' && isIsoDateString(value)) {
    return new Date(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => reviveDates(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = reviveDates(item);
    }
    return out as T;
  }
  return value;
}

async function scanKeys(client: Redis, pattern: string): Promise<string[]> {
  let cursor = '0';
  const keys: string[] = [];
  do {
    const [nextCursor, batch] = await client.scan(cursor, { match: pattern, count: 1000 });
    keys.push(...batch);
    cursor = nextCursor;
  } while (cursor !== '0');
  return keys;
}

async function deleteByPattern(client: Redis, pattern: string): Promise<void> {
  const keys = await scanKeys(client, pattern);
  if (keys.length > 0) await client.del(...keys);
}

function reviveChannelInstallation(installation: ChannelInstallation): ChannelInstallation {
  return {
    ...installation,
    createdAt: new Date(installation.createdAt),
    updatedAt: new Date(installation.updatedAt),
  };
}

function reviveNotification(record: NotificationRecord): NotificationRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    deliveredAt: record.deliveredAt ? new Date(record.deliveredAt) : undefined,
    seenAt: record.seenAt ? new Date(record.seenAt) : undefined,
    dismissedAt: record.dismissedAt ? new Date(record.dismissedAt) : undefined,
    archivedAt: record.archivedAt ? new Date(record.archivedAt) : undefined,
    discardedAt: record.discardedAt ? new Date(record.discardedAt) : undefined,
    deliverAt: record.deliverAt ? new Date(record.deliverAt) : undefined,
    summaryAt: record.summaryAt ? new Date(record.summaryAt) : undefined,
    lastDeliveryAttemptAt: record.lastDeliveryAttemptAt ? new Date(record.lastDeliveryAttemptAt) : undefined,
  };
}

function matchesValue<T extends string>(value: T, filter?: T | T[]): boolean {
  if (!filter) return true;
  return Array.isArray(filter) ? filter.includes(value) : value === filter;
}

function notificationDueTime(record: NotificationRecord): number {
  const deliverAt = record.deliverAt?.getTime();
  const summaryAt = record.summaryAt?.getTime();
  if (deliverAt !== undefined && summaryAt !== undefined) return Math.min(deliverAt, summaryAt);
  return deliverAt ?? summaryAt ?? Number.POSITIVE_INFINITY;
}

function notificationStatusTimestamp(status: NotificationStatus, now: Date) {
  if (status === 'delivered') return { deliveredAt: now };
  if (status === 'seen') return { seenAt: now };
  if (status === 'dismissed') return { dismissedAt: now };
  if (status === 'archived') return { archivedAt: now };
  if (status === 'discarded') return { discardedAt: now };
  return {};
}

class UpstashInMemoryPersister {
  readonly client: Redis;
  readonly db: InMemoryDB;
  readonly key: string;

  constructor(config: PersistedConfig, defaultNamespace: string) {
    this.client = resolveUpstashConfig(config);
    this.db = config.db ?? new InMemoryDB();
    this.key = `mastra:upstash:domain-snapshot:${config.namespace ?? defaultNamespace}`;
  }

  async load(): Promise<void> {
    const snapshot = await this.client.get<Snapshot>(this.key);
    if (!snapshot) return;

    this.db.clear();

    for (const field of MAP_FIELDS) {
      const map = (this.db as any)[field] as Map<string, unknown>;
      for (const [key, value] of snapshot.maps?.[field] ?? []) {
        map.set(key, reviveDates(value));
      }
    }

    for (const field of ARRAY_FIELDS) {
      const target = this.db[field] as unknown[];
      target.length = 0;
      target.push(...(snapshot.arrays?.[field] ?? []).map(item => reviveDates(item)));
    }

    this.db.observabilityNextCursorId = snapshot.observabilityNextCursorId ?? 1;
  }

  async save(): Promise<void> {
    const maps: Snapshot['maps'] = {};
    const arrays: Snapshot['arrays'] = {};

    for (const field of MAP_FIELDS) {
      maps[field] = Array.from(((this.db as any)[field] as Map<string, unknown>).entries());
    }
    for (const field of ARRAY_FIELDS) {
      arrays[field] = [...(this.db[field] as unknown[])];
    }

    await this.client.set(this.key, {
      maps,
      arrays,
      observabilityNextCursorId: this.db.observabilityNextCursorId,
    } satisfies Snapshot);
  }

  async clear(): Promise<void> {
    this.db.clear();
    await this.client.del(this.key);
  }
}

function persisted<T extends object>(domain: T, persister: UpstashInMemoryPersister): T {
  return new Proxy(domain, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || prop === '__registerMastra') {
        return value;
      }

      return async (...args: unknown[]) => {
        await persister.load();
        const result = await value.apply(target, args);
        if (prop === 'dangerouslyClearAll') {
          await persister.clear();
        } else if (prop !== 'init') {
          await persister.save();
        }
        return result;
      };
    },
  });
}

export class AgentsUpstash extends InMemoryAgentsStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'agents');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class BlobsUpstash extends BlobStore {
  private client: Redis;
  private namespace: string;

  constructor(config: PersistedConfig) {
    super();
    this.client = resolveUpstashConfig(config);
    this.namespace = config.namespace ?? 'blobs';
  }

  async init(): Promise<void> {}

  async put(entry: StorageBlobEntry): Promise<void> {
    await this.client.set(this.key(entry.hash), entry);
  }

  async get(hash: string): Promise<StorageBlobEntry | null> {
    return (await this.client.get<StorageBlobEntry>(this.key(hash))) ?? null;
  }

  async has(hash: string): Promise<boolean> {
    return (await this.get(hash)) !== null;
  }

  async delete(hash: string): Promise<boolean> {
    const existed = await this.has(hash);
    if (existed) await this.client.del(this.key(hash));
    return existed;
  }

  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const pipeline = this.client.pipeline();
    entries.forEach(entry => pipeline.set(this.key(entry.hash), entry));
    await pipeline.exec();
  }

  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    if (hashes.length === 0) return result;
    const pipeline = this.client.pipeline();
    hashes.forEach(hash => pipeline.get(this.key(hash)));
    const entries = (await pipeline.exec()) as (StorageBlobEntry | null)[];
    hashes.forEach((hash, index) => {
      const entry = entries[index];
      if (entry) result.set(hash, entry);
    });
    return result;
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.deleteByPattern(this.key('*'));
  }

  private key(hash: string): string {
    return `mastra:upstash:blobs:${this.namespace}:${hash}`;
  }

  private async deleteByPattern(pattern: string): Promise<void> {
    const keys = await scanKeys(this.client, pattern);
    if (keys.length > 0) await this.client.del(...keys);
  }
}

export class ChannelsUpstash extends ChannelsStorage {
  private client: Redis;
  private namespace: string;

  constructor(config: PersistedConfig) {
    super();
    this.client = resolveUpstashConfig(config);
    this.namespace = config.namespace ?? 'channels';
  }

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    await this.client.set(this.installationKey(installation.id), installation);
  }

  async getInstallation(id: string): Promise<ChannelInstallation | null> {
    const installation = await this.client.get<ChannelInstallation>(this.installationKey(id));
    return installation ? reviveChannelInstallation(installation) : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const installations = await this.listInstallations(platform);
    const statusPriority = { active: 0, pending: 1, error: 2 } as const;
    return (
      installations
        .filter(installation => installation.agentId === agentId)
        .sort((a, b) => (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3))[0] ?? null
    );
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    const installations = await this.allInstallations();
    return installations.find(installation => installation.webhookId === webhookId) ?? null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    return (await this.allInstallations()).filter(installation => installation.platform === platform);
  }

  async deleteInstallation(id: string): Promise<void> {
    await this.client.del(this.installationKey(id));
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    await this.client.set(this.configKey(config.platform), config);
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    const config = await this.client.get<ChannelConfig>(this.configKey(platform));
    return config ? { ...config, updatedAt: new Date(config.updatedAt) } : null;
  }

  async deleteConfig(platform: string): Promise<void> {
    await this.client.del(this.configKey(platform));
  }

  async dangerouslyClearAll(): Promise<void> {
    await deleteByPattern(this.client, `mastra:upstash:channels:${this.namespace}:*`);
  }

  private async allInstallations(): Promise<ChannelInstallation[]> {
    const keys = await scanKeys(this.client, this.installationKey('*'));
    if (keys.length === 0) return [];
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    return ((await pipeline.exec()) as (ChannelInstallation | null)[])
      .filter((installation): installation is ChannelInstallation => !!installation)
      .map(reviveChannelInstallation);
  }

  private installationKey(id: string): string {
    return `mastra:upstash:channels:${this.namespace}:installations:${id}`;
  }

  private configKey(platform: string): string {
    return `mastra:upstash:channels:${this.namespace}:configs:${platform}`;
  }
}

export class DatasetsUpstash extends DatasetsInMemory {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'datasets');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class ExperimentsUpstash extends ExperimentsInMemory {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'experiments');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class FavoritesUpstash extends InMemoryFavoritesStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'favorites');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class MCPClientsUpstash extends InMemoryMCPClientsStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'mcp-clients');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class MCPServersUpstash extends InMemoryMCPServersStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'mcp-servers');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class NotificationsUpstash extends NotificationsStorage {
  private client: Redis;
  private namespace: string;

  constructor(config: PersistedConfig) {
    super();
    this.client = resolveUpstashConfig(config);
    this.namespace = config.namespace ?? 'notifications';
  }

  async createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
    const existing = await this.findCoalescable(input);
    if (existing) {
      const now = new Date();
      const next: NotificationRecord = {
        ...existing,
        summary: input.summary,
        payload: input.payload ?? existing.payload,
        priority: input.priority ?? existing.priority,
        attributes: input.attributes ? { ...existing.attributes, ...input.attributes } : existing.attributes,
        updatedAt: now,
        deliverAt: input.deliverAt ?? existing.deliverAt,
        summaryAt: input.summaryAt ?? existing.summaryAt,
        deliveryReason: input.deliveryReason ?? existing.deliveryReason,
        coalescedCount: (existing.coalescedCount ?? 1) + 1,
        metadata: input.metadata ? { ...existing.metadata, ...input.metadata } : existing.metadata,
      };
      await this.client.set(this.notificationKey(next.threadId, next.id), next);
      return next;
    }

    const now = input.createdAt ?? new Date();
    const record: NotificationRecord = {
      id: input.id ?? crypto.randomUUID(),
      threadId: input.threadId,
      source: input.source,
      kind: input.kind,
      priority: input.priority ?? 'medium',
      status: 'pending',
      summary: input.summary,
      payload: input.payload,
      resourceId: input.resourceId,
      agentId: input.agentId,
      sourceId: input.sourceId,
      dedupeKey: input.dedupeKey,
      coalesceKey: input.coalesceKey,
      coalescedCount: 1,
      attributes: input.attributes,
      createdAt: now,
      updatedAt: now,
      deliverAt: input.deliverAt,
      summaryAt: input.summaryAt,
      deliveryReason: input.deliveryReason,
      deliveryAttempts: 0,
      metadata: input.metadata,
    };
    await this.client.set(this.notificationKey(record.threadId, record.id), record);
    return record;
  }

  async listNotifications(input: ListNotificationsInput): Promise<NotificationRecord[]> {
    const search = input.search?.toLowerCase();
    const records = await this.allNotifications();
    return records
      .filter(record => record.threadId === input.threadId)
      .filter(record => matchesValue(record.status, input.status))
      .filter(record => matchesValue(record.priority, input.priority))
      .filter(record => !input.source || record.source === input.source)
      .filter(record => !input.resourceId || record.resourceId === input.resourceId)
      .filter(record => !input.agentId || record.agentId === input.agentId)
      .filter(
        record =>
          !search ||
          record.summary.toLowerCase().includes(search) ||
          record.kind.toLowerCase().includes(search) ||
          record.source.toLowerCase().includes(search),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, input.limit ?? records.length);
  }

  async listDueNotifications(input: ListDueNotificationsInput): Promise<NotificationRecord[]> {
    const now = input.now.getTime();
    const records = await this.allNotifications();
    return records
      .filter(record => record.status === 'pending')
      .filter(record => !input.agentId || record.agentId === input.agentId)
      .filter(record => !input.resourceId || record.resourceId === input.resourceId)
      .filter(record => notificationDueTime(record) <= now)
      .sort((a, b) => notificationDueTime(a) - notificationDueTime(b) || a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, input.limit ?? records.length);
  }

  async getNotification(input: { threadId: string; id: string }): Promise<NotificationRecord | null> {
    const record = await this.client.get<NotificationRecord>(this.notificationKey(input.threadId, input.id));
    return record ? reviveNotification(record) : null;
  }

  async updateNotification(input: UpdateNotificationInput): Promise<NotificationRecord> {
    const existing = await this.getNotification(input);
    if (!existing) throw new Error(`Notification ${input.id} was not found for thread ${input.threadId}`);
    const now = new Date();
    const next: NotificationRecord = {
      ...existing,
      ...(input.status ? { status: input.status, ...notificationStatusTimestamp(input.status, now) } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.deliverAt !== undefined ? { deliverAt: input.deliverAt ?? undefined } : {}),
      ...(input.summaryAt !== undefined ? { summaryAt: input.summaryAt ?? undefined } : {}),
      ...(input.deliveryReason !== undefined ? { deliveryReason: input.deliveryReason } : {}),
      ...(input.deliveryAttempts !== undefined ? { deliveryAttempts: input.deliveryAttempts } : {}),
      ...(input.lastDeliveryAttemptAt !== undefined ? { lastDeliveryAttemptAt: input.lastDeliveryAttemptAt } : {}),
      ...(input.lastDeliveryError !== undefined ? { lastDeliveryError: input.lastDeliveryError } : {}),
      ...(input.deliveredSignalId !== undefined ? { deliveredSignalId: input.deliveredSignalId } : {}),
      ...(input.summarySignalId !== undefined ? { summarySignalId: input.summarySignalId } : {}),
      updatedAt: now,
    };
    await this.client.set(this.notificationKey(next.threadId, next.id), next);
    return next;
  }

  async dangerouslyClearAll(): Promise<void> {
    await deleteByPattern(this.client, `mastra:upstash:notifications:${this.namespace}:*`);
  }

  private async allNotifications(): Promise<NotificationRecord[]> {
    const keys = await scanKeys(this.client, this.notificationKey('*', '*'));
    if (keys.length === 0) return [];
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    return ((await pipeline.exec()) as (NotificationRecord | null)[])
      .filter((record): record is NotificationRecord => !!record)
      .map(reviveNotification);
  }

  private async findCoalescable(input: CreateNotificationInput): Promise<NotificationRecord | undefined> {
    if (!input.dedupeKey && !input.coalesceKey) return undefined;
    const records = await this.allNotifications();
    return records.find(record => {
      if (
        record.threadId !== input.threadId ||
        record.source !== input.source ||
        record.kind !== input.kind ||
        record.status !== 'pending'
      ) {
        return false;
      }
      if (record.agentId !== input.agentId || record.resourceId !== input.resourceId) return false;
      return Boolean(
        (input.dedupeKey && record.dedupeKey === input.dedupeKey) ||
          (input.coalesceKey && record.coalesceKey === input.coalesceKey),
      );
    });
  }

  private notificationKey(threadId: string, id: string): string {
    return `mastra:upstash:notifications:${this.namespace}:${threadId}:${id}`;
  }
}

export class ObservabilityUpstash extends ObservabilityInMemory {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'observability');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class PromptBlocksUpstash extends InMemoryPromptBlocksStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'prompt-blocks');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class SchedulesUpstash extends InMemorySchedulesStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'schedules');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class ScorerDefinitionsUpstash extends InMemoryScorerDefinitionsStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'scorer-definitions');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class SkillsUpstash extends InMemorySkillsStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'skills');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}

export class ToolProviderConnectionsUpstash {
  private client: Redis;
  private namespace: string;

  constructor(config: PersistedConfig) {
    this.client = resolveUpstashConfig(config);
    this.namespace = config.namespace ?? 'tool-provider-connections';
  }

  async init(): Promise<void> {}

  async dangerouslyClearAll(): Promise<void> {
    const keys = await this.scanKeys(this.key('*', '*', '*'));
    if (keys.length > 0) await this.client.del(...keys);
  }

  async getConnectionById({
    authorId,
    providerId,
    connectionId,
  }: StorageToolProviderConnectionKey): Promise<StorageToolProviderConnection | null> {
    return (await this.client.get<StorageToolProviderConnection>(this.key(authorId, providerId, connectionId))) ?? null;
  }

  async upsertConnection(input: StorageUpsertToolProviderConnectionInput): Promise<StorageToolProviderConnection> {
    const existing = await this.getConnectionById(input);
    const now = new Date();
    const row: StorageToolProviderConnection = {
      authorId: input.authorId,
      providerId: input.providerId,
      toolkit: input.toolkit,
      connectionId: input.connectionId,
      label: input.label,
      scope: input.scope ?? existing?.scope ?? 'per-author',
      createdAt: existing?.createdAt ? new Date(existing.createdAt) : now,
      updatedAt: now,
    };
    await this.client.set(this.key(input.authorId, input.providerId, input.connectionId), row);
    return row;
  }

  async listConnectionsByAuthor({
    authorId,
    providerId,
    toolkit,
    scope,
  }: StorageListToolProviderConnectionsInput): Promise<StorageToolProviderConnection[]> {
    const keys = await this.scanKeys(this.key(authorId ?? '*', providerId ?? '*', '*'));
    if (keys.length === 0) return [];

    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const rows = (await pipeline.exec()) as (StorageToolProviderConnection | null)[];

    return rows
      .filter((row): row is StorageToolProviderConnection => !!row)
      .map(row => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }))
      .filter(row => (toolkit ? row.toolkit === toolkit : true))
      .filter(row => (scope ? row.scope === scope : true));
  }

  async deleteConnection({ authorId, providerId, connectionId }: StorageDeleteToolProviderConnectionInput): Promise<void> {
    await this.client.del(this.key(authorId, providerId, connectionId));
  }

  private key(authorId: string, providerId: string, connectionId: string): string {
    return `mastra:upstash:tool-provider-connections:${this.namespace}:${authorId}:${providerId}:${connectionId}`;
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [nextCursor, batch] = await this.client.scan(cursor, { match: pattern, count: 1000 });
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== '0');
    return keys;
  }
}

export class WorkspacesUpstash extends InMemoryWorkspacesStorage {
  constructor(config: PersistedConfig) {
    const persister = new UpstashInMemoryPersister(config, 'workspaces');
    super({ db: persister.db });
    return persisted(this, persister);
  }
}
