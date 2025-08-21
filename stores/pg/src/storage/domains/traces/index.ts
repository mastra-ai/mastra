import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { PaginationInfo, StorageGetTracesArg, StorageGetTracesPaginatedArg } from '@mastra/core/storage';
import { TABLE_TRACES, TracesStorage, safelyParseJSON } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import { parseFieldKey } from '@mastra/core/utils';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations';
import { getSchemaName, getTableName } from '../utils';

export class TracesPG extends TracesStorage {
  public client: IDatabase<{}>;
  private operations: StoreOperationsPG;
  private schema?: string;

  constructor({
    client,
    operations,
    schema,
  }: {
    client: IDatabase<{}>;
    operations: StoreOperationsPG;
    schema?: string;
  }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
  }

  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    if (args.fromDate || args.toDate) {
      (args as any).dateRange = {
        start: args.fromDate,
        end: args.toDate,
      };
    }
    try {
      const result = await this.getTracesPaginated(args);
      return result.traces;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    const { name, scope, page = 0, perPage = 100, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const currentOffset = page * perPage;

    const queryParams: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (name) {
      conditions.push(`name LIKE $${paramIndex++}`);
      queryParams.push(`${name}%`);
    }
    if (scope) {
      conditions.push(`scope = $${paramIndex++}`);
      queryParams.push(scope);
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        const parsedKey = parseFieldKey(key);
        conditions.push(`attributes->>'${parsedKey}' = $${paramIndex++}`);
        queryParams.push(value);
      });
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        const parsedKey = parseFieldKey(key);
        conditions.push(`"${parsedKey}" = $${paramIndex++}`);
        queryParams.push(value);
      });
    }
    if (fromDate) {
      conditions.push(`"createdAt" >= $${paramIndex++}`);
      queryParams.push(fromDate);
    }
    if (toDate) {
      conditions.push(`"createdAt" <= $${paramIndex++}`);
      queryParams.push(toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countResult = await this.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_TRACES, schemaName: getSchemaName(this.schema) })} ${whereClause}`,
        queryParams,
      );
      const total = Number(countResult?.count ?? 0);

      if (total === 0) {
        return {
          traces: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const dataResult = await this.client.manyOrNone<Record<string, any>>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_TRACES, schemaName: getSchemaName(this.schema) })} ${whereClause} ORDER BY "startTime" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...queryParams, perPage, currentOffset],
      );

      const traces = dataResult.map(row => ({
        id: row.id,
        parentSpanId: row.parentSpanId,
        traceId: row.traceId,
        name: row.name,
        scope: row.scope,
        kind: row.kind,
        status: safelyParseJSON(row.status),
        events: safelyParseJSON(row.events),
        links: safelyParseJSON(row.links),
        attributes: safelyParseJSON(row.attributes),
        startTime: row.startTime,
        endTime: row.endTime,
        other: safelyParseJSON(row.other),
        createdAt: row.createdAtZ || row.createdAt,
      })) as Trace[];

      return {
        traces,
        total,
        page,
        perPage,
        hasMore: currentOffset + traces.length < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('Batch inserting traces', { count: records.length });
    await this.operations.batchInsert({
      tableName: TABLE_TRACES,
      records,
    });
  }
}
