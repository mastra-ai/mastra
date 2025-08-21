import type { Connection } from '@lancedb/lancedb';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type { TraceType } from '@mastra/core/memory';
import { TABLE_TRACES, TracesStorage } from '@mastra/core/storage';
import type { PaginationInfo, StorageGetTracesPaginatedArg } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StoreOperationsLance } from '../operations';

export class StoreTracesLance extends TracesStorage {
  private client: Connection;
  private operations: StoreOperationsLance;
  constructor({ client, operations }: { client: Connection; operations: StoreOperationsLance }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  async saveTrace({ trace }: { trace: TraceType }): Promise<TraceType> {
    try {
      const table = await this.client.openTable(TABLE_TRACES);
      const record = {
        ...trace,
        attributes: JSON.stringify(trace.attributes),
        status: JSON.stringify(trace.status),
        events: JSON.stringify(trace.events),
        links: JSON.stringify(trace.links),
        other: JSON.stringify(trace.other),
      };
      await table.add([record], { mode: 'append' });
      return trace;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_SAVE_TRACE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTraceById({ traceId }: { traceId: string }): Promise<TraceType> {
    try {
      const table = await this.client.openTable(TABLE_TRACES);
      const query = table.query().where(`id = '${traceId}'`);
      const records = await query.toArray();
      return records[0] as TraceType;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_TRACE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTraces({
    name,
    scope,
    page = 1,
    perPage = 10,
    attributes,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<Trace[]> {
    try {
      const table = await this.client.openTable(TABLE_TRACES);
      const query = table.query();
      if (name) {
        query.where(`name = '${name}'`);
      }
      if (scope) {
        query.where(`scope = '${scope}'`);
      }
      if (attributes) {
        query.where(`attributes = '${JSON.stringify(attributes)}'`);
      }
      // Calculate offset based on page and perPage
      const offset = (page - 1) * perPage;
      query.limit(perPage);
      if (offset > 0) {
        query.offset(offset);
      }
      const records = await query.toArray();
      return records.map(record => {
        const processed = {
          ...record,
          attributes: record.attributes ? JSON.parse(record.attributes) : {},
          status: record.status ? JSON.parse(record.status) : {},
          events: record.events ? JSON.parse(record.events) : [],
          links: record.links ? JSON.parse(record.links) : [],
          other: record.other ? JSON.parse(record.other) : {},
          startTime: new Date(record.startTime),
          endTime: new Date(record.endTime),
          createdAt: new Date(record.createdAt),
        };
        if (processed.parentSpanId === null || processed.parentSpanId === undefined) {
          processed.parentSpanId = '';
        } else {
          processed.parentSpanId = String(processed.parentSpanId);
        }
        return processed as Trace;
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { name: name ?? '', scope: scope ?? '' },
        },
        error,
      );
    }
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    try {
      const table = await this.client.openTable(TABLE_TRACES);
      const query = table.query();
      const conditions: string[] = [];
      if (args.name) {
        conditions.push(`name = '${args.name}'`);
      }
      if (args.scope) {
        conditions.push(`scope = '${args.scope}'`);
      }
      if (args.attributes) {
        const attributesStr = JSON.stringify(args.attributes);
        conditions.push(`attributes LIKE '%${attributesStr.replace(/"/g, '\\"')}%'`);
      }
      if (args.dateRange?.start) {
        conditions.push(`\`createdAt\` >= ${args.dateRange.start.getTime()}`);
      }
      if (args.dateRange?.end) {
        conditions.push(`\`createdAt\` <= ${args.dateRange.end.getTime()}`);
      }
      if (conditions.length > 0) {
        const whereClause = conditions.join(' AND ');
        query.where(whereClause);
      }
      let total = 0;
      if (conditions.length > 0) {
        const countQuery = table.query().where(conditions.join(' AND '));
        const allRecords = await countQuery.toArray();
        total = allRecords.length;
      } else {
        total = await table.countRows();
      }
      const page = args.page || 0;
      const perPage = args.perPage || 10;
      const offset = page * perPage;
      query.limit(perPage);
      if (offset > 0) {
        query.offset(offset);
      }
      const records = await query.toArray();
      const traces = records.map(record => {
        const processed = {
          ...record,
          attributes: record.attributes ? JSON.parse(record.attributes) : {},
          status: record.status ? JSON.parse(record.status) : {},
          events: record.events ? JSON.parse(record.events) : [],
          links: record.links ? JSON.parse(record.links) : [],
          other: record.other ? JSON.parse(record.other) : {},
          startTime: new Date(record.startTime),
          endTime: new Date(record.endTime),
          createdAt: new Date(record.createdAt),
        };
        if (processed.parentSpanId === null || processed.parentSpanId === undefined) {
          processed.parentSpanId = '';
        } else {
          processed.parentSpanId = String(processed.parentSpanId);
        }
        return processed as Trace;
      });
      return {
        traces,
        total,
        page,
        perPage,
        hasMore: total > (page + 1) * perPage,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { name: args.name ?? '', scope: args.scope ?? '' },
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
