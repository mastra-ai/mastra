import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { SpanType, type TracingContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import type { ToolObserve } from '@mastra/core/tools';
import { createStep } from '@mastra/core/workflows';

import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { systemClock, type Clock } from '../../domain/clock.js';
import { DomainError } from '../../domain/errors.js';
import { uuidGenerator, type IdGenerator } from '../../domain/id-generator.js';
import {
  BranchResultSchema,
  EvidenceProviderInputSchema,
  EvidenceToolOutputSchema,
  InvestigationContextSchema,
  type EvidenceProviderInput,
  type EvidenceSourceV1,
} from '../../evidence/contracts.js';
import { persistEvidenceItems } from '../../evidence/persistence.js';
import {
  generateWithOneSchemaRetry,
  InvestigatorOutputSchema,
  type InvestigatorInvoker,
} from '../agents/investigator-output.js';
import { projectFactsForPrompt } from '../agents/prompt-safe-evidence.js';
import type { EvidenceReadTool } from '../tools/evidence-read-tool.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';
import { readWorkflowTrace } from '../workflow-trace.js';
import { startWorkflowBoundary } from '../observability.js';

export type GatherDependencies<Source extends EvidenceSourceV1> = Readonly<{
  openStore?: () => OperationalStore;
  tool: EvidenceReadTool & Readonly<{ __source?: Source }>;
  investigator: InvestigatorInvoker;
  timeoutMs?: number;
  toolObserve?: ToolObserve;
  clock?: Clock;
  monotonicNow?: () => number;
  ids?: IdGenerator;
}>;

export function createGatherEvidenceStep<Source extends EvidenceSourceV1>(
  source: Source,
  dependencies: GatherDependencies<Source>,
) {
  const stepId = `gather-${source}-evidence` as const;
  return createStep({
    id: stepId,
    description: `Collects and persists ${source} evidence within a bounded read-only scope.`,
    inputSchema: InvestigationContextSchema,
    outputSchema: BranchResultSchema,
    execute: async ({ inputData, abortSignal, tracingContext }) => {
      const clock = dependencies.clock ?? systemClock;
      const monotonicNow = dependencies.monotonicNow ?? (() => performance.now());
      const startedAt = clock.now();
      const startedMonotonic = monotonicNow();
      const toolCallId = `tc_${createHash('sha256')
        .update(`${inputData.workflowRunId}:${source}`, 'utf8')
        .digest('hex')}`;
      // Start the gather interval before its provider/tool/agent work begins.
      // The three workflow branches run concurrently, so their persisted
      // boundary timing must evidence overlap rather than merely a shared
      // parent or start-order.
      const gatherStore = (dependencies.openStore ?? createLibSqlOperationalStore)();
      try {
        const gatherContext = await readWorkflowTrace(gatherStore, {
          tenantId: inputData.tenantId,
          incidentId: inputData.incidentId,
          workflowRunId: inputData.workflowRunId,
        });
        const gatherTrace = startWorkflowBoundary({
          boundary: `gather.${source}` as const,
          tenantId: inputData.tenantId,
          incidentId: inputData.incidentId,
          runId: inputData.workflowRunId,
          correlationId: inputData.correlationId,
          requestId: gatherContext?.requestId ?? inputData.workflowRunId,
          ...(gatherContext ? { context: gatherContext } : {}),
          identifiers: {
            stepId,
            toolCallId,
            provider: `${source}-read-tool`,
          },
        });
        try {
          const request = {
            tenantId: inputData.tenantId,
            incidentId: inputData.incidentId,
            subjectId: inputData.subjectId,
            workflowRunId: inputData.workflowRunId,
            incidentKind: inputData.incidentKind,
            occurredAt: inputData.occurredAt,
            ...(inputData.sessionId ? { sessionId: inputData.sessionId } : {}),
            ...(inputData.deviceId ? { deviceId: inputData.deviceId } : {}),
            ...(inputData.ip ? { ip: inputData.ip } : {}),
            ...(inputData.actorId ? { actorId: inputData.actorId } : {}),
            ...(inputData.roleChange ? { roleChange: inputData.roleChange } : {}),
            ...(inputData.changeApproved === undefined ? {} : { changeApproved: inputData.changeApproved }),
          };
          const parsedRequest = EvidenceProviderInputSchema.parse(request);
          const executeTool = dependencies.tool.execute;
          if (!executeTool || dependencies.tool.id !== `${source}-read-tool`) throw new DomainError('CONFLICT');
          const toolOutput = EvidenceToolOutputSchema.parse(
            await executeTool(parsedRequest, {
              requestContext: trustedRequestContext(parsedRequest),
              abortSignal,
              observe:
                dependencies.toolObserve ??
                workflowToolObserve(tracingContext, {
                  tenantId: inputData.tenantId,
                  incidentId: inputData.incidentId,
                  runId: inputData.workflowRunId,
                  correlationId: inputData.correlationId,
                  stepId,
                  source,
                  toolId: dependencies.tool.id,
                }),
              ...(tracingContext ? { tracing: tracingContext, tracingContext } : {}),
              agent: {
                agentId: `${source}-investigator`,
                toolCallId,
                messages: [],
                suspend: async () => undefined,
              },
            }),
          );
          if (toolOutput.result.status !== 'success') {
            return await failedBranch(toolOutput.result.error);
          }
          const successfulResult = toolOutput.result;
          if (new Set(successfulResult.facts.map(fact => fact.semanticKey)).size !== successfulResult.facts.length) {
            return await failedBranch({
              code: 'INVALID_RESPONSE',
              retryable: false,
              safeRef: `provider:${source}-investigator:duplicate-key`,
              attempt: 1,
            });
          }
          const promptFacts = projectFactsForPrompt(
            successfulResult.facts.map(fact => ({
              semanticKey: fact.semanticKey,
              factType: fact.factType,
              value: fact.value,
              sensitivity: fact.sensitivity,
            })),
          );
          const traceStore = (dependencies.openStore ?? createLibSqlOperationalStore)();
          let agentResult;
          try {
            agentResult = await withinWorkflowBoundary(
              traceStore,
              {
                tenantId: inputData.tenantId,
                incidentId: inputData.incidentId,
                workflowRunId: inputData.workflowRunId,
                correlationId: inputData.correlationId,
                boundary: `agent.${source}` as const,
                stepId,
                toolCallId,
                provider: `${source}-investigator`,
                // The three gather branches deliberately share workflow.start.
                advance: false,
              },
              () =>
                generateWithOneSchemaRetry(
                  attempt => dependencies.investigator({ facts: promptFacts }, attempt, abortSignal),
                  InvestigatorOutputSchema,
                ),
            ).catch((error: unknown) => ({
              status: 'operational' as const,
              error,
            }));
          } finally {
            traceStore.close();
          }
          if (agentResult.status === 'operational')
            return await failedBranch(agentOperationalFailure(source, agentResult.error, abortSignal));
          if (
            agentResult.status !== 'success' ||
            !citesExactly(
              agentResult.status === 'success' ? agentResult.output.citedFactTokens : [],
              promptFacts.map(fact => fact.factToken),
            )
          ) {
            return await failedBranch({
              code: 'INVALID_RESPONSE',
              retryable: false,
              safeRef: `provider:${source}-investigator:attempt-2`,
              attempt: 2,
            });
          }
          const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
          try {
            const evidence = await persistEvidenceItems(
              store,
              {
                context: inputData,
                source,
                provider: successfulResult.provider,
                facts: successfulResult.facts,
              },
              {
                ...(dependencies.clock ? { clock: dependencies.clock } : {}),
                ids: dependencies.ids ?? uuidGenerator,
              },
            );
            const finishedAt = clock.now();
            gatherTrace.span.end({ attributes: { success: true } as never });
            return BranchResultSchema.parse({
              source,
              status: evidence.some(item => item.incomplete) ? 'partial' : 'success',
              evidenceIds: evidence.map(item => item.evidenceId),
              startedAt,
              finishedAt,
              latencyMs: Math.max(0, Math.round(monotonicNow() - startedMonotonic)),
              stepId,
              toolCallIds: [toolCallId],
            });
          } finally {
            store.close();
          }

          async function failedBranch(error: {
            code: 'NOT_FOUND' | 'TIMEOUT' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'INVALID_RESPONSE' | 'ABORTED';
            retryable: boolean;
            safeRef: string;
            attempt: number;
          }) {
            const finishedAt = clock.now();
            gatherTrace.span.end({ attributes: { success: false } as never });
            return BranchResultSchema.parse({
              source,
              status: 'failed',
              evidenceIds: [],
              error,
              startedAt,
              finishedAt,
              latencyMs: Math.max(0, Math.round(monotonicNow() - startedMonotonic)),
              stepId,
              toolCallIds: [toolCallId],
            });
          }
        } catch (error) {
          gatherTrace.span.end({ attributes: { success: false } as never });
          throw error;
        }
      } finally {
        gatherStore.close();
      }
    },
  });
}

function trustedRequestContext(request: EvidenceProviderInput) {
  const context = new RequestContext<EvidenceProviderInput>();
  context.set('tenantId', request.tenantId);
  context.set('incidentId', request.incidentId);
  context.set('subjectId', request.subjectId);
  context.set('workflowRunId', request.workflowRunId);
  context.set('incidentKind', request.incidentKind);
  context.set('occurredAt', request.occurredAt);
  if (request.sessionId) context.set('sessionId', request.sessionId);
  if (request.deviceId) context.set('deviceId', request.deviceId);
  if (request.ip) context.set('ip', request.ip);
  if (request.actorId) context.set('actorId', request.actorId);
  if (request.roleChange) context.set('roleChange', request.roleChange);
  if (request.changeApproved !== undefined) context.set('changeApproved', request.changeApproved);
  return context;
}

function workflowToolObserve(
  tracingContext: TracingContext | undefined,
  scope: {
    tenantId: string;
    incidentId: string;
    runId: string;
    correlationId: string;
    stepId: string;
    source: EvidenceSourceV1;
    toolId: string;
  },
): ToolObserve {
  return {
    span: async (name, fn, attributes) => {
      const span = tracingContext?.currentSpan?.createChildSpan({
        name,
        type: SpanType.TOOL_CALL,
        attributes: {
          toolType: typeof attributes?.toolType === 'string' ? attributes.toolType : 'function',
          ...(typeof attributes?.toolCallId === 'string' ? { toolCallId: attributes.toolCallId } : {}),
          ...scope,
        },
      });
      if (!span) return fn();
      try {
        const output = await span.executeInContext(async () => fn());
        span.end({ attributes: { success: true } });
        return output;
      } catch (error) {
        span.error({
          error: error instanceof Error ? error : new Error('Tool failed'),
          endSpan: true,
        });
        throw error;
      }
    },
    log: () => undefined,
  };
}

function agentOperationalFailure(source: EvidenceSourceV1, error: unknown, signal?: AbortSignal) {
  const description = error instanceof Error ? `${error.name}:${error.message}`.toLowerCase() : 'unknown';
  const code = signal?.aborted
    ? ('ABORTED' as const)
    : /timeout|timed out/u.test(description)
      ? ('TIMEOUT' as const)
      : /rate.?limit/u.test(description)
        ? ('RATE_LIMITED' as const)
        : ('UNAVAILABLE' as const);
  return {
    code,
    retryable: false,
    safeRef: `provider:${source}-investigator:operational-error`,
    attempt: 1,
  };
}

function citesExactly(cited: readonly string[], available: readonly string[]): boolean {
  const sortedCited = [...new Set(cited)].sort();
  const sortedAvailable = [...new Set(available)].sort();
  return (
    sortedCited.length === cited.length &&
    sortedCited.length === sortedAvailable.length &&
    sortedCited.every((key, index) => key === sortedAvailable[index])
  );
}
