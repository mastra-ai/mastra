import { randomUUID } from 'node:crypto';
import type { StepResult, ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../../memory';
import { InternalSpans } from '../../../observability';
import { safeEnqueue } from '../../../stream/base';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createWorkflow } from '../../../workflows/create';
import type { OutputWriter } from '../../../workflows/types';
import type { RunScopeContext } from '../../run-scope-access';
import { readScoped, writeScoped } from '../../run-scope-access';
import { DELEGATION_BAILED_KEY, DRAIN_PENDING_SIGNALS_KEY, RESOURCE_ID_KEY, THREAD_ID_KEY } from '../../run-scope-keys';
import type { LoopRun } from '../../types';
import { createAgenticExecutionWorkflow } from '../agentic-execution';
import { pruneAgentLoopSnapshot } from '../prune-snapshot';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';

interface AgenticLoopParams<Tools extends ToolSet = ToolSet, OUTPUT = undefined> extends LoopRun<Tools, OUTPUT> {
  controller: ReadableStreamDefaultController<ChunkType<OUTPUT>>;
  outputWriter: OutputWriter;
}

export function createAgenticLoopWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  params: AgenticLoopParams<Tools, OUTPUT>,
) {
  const {
    models,
    _internal,
    messageId,
    runId,
    toolChoice,
    messageList,
    modelSettings,
    controller,
    outputWriter,
    ...rest
  } = params;

  const scopeCtx: RunScopeContext = { mastra: rest.mastra, runId, _internal };

  // Track accumulated steps across iterations to pass to stopWhen
  const accumulatedSteps: StepResult<Tools>[] = [];
  // Track previous content to determine what's new in each step
  let previousContentLength = 0;
  // When continue:false + feedback, allow one more LLM turn then stop
  let pendingFeedbackStop = false;

  const agenticExecutionWorkflow = createAgenticExecutionWorkflow<Tools, OUTPUT>({
    messageId: messageId!,
    models,
    _internal,
    modelSettings,
    toolChoice,
    controller,
    outputWriter,
    messageList,
    runId,
    ...rest,
  });

  return createWorkflow({
    id: 'agentic-loop',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    options: {
      tracingPolicy: {
        // mark all workflow spans related to the
        // VNext execution as internal
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: params => {
        // We need a persisted snapshot record to support `resumeStream()`.
        // - Create the initial record early ("pending")
        // - Update it when execution is suspended ("paused"/"suspended")
        // Avoid persisting "running" snapshots so we don't overwrite an existing suspended snapshot.
        return (
          params.workflowStatus === 'pending' ||
          params.workflowStatus === 'paused' ||
          params.workflowStatus === 'suspended'
        );
      },
      // Agent-loop snapshots are pure resume artifacts — strip everything a
      // resume never reads (stale suspend payloads, duplicated message
      // arrays, AI SDK step history) before persisting.
      pruneSnapshot: pruneAgentLoopSnapshot,
      validateInputs: false,
    },
  })
    .dowhile(agenticExecutionWorkflow, async ({ inputData }) => {
      const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
      let hasFinishedSteps = false;

      const pendingSignals = readScoped(scopeCtx, DRAIN_PENDING_SIGNALS_KEY, 'drainPendingSignals')?.(runId) ?? [];
      if (pendingSignals.length > 0) {
        messageList.markResponseMessageBoundary(typedInputData.stepResult?.messageId ?? typedInputData.messageId);

        const nextMessageId = rest.rotateResponseMessageId();
        typedInputData.messageId = nextMessageId;
        for (const pendingSignal of pendingSignals) {
          const signalForTranscript = messageList.addSignal(pendingSignal);
          safeEnqueue(controller, signalForTranscript.toDataPart() as any);
        }
        if (typedInputData.stepResult) {
          typedInputData.stepResult.messageId = nextMessageId;
          typedInputData.stepResult.isContinued = true;
        }
        typedInputData.messages = {
          all: messageList.get.all.aiV5.model(),
          user: messageList.get.input.aiV5.model(),
          nonUser: messageList.get.response.aiV5.model(),
        };
      }

      if (pendingFeedbackStop) {
        hasFinishedSteps = true;
        pendingFeedbackStop = false;
      }

      const allContent: StepResult<Tools>['content'] = typedInputData.messages.nonUser.flatMap(
        message => message.content as unknown as StepResult<Tools>['content'],
      );

      // Only include new content in this step (content added since the previous iteration)
      const currentContent = allContent.slice(previousContentLength);
      previousContentLength = allContent.length;

      const toolResultParts = currentContent.filter(part => part.type === 'tool-result');

      const currentStep: StepResult<Tools> = {
        content: currentContent,
        usage: typedInputData.output.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        // we need to cast this because we add 'tripwire' and 'retry' for processor scenarios
        finishReason: (typedInputData.stepResult?.reason || 'unknown') as StepResult<Tools>['finishReason'],
        warnings: typedInputData.stepResult?.warnings || [],
        request: typedInputData.metadata?.request || {},
        response: {
          ...typedInputData.metadata,
          modelId: typedInputData.metadata?.modelId || typedInputData.metadata?.model || '',
          messages: [],
        } as StepResult<Tools>['response'],
        text: typedInputData.output.text || '',
        reasoning: typedInputData.output.reasoning || [],
        reasoningText: typedInputData.output.reasoningText || '',
        files: typedInputData.output.files || [],
        toolCalls: typedInputData.output.toolCalls || [],
        toolResults: toolResultParts as StepResult<Tools>['toolResults'],
        sources: typedInputData.output.sources || [],
        staticToolCalls: typedInputData.output.staticToolCalls || [],
        dynamicToolCalls: typedInputData.output.dynamicToolCalls || [],
        staticToolResults: toolResultParts.filter(
          (part: any) => part.dynamic === false,
        ) as StepResult<Tools>['staticToolResults'],
        dynamicToolResults: toolResultParts.filter(
          (part: any) => part.dynamic === true,
        ) as StepResult<Tools>['dynamicToolResults'],
        providerMetadata: typedInputData.metadata?.providerMetadata,
      };

      accumulatedSteps.push(currentStep);

      // Only call stopWhen if we're continuing (not on the final step)
      if (rest.stopWhen && typedInputData.stepResult?.isContinued && accumulatedSteps.length > 0) {
        // Cast steps to any for v5/v6 StopCondition compatibility
        // v5 and v6 StepResult types have minor differences (e.g., rawFinishReason, finishReason format)
        // but are compatible at runtime for stop condition evaluation
        const steps = accumulatedSteps as any;
        const conditions = await Promise.all(
          (Array.isArray(rest.stopWhen) ? rest.stopWhen : [rest.stopWhen]).map(condition => {
            return condition({ steps });
          }),
        );

        const hasStopped = conditions.some(condition => condition);
        hasFinishedSteps = hasFinishedSteps || hasStopped;
      }

      // Call onIterationComplete hook if provided (call for every iteration, not just continued ones)
      if (rest.onIterationComplete && !typedInputData.backgroundTaskPending) {
        const isFinal = !typedInputData.stepResult?.isContinued || hasFinishedSteps;
        const iterationContext = {
          iteration: accumulatedSteps.length,
          maxIterations: rest.maxSteps,
          text: typedInputData.output.text || '',
          toolCalls: (typedInputData.output.toolCalls || []).map((tc: any) => ({
            id: tc.toolCallId || tc.id || '',
            name: tc.toolName || tc.name || '',
            args: (tc.args || {}) as Record<string, unknown>,
          })),
          toolResults: toolResultParts.map(tr => ({
            id: tr.toolCallId,
            name: tr.toolName,
            result: unwrapToolResultOutput(tr.output),
          })),
          isFinal,
          finishReason: typedInputData.stepResult?.reason || 'unknown',
          runId: runId,
          threadId: readScoped(scopeCtx, THREAD_ID_KEY, 'threadId'),
          resourceId: readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId'),
          agentId: rest.agentId,
          agentName: rest.agentName || rest.agentId,
          messages: messageList.get.all.db(),
        };

        try {
          const iterationResult = await rest.onIterationComplete(iterationContext);

          if (iterationResult) {
            if (iterationResult.feedback && typedInputData.stepResult?.isContinued) {
              messageList.add(
                {
                  id: rest.mastra?.generateId() || randomUUID(),
                  createdAt: new Date(),
                  type: 'text',
                  role: 'assistant',
                  content: {
                    parts: [
                      {
                        type: 'text',
                        text: iterationResult.feedback,
                      },
                    ],
                    metadata: {
                      mode: 'stream',
                      completionResult: {
                        suppressFeedback: true,
                      },
                    },
                    format: 2,
                  },
                } as MastraDBMessage,
                'response',
              );

              if (iterationResult.continue === false) {
                pendingFeedbackStop = true;
              } else if (!hasFinishedSteps && rest.maxSteps && accumulatedSteps.length < rest.maxSteps) {
                hasFinishedSteps = false;
                typedInputData.stepResult.isContinued = true;
              }
            } else if (iterationResult.continue === false && !hasFinishedSteps) {
              hasFinishedSteps = true;
            } else if (
              iterationResult.continue === true &&
              (hasFinishedSteps || !typedInputData.stepResult?.isContinued)
            ) {
              if ((rest.maxSteps && accumulatedSteps.length < rest.maxSteps) || !rest.maxSteps) {
                hasFinishedSteps = false;
                if (typedInputData.stepResult) {
                  typedInputData.stepResult.isContinued = true;
                }
              }
            }
          }
        } catch (error) {
          // Log error but don't fail the iteration
          rest.logger?.error('Error in onIterationComplete hook:', error);
        }
      }

      // Check if a delegation hook called ctx.bail() — stop the loop after this iteration
      if (!hasFinishedSteps && readScoped(scopeCtx, DELEGATION_BAILED_KEY, '_delegationBailed')) {
        hasFinishedSteps = true;
        writeScoped(scopeCtx, DELEGATION_BAILED_KEY, '_delegationBailed', false);
      }

      if (typedInputData.stepResult) {
        typedInputData.stepResult.isContinued = hasFinishedSteps ? false : typedInputData.stepResult.isContinued;
      }

      // Emit step-finish for all cases except tripwire without any steps
      // When tripwire happens but we have steps (e.g., max retries exceeded), we still
      // need to emit step-finish so the stream properly finishes with all step data
      const hasSteps = (typedInputData.output?.steps?.length ?? 0) > 0;
      const shouldEmitStepFinish = typedInputData.stepResult?.reason !== 'tripwire' || hasSteps;

      if (shouldEmitStepFinish) {
        await outputWriter({
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: typedInputData,
        });
      }

      const reason = typedInputData.stepResult?.reason;

      if (reason === undefined) {
        return false;
      }

      return typedInputData.stepResult?.isContinued ?? false;
    })
    .commit();
}

function unwrapToolResultOutput(output: unknown): unknown {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return output;
  }

  const record = output as Record<string, unknown>;
  if (!('value' in record)) {
    return output;
  }

  switch (record.type) {
    case 'text':
    case 'json':
    case 'error-text':
    case 'error-json':
    case 'content':
      return record.value;
    default:
      return output;
  }
}
