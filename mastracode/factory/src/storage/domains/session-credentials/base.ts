import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';

/**
 * Session-scoped credentials a person hands to one Factory session for
 * integration tests. The agent opens a one-time request; the session owner
 * submits the value through an authenticated form; the value is stored
 * encrypted with a TTL and is only ever read back to inject into a single
 * sandbox command's environment. Nothing here returns a value to a caller
 * except {@link SessionCredentialsStorage.resolveForCommand}.
 */

export const CREDENTIAL_REQUEST_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_CREDENTIAL_TTL_MS = 4 * 60 * 60 * 1000;
export const MAX_CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_CREDENTIAL_VALUE_BYTES = 16 * 1024;
export const MAX_CREDENTIAL_PURPOSE_LENGTH = 500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
/** Names that would change how the sandbox runs commands, or shadow a token Factory already manages. */
const RESERVED_NAMES = new Set([
  'PATH',
  'HOME',
  'SHELL',
  'USER',
  'PWD',
  'TMPDIR',
  'NODE_OPTIONS',
  'BASH_ENV',
  'ENV',
  'IFS',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GIT_ASKPASS',
  'SSH_AUTH_SOCK',
]);
const RESERVED_PREFIXES = ['LD_', 'DYLD_', 'GIT_', 'MASTRA_', 'FACTORY_'];

/** Why a credential name is unusable, or `null` when it is a valid environment variable name we allow. */
export function credentialNameProblem(name: string): string | null {
  if (!NAME_PATTERN.test(name)) {
    return 'Use an environment variable name: uppercase letters, digits and underscores, starting with a letter (max 64).';
  }
  if (RESERVED_NAMES.has(name) || RESERVED_PREFIXES.some(prefix => name.startsWith(prefix))) {
    return `${name} is reserved; choose a name specific to the service under test (e.g. STRIPE_TEST_KEY).`;
  }
  return null;
}

export type SessionCredentialErrorCode =
  | 'not_found'
  | 'expired'
  | 'already_used'
  | 'invalid_name'
  | 'invalid_value'
  | 'missing'
  | 'sandbox_not_allowed';

export class SessionCredentialError extends Error {
  constructor(
    readonly code: SessionCredentialErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SessionCredentialError';
  }
}

/** Binding every request and credential carries; every read matches all of it. */
export interface SessionCredentialScope {
  orgId: string;
  sessionId: string;
}

export interface CredentialRequestRecord extends SessionCredentialScope {
  id: string;
  factoryProjectId: string | null;
  /** Thread notified when the value arrives. */
  threadId: string;
  /** The only person who may submit a value: the session's owner when the request was made. */
  ownerUserId: string;
  name: string;
  purpose: string;
  status: 'pending' | 'fulfilled';
  createdAt: Date;
  expiresAt: Date;
  fulfilledAt: Date | null;
}

/** Credential metadata. The value never leaves this module except through `resolveForCommand`. */
export interface SessionCredentialRecord extends SessionCredentialScope {
  name: string;
  factoryProjectId: string | null;
  submittedBy: string;
  allowSandbox: boolean;
  createdAt: Date;
  expiresAt: Date;
}

const REQUESTS = 'session_credential_requests';
const REQUEST_RETENTION_MS = 24 * 60 * 60_000;
const CREDENTIALS = 'session_credentials';

export const SESSION_CREDENTIAL_REQUESTS_SCHEMA: CollectionSchema = {
  name: REQUESTS,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text', nullable: true },
    session_id: { type: 'text' },
    thread_id: { type: 'text' },
    owner_user_id: { type: 'text' },
    name: { type: 'text' },
    purpose: { type: 'text' },
    status: { type: 'text' },
    created_at: { type: 'timestamp' },
    expires_at: { type: 'timestamp' },
    fulfilled_at: { type: 'timestamp', nullable: true },
  },
  indexes: [{ name: 'session_credential_requests_session_idx', columns: ['org_id', 'session_id'] }],
};

export const SESSION_CREDENTIALS_SCHEMA: CollectionSchema = {
  name: CREDENTIALS,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text', nullable: true },
    session_id: { type: 'text' },
    name: { type: 'text' },
    value: { type: 'text' },
    submitted_by: { type: 'text' },
    allow_sandbox: { type: 'boolean' },
    created_at: { type: 'timestamp' },
    expires_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'session_credentials_org_session_name_key', columns: ['org_id', 'session_id', 'name'] }],
};

interface RequestRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string | null;
  session_id: string;
  thread_id: string;
  owner_user_id: string;
  name: string;
  purpose: string;
  status: 'pending' | 'fulfilled';
  created_at: Date;
  expires_at: Date;
  fulfilled_at: Date | null;
}

interface CredentialRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string | null;
  session_id: string;
  name: string;
  value: string;
  submitted_by: string;
  allow_sandbox: boolean;
  created_at: Date;
  expires_at: Date;
}

function toRequest(row: RequestRow): CredentialRequestRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    sessionId: row.session_id,
    threadId: row.thread_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    purpose: row.purpose,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    fulfilledAt: row.fulfilled_at,
  };
}

function toCredential(row: CredentialRow): SessionCredentialRecord {
  return {
    orgId: row.org_id,
    sessionId: row.session_id,
    factoryProjectId: row.factory_project_id,
    name: row.name,
    submittedBy: row.submitted_by,
    allowSandbox: row.allow_sandbox,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/** Clamp a requested lifetime to (0, MAX]; absent means the default. */
export function credentialTtlMs(requested?: number): number {
  if (requested === undefined || !Number.isFinite(requested) || requested <= 0) return DEFAULT_CREDENTIAL_TTL_MS;
  return Math.min(requested, MAX_CREDENTIAL_TTL_MS);
}

export class SessionCredentialsStorage extends FactoryStorageDomain {
  constructor(private readonly encryption: FactorySecretEncryption = createPlaintextFactorySecretEncryption()) {
    super('session-credentials');
  }

  async init(): Promise<void> {
    await this.ensureCollections([SESSION_CREDENTIAL_REQUESTS_SCHEMA, SESSION_CREDENTIALS_SCHEMA]);
    await this.purgeExpired();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteMany(REQUESTS, {});
    await this.#db.deleteMany(CREDENTIALS, {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async createRequest(input: {
    orgId: string;
    factoryProjectId: string | null;
    sessionId: string;
    threadId: string;
    ownerUserId: string;
    name: string;
    purpose: string;
    now?: Date;
  }): Promise<CredentialRequestRecord> {
    const problem = credentialNameProblem(input.name);
    if (problem) throw new SessionCredentialError('invalid_name', problem);
    const now = input.now ?? new Date();
    await this.purgeExpired(now);
    const row = await this.#db.insertOne<RequestRow>(REQUESTS, {
      org_id: input.orgId,
      factory_project_id: input.factoryProjectId,
      session_id: input.sessionId,
      thread_id: input.threadId,
      owner_user_id: input.ownerUserId,
      name: input.name,
      purpose: input.purpose.slice(0, MAX_CREDENTIAL_PURPOSE_LENGTH),
      status: 'pending',
      created_at: now,
      expires_at: new Date(now.getTime() + CREDENTIAL_REQUEST_TTL_MS),
      fulfilled_at: null,
    });
    return toRequest(row);
  }

  async getRequest(id: string): Promise<CredentialRequestRecord | null> {
    if (!UUID_PATTERN.test(id)) return null;
    const row = await this.#db.findOne<RequestRow>(REQUESTS, { id });
    return row ? toRequest(row) : null;
  }

  /**
   * Claim a pending, unexpired request exactly once and store its value.
   * The caller must already have checked that the submitter owns the request.
   */
  async fulfillRequest(input: {
    requestId: string;
    submittedBy: string;
    value: string;
    allowSandbox: boolean;
    ttlMs?: number;
    now?: Date;
  }): Promise<{ request: CredentialRequestRecord; credential: SessionCredentialRecord }> {
    if (input.value.length === 0 || Buffer.byteLength(input.value, 'utf8') > MAX_CREDENTIAL_VALUE_BYTES) {
      throw new SessionCredentialError(
        'invalid_value',
        `The value must be between 1 byte and ${MAX_CREDENTIAL_VALUE_BYTES / 1024} KB.`,
      );
    }
    if (!UUID_PATTERN.test(input.requestId))
      throw new SessionCredentialError('not_found', 'Credential request not found.');
    const now = input.now ?? new Date();
    // Encrypt before claiming, so an encryption failure leaves the link usable.
    const encrypted = await this.encryption.encrypt(input.value);
    const outcome: { failure?: SessionCredentialError } = {};
    const claimed = await this.#db.updateAtomic<RequestRow>(REQUESTS, { id: input.requestId }, row => {
      if (row.status !== 'pending') {
        outcome.failure = new SessionCredentialError('already_used', 'This credential request has already been used.');
        return null;
      }
      if (row.expires_at.getTime() <= now.getTime()) {
        outcome.failure = new SessionCredentialError(
          'expired',
          'This credential request has expired. Ask the agent for a new link.',
        );
        return null;
      }
      return { status: 'fulfilled', fulfilled_at: now };
    });
    if (!claimed) throw new SessionCredentialError('not_found', 'Credential request not found.');
    if (outcome.failure) throw outcome.failure;

    const request = toRequest(claimed);
    const values = {
      factory_project_id: request.factoryProjectId,
      value: encrypted,
      submitted_by: input.submittedBy,
      allow_sandbox: input.allowSandbox,
      created_at: now,
      expires_at: new Date(now.getTime() + credentialTtlMs(input.ttlMs)),
    };
    let row: CredentialRow;
    try {
      row = await this.#db.upsertOne<CredentialRow>(CREDENTIALS, ['org_id', 'session_id', 'name'], {
        org_id: request.orgId,
        session_id: request.sessionId,
        name: request.name,
        ...values,
      });
    } catch (error) {
      // The storage layer has no multi-collection transaction: release this
      // claim so the owner can retry the same link instead of getting 409.
      await this.#db.updateAtomic<RequestRow>(REQUESTS, { id: input.requestId }, current =>
        current.status === 'fulfilled' && current.fulfilled_at?.getTime() === now.getTime()
          ? { status: 'pending', fulfilled_at: null }
          : null,
      );
      throw error;
    }
    // A session purge that ran between the claim and the upsert removed the
    // request first; drop the credential written after it instead of leaving it.
    if (!(await this.#db.findOne<RequestRow>(REQUESTS, { id: input.requestId }))) {
      await this.#db.deleteMany(CREDENTIALS, { id: row.id, created_at: row.created_at });
      throw new SessionCredentialError('not_found', 'Credential request not found.');
    }
    return { request, credential: toCredential(row) };
  }

  /** Unexpired credentials of one session, without values. */
  async list(scope: SessionCredentialScope, now = new Date()): Promise<SessionCredentialRecord[]> {
    const rows = await this.#db.findMany<CredentialRow>(CREDENTIALS, {
      org_id: scope.orgId,
      session_id: scope.sessionId,
    });
    await this.#deleteExpired(rows, now);
    return rows
      .filter(row => row.expires_at.getTime() > now.getTime())
      .map(toCredential)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Delete one credential; true when it existed. Revocation takes effect for every later command. */
  async revoke(scope: SessionCredentialScope & { name: string }): Promise<boolean> {
    return (
      (await this.#db.deleteMany(CREDENTIALS, {
        org_id: scope.orgId,
        session_id: scope.sessionId,
        name: scope.name,
      })) > 0
    );
  }

  /**
   * Delete every expired credential, and requests a day past their expiry
   * (kept that long so an expired link still says "expired"). Runs at startup
   * and before each new request, so expired values do not linger in storage.
   */
  async purgeExpired(now = new Date()): Promise<void> {
    const credentials = await this.#db.findMany<CredentialRow>(CREDENTIALS, {});
    await this.#deleteExpired(credentials, now);
    const requestCutoff = now.getTime() - REQUEST_RETENTION_MS;
    const requests = await this.#db.findMany<RequestRow>(REQUESTS, {});
    const staleRequests = requests.filter(row => row.expires_at.getTime() <= requestCutoff).map(row => row.id);
    if (staleRequests.length > 0) await this.#db.deleteMany(REQUESTS, { id: { in: staleRequests } });
  }

  /**
   * Delete rows that were expired when read. Matching on the observed expiry
   * keeps a value resubmitted in the meantime (the upsert keeps the row id).
   */
  async #deleteExpired(rows: CredentialRow[], now: Date): Promise<void> {
    for (const row of rows) {
      if (row.expires_at.getTime() > now.getTime()) continue;
      await this.#db.deleteMany(CREDENTIALS, { id: row.id, expires_at: row.expires_at });
    }
  }

  /** Drop every credential and request of a session (session deleted or closed). */
  async purgeSession(scope: SessionCredentialScope): Promise<void> {
    const where = { org_id: scope.orgId, session_id: scope.sessionId };
    // Requests first: an in-flight fulfillRequest re-checks its request after
    // writing, so either it sees the request gone or this delete removes its credential.
    await this.#db.deleteMany(REQUESTS, where);
    await this.#db.deleteMany(CREDENTIALS, where);
  }

  /**
   * Decrypt the named credentials for one sandbox command. Expired rows are
   * deleted on the way; every name must exist, be unexpired, have been
   * submitted by `submittedBy` (the current session owner, so credentials do
   * not pass to a new owner after a transfer), and allow sandbox use.
   */
  async resolveForCommand(
    scope: SessionCredentialScope & { names: string[]; submittedBy: string },
    now = new Date(),
  ): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    for (const name of new Set(scope.names)) {
      const row = await this.#db.findOne<CredentialRow>(CREDENTIALS, {
        org_id: scope.orgId,
        session_id: scope.sessionId,
        name,
        submitted_by: scope.submittedBy,
      });
      if (row) await this.#deleteExpired([row], now);
      if (!row || row.expires_at.getTime() <= now.getTime()) {
        throw new SessionCredentialError(
          'missing',
          `No credential named ${name} is available in this session. Use factory_request_credential to ask the session owner for it.`,
        );
      }
      if (!row.allow_sandbox) {
        throw new SessionCredentialError(
          'sandbox_not_allowed',
          `${name} was not submitted with sandbox use allowed, so it cannot be passed to a command.`,
        );
      }
      env[name] = (await this.encryption.decrypt<string>(row.value)).value;
    }
    return env;
  }
}
