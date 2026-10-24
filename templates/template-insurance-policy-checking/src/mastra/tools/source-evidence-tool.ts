import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { safely } from '../domain/operation-errors.js';
import type { CaseService } from '../services/case-service.js';
import { operationContext } from './tool-context.js';

export function createSourceEvidenceTool(caseService: CaseService, operatorId: string) {
  return createTool({
    id: 'source-evidence',
    description:
      'Read exact captured evidence from a physical PDF page or structured record and field in this conversation. Never invent locators.',
    inputSchema: z
      .object({
        sourceId: z.uuid().describe('Immutable captured source identifier; copy it exactly from the source.'),
        physicalPage: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('One-based physical PDF page; null or absent for a record/field locator.'),
        recordId: z.string().min(1).optional().describe('Captured record identifier; null or absent for a PDF page.'),
        field: z
          .string()
          .min(1)
          .optional()
          .describe('Captured field name within the identified record; null or absent for a PDF page.'),
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
