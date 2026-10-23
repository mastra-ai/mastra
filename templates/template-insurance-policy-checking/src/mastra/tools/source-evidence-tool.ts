import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { CaseService } from '../domain/case-service.js';
import { safely } from '../domain/errors.js';
import { operationContext } from './tool-context.js';

export function createSourceEvidenceTool(caseService: CaseService, operatorId: string) {
  return createTool({
    id: 'source-evidence',
    description:
      'Read exact captured evidence from a physical PDF page or structured record and field in this conversation. Never invent locators.',
    inputSchema: z
      .object({
        sourceId: z.uuid(),
        physicalPage: z.number().int().positive().optional(),
        recordId: z.string().min(1).optional(),
        field: z.string().min(1).optional(),
      })
      .strict()
      .refine(
        value => (value.physicalPage ? !value.recordId && !value.field : Boolean(value.recordId && value.field)),
        'Supply either a physical page or a record and field locator.',
      ),
    execute: async ({ sourceId, ...locator }, context) =>
      safely(() =>
        caseService.evidence(operationContext(caseService, operatorId, context.requestContext), sourceId, locator),
      ),
  });
}
