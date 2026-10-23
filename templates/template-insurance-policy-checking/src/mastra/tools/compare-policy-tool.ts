import { createTool } from '@mastra/core/tools';
import type { CaseService } from '../domain/case-service.js';
import { compareRequestSchema, type ComparisonRunner } from '../domain/reconciliation-contracts.js';
import { safely } from '../domain/errors.js';
import { operationContext } from './tool-context.js';

export function createComparePolicyTool(cases: CaseService, runner: ComparisonRunner, operatorId: string) {
  return createTool({
    id: 'compare-policy',
    description:
      'Run evidence-backed comparison through the persistent policy checking workflow. Requires explicit case clarification and approved processing budgets. Does not approve findings, generate reports or certify coverage.',
    inputSchema: compareRequestSchema,
    execute: async (input, context) =>
      safely(() => runner.compare(operationContext(cases, operatorId, context.requestContext), input)),
  });
}
