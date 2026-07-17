/**
 * In-memory Linear storage for tests. Mirrors the pg implementation's
 * one-row-per-org and keep-scope-on-null-refresh semantics.
 */

import { randomUUID } from 'node:crypto';

import type { FactoryStorageContext } from '../../storage/domain';
import { LinearStorage } from './base';
import type { LinearConnectionRow, LinearTokenUpdate, UpsertLinearConnectionInput } from './base';

export class LinearStorageInMemory extends LinearStorage {
  connections: LinearConnectionRow[] = [];

  async init(_ctx: FactoryStorageContext): Promise<void> {
    // No DDL to run.
  }

  async getConnection(orgId: string): Promise<LinearConnectionRow | null> {
    return this.connections.find(row => row.orgId === orgId) ?? null;
  }

  async upsertConnection(input: UpsertLinearConnectionInput): Promise<void> {
    const existing = await this.getConnection(input.orgId);
    if (existing) {
      Object.assign(existing, input, { updatedAt: new Date() });
      return;
    }
    const now = new Date();
    this.connections.push({ id: randomUUID(), createdAt: now, updatedAt: now, ...input });
  }

  async updateTokens(orgId: string, tokens: LinearTokenUpdate): Promise<void> {
    const row = await this.getConnection(orgId);
    if (!row) return;
    row.accessToken = tokens.accessToken;
    row.refreshToken = tokens.refreshToken;
    row.expiresAt = tokens.expiresAt;
    // Refresh responses may omit scope; keep the recorded grant in that case.
    if (tokens.scope !== null) row.scope = tokens.scope;
    row.updatedAt = new Date();
  }
}
