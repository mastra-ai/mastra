import { createTool } from '@mastra/core/tools';
import { clarifySchema } from '../domain/case-contracts.js';
import { safely } from '../domain/operation-errors.js';
import type { CaseService } from '../services/case-service.js';
import { operationContext } from './tool-context.js';

/** Record explicit broker clarification through a schema-validated tool call. */
export function createClarifyCaseTool(caseService: CaseService, operatorId: string) {
  return createTool({
    id: 'clarify-case',
    description:
      'Record explicit broker-provided identity, intent, reference, target and roles. A selected reference is not accepted terms. Never infer acceptance. Does not compare or approve reports.',
    inputSchema: clarifySchema,
    execute: async (input, context) =>
      safely(() => caseService.clarify(operationContext(caseService, operatorId, context.requestContext), input)),
  });
}
