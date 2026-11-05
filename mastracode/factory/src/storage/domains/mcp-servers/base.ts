import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';
import type { OAuthStorage, SerializableMCPToolDefinition } from '@mastra/mcp';

import { toolExposedName } from '../../../mcp-servers/schemas.js';
import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';

export type McpServerAuthType = 'none' | 'headers' | 'oauth';
export type McpServerStatus = 'unknown' | 'connected' | 'needs_auth' | 'error';

export interface McpServerCatalogEntry {
  /** Name the agent and permission rules see (see `toolExposedName`). */
  exposedName: string;
  definition: SerializableMCPToolDefinition;
}

/** Discovered tools keyed by the server's own tool name. */
export type McpServerToolCatalog = Record<string, McpServerCatalogEntry>;

/**
 * A remote MCP server shared by an organization. Secrets are decrypted on
 * read; routes must redact them before responding.
 */
export interface McpServerRecord {
  id: string;
  orgId: string;
  createdBy: string;
  updatedBy: string;
  /** Immutable after creation: it prefixes every exposed tool name. */
  slug: string;
  name: string;
  url: string;
  authType: McpServerAuthType;
  headers: Record<string, string> | null;
  oauthClientId: string | null;
  oauthClientSecret: string | null;
  oauthScopes: string[];
  /**
   * Hosts of the OAuth authorization server (its issuer and token endpoint)
   * recorded by the last sign-in; with the server's own host they are the
   * only hosts its connections may reach.
   */
  authorizationServerHosts: string[];
  toolCatalog: McpServerToolCatalog | null;
  selectedTools: string[];
  /** Tools that appeared on a refresh and have not been reviewed; never selected automatically. */
  newTools: string[];
  status: McpServerStatus;
  lastError: string | null;
  discoveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMcpServerInput {
  slug: string;
  name: string;
  url: string;
  authType: McpServerAuthType;
  headers?: Record<string, string>;
  oauth?: { clientId?: string; clientSecret?: string; scopes?: string[] };
}

/**
 * Omitted fields keep their stored values; `headers` replaces all stored
 * headers; OAuth `clientId`/`clientSecret` accept `null` to clear.
 */
export interface UpdateMcpServerInput {
  name?: string;
  url?: string;
  authType?: McpServerAuthType;
  headers?: Record<string, string>;
  oauth?: { clientId?: string | null; clientSecret?: string | null; scopes?: string[] };
}

export interface McpServerOAuthFlow {
  nonce: string;
  orgId: string;
  userId: string;
  serverId: string;
  factoryProjectId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

/** Another server in the organization already uses this slug. */
export class McpServerSlugConflictError extends Error {
  constructor(readonly slug: string) {
    super(`An MCP server named "${slug}" already exists in this organization. Choose a different name.`);
    this.name = 'McpServerSlugConflictError';
  }
}

/** The requested change is invalid for the stored server. The message is safe to show to users. */
export class McpServerInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpServerInputError';
  }
}

export const MCP_SERVERS_SCHEMA: CollectionSchema = {
  name: 'mcp_servers',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    created_by: { type: 'text' },
    updated_by: { type: 'text' },
    slug: { type: 'text' },
    name: { type: 'text' },
    url: { type: 'text' },
    auth_type: { type: 'text' },
    headers: { type: 'text', nullable: true },
    oauth_client_id: { type: 'text', nullable: true },
    oauth_client_secret: { type: 'text', nullable: true },
    oauth_scopes: { type: 'json', nullable: true },
    authorization_server_hosts: { type: 'json', nullable: true },
    tool_catalog: { type: 'json', nullable: true },
    selected_tools: { type: 'json' },
    new_tools: { type: 'json' },
    status: { type: 'text' },
    last_error: { type: 'text', nullable: true },
    discovered_at: { type: 'timestamp', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'mcp_servers_org_slug_key', columns: ['org_id', 'slug'] }],
};

export const MCP_SERVER_OAUTH_SCHEMA: CollectionSchema = {
  name: 'mcp_server_oauth',
  columns: {
    id: { type: 'uuid-pk' },
    server_id: { type: 'text' },
    key: { type: 'text' },
    value: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'mcp_server_oauth_server_key', columns: ['server_id', 'key'] }],
};

export const MCP_SERVER_OAUTH_FLOWS_SCHEMA: CollectionSchema = {
  name: 'mcp_server_oauth_flows',
  columns: {
    nonce: { type: 'text', primaryKey: true },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    server_id: { type: 'text' },
    factory_project_id: { type: 'text', nullable: true },
    expires_at: { type: 'timestamp' },
    created_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'mcp_server_oauth_flows_server', columns: ['server_id'] }],
};

interface McpServerDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  created_by: string;
  updated_by: string;
  slug: string;
  name: string;
  url: string;
  auth_type: McpServerAuthType;
  headers: string | null;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  oauth_scopes: string[] | null;
  authorization_server_hosts: string[] | null;
  tool_catalog: McpServerToolCatalog | null;
  selected_tools: string[];
  new_tools: string[];
  status: McpServerStatus;
  last_error: string | null;
  discovered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface McpServerOAuthDbRow extends Record<string, unknown> {
  id: string;
  server_id: string;
  key: string;
  value: string;
  updated_at: Date;
}

interface McpServerOAuthFlowDbRow extends Record<string, unknown> {
  nonce: string;
  org_id: string;
  user_id: string;
  server_id: string;
  factory_project_id: string | null;
  expires_at: Date;
  created_at: Date;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(item => typeof item === 'string')
  );
}

function toFlow(row: McpServerOAuthFlowDbRow): McpServerOAuthFlow {
  return {
    nonce: row.nonce,
    orgId: row.org_id,
    userId: row.user_id,
    serverId: row.server_id,
    factoryProjectId: row.factory_project_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Organization MCP servers, their OAuth state, and pending OAuth sign-ins.
 * Header values, client secrets, and OAuth values are encrypted with the
 * Factory secret encryption.
 */
export class McpServersStorage extends FactoryStorageDomain {
  constructor(private readonly encryption: FactorySecretEncryption = createPlaintextFactorySecretEncryption()) {
    super('mcp-servers');
  }

  async init(): Promise<void> {
    await this.ensureCollections([MCP_SERVERS_SCHEMA, MCP_SERVER_OAUTH_SCHEMA, MCP_SERVER_OAUTH_FLOWS_SCHEMA]);
    const servers = await this.#db.findMany<McpServerDbRow>('mcp_servers', {});
    await Promise.all(
      servers
        .filter(row => row.headers !== null || row.oauth_client_secret !== null)
        .map(row => this.#migrateServerSecrets(row.id)),
    );
    const oauthRows = await this.#db.findMany<McpServerOAuthDbRow>('mcp_server_oauth', {});
    await Promise.all(oauthRows.map(row => this.#migrateOAuthValue(row.id)));
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteMany('mcp_server_oauth_flows', {});
    await this.#db.deleteMany('mcp_server_oauth', {});
    await this.#db.deleteMany('mcp_servers', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  // ---- secrets -------------------------------------------------------------

  async #decryptHeaders(stored: string): Promise<{ value: Record<string, string> | null; needsReencryption: boolean }> {
    const decrypted = await this.encryption.decrypt<unknown>(stored);
    return {
      value: isStringRecord(decrypted.value) ? decrypted.value : null,
      needsReencryption: decrypted.needsReencryption,
    };
  }

  /** Secrets are always strings; a non-string decode means the stored text is the secret. */
  async #decryptString(stored: string): Promise<{ value: string; needsReencryption: boolean }> {
    const decrypted = await this.encryption.decrypt<unknown>(stored);
    return {
      value: typeof decrypted.value === 'string' ? decrypted.value : stored,
      needsReencryption: decrypted.needsReencryption,
    };
  }

  async #encryptHeaders(headers: Record<string, string> | null | undefined): Promise<string | null> {
    return headers && Object.keys(headers).length > 0 ? this.encryption.encrypt(headers) : null;
  }

  async #encryptString(value: string | null | undefined): Promise<string | null> {
    return value ? this.encryption.encrypt(value) : null;
  }

  async #migrateServerSecrets(id: string): Promise<void> {
    await this.#db.updateAtomic<McpServerDbRow>('mcp_servers', { id }, async row => {
      const set: Partial<McpServerDbRow> = {};
      if (row.headers !== null) {
        const headers = await this.#decryptHeaders(row.headers);
        if (headers.needsReencryption) set.headers = await this.#encryptHeaders(headers.value);
      }
      if (row.oauth_client_secret !== null) {
        const secret = await this.#decryptString(row.oauth_client_secret);
        if (secret.needsReencryption) set.oauth_client_secret = await this.encryption.encrypt(secret.value);
      }
      return Object.keys(set).length > 0 ? set : null;
    });
  }

  async #migrateOAuthValue(id: string): Promise<void> {
    await this.#db.updateAtomic<McpServerOAuthDbRow>('mcp_server_oauth', { id }, async row => {
      const decrypted = await this.#decryptString(row.value);
      return decrypted.needsReencryption ? { value: await this.encryption.encrypt(decrypted.value) } : null;
    });
  }

  async #toRecord(row: McpServerDbRow): Promise<McpServerRecord> {
    return {
      id: row.id,
      orgId: row.org_id,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      slug: row.slug,
      name: row.name,
      url: row.url,
      authType: row.auth_type,
      headers: row.headers === null ? null : (await this.#decryptHeaders(row.headers)).value,
      oauthClientId: row.oauth_client_id,
      oauthClientSecret:
        row.oauth_client_secret === null ? null : (await this.#decryptString(row.oauth_client_secret)).value,
      oauthScopes: stringArray(row.oauth_scopes),
      authorizationServerHosts: stringArray(row.authorization_server_hosts),
      toolCatalog: row.tool_catalog && typeof row.tool_catalog === 'object' ? row.tool_catalog : null,
      selectedTools: stringArray(row.selected_tools),
      newTools: stringArray(row.new_tools),
      status: row.status,
      lastError: row.last_error,
      discoveredAt: row.discovered_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ---- servers -------------------------------------------------------------

  async list({ orgId }: { orgId: string }): Promise<McpServerRecord[]> {
    const rows = await this.#db.findMany<McpServerDbRow>(
      'mcp_servers',
      { org_id: orgId },
      { orderBy: [['name', 'asc']] },
    );
    return Promise.all(rows.map(row => this.#toRecord(row)));
  }

  async get({ orgId, id }: { orgId: string; id: string }): Promise<McpServerRecord | null> {
    const row = await this.#db.findOne<McpServerDbRow>('mcp_servers', { org_id: orgId, id });
    return row ? this.#toRecord(row) : null;
  }

  async countForOrg({ orgId }: { orgId: string }): Promise<number> {
    if (this.#db.count) return this.#db.count('mcp_servers', { org_id: orgId });
    return (await this.#db.findMany('mcp_servers', { org_id: orgId })).length;
  }

  async create({
    orgId,
    userId,
    input,
  }: {
    orgId: string;
    userId: string;
    input: CreateMcpServerInput;
  }): Promise<McpServerRecord> {
    const now = new Date();
    const oauth = input.authType === 'oauth' ? input.oauth : undefined;
    try {
      const row = await this.#db.insertOne<McpServerDbRow>('mcp_servers', {
        org_id: orgId,
        created_by: userId,
        updated_by: userId,
        slug: input.slug,
        name: input.name,
        url: input.url,
        auth_type: input.authType,
        headers: input.authType === 'headers' ? await this.#encryptHeaders(input.headers) : null,
        oauth_client_id: oauth?.clientId ?? null,
        oauth_client_secret: oauth?.clientId ? await this.#encryptString(oauth.clientSecret) : null,
        oauth_scopes: oauth?.scopes ?? null,
        authorization_server_hosts: null,
        tool_catalog: null,
        selected_tools: [],
        new_tools: [],
        status: 'unknown',
        last_error: null,
        discovered_at: null,
        created_at: now,
        updated_at: now,
      });
      return this.#toRecord(row);
    } catch (error) {
      if (error instanceof UniqueViolationError) throw new McpServerSlugConflictError(input.slug);
      throw error;
    }
  }

  /**
   * Apply an edit. Stored credentials never follow a server to a new origin:
   * changing the URL's origin requires re-sending headers and the client
   * secret, and clears OAuth tokens, pending sign-ins, the authorization-server
   * hosts, the tool catalog, and the selection. Changing how the server
   * authenticates resets its status so it is connected again before sessions
   * use it.
   */
  async update({
    orgId,
    id,
    userId,
    input,
  }: {
    orgId: string;
    id: string;
    userId: string;
    input: UpdateMcpServerInput;
  }): Promise<McpServerRecord | null> {
    const row = await this.storage.withTransaction(ops =>
      ops.updateAtomic<McpServerDbRow>('mcp_servers', { org_id: orgId, id }, async current => {
        const url = input.url ?? current.url;
        const authType = input.authType ?? current.auth_type;
        const originChanged = new URL(url).origin !== new URL(current.url).origin;

        let headers = current.headers;
        if (authType !== 'headers') {
          headers = null;
        } else if (input.headers) {
          headers = await this.#encryptHeaders(input.headers);
        } else if (current.auth_type !== 'headers' || current.headers === null) {
          throw new McpServerInputError('Add at least one header.');
        } else if (originChanged) {
          throw new McpServerInputError('Enter the headers again when you change the server address.');
        }

        let clientId: string | null = null;
        let clientSecret: string | null = null;
        let scopes: string[] | null = null;
        if (authType === 'oauth') {
          const wasOAuth = current.auth_type === 'oauth';
          clientId =
            input.oauth?.clientId !== undefined ? input.oauth.clientId : wasOAuth ? current.oauth_client_id : null;
          scopes = input.oauth?.scopes ?? (wasOAuth ? current.oauth_scopes : null);
          const clientIdChanged = clientId !== current.oauth_client_id;
          if (input.oauth?.clientSecret !== undefined) {
            if (input.oauth.clientSecret && !clientId)
              throw new McpServerInputError('A client secret needs a client ID.');
            clientSecret = await this.#encryptString(input.oauth.clientSecret);
          } else if (wasOAuth && !clientIdChanged && current.oauth_client_secret !== null) {
            if (originChanged) {
              throw new McpServerInputError('Enter the client secret again when you change the server address.');
            }
            clientSecret = current.oauth_client_secret;
          }
        }

        // OAuth tokens belong to one client at one origin.
        const clearsOAuth =
          current.auth_type === 'oauth' &&
          (originChanged || authType !== 'oauth' || clientId !== current.oauth_client_id);
        if (clearsOAuth) {
          await ops.deleteMany('mcp_server_oauth', { server_id: current.id });
          await ops.deleteMany('mcp_server_oauth_flows', { server_id: current.id });
        }

        const reconnect = originChanged || authType !== current.auth_type || input.headers !== undefined || clearsOAuth;
        return {
          name: input.name ?? current.name,
          url,
          auth_type: authType,
          headers,
          oauth_client_id: clientId,
          oauth_client_secret: clientSecret,
          oauth_scopes: scopes,
          ...(clearsOAuth ? { authorization_server_hosts: null } : {}),
          ...(originChanged ? { tool_catalog: null, selected_tools: [], new_tools: [], discovered_at: null } : {}),
          ...(reconnect ? { status: 'unknown' as const, last_error: null } : {}),
          updated_by: userId,
          updated_at: new Date(),
        };
      }),
    );
    return row ? this.#toRecord(row) : null;
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<boolean> {
    return this.storage.withTransaction(async ops => {
      const deleted = (await ops.deleteMany('mcp_servers', { org_id: orgId, id })) > 0;
      if (deleted) {
        await ops.deleteMany('mcp_server_oauth', { server_id: id });
        await ops.deleteMany('mcp_server_oauth_flows', { server_id: id });
      }
      return deleted;
    });
  }

  /**
   * Persist a successful discovery and mark the server connected. The first
   * discovery selects every tool; later ones keep the explicit selection,
   * drop tools that disappeared, and list newly appearing tools in
   * `newTools` without selecting them. `ifUrl` discards results discovered
   * against an address the server no longer has.
   */
  async saveDiscovery({
    orgId,
    id,
    ifUrl,
    tools,
    now = new Date(),
  }: {
    orgId: string;
    id: string;
    ifUrl: string;
    tools: SerializableMCPToolDefinition[];
    now?: Date;
  }): Promise<McpServerRecord | null> {
    let applied = false;
    const row = await this.#db.updateAtomic<McpServerDbRow>('mcp_servers', { org_id: orgId, id }, current => {
      if (current.url !== ifUrl) return null;
      applied = true;
      const catalog: McpServerToolCatalog = {};
      for (const definition of tools) {
        catalog[definition.name] = { exposedName: toolExposedName(current.slug, definition.name), definition };
      }
      const names = Object.keys(catalog);
      const previous = current.tool_catalog;
      let selected: string[];
      let newTools: string[];
      if (!previous) {
        selected = names;
        newTools = [];
      } else {
        const kept = new Set(stringArray(current.selected_tools));
        const pending = new Set(stringArray(current.new_tools));
        selected = names.filter(name => kept.has(name));
        newTools = names.filter(name => !kept.has(name) && (pending.has(name) || !(name in previous)));
      }
      return {
        tool_catalog: catalog,
        selected_tools: selected,
        new_tools: newTools,
        status: 'connected',
        last_error: null,
        discovered_at: now,
        updated_at: now,
      };
    });
    return row && applied ? this.#toRecord(row) : null;
  }

  /** Replace the selection; every name must be in the catalog. Marks all tools as reviewed. */
  async setSelectedTools({
    orgId,
    id,
    userId,
    selected,
  }: {
    orgId: string;
    id: string;
    userId: string;
    selected: string[];
  }): Promise<McpServerRecord | null> {
    const row = await this.#db.updateAtomic<McpServerDbRow>('mcp_servers', { org_id: orgId, id }, current => {
      const catalog = current.tool_catalog ?? {};
      const unknown = selected.filter(name => !(name in catalog));
      if (unknown.length > 0) {
        throw new McpServerInputError(
          `Unknown tools: ${unknown.join(', ')}. Refresh the server's tools and try again.`,
        );
      }
      return {
        selected_tools: [...new Set(selected)],
        new_tools: [],
        updated_by: userId,
        updated_at: new Date(),
      };
    });
    return row ? this.#toRecord(row) : null;
  }

  /** `ifUrl` discards a status computed against an address the server no longer has. */
  async setStatus({
    orgId,
    id,
    status,
    lastError = null,
    ifUrl,
  }: {
    orgId: string;
    id: string;
    status: McpServerStatus;
    lastError?: string | null;
    ifUrl?: string;
  }): Promise<McpServerRecord | null> {
    let applied = false;
    const row = await this.#db.updateAtomic<McpServerDbRow>('mcp_servers', { org_id: orgId, id }, current => {
      if (ifUrl !== undefined && current.url !== ifUrl) return null;
      applied = true;
      return { status, last_error: lastError, updated_at: new Date() };
    });
    return row && applied ? this.#toRecord(row) : null;
  }

  // ---- OAuth state ---------------------------------------------------------

  /** `@mastra/mcp` OAuth storage for one server, with every value encrypted. */
  oauthStorage(serverId: string): OAuthStorage {
    return {
      get: async key => {
        const row = await this.#db.findOne<McpServerOAuthDbRow>('mcp_server_oauth', { server_id: serverId, key });
        return row ? (await this.#decryptString(row.value)).value : undefined;
      },
      set: async (key, value) => {
        await this.#db.upsertOne<McpServerOAuthDbRow>('mcp_server_oauth', ['server_id', 'key'], {
          server_id: serverId,
          key,
          value: await this.encryption.encrypt(value),
          updated_at: new Date(),
        });
      },
      delete: async key => {
        await this.#db.deleteMany('mcp_server_oauth', { server_id: serverId, key });
      },
    };
  }

  /**
   * Sign the server out: forget its OAuth tokens, discovery state, pending
   * sign-ins, and authorization-server hosts, and mark it as needing sign-in.
   */
  async disconnectOAuth({ orgId, id }: { orgId: string; id: string }): Promise<McpServerRecord | null> {
    const row = await this.storage.withTransaction(ops =>
      ops.updateAtomic<McpServerDbRow>('mcp_servers', { org_id: orgId, id }, async () => {
        await ops.deleteMany('mcp_server_oauth', { server_id: id });
        await ops.deleteMany('mcp_server_oauth_flows', { server_id: id });
        return {
          authorization_server_hosts: null,
          status: 'needs_auth' as const,
          last_error: 'Sign in to connect this server.',
          updated_at: new Date(),
        };
      }),
    );
    return row ? this.#toRecord(row) : null;
  }

  /** Record the hosts a completed sign-in talked to. `ifUrl` discards a sign-in for an address the server no longer has. */
  async setAuthorizationServerHosts({
    orgId,
    id,
    ifUrl,
    hosts,
  }: {
    orgId: string;
    id: string;
    ifUrl: string;
    hosts: string[];
  }): Promise<McpServerRecord | null> {
    let applied = false;
    const row = await this.#db.updateAtomic<McpServerDbRow>('mcp_servers', { org_id: orgId, id }, current => {
      if (current.url !== ifUrl) return null;
      applied = true;
      return { authorization_server_hosts: [...new Set(hosts)], updated_at: new Date() };
    });
    return row && applied ? this.#toRecord(row) : null;
  }

  /** Whether a sign-in stored tokens for the server (`tokens`, or `tokens:<issuer>` per authorization server). */
  async hasOAuthTokens(serverId: string): Promise<boolean> {
    const rows = await this.#db.findMany<McpServerOAuthDbRow>('mcp_server_oauth', { server_id: serverId });
    return rows.some(row => row.key === 'tokens' || row.key.startsWith('tokens:'));
  }

  async createFlow(flow: Omit<McpServerOAuthFlow, 'createdAt'>): Promise<McpServerOAuthFlow> {
    const row = await this.#db.insertOne<McpServerOAuthFlowDbRow>('mcp_server_oauth_flows', {
      nonce: flow.nonce,
      org_id: flow.orgId,
      user_id: flow.userId,
      server_id: flow.serverId,
      factory_project_id: flow.factoryProjectId,
      expires_at: flow.expiresAt,
      created_at: new Date(),
    });
    return toFlow(row);
  }

  /** Single use: the first caller gets the flow, later callers and expired flows get `null`. */
  async consumeFlow(nonce: string, now = new Date()): Promise<McpServerOAuthFlow | null> {
    const row = await this.#db.findOne<McpServerOAuthFlowDbRow>('mcp_server_oauth_flows', { nonce });
    if (!row) return null;
    const claimed = (await this.#db.deleteMany('mcp_server_oauth_flows', { nonce })) > 0;
    if (!claimed || row.expires_at.getTime() <= now.getTime()) return null;
    return toFlow(row);
  }
}
