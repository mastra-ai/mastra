/**
 * Postgres Linear storage, bound to the shared pool from the `PostgresStore`
 * injected into `MastraFactory`. `init()` owns the idempotent DDL and binds
 * all typed Linear queries to that shared pool.
 */

import type pg from 'pg';

import type { FactoryStorageContext } from '../../storage/domain';
import { LinearStorage } from './base';
import type { LinearConnectionRow, LinearTokenUpdate, UpsertLinearConnectionInput } from './base';

export const LINEAR_DDL = `
CREATE TABLE IF NOT EXISTS linear_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  user_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  workspace_name text,
  workspace_url_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linear_connections ADD COLUMN IF NOT EXISTS refresh_token text;
ALTER TABLE linear_connections ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE linear_connections ADD COLUMN IF NOT EXISTS scope text;
CREATE UNIQUE INDEX IF NOT EXISTS linear_connections_org_unique ON linear_connections (org_id);
`;

interface ConnectionDbRow {
  id: string;
  org_id: string;
  user_id: string;
  access_token: string;
  scope: string | null;
  refresh_token: string | null;
  expires_at: Date | null;
  workspace_name: string | null;
  workspace_url_key: string | null;
  created_at: Date;
  updated_at: Date;
}

function toRow(db: ConnectionDbRow): LinearConnectionRow {
  return {
    id: db.id,
    orgId: db.org_id,
    userId: db.user_id,
    accessToken: db.access_token,
    scope: db.scope,
    refreshToken: db.refresh_token,
    expiresAt: db.expires_at,
    workspaceName: db.workspace_name,
    workspaceUrlKey: db.workspace_url_key,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export class LinearStoragePG extends LinearStorage {
  #pool?: pg.Pool;

  async init(ctx: FactoryStorageContext): Promise<void> {
    await ctx.pool.query(LINEAR_DDL);
    this.#pool = ctx.pool;
  }

  get #db(): pg.Pool {
    if (!this.#pool) throw new Error('[LinearStoragePG] Not initialized — init() has not succeeded.');
    return this.#pool;
  }

  async getConnection(orgId: string): Promise<LinearConnectionRow | null> {
    const { rows } = await this.#db.query<ConnectionDbRow>('SELECT * FROM linear_connections WHERE org_id = $1', [
      orgId,
    ]);
    return rows[0] ? toRow(rows[0]) : null;
  }

  async upsertConnection(input: UpsertLinearConnectionInput): Promise<void> {
    await this.#db.query(
      `INSERT INTO linear_connections
         (org_id, user_id, access_token, refresh_token, expires_at, scope, workspace_name, workspace_url_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (org_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         scope = EXCLUDED.scope,
         workspace_name = EXCLUDED.workspace_name,
         workspace_url_key = EXCLUDED.workspace_url_key,
         updated_at = now()`,
      [
        input.orgId,
        input.userId,
        input.accessToken,
        input.refreshToken,
        input.expiresAt,
        input.scope,
        input.workspaceName,
        input.workspaceUrlKey,
      ],
    );
  }

  async updateTokens(orgId: string, tokens: LinearTokenUpdate): Promise<void> {
    // Refresh responses may omit scope; COALESCE keeps the recorded grant.
    await this.#db.query(
      `UPDATE linear_connections SET
         access_token = $2,
         refresh_token = $3,
         expires_at = $4,
         scope = COALESCE($5, scope),
         updated_at = now()
       WHERE org_id = $1`,
      [orgId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt, tokens.scope],
    );
  }
}
