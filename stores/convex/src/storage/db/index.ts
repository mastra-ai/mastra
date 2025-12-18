import crypto from 'node:crypto';

import { MastraBase } from '@mastra/core/base';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';

import { ConvexAdminClient } from '../client';
import type { EqualityFilter } from '../types';

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 * 1. An existing ConvexAdminClient
 * 2. Config to create a new client internally
 */
export type ConvexDomainConfig = ConvexDomainClientConfig | ConvexDomainRestConfig;

/**
 * Pass an existing ConvexAdminClient
 */
export interface ConvexDomainClientConfig {
  client: ConvexAdminClient;
}

/**
 * Pass config to create a new ConvexAdminClient internally
 */
export interface ConvexDomainRestConfig {
  deploymentUrl: string;
  adminAuthToken: string;
  storageFunction?: string;
}

/**
 * Resolves ConvexDomainConfig to a ConvexAdminClient.
 * Handles creating a new client if config is provided.
 */
export function resolveConvexConfig(config: ConvexDomainConfig): ConvexAdminClient {
  // Existing client
  if ('client' in config) {
    return config.client;
  }

  // Config to create new client
  return new ConvexAdminClient(config);
}

export class ConvexDB extends MastraBase {
    constructor(private readonly client: ConvexAdminClient) {
        super({ name: 'convex-db' });
    }

    async hasColumn(_table: string, _column: string): Promise<boolean> {
        return true;
    }

    async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
        // Delete in batches since each mutation can only delete a small number of docs
        // to stay within Convex's 1-second mutation timeout.
        let hasMore = true;
        while (hasMore) {
            const response = await this.client.callStorageRaw({
                op: 'clearTable',
                tableName,
            });
            hasMore = response.hasMore ?? false;
        }
    }

    async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
        // Delete in batches since each mutation can only delete a small number of docs
        // to stay within Convex's 1-second mutation timeout.
        let hasMore = true;
        while (hasMore) {
            const response = await this.client.callStorageRaw({
                op: 'dropTable',
                tableName,
            });
            hasMore = response.hasMore ?? false;
        }
    }

    async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
        await this.client.callStorage({
            op: 'insert',
            tableName,
            record: this.normalizeRecord(tableName, record),
        });
    }

    async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
        if (records.length === 0) return;

        await this.client.callStorage({
            op: 'batchInsert',
            tableName,
            records: records.map(record => this.normalizeRecord(tableName, record)),
        });
    }

    async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
        const result = await this.client.callStorage<R | null>({
            op: 'load',
            tableName,
            keys,
        });

        return result;
    }

    public async queryTable<R>(tableName: TABLE_NAMES, filters?: EqualityFilter[]): Promise<R[]> {
        return this.client.callStorage<R[]>({
            op: 'queryTable',
            tableName,
            filters,
        });
    }

    public async deleteMany(tableName: TABLE_NAMES, ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.client.callStorage({
            op: 'deleteMany',
            tableName,
            ids,
        });
    }

    private normalizeRecord(tableName: TABLE_NAMES, record: Record<string, any>): Record<string, any> {
        const normalized: Record<string, any> = { ...record };

        if (tableName === TABLE_WORKFLOW_SNAPSHOT && !normalized.id) {
            const runId = normalized.run_id || normalized.runId;
            const workflowName = normalized.workflow_name || normalized.workflowName;
            normalized.id = workflowName ? `${workflowName}-${runId}` : runId;
        }

        if (!normalized.id) {
            normalized.id = crypto.randomUUID();
        }

        for (const [key, value] of Object.entries(normalized)) {
            if (value instanceof Date) {
                normalized[key] = value.toISOString();
            }
        }

        return normalized;
    }
}
