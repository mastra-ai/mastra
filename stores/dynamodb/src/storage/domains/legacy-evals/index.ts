import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { EvalRow, PaginationArgs, PaginationInfo } from '@mastra/core/storage';
import { LegacyEvalsStorage } from '@mastra/core/storage';
import type { Service } from 'electrodb';

export class LegacyEvalsDynamoDB extends LegacyEvalsStorage {
  service: Service<Record<string, any>>;
  tableName: string;

  constructor({ service, tableName }: { service: Service<Record<string, any>>; tableName: string }) {
    super();
    this.service = service;
    this.tableName = tableName;
  }

  // Eval operations
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    this.logger.debug('Getting evals for agent', { agentName, type });

    try {
      // Query evals by agent name using the GSI
      // Provide *all* composite key components for the 'byAgent' index ('entity', 'agent_name')
      const query = this.service.entities.eval.query.byAgent({ entity: 'eval', agent_name: agentName });

      // Fetch potentially all items in descending order, using the correct 'order' option
      const results = await query.go({ order: 'desc', limit: 100 }); // Use order: 'desc'

      if (!results.data.length) {
        return [];
      }

      // Filter by type if specified
      let filteredData = results.data;
      if (type) {
        filteredData = filteredData.filter((evalRecord: Record<string, any>) => {
          try {
            // Need to handle potential parse errors for test_info
            const testInfo =
              evalRecord.test_info && typeof evalRecord.test_info === 'string'
                ? JSON.parse(evalRecord.test_info)
                : undefined;

            if (type === 'test' && !testInfo) {
              return false;
            }
            if (type === 'live' && testInfo) {
              return false;
            }
          } catch (e) {
            this.logger.warn('Failed to parse test_info during filtering', { record: evalRecord, error: e });
            // Decide how to handle parse errors - exclude or include? Including for now.
          }
          return true;
        });
      }

      // Format the results - ElectroDB transforms most attributes, but we need to map/parse
      return filteredData.map((evalRecord: Record<string, any>) => {
        try {
          return {
            input: evalRecord.input,
            output: evalRecord.output,
            // Safely parse result and test_info
            result:
              evalRecord.result && typeof evalRecord.result === 'string' ? JSON.parse(evalRecord.result) : undefined,
            agentName: evalRecord.agent_name,
            createdAt: evalRecord.created_at, // Keep as string from DDB?
            metricName: evalRecord.metric_name,
            instructions: evalRecord.instructions,
            runId: evalRecord.run_id,
            globalRunId: evalRecord.global_run_id,
            testInfo:
              evalRecord.test_info && typeof evalRecord.test_info === 'string'
                ? JSON.parse(evalRecord.test_info)
                : undefined,
          } as EvalRow;
        } catch (parseError) {
          this.logger.error('Failed to parse eval record', { record: evalRecord, error: parseError });
          // Return a partial record or null/undefined on error?
          // Returning partial for now, might need adjustment based on requirements.
          return {
            agentName: evalRecord.agent_name,
            createdAt: evalRecord.created_at,
            runId: evalRecord.run_id,
            globalRunId: evalRecord.global_run_id,
          } as Partial<EvalRow> as EvalRow; // Cast needed for return type
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_EVALS_BY_AGENT_NAME_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName },
        },
        error,
      );
    }
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs = {},
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    const { agentName, type, page = 0, perPage = 100, dateRange } = options;

    this.logger.debug('Getting evals with pagination', { agentName, type, page, perPage, dateRange });

    try {
      let query;

      if (agentName) {
        // Query by specific agent name
        query = this.service.entities.eval.query.byAgent({ entity: 'eval', agent_name: agentName });
      } else {
        // Query all evals using the primary index
        query = this.service.entities.eval.query.byEntity({ entity: 'eval' });
      }

      // For DynamoDB, we need to fetch all data and apply pagination in memory
      // since DynamoDB doesn't support traditional offset-based pagination
      const results = await query.go({
        order: 'desc',
        pages: 'all', // Get all pages to apply filtering and pagination
      });

      if (!results.data.length) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Filter by type if specified
      let filteredData = results.data;
      if (type) {
        filteredData = filteredData.filter((evalRecord: Record<string, any>) => {
          try {
            const testInfo =
              evalRecord.test_info && typeof evalRecord.test_info === 'string'
                ? JSON.parse(evalRecord.test_info)
                : undefined;

            if (type === 'test' && !testInfo) {
              return false;
            }
            if (type === 'live' && testInfo) {
              return false;
            }
          } catch (e) {
            this.logger.warn('Failed to parse test_info during filtering', { record: evalRecord, error: e });
          }
          return true;
        });
      }

      // Apply date range filtering if specified
      if (dateRange) {
        const fromDate = dateRange.start;
        const toDate = dateRange.end;

        filteredData = filteredData.filter((evalRecord: Record<string, any>) => {
          const recordDate = new Date(evalRecord.created_at);

          if (fromDate && recordDate < fromDate) {
            return false;
          }
          if (toDate && recordDate > toDate) {
            return false;
          }
          return true;
        });
      }

      // Apply pagination
      const total = filteredData.length;
      const start = page * perPage;
      const end = start + perPage;
      const paginatedData = filteredData.slice(start, end);

      // Transform to EvalRow format
      const evals = paginatedData.map((evalRecord: Record<string, any>) => {
        try {
          return {
            input: evalRecord.input,
            output: evalRecord.output,
            result:
              evalRecord.result && typeof evalRecord.result === 'string' ? JSON.parse(evalRecord.result) : undefined,
            agentName: evalRecord.agent_name,
            createdAt: evalRecord.created_at,
            metricName: evalRecord.metric_name,
            instructions: evalRecord.instructions,
            runId: evalRecord.run_id,
            globalRunId: evalRecord.global_run_id,
            testInfo:
              evalRecord.test_info && typeof evalRecord.test_info === 'string'
                ? JSON.parse(evalRecord.test_info)
                : undefined,
          } as EvalRow;
        } catch (parseError) {
          this.logger.error('Failed to parse eval record', { record: evalRecord, error: parseError });
          return {
            agentName: evalRecord.agent_name,
            createdAt: evalRecord.created_at,
            runId: evalRecord.run_id,
            globalRunId: evalRecord.global_run_id,
          } as Partial<EvalRow> as EvalRow;
        }
      });

      const hasMore = end < total;

      return {
        evals,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            agentName: agentName || 'all',
            type: type || 'all',
            page,
            perPage,
          },
        },
        error,
      );
    }
  }
}
