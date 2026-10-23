import { createTool } from '@mastra/core/tools';
import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import type { IntakeService } from '../services/intake.js';
import { clarifySchema } from '../storage/cases.js';
import { safely } from '../services/errors.js';

export function operationContext(service: IntakeService, operatorId: string, requestContext?: RequestContext) {
  const threadId =
    (requestContext?.get('insuranceThreadId') as string | undefined) ??
    parseMemoryRequestContext(requestContext)?.thread?.id;
  return { operatorId, threadId: service.requireThread(threadId) };
}
export function createIntakeTools(service: IntakeService, operatorId: string) {
  return {
    caseStatus: createTool({
      id: 'case-status',
      description:
        'Read the authoritative selected case, source metadata, physical pages, limitations and clarification needs in this conversation.',
      inputSchema: z.object({}).strict(),
      execute: async (_input, context) =>
        safely(() => service.status(operationContext(service, operatorId, context.requestContext))),
    }),
    clarifyCase: createTool({
      id: 'clarify-case',
      description:
        'Record explicit broker-provided identity, intent, reference, target and roles. A selected reference is not accepted terms. Never infer acceptance. Does not compare or approve reports.',
      inputSchema: clarifySchema,
      execute: async (input, context) =>
        safely(() => service.clarify(operationContext(service, operatorId, context.requestContext), input)),
    }),
    sourceEvidence: createTool({
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
          service.evidence(operationContext(service, operatorId, context.requestContext), sourceId, locator),
        ),
    }),
  };
}
