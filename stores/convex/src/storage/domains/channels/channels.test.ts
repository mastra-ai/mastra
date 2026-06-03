import { TABLE_CHANNEL_CONFIG, TABLE_CHANNEL_INSTALLATIONS } from '@mastra/core/storage';
import type { ChannelConfig, ChannelInstallation } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ConvexAdminClient } from '../../client';
import type { StorageRequest } from '../../types';
import { ChannelsConvex } from './index';

function createClient({
  callStorage = vi.fn(),
  callStorageRaw = vi.fn(),
}: {
  callStorage?: ReturnType<typeof vi.fn>;
  callStorageRaw?: ReturnType<typeof vi.fn>;
} = {}) {
  const client = new ConvexAdminClient({
    deploymentUrl: 'https://test.convex.cloud',
    adminAuthToken: 'test-token',
  });

  (client as unknown as { callStorage: typeof callStorage }).callStorage = callStorage;
  (client as unknown as { callStorageRaw: typeof callStorageRaw }).callStorageRaw = callStorageRaw;

  return { client, callStorage, callStorageRaw };
}

function createInstallation(overrides: Partial<ChannelInstallation> = {}): ChannelInstallation {
  return {
    id: 'install-1',
    platform: 'slack',
    agentId: 'agent-1',
    status: 'active',
    webhookId: 'webhook-1',
    data: { botToken: 'xoxb-test', nested: { $schema: 'https://example.test/schema.json' } },
    configHash: 'hash-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    platform: 'slack',
    data: { appConfigToken: 'xapp-test', nested: { $schema: 'https://example.test/schema.json' } },
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ChannelsConvex', () => {
  it('saves channel installations with serialized provider data', async () => {
    const installation = createInstallation({ webhookId: undefined, error: 'setup failed' });
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => undefined),
    });
    const storage = new ChannelsConvex({ client });

    await storage.saveInstallation(installation);

    expect(callStorage).toHaveBeenNthCalledWith(1, {
      op: 'load',
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      keys: { id: 'install-1' },
    });
    expect(callStorage).toHaveBeenNthCalledWith(2, {
      op: 'insert',
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      record: {
        id: 'install-1',
        platform: 'slack',
        agentId: 'agent-1',
        status: 'active',
        webhookId: null,
        data: JSON.stringify(installation.data),
        configHash: 'hash-1',
        error: 'setup failed',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: expect.any(String),
      },
    });
  });

  it('preserves original createdAt when updating an installation', async () => {
    const existingRecord = {
      id: 'install-1',
      platform: 'slack',
      agentId: 'agent-1',
      status: 'pending',
      webhookId: null,
      data: '{}',
      configHash: null,
      error: null,
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2025-12-01T00:00:00.000Z',
    };
    const installation = createInstallation({ createdAt: new Date('2026-01-01T00:00:00.000Z') });
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'load') return existingRecord;
        return undefined;
      }),
    });
    const storage = new ChannelsConvex({ client });

    await storage.saveInstallation(installation);

    expect(callStorage).toHaveBeenNthCalledWith(2, {
      op: 'insert',
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      record: expect.objectContaining({
        id: 'install-1',
        createdAt: '2025-12-01T00:00:00.000Z',
      }),
    });
  });

  it('loads and deserializes installations by id and webhook id', async () => {
    const installation = createInstallation();
    const record = {
      id: installation.id,
      platform: installation.platform,
      agentId: installation.agentId,
      status: installation.status,
      webhookId: installation.webhookId,
      data: JSON.stringify(installation.data),
      configHash: installation.configHash,
      error: null,
      createdAt: installation.createdAt.toISOString(),
      updatedAt: installation.updatedAt.toISOString(),
    };
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'load') return record;
        if (request.op === 'queryTable') return [record];
        return undefined;
      }),
    });
    const storage = new ChannelsConvex({ client });

    await expect(storage.getInstallation('install-1')).resolves.toEqual(installation);
    await expect(storage.getInstallationByWebhookId('webhook-1')).resolves.toEqual(installation);

    expect(callStorage).toHaveBeenNthCalledWith(1, {
      op: 'load',
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      keys: { id: 'install-1' },
    });
    expect(callStorage).toHaveBeenNthCalledWith(2, {
      op: 'queryTable',
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      filters: [{ field: 'webhookId', value: 'webhook-1' }],
      indexHint: undefined,
    });
  });

  it('chooses the best installation for an agent by status and recency', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => [
        {
          id: 'error-1',
          platform: 'slack',
          agentId: 'agent-1',
          status: 'error',
          webhookId: null,
          data: '{}',
          configHash: null,
          error: 'failed',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-03T00:00:00.000Z',
        },
        {
          id: 'pending-old',
          platform: 'slack',
          agentId: 'agent-1',
          status: 'pending',
          webhookId: null,
          data: '{}',
          configHash: null,
          error: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'pending-new',
          platform: 'slack',
          agentId: 'agent-1',
          status: 'pending',
          webhookId: null,
          data: '{}',
          configHash: null,
          error: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });
    const storage = new ChannelsConvex({ client });

    await expect(storage.getInstallationByAgent('slack', 'agent-1')).resolves.toEqual(
      expect.objectContaining({ id: 'pending-new' }),
    );

    expect(callStorage).toHaveBeenCalledWith({
      op: 'queryTable',
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      filters: [
        { field: 'platform', value: 'slack' },
        { field: 'agentId', value: 'agent-1' },
      ],
      indexHint: undefined,
    });
  });

  it('lists installations for a platform newest first', async () => {
    const { client } = createClient({
      callStorage: vi.fn(async () => [
        {
          id: 'old',
          platform: 'slack',
          agentId: 'agent-1',
          status: 'active',
          webhookId: null,
          data: '{}',
          configHash: null,
          error: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'new',
          platform: 'slack',
          agentId: 'agent-2',
          status: 'active',
          webhookId: null,
          data: '{}',
          configHash: null,
          error: null,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });
    const storage = new ChannelsConvex({ client });

    await expect(storage.listInstallations('slack')).resolves.toEqual([
      expect.objectContaining({ id: 'new' }),
      expect.objectContaining({ id: 'old' }),
    ]);
  });

  it('deletes installations by id', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => undefined),
    });
    const storage = new ChannelsConvex({ client });

    await storage.deleteInstallation('install-1');

    expect(callStorage).toHaveBeenCalledWith({
      op: 'deleteMany',
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      ids: ['install-1'],
    });
  });

  it('saves, loads, and deletes platform configs by platform key', async () => {
    const config = createConfig();
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'load') {
          return {
            id: 'slack',
            platform: 'slack',
            data: JSON.stringify(config.data),
            updatedAt: config.updatedAt.toISOString(),
          };
        }
        return undefined;
      }),
    });
    const storage = new ChannelsConvex({ client });

    await storage.saveConfig(config);
    await expect(storage.getConfig('slack')).resolves.toEqual(config);
    await storage.deleteConfig('slack');

    expect(callStorage).toHaveBeenNthCalledWith(1, {
      op: 'insert',
      tableName: TABLE_CHANNEL_CONFIG,
      record: {
        id: 'slack',
        platform: 'slack',
        data: JSON.stringify(config.data),
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(callStorage).toHaveBeenNthCalledWith(2, {
      op: 'load',
      tableName: TABLE_CHANNEL_CONFIG,
      keys: { id: 'slack' },
    });
    expect(callStorage).toHaveBeenNthCalledWith(3, {
      op: 'deleteMany',
      tableName: TABLE_CHANNEL_CONFIG,
      ids: ['slack'],
    });
  });

  it('clears both channel tables', async () => {
    const { client, callStorageRaw } = createClient({
      callStorageRaw: vi.fn(async () => ({ hasMore: false })),
    });
    const storage = new ChannelsConvex({ client });

    await storage.dangerouslyClearAll();

    expect(callStorageRaw).toHaveBeenNthCalledWith(1, {
      op: 'clearTable',
      tableName: TABLE_CHANNEL_INSTALLATIONS,
    });
    expect(callStorageRaw).toHaveBeenNthCalledWith(2, {
      op: 'clearTable',
      tableName: TABLE_CHANNEL_CONFIG,
    });
  });
});
