/**
 * Drizzle schema for the Linear integration, living in the same application
 * Postgres as the GitHub tables (`../github/db`). One row per WorkOS
 * organization: the Linear OAuth connection Intake reads issues through.
 *
 * The tenancy model matches GitHub: the connection is **org-owned** (any user
 * in the org sees the same Linear workspace on Intake); `user_id` records who
 * connected it (audit only).
 *
 * The OAuth access token is stored server-side and never leaves the server —
 * the SPA only ever sees the derived status/issue payloads.
 */

import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** A Linear workspace an org has connected via OAuth. */
export const linearConnections = pgTable(
  'linear_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Owning WorkOS organization id. */
    orgId: text('org_id').notNull(),
    /** Stable WorkOS user id of whoever connected it (audit only). */
    userId: text('user_id').notNull(),
    /** Linear OAuth access token (workspace-scoped). Server-side only. */
    accessToken: text('access_token').notNull(),
    /**
     * Scopes Linear granted to the token (e.g. `read,comments:create`). Null
     * for connections created before scope tracking — treated as read-only.
     */
    scope: text('scope'),
    /**
     * Linear OAuth refresh token. Linear access tokens expire (24h) and refresh
     * tokens rotate on every exchange, so this is rewritten after each refresh.
     * Null for connections created before token expiry support.
     */
    refreshToken: text('refresh_token'),
    /** When the current access token expires; null when Linear reported no expiry. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** Linear workspace display name, for the status payload. */
    workspaceName: text('workspace_name'),
    /** Linear workspace url key (linear.app/<urlKey>). */
    workspaceUrlKey: text('workspace_url_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('linear_connections_org_unique').on(table.orgId)],
);

export type LinearConnectionRow = typeof linearConnections.$inferSelect;
export type NewLinearConnectionRow = typeof linearConnections.$inferInsert;

/**
 * Idempotent DDL run on boot when the feature is enabled, mirroring the GitHub
 * schema's inline-migration approach (`CREATE ... IF NOT EXISTS` keeps boot
 * safe to re-run).
 */
export const LINEAR_MIGRATION_SQL = `
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
