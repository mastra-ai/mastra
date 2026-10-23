import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { CaseService } from '../domain/case-service.js';
import { safely } from '../domain/errors.js';
import { operationContext } from './tool-context.js';

export function createCaseStatusTool(caseService: CaseService, operatorId: string) {
  return createTool({
    id: 'case-status',
    description:
      'Read the authoritative selected case, source metadata, physical pages, limitations and clarification needs in this conversation.',
    inputSchema: z.object({}).strict(),
    execute: async (_input, context) =>
      safely(() => caseService.status(operationContext(caseService, operatorId, context.requestContext))),
  });
}
