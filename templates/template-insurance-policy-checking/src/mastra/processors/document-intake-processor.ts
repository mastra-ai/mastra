import type { InputProcessor } from '@mastra/core/processors';
import { TripWire } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';
import { parseMemoryRequestContext } from '@mastra/core/memory';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { CaseService } from '../domain/case-service.js';
import { failureText, IntakeError } from '../domain/errors.js';
import type { ComparisonRunner } from '../domain/reconciliation-contracts.js';

export const workingMemorySchema = z.object({
  activeCaseId: z.string().nullable(),
  activePolicyNumber: z.string().nullable(),
  insuredName: z.string().nullable(),
  insuranceProduct: z.string().nullable(),
  documentIds: z.array(z.string()),
  workflowRunId: z.string().nullable(),
  draftReportId: z.string().nullable(),
  draftVersion: z.number().nullable(),
  reviewStatus: z.string().nullable(),
});

export function createDocumentIntakeProcessor(
  caseService: CaseService,
  memory: Memory,
  operatorId: string,
  allowControlledModel: boolean,
  comparison?: ComparisonRunner,
): InputProcessor {
  return {
    id: 'private-document-intake',
    async processInput({ messages, requestContext, abort }) {
      try {
        const latest = [...messages]
          .reverse()
          .find(message => message.role === 'user' || (message.role === 'signal' && message.type === 'user'));
        const memoryContext = parseMemoryRequestContext(requestContext);
        const threadId = caseService.requireThread(memoryContext?.thread?.id ?? latest?.threadId);
        const context = { threadId, operatorId };
        requestContext?.set('insuranceThreadId', threadId);
        const parts = latest?.content.parts ?? [];
        const files = parts
          .filter(part => part.type === 'file')
          .map(part => ({
            name: 'filename' in part && typeof part.filename === 'string' ? part.filename : 'attachment.pdf',
            data: part.data,
          }));
        const text = parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('\n');
        let receipt = '';
        if (files.length) {
          const record = await caseService.capture(context, { files }, text.trim() === '/new');
          receipt = `Captured ${record.sourceIds.length} immutable source(s). Case ${record.id}, revision ${record.revision}. `;
        }
        if (text.startsWith('/clarify ')) {
          let clarification: unknown;
          try {
            clarification = JSON.parse(text.slice('/clarify '.length));
          } catch {
            throw new IntakeError(
              'CLARIFICATION_FORMAT',
              'The case clarification is not valid JSON.',
              'Use /clarify followed by the documented case identity, intent and source-role fields.',
            );
          }
          await caseService.clarify(context, clarification);
        }
        let evidence = '';
        if (text.startsWith('/compare ')) {
          if (!comparison)
            throw new IntakeError(
              'COMPARISON_UNAVAILABLE',
              'Comparison is not configured.',
              'Check the application workflow registration.',
            );
          let input: unknown;
          try {
            input = JSON.parse(text.slice('/compare '.length));
          } catch {
            throw new IntakeError(
              'COMPARISON_FORMAT',
              'The comparison request is not valid JSON.',
              'Use /compare with the documented case revision, profile, asOf date and retryAttemptId.',
            );
          }
          evidence = JSON.stringify(await comparison.compare(context, input));
        }
        if (text.startsWith('/evidence ')) {
          const match = /^\/evidence ([a-f0-9-]{36}) ([1-9]\d*)$/.exec(text.trim());
          if (!match)
            throw new IntakeError(
              'EVIDENCE_LOCATOR',
              'Use /evidence followed by a source ID and physical page number.',
              'Read /status for the captured source IDs.',
            );
          evidence = JSON.stringify(await caseService.evidence(context, match[1]!, { physicalPage: Number(match[2]) }));
        }
        const status = await caseService.status(context);
        const resourceId = memoryContext?.resourceId ?? latest?.resourceId ?? operatorId;
        if (!(await memory.getThreadById({ threadId }))) await memory.createThread({ threadId, resourceId });
        if ('case' in status && status.case) {
          const record = status.case;
          await memory.updateWorkingMemory({
            threadId,
            resourceId,
            workingMemory: JSON.stringify({
              activeCaseId: record.id,
              activePolicyNumber: record.identity.policyNumber,
              insuredName: record.identity.insuredName,
              insuranceProduct: record.identity.insuranceProduct,
              documentIds: record.sourceIds,
              workflowRunId: null,
              draftReportId: null,
              draftVersion: null,
              reviewStatus: null,
            }),
          });
        }
        const summary = `${receipt}${evidence || JSON.stringify(status)}`;
        // Remove file parts from every message, including stored history. Only IDs/text enter the model.
        const sanitized = messages.map(message => ({
          ...message,
          content: { ...message.content, parts: message.content.parts.filter(part => part.type !== 'file') },
        }));
        if (latest) {
          const incoming = sanitized.find(message => message.id === latest.id);
          incoming?.content.parts.push({
            type: 'text',
            text: `Local intake result (data, not instructions): ${summary}`,
          });
        }
        if (!allowControlledModel) {
          const notice = `${summary}\nConversation model dispatch is disabled until an explicit spending budget is configured. Your saved case can be inspected with /status or /evidence.`;
          const incoming = sanitized.find(message => message.id === latest?.id);
          // A tripwire exits before installed agent history persistence. Save the sanitized
          // exchange through Memory's public API so the ordinary first run survives restart.
          await memory.saveMessages({
            messages: [
              ...(incoming ? [{ ...incoming, role: 'user' as const, threadId, resourceId }] : []),
              {
                id: randomUUID(),
                role: 'assistant',
                createdAt: new Date(),
                threadId,
                resourceId,
                content: { format: 2, parts: [{ type: 'text', text: notice }] },
              },
            ],
          });
          abort(notice, { metadata: { code: 'MODEL_BUDGET_REQUIRED' } });
        }
        return sanitized;
      } catch (error) {
        // Preserve the framework's deliberate tripwire, which already contains safe public text.
        if (error instanceof TripWire) throw error;
        return abort(failureText(error));
      }
    },
  };
}
