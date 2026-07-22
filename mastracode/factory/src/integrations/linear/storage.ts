/**
 * Linear connection persistence on the generic integration storage domain.
 *
 * Linear stores exactly one org-owned connection (access token, rotating
 * refresh token, granted scopes, workspace metadata) — the canonical shape
 * the built-in `IntegrationStorage` domain covers, so there is no bespoke
 * Linear storage domain: the connection lives as the `data` payload of the
 * org's `integration_connections` row, pre-scoped to `integration_id =
 * 'linear'`.
 *
 * Tenancy matches GitHub: the connection is **org-owned** (any user in the
 * org sees the same workspace); `userId` records who connected it (audit
 * only). Tokens are stored server-side only and rewritten on every refresh
 * by `LinearIntegration`'s connection lifecycle methods.
 */

import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base';

/** Linear's slice of the generic integration storage domain. */
export type LinearStorageHandle = IntegrationStorageHandle<LinearConnectionData>;

/**
 * JSON payload stored in the connection's `data` column. JSON can't hold
 * `Date`s, so the expiry is epoch millis; {@link LinearConnectionRow} exposes
 * it as a `Date` again.
 */
export interface LinearConnectionData {
  /** Linear OAuth access token (workspace-scoped). Server-side only. */
  accessToken: string;
  /** Rotating refresh token; rewritten after each refresh. */
  refreshToken: string | null;
  /** When the current access token expires (epoch ms); null when Linear reported none. */
  expiresAtMs: number | null;
  /**
   * Scopes Linear granted (e.g. `read,comments:create`). Null for
   * connections created before scope tracking — treated as read-only.
   */
  scope: string | null;
  workspaceName: string | null;
  workspaceUrlKey: string | null;
}

/** A Linear workspace an org has connected via OAuth (consumer view). */
export interface LinearConnectionRow {
  id: string;
  orgId: string;
  /** Stable user id of whoever connected it (audit only). */
  userId: string | null;
  accessToken: string;
  scope: string | null;
  refreshToken: string | null;
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
