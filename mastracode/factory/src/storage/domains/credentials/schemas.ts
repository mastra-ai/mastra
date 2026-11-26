import type { CollectionSchema } from '@mastra/core/storage';

import type { LoginAccountTarget, LoginCredentialScope, LoginSessionKind } from './base.js';

export const CREDENTIALS = 'model_provider_credentials';
export const LOGIN_SESSIONS = 'oauth_login_sessions';

/**
 * One row per tenant scope and provider. `data` holds the API key or the first
 * OAuth subscription, so every reader that knows a single credential per
 * provider keeps working; `extra_accounts` holds the encrypted list of later
 * subscriptions, so every change to a provider's accounts is one row write.
 */
export const MODEL_CREDENTIALS_SCHEMA: CollectionSchema = {
  name: CREDENTIALS,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text', nullable: true },
    provider: { type: 'text' },
    type: { type: 'text' },
    data: { type: 'json' },
    label: { type: 'text', nullable: true },
    /** The first subscription's id once it was promoted from `extra_accounts`; absent, the row id. */
    account_id: { type: 'text', nullable: true },
    extra_accounts: { type: 'json', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
    refresh_failed_at: { type: 'timestamp', nullable: true },
  },
  uniqueIndexes: [
    // Scope is encoded in `user_id` nullability (NULL = org-scoped shared
    // row), enforced by two partial unique indexes.
    {
      name: 'model_provider_credentials_user_unique',
      columns: ['org_id', 'user_id', 'provider'],
      whereNotNull: 'user_id',
    },
    { name: 'model_provider_credentials_org_unique', columns: ['org_id', 'provider'], whereNull: 'user_id' },
  ],
};

export const OAUTH_LOGIN_SESSIONS_SCHEMA: CollectionSchema = {
  name: LOGIN_SESSIONS,
  columns: {
    session_id: { type: 'text', primaryKey: true },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    provider: { type: 'text' },
    kind: { type: 'text' },
    credential_scope: { type: 'text', nullable: true },
    account_target: { type: 'json', nullable: true },
    pending: { type: 'json' },
    expires_at: { type: 'timestamp' },
    next_poll_at: { type: 'timestamp', nullable: true },
    created_at: { type: 'timestamp' },
  },
};

export interface CredentialDbRow extends Record<string, unknown> {
  id: string;
  provider: string;
  user_id: string | null;
  type: string;
  data: unknown;
  label: string | null;
  account_id: string | null;
  extra_accounts: unknown;
  created_at: Date;
  updated_at: Date;
  refresh_failed_at: Date | null;
}

export interface LoginSessionDbRow extends Record<string, unknown> {
  session_id: string;
  org_id: string;
  user_id: string;
  provider: string;
  kind: LoginSessionKind;
  credential_scope: LoginCredentialScope | null;
  account_target: LoginAccountTarget | null;
  pending: Record<string, unknown>;
  expires_at: Date;
  next_poll_at: Date | null;
  created_at: Date;
}
