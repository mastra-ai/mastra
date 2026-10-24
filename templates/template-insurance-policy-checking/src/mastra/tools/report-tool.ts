import { createTool } from '@mastra/core/tools';
import type { OperationContext } from '../domain/case-contracts.js';
import { safely } from '../domain/operation-errors.js';
import { reportRequestSchema } from '../domain/report-contracts.js';
import type { CaseService } from '../services/case-service.js';
import { operationContext } from './tool-context.js';
export type ReportReader = (context: OperationContext, input: unknown) => Promise<unknown>;
export function createReportTool(cases: CaseService, read: ReportReader, operatorId: string) {
  return createTool({
    id: 'read-policy-report',
    description:
      'Read the immutable draft, exact findings and source evidence for this selected case. Reading cannot approve or finalize.',
    inputSchema: reportRequestSchema.omit({ retryPublication: true }),
    execute: async (input, context) =>
      safely(() =>
        read(operationContext(cases, operatorId, context.requestContext), { ...input, retryPublication: false }),
      ),
  });
}
