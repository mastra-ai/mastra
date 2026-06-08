import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  AGENTS_SCHEMA,
  AGENT_VERSIONS_SCHEMA,
  calculatePagination,
  createStorageErrorId,
  normalizePerPage,
  TABLE_AGENTS,
  TABLE_AGENT_VERSIONS,
  TABLE_FAVORITES,
} from '@mastra/core/storage';
import type {
  AgentInstructionBlock,
  AgentVersion,
  CreateIndexOptions,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
  StorageAgentType,
  StorageCreateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageUpdateAgentInput,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

// Fields the version row already carries as metadata; everything else is
// snapshot config (pulled in by the abstract class via versionMetadataFields).
const VERSION_CONFIG_KEYS = [
  'name',
  'description',
  'instructions',
  'model',
  'tools',
  'defaultOptions',
  'workflows',
  'agents',
  'integrationTools',
  'inputProcessors',
  'outputProcessors',
  'memory',
  'scorers',
  'mcpClients',
  'requestContextSchema',
  'workspace',
  'skills',
  'skillsFormat',
] as const;

export class AgentsSpanner extends AgentsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_AGENTS, TABLE_AGENT_VERSIONS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup } =
      resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (AgentsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_AGENTS, schema: AGENTS_SCHEMA });
    await this.db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: AGENT_VERSIONS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
    await this.cleanupStaleDrafts();
  }

  /**
   * Sweeps orphaned draft thin-rows whose paired version row was never written.
   * Skipped under `initMode: 'validate'` because that mode owns the schema and
   * data externally and must never issue destructive DML.
   */
  private async cleanupStaleDrafts(): Promise<void> {
    if (this.db.initMode === 'validate') return;
    if (!this.db.cleanupStaleDraftsOnStartup) return;
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_AGENTS, 'table name')}
              WHERE ${quoteIdent('status', 'column name')} = 'draft'
                AND ${quoteIdent('activeVersionId', 'column name')} IS NULL
                AND id NOT IN (
                  SELECT ${quoteIdent('agentId', 'column name')}
                  FROM ${quoteIdent(TABLE_AGENT_VERSIONS, 'table name')}
                  WHERE ${quoteIdent('agentId', 'column name')} IS NOT NULL
                )`,
      });
    } catch (error) {
      this.logger?.warn?.('Failed to clean up stale draft agents:', error);
    }
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_agents_status_createdat_idx',
        table: TABLE_AGENTS,
        columns: ['status', 'createdAt DESC'],
      },
      {
        name: 'mastra_agents_authorid_idx',
        table: TABLE_AGENTS,
        columns: ['authorId'],
      },
      // Unique index on (agentId, versionNumber) prevents duplicate versions
      // from concurrent createVersion calls and keeps getVersionByNumber /
      // getLatestVersion consistent.
      {
        name: 'mastra_agent_versions_agentid_versionnumber_idx',
        table: TABLE_AGENT_VERSIONS,
        columns: ['agentId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_AGENT_VERSIONS });
    await this.db.clearTable({ tableName: TABLE_AGENTS });
  }

  private parseAgentRow(row: Record<string, any>): StorageAgentType {
    const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_AGENTS, row });
    // visibility and favoriteCount were added to StorageAgentType after the
    // initial Spanner adapter shipped; the stale dist .d.ts published with
    // older core releases doesn't carry them yet so we widen the return
    // shape here to keep the build green until the next core release.
    return {
      id: transformed.id,
      status: transformed.status,
      activeVersionId: transformed.activeVersionId ?? undefined,
      authorId: transformed.authorId ?? undefined,
      visibility: (transformed.visibility as 'private' | 'public' | undefined) ?? undefined,
      metadata: transformed.metadata ?? undefined,
      favoriteCount:
        transformed.favoriteCount === null || transformed.favoriteCount === undefined
          ? 0
          : Number(transformed.favoriteCount),
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    } as StorageAgentType;
  }

  /** Coerces stored instructions (string or JSON-stringified array of blocks) back to its API shape. */
  private deserializeInstructions(raw: unknown): string | AgentInstructionBlock[] {
    if (raw == null) return '';
    if (typeof raw !== 'string') return raw as any;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('[')) return raw;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as AgentInstructionBlock[];
    } catch {
      // Not JSON  treat as plain string.
    }
    return raw;
  }

  private serializeInstructions(value: string | AgentInstructionBlock[] | undefined): string {
    if (value == null) return '';
    return Array.isArray(value) ? JSON.stringify(value) : value;
  }

  private parseVersionRow(row: Record<string, any>): AgentVersion {
    const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_AGENT_VERSIONS, row });
    return {
      id: transformed.id,
      agentId: transformed.agentId,
      versionNumber: Number(transformed.versionNumber),
      name: transformed.name,
      description: transformed.description ?? undefined,
      instructions: this.deserializeInstructions(transformed.instructions),
      model: transformed.model,
      tools: transformed.tools ?? undefined,
      defaultOptions: transformed.defaultOptions ?? undefined,
      workflows: transformed.workflows ?? undefined,
      agents: transformed.agents ?? undefined,
      integrationTools: transformed.integrationTools ?? undefined,
      inputProcessors: transformed.inputProcessors ?? undefined,
      outputProcessors: transformed.outputProcessors ?? undefined,
      memory: transformed.memory ?? undefined,
      scorers: transformed.scorers ?? undefined,
      mcpClients: transformed.mcpClients ?? undefined,
      requestContextSchema: transformed.requestContextSchema ?? undefined,
      workspace: transformed.workspace ?? undefined,
      skills: transformed.skills ?? undefined,
      skillsFormat: transformed.skillsFormat ?? undefined,
      changedFields: transformed.changedFields ?? undefined,
      changeMessage: transformed.changeMessage ?? undefined,
      createdAt: transformed.createdAt,
    };
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_AGENTS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseAgentRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_AGENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error,
      );
    }
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    const { agent } = input;
    try {
      const now = new Date();
      const { id: _id, authorId: _authorId, visibility: _visibility, metadata: _metadata, ...snapshot } = agent as any;
      // Default visibility to 'private' for owned agents so multi-tenant
      // reads stay scoped; legacy/unowned agents keep their nullable status.
      const visibility = (agent as any).visibility ?? (agent.authorId ? 'private' : null);
      const versionId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const versionRecord: Record<string, any> = {
        id: versionId,
        agentId: agent.id,
        versionNumber: 1,
        name: (snapshot as any).name ?? null,
        description: (snapshot as any).description ?? null,
        instructions: this.serializeInstructions((snapshot as any).instructions),
        model: (snapshot as any).model ?? {},
        changedFields: Object.keys(snapshot),
        changeMessage: 'Initial version',
        createdAt: now,
      };
      for (const key of VERSION_CONFIG_KEYS) {
        if (key === 'name' || key === 'description' || key === 'instructions' || key === 'model') continue;
        const value = (snapshot as any)[key];
        versionRecord[key] = value === undefined ? null : value;
      }

      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await this.db.insert({
              tableName: TABLE_AGENTS,
              record: {
                id: agent.id,
                status: 'draft',
                activeVersionId: null,
                authorId: agent.authorId ?? null,
                visibility,
                metadata: agent.metadata ?? null,
                favoriteCount: 0,
                createdAt: now,
                updatedAt: now,
              },
              transaction: tx,
            });
            await this.db.insert({
              tableName: TABLE_AGENT_VERSIONS,
              record: versionRecord,
              transaction: tx,
            });
            await tx.commit();
          } catch (err) {
            // The Spanner client does NOT auto-rollback when the runFn throws
            // the transaction (and its row locks) stay pending on the server
            // until explicitly released. Without this rollback, a failed
            // create() blocks subsequent reads/writes against the same rows.
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );

      const created = await this.getById(agent.id);
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'CREATE_AGENT', 'NOT_FOUND_AFTER_CREATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Agent ${agent.id} not found after creation`,
          details: { agentId: agent.id },
        });
      }
      return created;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: agent.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_AGENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Agent ${id} not found`,
          details: { agentId: id },
        });
      }

      // The base update only touches thin-record fields. Config updates are made
      // through `createVersion` by the server's auto-versioning layer.
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.authorId !== undefined) updateData.authorId = updates.authorId;
      if (updates.activeVersionId !== undefined) updateData.activeVersionId = updates.activeVersionId;
      if (updates.status !== undefined) updateData.status = updates.status;
      if ((updates as any).visibility !== undefined) updateData.visibility = (updates as any).visibility;
      // Replace metadata wholesale, matching the documented DB-adapter semantics.
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata ?? null;

      await this.db.update({ tableName: TABLE_AGENTS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_AGENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Agent ${id} not found after update`,
          details: { agentId: id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error,
      );
    }
  }

  /** Removes an agent and all its versions atomically in a single transaction. */
  async delete(id: string): Promise<void> {
    try {
      // Both deletes share a transaction so a partial failure can't leave
      // versions without a parent (or vice versa). Spanner has no FK cascades
      // for non-interleaved tables so the parent has to be cleared explicitly.
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_AGENT_VERSIONS, 'table name')} WHERE ${quoteIdent('agentId', 'column name')} = @agentId`,
              params: { agentId: id },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_AGENTS, 'table name')} WHERE id = @id`,
              params: { id },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    // Default to status='published' so list() never leaks drafts/archived to
    // callers that omit the filter.
    const {
      page = 0,
      perPage: perPageInput,
      orderBy,
      authorId,
      metadata,
      status,
      entityIds,
      pinFavoritedFor,
      favoritedOnly,
    } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    // Default to status='published' so list() never leaks drafts/archived to
    // callers that omit the filter. Favorites-feature queries (entityIds /
    // pinFavoritedFor / favoritedOnly) operate on the favorited candidate set
    // and must see entities regardless of lifecycle status, so the default is
    // suppressed for them unless the caller passes an explicit status.
    const favoritesQuery = entityIds !== undefined || pinFavoritedFor !== undefined || favoritedOnly !== undefined;
    const effectiveStatus = status ?? (favoritesQuery ? undefined : 'published');

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_AGENTS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      // Empty entityIds can never match a row — short-circuit before querying.
      if (entityIds && entityIds.length === 0) {
        return { agents: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const tableName = quoteIdent(TABLE_AGENTS, 'table name');
      const favoritesTable = quoteIdent(TABLE_FAVORITES, 'table name');
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      // A favorites JOIN is only needed when a viewer is supplied (favorited-first
      // ordering and/or favoritedOnly filtering).
      const useJoin = Boolean(pinFavoritedFor);
      if (useJoin) params.pinUserId = pinFavoritedFor;

      if (effectiveStatus) {
        conditions.push(`a.${quoteIdent('status', 'column name')} = @status`);
        params.status = effectiveStatus;
      }
      if (authorId !== undefined) {
        conditions.push(`a.${quoteIdent('authorId', 'column name')} = @authorId`);
        params.authorId = authorId;
      }
      if (metadata && Object.keys(metadata).length > 0) {
        let i = 0;
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('SPANNER', 'LIST_AGENTS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          const param = `m${i++}`;
          conditions.push(`JSON_VALUE(a.metadata, '$.${key}') = @${param}`);
          params[param] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }
      if (entityIds && entityIds.length > 0) {
        const placeholders = entityIds.map((id, i) => {
          const param = `eid${i}`;
          params[param] = id;
          return `@${param}`;
        });
        conditions.push(`a.${quoteIdent('id', 'column name')} IN (${placeholders.join(', ')})`);
      }
      if (useJoin && favoritedOnly) {
        conditions.push(`s.${quoteIdent('userId', 'column name')} IS NOT NULL`);
      } else if (favoritedOnly) {
        // favoritedOnly without a viewer can never match a real favorite row.
        conditions.push('1 = 0');
      }

      const joinClause = useJoin
        ? `LEFT JOIN ${favoritesTable} s ON s.${quoteIdent('entityType', 'column name')} = 'agent'` +
          ` AND s.${quoteIdent('entityId', 'column name')} = a.${quoteIdent('id', 'column name')}` +
          ` AND s.${quoteIdent('userId', 'column name')} = @pinUserId`
        : '';
      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} a ${joinClause} ${whereSql}`,
        params,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);

      if (total === 0) {
        return { agents: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const dirSql = (direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const orderParts: string[] = [];
      if (useJoin) {
        // Favorited entities first, then the requested ordering.
        orderParts.push(`(s.${quoteIdent('userId', 'column name')} IS NOT NULL) DESC`);
      }
      orderParts.push(`a.${quoteIdent(field, 'column name')} ${dirSql}`);
      orderParts.push(`a.${quoteIdent('id', 'column name')} ${dirSql}`);
      const [rows] = await this.database.run({
        sql: `SELECT a.* FROM ${tableName} a ${joinClause} ${whereSql}
              ORDER BY ${orderParts.join(', ')}
              LIMIT @limit OFFSET @offset`,
        params: { ...params, limit, offset },
        json: true,
      });
      const agents = (rows as Array<Record<string, any>>).map(r => this.parseAgentRow(r));

      return {
        agents,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_AGENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    try {
      const now = new Date();
      const record: Record<string, any> = {
        id: input.id,
        agentId: input.agentId,
        versionNumber: input.versionNumber,
        name: input.name ?? null,
        description: input.description ?? null,
        instructions: this.serializeInstructions(input.instructions),
        model: input.model ?? {},
        changedFields: input.changedFields ?? null,
        changeMessage: input.changeMessage ?? null,
        createdAt: now,
      };
      // Pass through optional config fields when present.
      for (const key of VERSION_CONFIG_KEYS) {
        if (key === 'name' || key === 'description' || key === 'instructions' || key === 'model') continue;
        const value = (input as any)[key];
        record[key] = value === undefined ? null : value;
      }

      await this.db.insert({ tableName: TABLE_AGENT_VERSIONS, record });

      return {
        ...input,
        createdAt: now,
      } as AgentVersion;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, agentId: input.agentId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_AGENT_VERSIONS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_AGENT_VERSIONS, 'table name')}
              WHERE ${quoteIdent('agentId', 'column name')} = @agentId
                AND ${quoteIdent('versionNumber', 'column name')} = @versionNumber
              LIMIT 1`,
        params: { agentId, versionNumber },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_AGENT_VERSIONS, 'table name')}
              WHERE ${quoteIdent('agentId', 'column name')} = @agentId
              ORDER BY ${quoteIdent('versionNumber', 'column name')} DESC
              LIMIT 1`,
        params: { agentId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { agentId, page = 0, perPage: perPageInput, orderBy } = input;
    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_VERSIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }
    const perPage = normalizePerPage(perPageInput, 20);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const dirSql = direction === 'ASC' ? 'ASC' : 'DESC';
      const tableName = quoteIdent(TABLE_AGENT_VERSIONS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${quoteIdent('agentId', 'column name')} = @agentId`,
        params: { agentId },
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);

      if (total === 0) {
        return { versions: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('agentId', 'column name')} = @agentId
              ORDER BY ${quoteIdent(field, 'column name')} ${dirSql}, id ${dirSql}
              LIMIT @limit OFFSET @offset`,
        params: { agentId, limit, offset },
        json: true,
      });
      const versions = (rows as Array<Record<string, any>>).map(r => this.parseVersionRow(r));
      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_AGENT_VERSIONS, 'table name')} WHERE id = @id`,
        params: { id },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_AGENT_VERSIONS, 'table name')} WHERE ${quoteIdent('agentId', 'column name')} = @agentId`,
        params: { agentId: entityId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_VERSIONS_BY_AGENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: entityId },
        },
        error,
      );
    }
  }

  async countVersions(agentId: string): Promise<number> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${quoteIdent(TABLE_AGENT_VERSIONS, 'table name')} WHERE ${quoteIdent('agentId', 'column name')} = @agentId`,
        params: { agentId },
        json: true,
      });
      return Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'COUNT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }
}
