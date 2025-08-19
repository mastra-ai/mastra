import type { Connection } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { LegacyEvalsStorage, TABLE_EVALS } from '@mastra/core/storage';
import type { EvalRow, PaginationInfo } from '@mastra/core/storage';

export class StoreLegacyEvalsLance extends LegacyEvalsStorage {
  private client: Connection;
  constructor({ client }: { client: Connection }) {
    super();
    this.client = client;
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const table = await this.client.openTable(TABLE_EVALS);
      const query = table.query().where(`agent_name = '${agentName}'`);
      const records = await query.toArray();

      // Filter by type if specified
      let filteredRecords = records;
      if (type === 'live') {
        // Live evals have test_info as null
        filteredRecords = records.filter(record => record.test_info === null);
      } else if (type === 'test') {
        // Test evals have test_info as a JSON string
        filteredRecords = records.filter(record => record.test_info !== null);
      }

      return filteredRecords.map(record => {
        return {
          id: record.id,
          input: record.input,
          output: record.output,
          agentName: record.agent_name,
          metricName: record.metric_name,
          result: JSON.parse(record.result),
          instructions: record.instructions,
          testInfo: record.test_info ? JSON.parse(record.test_info) : null,
          globalRunId: record.global_run_id,
          runId: record.run_id,
          createdAt: new Date(record.created_at).toString(),
        };
      }) as EvalRow[];
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_EVALS_BY_AGENT_NAME_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName },
        },
        error,
      );
    }
  }

  async getEvals(options: {
    agentName?: string;
    type?: 'test' | 'live';
    page?: number;
    perPage?: number;
    fromDate?: Date;
    toDate?: Date;
    dateRange?: { start?: Date; end?: Date };
  }): Promise<PaginationInfo & { evals: EvalRow[] }> {
    try {
      const table = await this.client.openTable(TABLE_EVALS);

      // Build combined where clause
      const conditions: string[] = [];

      if (options.agentName) {
        conditions.push(`agent_name = '${options.agentName}'`);
      }

      // Apply type filtering
      if (options.type === 'live') {
        conditions.push('length(test_info) = 0');
      } else if (options.type === 'test') {
        conditions.push('length(test_info) > 0');
      }

      // Apply date filtering
      const startDate = options.dateRange?.start || options.fromDate;
      const endDate = options.dateRange?.end || options.toDate;

      if (startDate) {
        conditions.push(`\`created_at\` >= ${startDate.getTime()}`);
      }

      if (endDate) {
        conditions.push(`\`created_at\` <= ${endDate.getTime()}`);
      }

      // Get total count with the same conditions
      let total = 0;
      if (conditions.length > 0) {
        total = await table.countRows(conditions.join(' AND '));
      } else {
        total = await table.countRows();
      }

      // Build query for fetching records
      const query = table.query();

      // Apply combined where clause if we have conditions
      if (conditions.length > 0) {
        const whereClause = conditions.join(' AND ');
        query.where(whereClause);
      }

      const records = await query.toArray();

      const evals = records
        .sort((a, b) => b.created_at - a.created_at)
        .map(record => {
          return {
            id: record.id,
            input: record.input,
            output: record.output,
            agentName: record.agent_name,
            metricName: record.metric_name,
            result: JSON.parse(record.result),
            instructions: record.instructions,
            testInfo: record.test_info ? JSON.parse(record.test_info) : null,
            globalRunId: record.global_run_id,
            runId: record.run_id,
            createdAt: new Date(record.created_at).toISOString(),
          };
        }) as EvalRow[];

      // Apply pagination after filtering
      const page = options.page || 0;
      const perPage = options.perPage || 10;
      const pagedEvals = evals.slice(page * perPage, (page + 1) * perPage);

      return {
        evals: pagedEvals,
        total: total,
        page,
        perPage,
        hasMore: total > (page + 1) * perPage,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName: options.agentName ?? '' },
        },
        error,
      );
    }
  }
}
