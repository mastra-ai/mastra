import { createTool } from '@mastra/core/tools';
import type { CaseService } from '../domain/case-service.js';
import { clarifySchema } from '../domain/contracts.js';
import { safely } from '../domain/errors.js';
import { operationContext } from './tool-context.js';

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
