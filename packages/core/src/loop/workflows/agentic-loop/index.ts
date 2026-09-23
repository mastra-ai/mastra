import { randomUUID } from 'node:crypto';
import type { StepResult, ToolSet } from '@internal/ai-sdk-v5';
import { AGENT_RESPONSE_RECOVERY_CONTINUATION } from '../../../agent/merge-execution-options';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { MastraDBMessage } from '../../../memory';
import { InternalSpans } from '../../../observability';
import { safeEnqueue } from '../../../stream/base';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createWorkflow as createDirectWorkflow, createEventedWorkflow } from '../../../workflows/create';
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
  let previousCallerVisibleContentLength = rest.resumeContext
    ? messageList.getCallerVisibleResponseContent().length
    : 0;
  // When continue:false + feedback, allow one more LLM turn then stop
  let pendingFeedbackStop = false;
  let responseRecoveryReserved = false;
  // When this loop is a resume (e.g. after tool approval), the suspended run
  // already flushed its in-progress assistant message to storage. The first
  // continuation must start a fresh response message instead of merging into
  // that persisted row — see the guard in the dowhile below (issue #19445).
  let isResumeContinuationPending = !!rest.resumeContext;

  const agenticExecutionWorkflow = createAgenticExecutionWorkflow<Tools, OUTPUT>({
    messageId: messageId,
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

  const createWorkflow = process.env.MASTRA_EVENTED_EXECUTION === 'true' ? createEventedWorkflow : createDirectWorkflow;

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
      // Excluding `running` means resume claims cannot persist; the agent loop
      // serializes its own resumes, so suppress the per-resume warning.
      allowUnclaimedResumes: true,
      // Agent-loop snapshots are pure resume artifacts — strip everything a
      // resume never reads (stale suspend payloads, duplicated message
      // arrays, AI SDK step history) before persisting.
      pruneSnapshot: pruneAgentLoopSnapshot,
      validateInputs: false,
    },
  })
    .dowhile(agenticExecutionWorkflow, async ({ inputData }) => {
      const typedInputData = inputData as LLMIterationData<Tools, OUTPUT> | undefined;
      // A nested run that settles non-success can resolve this workflow's
      // output as undefined (PF-4386): the parent executor then miscasts it
      // as { status: 'success', output: undefined } and this condition would
      // dereference typedInputData.messages inside consumeStream — killing
      // the loop with a TypeError and leaving the turn a silent zombie.
      // Reject malformed iteration output as a workflow error instead so the
      // turn surfaces a truthful failure.
      if (typedInputData?.messages === undefined || typedInputData?.output === undefined) {
        throw new MastraError({
          id: 'MASTRA_AGENTIC_LOOP_ITERATION_OUTPUT_MISSING',
          text: `Agentic execution workflow resolved an iteration for run '${runId}' without iteration output`,
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
        });
      }
      const abortWon = rest.options?.abortSignal?.aborted === true;
      if (abortWon) {
        typedInputData.terminalToolResult = undefined;
        if (typedInputData.stepResult) {
          typedInputData.stepResult.reason = 'abort';
          typedInputData.stepResult.isContinued = false;
        }
      }
      let hasFinishedSteps = abortWon;

      // First loop-back after a resume: the suspended run flushed its
      // in-progress assistant message (reasoning + text + the pending
      // tool-call) to storage before parking. The approved tool result has
      // now attached to that same message — which is correct, it resolves the
      // message's own tool call — but everything the model produces from here
      // is a separate response and must NOT merge back into the persisted row.
      // Appending a second response's parts mutates the row in place, and
      // providers that sign reasoning blocks (Anthropic extended thinking)
      // then reject the next turn ("thinking blocks in the latest assistant
      // message cannot be modified"). Seal the flushed message and rotate to a
      // fresh response message for the continuation. See issue #19445.
      if (isResumeContinuationPending) {
        isResumeContinuationPending = false;
        const nextMessageId = rest.rotateResponseMessageId(
          typedInputData.stepResult?.messageId ?? typedInputData.messageId,
        );
        typedInputData.messageId = nextMessageId;
        if (typedInputData.stepResult) {
          typedInputData.stepResult.messageId = nextMessageId;
          typedInputData.stepResult.isContinued = true;
        }
      }

      const pendingSignals = abortWon
        ? []
        : (readScoped(scopeCtx, DRAIN_PENDING_SIGNALS_KEY, 'drainPendingSignals')?.(runId) ?? []);
      if (pendingSignals.length > 0) {
        // Signals arriving after the execution workflow settled still win over
        // a terminal candidate. The next provider turn must see them.
        typedInputData.terminalToolResult = undefined;
        // Sealing the flushed response message is what keeps the signal turn out
        // of the previous row; `rotateResponseMessageId` now marks that boundary
        // itself, so pass the id it must seal.
        const nextMessageId = rest.rotateResponseMessageId(
          typedInputData.stepResult?.messageId ?? typedInputData.messageId,
        );
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

      const callerVisibleContent = messageList.getCallerVisibleResponseContent();
      const currentCallerVisibleContent = rest.outputProcessors?.length
        ? []
        : callerVisibleContent.slice(previousCallerVisibleContentLength);
      previousCallerVisibleContentLength = callerVisibleContent.length;

      const toolResultParts = currentContent.filter(part => part.type === 'tool-result');

      // Without output processors, the MessageList slice excludes framework
      // feedback by provenance and preserves approval-resume behavior. With
      // output processors, cumulative caller-visible content is not a stable
      // cursor: a processor may insert, remove, or reorder earlier parts. The
      // completed step's processed content is therefore the sole authority for
      // the current iteration, including an intentionally empty/redacted step.
      const latestCompletedStep = typedInputData.output.steps.at(-1);
      const processedStepText = latestCompletedStep?.content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('');
      const projectedStepText = rest.outputProcessors?.length
        ? (processedStepText ?? '')
        : currentCallerVisibleContent
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('');
      const stepWasRejected =
        typedInputData.stepResult?.reason === 'tripwire' ||
        typedInputData.stepResult?.reason === 'retry' ||
        (latestCompletedStep as { tripwire?: unknown } | undefined)?.tripwire !== undefined;
      const currentIterationText = stepWasRejected ? '' : projectedStepText;

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
        text: currentIterationText,
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

      if (typedInputData.terminalToolResult) {
        hasFinishedSteps = true;
      }

      // Only call stopWhen if we're continuing (not on the final step)
      let customStopWhenMatched = false;
      if (rest.stopWhen && !hasFinishedSteps && typedInputData.stepResult?.isContinued && accumulatedSteps.length > 0) {
        // Cast steps to any for v5/v6 StopCondition compatibility
        // v5 and v6 StepResult types have minor differences (e.g., rawFinishReason, finishReason format)
        // but are compatible at runtime for stop condition evaluation
        const steps = accumulatedSteps as any;
        const conditions = await Promise.all(
          (Array.isArray(rest.stopWhen) ? rest.stopWhen : [rest.stopWhen]).map(condition => {
            return condition({ steps });
          }),
        );

        const matchedStopConditionIndexes = conditions.flatMap((condition, index) => (condition ? [index] : []));
        const maxStepsConditionMatched = rest.maxSteps !== undefined && accumulatedSteps.length >= rest.maxSteps;
        // The loop prepends its internal maxSteps condition before caller
        // conditions. Recovery may cross only that ordinary ceiling; any later
        // matching condition is a caller-owned hard stop.
        customStopWhenMatched = matchedStopConditionIndexes.some(index => !maxStepsConditionMatched || index > 0);
        hasFinishedSteps = hasFinishedSteps || matchedStopConditionIndexes.length > 0;
      }

      // Call onIterationComplete hook if provided (call for every iteration, not just continued ones)
      if (rest.onIterationComplete && !typedInputData.backgroundTaskPending) {
        const isFinal = !typedInputData.stepResult?.isContinued || hasFinishedSteps;
        const iterationContext = {
          iteration: accumulatedSteps.length,
          maxIterations: rest.maxSteps,
          text: currentStep.text,
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
          const reservesResponseRecovery =
            !customStopWhenMatched &&
            iterationResult?.continue === true &&
            iterationResult[AGENT_RESPONSE_RECOVERY_CONTINUATION] === true &&
            rest.maxSteps !== undefined &&
            rest.recoveryMaxSteps !== undefined &&
            accumulatedSteps.length >= rest.maxSteps &&
            accumulatedSteps.length < rest.maxSteps + rest.recoveryMaxSteps;

          // A terminal tool result is already the caller-visible answer. The
          // callback may observe that iteration, but its continuation feedback
          // must not become a hidden synthetic assistant message that appears
          // only in persisted history.
          if (iterationResult && !typedInputData.terminalToolResult) {
            if (iterationResult.feedback && typedInputData.stepResult?.isContinued && !reservesResponseRecovery) {
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
              } else if (!hasFinishedSteps && rest.maxSteps !== undefined && accumulatedSteps.length < rest.maxSteps) {
                hasFinishedSteps = false;
                typedInputData.stepResult.isContinued = true;
              }
            } else if (iterationResult.continue === false && !hasFinishedSteps) {
              hasFinishedSteps = true;
            } else if (
              iterationResult.continue === true &&
              (hasFinishedSteps || !typedInputData.stepResult?.isContinued)
            ) {
              // Forced continuation from a FINISHED state (the model returned
              // stop, or a stop condition fired). Setting the flags alone is
              // not enough: the finished iteration's response message is
              // closed, so the resumed provider call needs the same boundary
              // bookkeeping the pending-signals path performs above —
              // otherwise the loop re-enters against a sealed message and the
              // extra turn produces nothing caller-visible (live-diagnosed as
              // the silent-turn nudge failing to surface any text).
              if (rest.maxSteps === undefined || accumulatedSteps.length < rest.maxSteps || reservesResponseRecovery) {
                if (iterationResult.feedback) {
                  messageList.add(
                    {
                      id: rest.mastra?.generateId() || randomUUID(),
                      createdAt: new Date(),
                      type: 'text',
                      role: 'assistant',
                      content: {
                        parts: [{ type: 'text', text: iterationResult.feedback }],
                        metadata: {
                          mode: 'stream',
                          completionResult: { suppressFeedback: true },
                        },
                        format: 2,
                      },
                    } as MastraDBMessage,
                    'response',
                  );
                }
                // `turnContinues`: unlike the signal path above, nothing from the
                // user separates the sealed message from the one the resumed call
                // writes into. Both halves are the same caller-visible answer, so
                // the run's final text must be read across the pair.
                messageList.markResponseMessageBoundary(
                  typedInputData.stepResult?.messageId ?? typedInputData.messageId,
                  { turnContinues: true },
                );
                const forcedContinuationMessageId = rest.rotateResponseMessageId();
                typedInputData.messageId = forcedContinuationMessageId;
                hasFinishedSteps = false;
                if (typedInputData.stepResult) {
                  typedInputData.stepResult.messageId = forcedContinuationMessageId;
                  typedInputData.stepResult.isContinued = true;
                }
                typedInputData.messages = {
                  all: messageList.get.all.aiV5.model(),
                  user: messageList.get.input.aiV5.model(),
                  nonUser: messageList.get.response.aiV5.model(),
                };
                responseRecoveryReserved = reservesResponseRecovery;
              }
            }
          }
        } catch (error) {
          // Log error but don't fail the iteration
          rest.logger?.error('Error in onIterationComplete hook:', error);
        }
      }

      // The hook above may reserve one framework-owned response-only call at
      // the exact ordinary maxSteps boundary. `maxSteps` still fences every
      // natural/scorer/background/configured continuation; only a hook-forced
      // continuation from an otherwise terminal iteration may cross it.
      let forcedResponseOnlyContinuation = responseRecoveryReserved && typedInputData.stepResult?.isContinued === true;
      responseRecoveryReserved = false;
      if (forcedResponseOnlyContinuation) {
        // The AI-SDK-compatible maxSteps stop condition already marked this
        // iteration complete before the hook ran. Clear only that boundary so
        // the callback-reserved response call can enter the workflow once.
        hasFinishedSteps = false;
      }

      // Check if a delegation hook called ctx.bail() — stop the loop after this iteration
      if (!hasFinishedSteps && readScoped(scopeCtx, DELEGATION_BAILED_KEY, '_delegationBailed')) {
        hasFinishedSteps = true;
        writeScoped(scopeCtx, DELEGATION_BAILED_KEY, '_delegationBailed', false);
      }

      // A callback can abort after the predicate's entry check. Re-check at
      // the caller-visible commit point so terminal output never wins that
      // race or reaches persistence through the final stream state.
      if (rest.options?.abortSignal?.aborted) {
        typedInputData.terminalToolResult = undefined;
        forcedResponseOnlyContinuation = false;
        hasFinishedSteps = true;
        if (typedInputData.stepResult) {
          typedInputData.stepResult.reason = 'abort';
          typedInputData.stepResult.isContinued = false;
        }
      }

      // Terminal tool results are a hard stop. User callbacks may observe the
      // terminal iteration but cannot spend another provider call by forcing it
      // to continue.
      if (typedInputData.terminalToolResult) {
        forcedResponseOnlyContinuation = false;
        hasFinishedSteps = true;
      }

      if (typedInputData.stepResult) {
        typedInputData.stepResult.isContinued = hasFinishedSteps ? false : typedInputData.stepResult.isContinued;
      }

      // Emit step-finish for all cases except tripwire without any steps
      // When tripwire happens but we have steps (e.g., max retries exceeded), we still
      // need to emit step-finish so the stream properly finishes with all step data
      const hasSteps = (typedInputData.output?.steps?.length ?? 0) > 0;
      const shouldEmitStepFinish = typedInputData.stepResult?.reason !== 'tripwire' || hasSteps;

      // A terminal iteration is finalized by workflowLoopStream only after the
      // workflow transition has committed. Evented condition evaluation can be
      // replayed when publishing that transition fails; publishing either the
      // terminal answer or its step-finish here would duplicate caller-visible
      // output before the workflow has actually reached its terminal state.
      if (shouldEmitStepFinish && !typedInputData.terminalToolResult) {
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

      return forcedResponseOnlyContinuation || (typedInputData.stepResult?.isContinued ?? false);
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
