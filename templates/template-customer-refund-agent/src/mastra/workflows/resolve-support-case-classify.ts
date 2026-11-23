import { createStep } from '@mastra/core/workflows';
import { resourceIdForOwner, threadIdForCase, triageResultSchema } from '../domain/support-case';
import { caseStore } from '../lib/case-store';
import { bindingsForPersistedCase } from '../runtime/provider-bindings';
import {
  cancellationMessageHash,
  isStagingIntercomStripeCase,
  stagingCancellationSystem,
  stagingTriageSchema,
} from './staging-cancellation-authority';
import { getActiveCaseOrThrow, resolveSupportCaseInputSchema } from './resolve-support-case-context';

export const classifyStep = createStep({
  id: 'classify',
  description: "Runs the triage agent on the customer's message.",
  inputSchema: resolveSupportCaseInputSchema,
  outputSchema: resolveSupportCaseInputSchema,
  execute: async ({ inputData, mastra, requestContext, tracingContext }) => {
    const { supportCase, turn, ownerId } = await getActiveCaseOrThrow(inputData.caseId, inputData.turnId);
    const latestMessage = turn.message!;
    if (!mastra) throw new Error('The resolve workflow must run through a registered Mastra instance.');
    const traceId = tracingContext?.currentSpan?.traceId;
    if (traceId) {
      await caseStore.update(supportCase.id, { traceId });
      await caseStore.recordTurnTelemetry(supportCase.id, inputData.turnId, {
        traceId,
        workflowRunId: supportCase.workflowRunId,
      });
    }
    const stagingCancellation = isStagingIntercomStripeCase(supportCase);
    const result = await mastra.getAgent('triageAgent').generate(
      [
        {
          role: 'user',
          content: `Subject: ${supportCase.subject}\n\nMessage:\n${latestMessage.body}`,
        },
      ],
      {
        structuredOutput: {
          schema: stagingCancellation ? stagingTriageSchema : triageResultSchema,
        },
        ...(stagingCancellation ? { system: stagingCancellationSystem } : {}),
        memory: {
          thread: threadIdForCase(supportCase.id, bindingsForPersistedCase(supportCase).support.tenantId),
          resource: resourceIdForOwner(ownerId, bindingsForPersistedCase(supportCase).support.tenantId),
        },
        requestContext,
        tracingContext,
      },
    );
    const triageUsage = result.usage;
    const stagingStructured = stagingCancellation ? stagingTriageSchema.parse(result.object) : undefined;
    const structured = stagingStructured ?? triageResultSchema.parse(result.object);
    const { stagingCancellationInterpretation: _staleInterpretation, ...metadataWithoutInterpretation } =
      supportCase.metadata;
    const metadata = stagingStructured
      ? stagingStructured.cancellationInterpretation
        ? {
            ...metadataWithoutInterpretation,
            stagingCancellationInterpretation: {
              ...stagingStructured.cancellationInterpretation,
              turnId: turn.id,
              messageId: latestMessage.id,
              messageHash: cancellationMessageHash(latestMessage.body),
              binding: bindingsForPersistedCase(supportCase).transactions,
              interpretedAt: new Date().toISOString(),
            },
          }
        : metadataWithoutInterpretation
      : supportCase.metadata;
    await caseStore.update(supportCase.id, {
      triage: triageResultSchema.parse(structured),
      ...(stagingStructured ? { metadata } : {}),
      status: 'processing',
      agentUsage: {
        inputTokens: triageUsage.inputTokens ?? 0,
        outputTokens: triageUsage.outputTokens ?? 0,
        model: (result as { response?: { modelId?: string } }).response?.modelId,
      },
    });
    return { caseId: supportCase.id, turnId: inputData.turnId };
  },
});
