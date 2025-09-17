import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { PaginationInfo, StorageGetTracesArg, StorageGetTracesPaginatedArg } from '@mastra/core/storage';
import { TABLE_TRACES, TracesStorage } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import { createSqlBuilder } from '../../sql-builder';
import type { StoreOperationsD1 } from '../operations';
import { deserializeValue } from '../utils';

function isArrayOfRecords(value: any): value is Record<string, any>[] {
  return value && Array.isArray(value) && value.length > 0;
}

export class TracesStorageD1 extends TracesStorage {
  private operations: StoreOperationsD1;

  constructor({ operations }: { operations: StoreOperationsD1 }) {
    super();
    this.operations = operations;
  }

  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    // Convert the old interface to the new paginated interface
    const paginatedArgs: StorageGetTracesPaginatedArg = {
      name: args.name,
      scope: args.scope,
      page: args.page,
      perPage: args.perPage,
      attributes: args.attributes,
      filters: args.filters,
      dateRange:
        args.fromDate || args.toDate
          ? {
              start: args.fromDate,
              end: args.toDate,
            }
          : undefined,
    };

    try {
      const result = await this.getTracesPaginated(paginatedArgs);
      return result.traces;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_TRACES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve traces: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            name: args.name ?? '',
            scope: args.scope ?? '',
          },
        },
        error,
      );
    }
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    const { name, scope, page = 0, perPage = 100, attributes, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const fullTableName = this.operations.getTableName(TABLE_TRACES);

    try {
      const dataQuery = createSqlBuilder().select('*').from(fullTableName).where('1=1');
      const countQuery = createSqlBuilder().count().from(fullTableName).where('1=1');

      if (name) {
        dataQuery.andWhere('name LIKE ?', `%${name}%`);
        countQuery.andWhere('name LIKE ?', `%${name}%`);
      }

      if (scope) {
        dataQuery.andWhere('scope = ?', scope);
        countQuery.andWhere('scope = ?', scope);
      }

      if (attributes && Object.keys(attributes).length > 0) {
        for (const [key, value] of Object.entries(attributes)) {
          dataQuery.jsonLike('attributes', key, value);
          countQuery.jsonLike('attributes', key, value);
        }
      }

      if (fromDate) {
        const fromDateStr = fromDate instanceof Date ? fromDate.toISOString() : fromDate;
        dataQuery.andWhere('createdAt >= ?', fromDateStr);
        countQuery.andWhere('createdAt >= ?', fromDateStr);
      }

      if (toDate) {
        const toDateStr = toDate instanceof Date ? toDate.toISOString() : toDate;
        dataQuery.andWhere('createdAt <= ?', toDateStr);
        countQuery.andWhere('createdAt <= ?', toDateStr);
      }

      const allDataResult = await this.operations.executeQuery(
        createSqlBuilder().select('*').from(fullTableName).where('1=1').build(),
      );

      console.info('allDataResult', allDataResult);

      const countResult = (await this.operations.executeQuery(countQuery.build())) as {
        count: number;
      }[];
      const total = Number(countResult?.[0]?.count ?? 0);

      dataQuery
        .orderBy('startTime', 'DESC')
        .limit(perPage)
        .offset(page * perPage);

      const results = await this.operations.executeQuery(dataQuery.build());

      const traces = isArrayOfRecords(results)
        ? results.map(
            (trace: Record<string, any>) =>
              ({
                ...trace,
                attributes: deserializeValue(trace.attributes, 'jsonb'),
                status: deserializeValue(trace.status, 'jsonb'),
                events: deserializeValue(trace.events, 'jsonb'),
                links: deserializeValue(trace.links, 'jsonb'),
                other: deserializeValue(trace.other, 'jsonb'),
              }) as Trace,
          )
        : [];

      return {
        traces,
        total,
        page,
        perPage,
        hasMore: page * perPage + traces.length < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_TRACES_PAGINATED_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve traces: ${error instanceof Error ? error.message : String(error)}`,
          details: { name: name ?? '', scope: scope ?? '' },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return { traces: [], total: 0, page, perPage, hasMore: false };
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
