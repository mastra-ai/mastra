import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  IntegrationsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_INTEGRATIONS,
  TABLE_CACHED_TOOLS,
  INTEGRATIONS_SCHEMA,
  CACHED_TOOLS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageIntegrationConfig,
  StorageCreateIntegrationInput,
  StorageUpdateIntegrationInput,
  StorageListIntegrationsInput,
  StorageListIntegrationsOutput,
  StorageCachedTool,
  StorageCachedToolInput,
  StorageListCachedToolsInput,
  StorageListCachedToolsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

export class IntegrationsLibSQL extends IntegrationsStorage {
  #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    // Create integrations table
    await this.#db.createTable({ tableName: TABLE_INTEGRATIONS, schema: INTEGRATIONS_SCHEMA });

    // Create cached tools table
    await this.#db.createTable({ tableName: TABLE_CACHED_TOOLS, schema: CACHED_TOOLS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_CACHED_TOOLS });
    await this.#db.deleteData({ tableName: TABLE_INTEGRATIONS });
  }

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      const details: Record<string, string> = {
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
      };
      if (fieldName) {
        details.field = fieldName;
      }

      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'PARSE_JSON', 'INVALID_JSON'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details,
        },
        error,
      );
    }
  }

  private parseIntegrationRow(row: any): StorageIntegrationConfig {
    return {
      id: row.id as string,
      provider: row.provider as 'composio' | 'arcade',
      name: row.name as string,
      enabled: Boolean(row.enabled),
      selectedToolkits: this.parseJson(row.selectedToolkits, 'selectedToolkits') as string[],
      metadata: this.parseJson(row.metadata, 'metadata'),
      ownerId: row.ownerId as string | undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  private parseCachedToolRow(row: any): StorageCachedTool {
    return {
      id: row.id as string,
      integrationId: row.integrationId as string,
      provider: row.provider as 'composio' | 'arcade',
      toolkitSlug: row.toolkitSlug as string,
      toolSlug: row.toolSlug as string,
      name: row.name as string,
      description: row.description as string | undefined,
      inputSchema: this.parseJson(row.inputSchema, 'inputSchema'),
      outputSchema: this.parseJson(row.outputSchema, 'outputSchema'),
      rawDefinition: this.parseJson(row.rawDefinition, 'rawDefinition'),
      createdAt: new Date(row.createdAt as string),
      cachedAt: new Date(row.cachedAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  async getIntegrationById({ id }: { id: string }): Promise<StorageIntegrationConfig | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_INTEGRATIONS,
        keys: { id },
      });

      return result ? this.parseIntegrationRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_INTEGRATION_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { integrationId: id },
        },
        error,
      );
    }
  }

  async createIntegration({ integration }: { integration: StorageCreateIntegrationInput }): Promise<StorageIntegrationConfig> {
    try {
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_INTEGRATIONS,
        record: {
          id: integration.id,
          provider: integration.provider,
          name: integration.name,
          enabled: integration.enabled ? 1 : 0, // Convert boolean to integer for LibSQL
          selectedToolkits: integration.selectedToolkits,
          metadata: integration.metadata ?? null,
          ownerId: integration.ownerId ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });

      return {
        ...integration,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_INTEGRATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { integrationId: integration.id },
        },
        error,
      );
    }
  }

  async updateIntegration({ id, ...updates }: StorageUpdateIntegrationInput): Promise<StorageIntegrationConfig> {
    try {
      // First, get the existing integration
      const existingIntegration = await this.getIntegrationById({ id });
      if (!existingIntegration) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_INTEGRATION', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Integration ${id} not found`,
          details: { integrationId: id },
        });
      }

      // Build the data object with only the fields that are being updated
      const data: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.name !== undefined) data.name = updates.name;
      if (updates.enabled !== undefined) data.enabled = updates.enabled ? 1 : 0;
      if (updates.selectedToolkits !== undefined) data.selectedToolkits = updates.selectedToolkits;
      if (updates.metadata !== undefined) {
        // Merge metadata
        data.metadata = { ...existingIntegration.metadata, ...updates.metadata };
      }
      if (updates.ownerId !== undefined) data.ownerId = updates.ownerId;

      // Only update if there's more than just updatedAt
      if (Object.keys(data).length > 1) {
        await this.#db.update({
          tableName: TABLE_INTEGRATIONS,
          keys: { id },
          data,
        });
      }

      // Return the updated integration
      const updatedIntegration = await this.getIntegrationById({ id });
      if (!updatedIntegration) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_INTEGRATION', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Integration ${id} not found after update`,
          details: { integrationId: id },
        });
      }

      return updatedIntegration;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_INTEGRATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { integrationId: id },
        },
        error,
      );
    }
  }

  async deleteIntegration({ id }: { id: string }): Promise<void> {
    try {
      // First delete all cached tools for this integration
      await this.deleteCachedToolsByIntegration({ integrationId: id });

      await this.#db.delete({
        tableName: TABLE_INTEGRATIONS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_INTEGRATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { integrationId: id },
        },
        error,
      );
    }
  }

  async listIntegrations(args?: StorageListIntegrationsInput): Promise<StorageListIntegrationsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, provider, ownerId, enabled } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_INTEGRATIONS', 'INVALID_PAGE'),
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
      // Build WHERE clause for filtering
      const whereClauses: string[] = [];
      const whereValues: any[] = [];

      if (provider !== undefined) {
        whereClauses.push(`"provider" = ?`);
        whereValues.push(provider);
      }

      if (ownerId !== undefined) {
        whereClauses.push(`"ownerId" = ?`);
        whereValues.push(ownerId);
      }

      if (enabled !== undefined) {
        whereClauses.push(`"enabled" = ?`);
        whereValues.push(enabled ? 1 : 0);
      }

      const whereClause =
        whereClauses.length > 0 ? { sql: `WHERE ${whereClauses.join(' AND ')}`, args: whereValues } : undefined;

      // Get total count with filters
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_INTEGRATIONS,
        whereClause,
      });

      if (total === 0) {
        return {
          integrations: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results with filters
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_INTEGRATIONS,
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
        whereClause,
      });

      const integrations = rows.map(row => this.parseIntegrationRow(row));

      return {
        integrations,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_INTEGRATIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Cached Tools Methods
  // ==========================================================================

  async cacheTool({ tool }: { tool: StorageCachedToolInput }): Promise<StorageCachedTool> {
    try {
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_CACHED_TOOLS,
        record: {
          id: tool.id,
          integrationId: tool.integrationId,
          provider: tool.provider,
          toolkitSlug: tool.toolkitSlug,
          toolSlug: tool.toolSlug,
          name: tool.name,
          description: tool.description ?? null,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema ?? null,
          rawDefinition: tool.rawDefinition,
          createdAt: now,
          cachedAt: now,
          updatedAt: now,
        },
      });

      return {
        ...tool,
        createdAt: now,
        cachedAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CACHE_TOOL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { toolId: tool.id, integrationId: tool.integrationId },
        },
        error,
      );
    }
  }

  async cacheTools({ tools }: { tools: StorageCachedToolInput[] }): Promise<StorageCachedTool[]> {
    try {
      const now = new Date();

      const records = tools.map(tool => ({
        id: tool.id,
        integrationId: tool.integrationId,
        provider: tool.provider,
        toolkitSlug: tool.toolkitSlug,
        toolSlug: tool.toolSlug,
        name: tool.name,
        description: tool.description ?? null,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema ?? null,
        rawDefinition: tool.rawDefinition,
        createdAt: now,
        cachedAt: now,
        updatedAt: now,
      }));

      await this.#db.batchInsert({
        tableName: TABLE_CACHED_TOOLS,
        records,
      });

      return tools.map(tool => ({
        ...tool,
        createdAt: now,
        cachedAt: now,
        updatedAt: now,
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CACHE_TOOLS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { toolCount: tools.length },
        },
        error,
      );
    }
  }

  async getCachedTool({ id }: { id: string }): Promise<StorageCachedTool | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_CACHED_TOOLS,
        keys: { id },
      });

      return result ? this.parseCachedToolRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_CACHED_TOOL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { toolId: id },
        },
        error,
      );
    }
  }

  async getCachedToolBySlug({ integrationId, toolSlug }: { integrationId: string; toolSlug: string }): Promise<StorageCachedTool | null> {
    try {
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_CACHED_TOOLS,
        whereClause: {
          sql: 'WHERE "integrationId" = ? AND "toolSlug" = ?',
          args: [integrationId, toolSlug],
        },
        limit: 1,
      });

      return rows.length > 0 ? this.parseCachedToolRow(rows[0]!) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_CACHED_TOOL_BY_SLUG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { integrationId, toolSlug },
        },
        error,
      );
    }
  }

  async listCachedTools(args?: StorageListCachedToolsInput): Promise<StorageListCachedToolsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, integrationId, provider, toolkitSlug } = args || {};
    const { field, direction } = this.parseCachedToolOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_CACHED_TOOLS', 'INVALID_PAGE'),
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
      // Build WHERE clause for filtering
      const whereClauses: string[] = [];
      const whereValues: any[] = [];

      if (integrationId !== undefined) {
        whereClauses.push(`"integrationId" = ?`);
        whereValues.push(integrationId);
      }

      if (provider !== undefined) {
        whereClauses.push(`"provider" = ?`);
        whereValues.push(provider);
      }

      if (toolkitSlug !== undefined) {
        whereClauses.push(`"toolkitSlug" = ?`);
        whereValues.push(toolkitSlug);
      }

      const whereClause =
        whereClauses.length > 0 ? { sql: `WHERE ${whereClauses.join(' AND ')}`, args: whereValues } : undefined;

      // Get total count with filters
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_CACHED_TOOLS,
        whereClause,
      });

      if (total === 0) {
        return {
          tools: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results with filters
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_CACHED_TOOLS,
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
        whereClause,
      });

      const tools = rows.map(row => this.parseCachedToolRow(row));

      return {
        tools,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_CACHED_TOOLS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteCachedToolsByIntegration({ integrationId }: { integrationId: string }): Promise<void> {
    try {
      // Delete all cached tools for this integration in a single query
      await this.#db.delete({
        tableName: TABLE_CACHED_TOOLS,
        keys: { integrationId },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_CACHED_TOOLS_BY_INTEGRATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { integrationId },
        },
        error,
      );
    }
  }

  async updateCachedToolsTimestamp({ integrationId }: { integrationId: string }): Promise<void> {
    try {
      const now = new Date();

      // Get all tools for this integration
      const tools = await this.listCachedTools({
        integrationId,
        perPage: false, // Get all tools
      });

      if (tools.tools.length === 0) {
        return;
      }

      // Batch update all tools
      const updates = tools.tools.map(tool => ({
        keys: { id: tool.id },
        data: { updatedAt: now },
      }));

      await this.#db.batchUpdate({
        tableName: TABLE_CACHED_TOOLS,
        updates,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_CACHED_TOOLS_TIMESTAMP', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { integrationId },
        },
        error,
      );
    }
  }

  async deleteCachedTool({ id }: { id: string }): Promise<void> {
    try {
      await this.#db.delete({
        tableName: TABLE_CACHED_TOOLS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_CACHED_TOOL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { toolId: id },
        },
        error,
      );
    }
  }
}
