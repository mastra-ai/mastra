/**
 * Linear integration storage domain: typed query surface over
 * `linear_connections` — one row per org holding the workspace's OAuth
 * connection (access token, rotating refresh token, granted scopes,
 * workspace metadata).
 *
 * Tenancy matches GitHub: the connection is **org-owned** (any user in the
 * org sees the same workspace); `userId` records who connected it (audit
 * only). Tokens are stored server-side only and rewritten on every refresh.
 */

import type { FactoryStorageContext, FactoryStorageDomain } from '../../storage/domain';

/** A Linear workspace an org has connected via OAuth. */
export interface LinearConnectionRow {
  id: string;
  orgId: string;
  /** Stable user id of whoever connected it (audit only). */
  userId: string;
  /** Linear OAuth access token (workspace-scoped). Server-side only. */
  accessToken: string;
  /**
   * Scopes Linear granted (e.g. `read,comments:create`). Null for
   * connections created before scope tracking — treated as read-only.
   */
  scope: string | null;
  /** Rotating refresh token; rewritten after each refresh. */
  refreshToken: string | null;
  /** When the current access token expires; null when Linear reported none. */
  expiresAt: Date | null;
  workspaceName: string | null;
  workspaceUrlKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Full connection state persisted after an OAuth callback. */
export interface UpsertLinearConnectionInput {
  orgId: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
  workspaceName: string | null;
  workspaceUrlKey: string | null;
}

/** Rotated token set persisted after a refresh. */
export interface LinearTokenUpdate {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  /** Refresh responses may omit scope; null keeps the recorded grant. */
  scope: string | null;
}

export abstract class LinearStorage implements FactoryStorageDomain {
  readonly name = 'linear';

  /** Run idempotent DDL and bind to the shared connection. */
  abstract init(ctx: FactoryStorageContext): Promise<void>;

  /** The org's connection, or null when Linear has not been connected. */
  abstract getConnection(orgId: string): Promise<LinearConnectionRow | null>;

  /** Insert or replace the org's connection (one per org). */
  abstract upsertConnection(input: UpsertLinearConnectionInput): Promise<void>;

  /** Persist a rotated token set on the org's existing connection row. */
  abstract updateTokens(orgId: string, tokens: LinearTokenUpdate): Promise<void>;
}
