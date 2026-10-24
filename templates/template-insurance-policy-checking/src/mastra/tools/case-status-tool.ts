import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { safely } from '../domain/operation-errors.js';
import type { CaseService } from '../services/case-service.js';
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
