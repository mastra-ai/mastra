import type { MastraDBMessage, MastraMessagePart } from '../agent/message-list/state/types';
import type { AgentThreadSubscription } from '../agent/types';
import { getErrorFromUnknown } from '../error';
import type { RequestContext } from '../request-context';
import { getTransformedToolPayload, hasTransformedToolPayload } from '../tools/payload-transform';
import type { Session, SessionMachinery } from './session';
import {
  addOptionalUsageField,
  describeNonSuccessFinishReason,
  describeServerSideFallback,
  getDisplayTransform,
  getUsageNumber,
} from './stream-content';
import type { TokenUsage } from './types';

/**
 * The transient state of a single in-flight agent stream: the assistant message
 * being assembled, content indices for streaming deltas, and suspend/terminal
 * flags. One per run; recreated per run within a subscribed thread stream.
 */
type StreamState = {
  currentMessage: MastraDBMessage;
  lastFinishedMessage?: MastraDBMessage;
  isSuspended: boolean;
  textContentById: Map<string, { index: number; text: string }>;
  thinkingContentById: Map<string, { index: number; text: string }>;
  toolPartById: Map<string, number>;
  /**
   * Set when a stream ends on a non-success finish reason (e.g. `content-filter`,
   * `error`, `length`). Carries the user-facing message so the run finalizes
   * into an explicit terminal error state instead of silently completing.
   */
  terminalError?: string;
};

/**
 * The per-session agent run engine: it consumes an agent's event stream, folds
 * each chunk into the session's display messages and token usage, drives tool
 * approval/suspension, and finalizes the run. In the multi-user host the run
 * loop, run state, and thread stream are per-session and cannot be shared, so
 * they live on the Session — this engine is owned by exactly one Session.
 *
 * It reaches the host only through the narrow {@link SessionMachinery} it is
 * constructed with (resolve the agent, build run/stream options, persist usage,
 * drive tool approval/resume, drain follow-ups). It never reaches back into the
 * AgentController or another session: all per-run state is read and written on its own
 * {@link Session}.
 */
export class SessionRunEngine {
  readonly #session: Session;
  readonly #machinery: SessionMachinery;

  constructor(session: Session, machinery: SessionMachinery) {
    this.#session = session;
    this.#machinery = machinery;
  }

  private createEmptyAssistantMessage(): MastraDBMessage {
    return {
      id: this.#machinery.generateId(),
      role: 'assistant',
      content: { format: 2, parts: [] },
      createdAt: new Date(),
    };
  }

  /**
   * Build a DB-native signal message from a streamed `data-signal` /
   * `data-user-message` / `data-system-reminder` chunk. The raw data-part is
   * carried verbatim on `content.parts` and the signal identity is preserved on
   * `content.metadata.signal` so consumers read the native shape (no flattening).
   */
  private createSignalMessage(partType: string, payload: Record<string, unknown>): MastraDBMessage {
    const signalId = typeof payload.id === 'string' ? payload.id : this.#machinery.generateId();
    const createdAt =
      typeof payload.createdAt === 'string' && !Number.isNaN(Date.parse(payload.createdAt))
        ? new Date(payload.createdAt)
        : new Date();
    return {
      id: signalId,
      role: 'signal',
      content: {
        format: 2,
        parts: [{ type: partType, data: payload } as MastraMessagePart],
        metadata: { signal: payload },
      },
      createdAt,
    };
  }

  private hasCurrentMessageContent(state: StreamState): boolean {
    return state.currentMessage.content.parts.length > 0;
  }

  private cloneMessage(message: MastraDBMessage): MastraDBMessage {
    return { ...message, content: { ...message.content, parts: [...message.content.parts] } };
  }

  private setStopReason(message: MastraDBMessage, stopReason: string, force = false): void {
    message.content.metadata ??= {};
    const metadata = message.content.metadata as Record<string, unknown>;
    if (force) {
      metadata.stopReason = stopReason;
    } else {
      metadata.stopReason ??= stopReason;
    }
  }

  private setErrorMessage(message: MastraDBMessage, errorMessage: string): void {
    message.content.metadata ??= {};
    (message.content.metadata as Record<string, unknown>).errorMessage = errorMessage;
  }

  private finishCurrentMessageAndRotate(state: StreamState): void {
    if (!this.hasCurrentMessageContent(state)) return;
    this.setStopReason(state.currentMessage, 'complete');
    this.#session.emit({ type: 'message_end', message: state.currentMessage });
    state.lastFinishedMessage = state.currentMessage;
    state.currentMessage = this.createEmptyAssistantMessage();
    state.textContentById.clear();
    state.thinkingContentById.clear();
    state.toolPartById.clear();
  }

  createStreamState(): StreamState {
    return {
      currentMessage: this.createEmptyAssistantMessage(),
      isSuspended: false,
      textContentById: new Map<string, { index: number; text: string }>(),
      thinkingContentById: new Map<string, { index: number; text: string }>(),
      toolPartById: new Map<string, number>(),
    };
  }

  private abortForOmFailure({ operationType, stage, error }: { operationType: string; stage: string; error: string }) {
    this.#session.emit({
      type: 'error',
      error: new Error(`Observational memory ${operationType} ${stage} failed: ${error}`),
    });
    this.#session.abortRun();
  }

  /**
   * Process a stream response (shared between sendMessage and tool approval).
   */
  async processStream(
    response: { fullStream: AsyncIterable<any> },
    requestContextInput?: RequestContext,
  ): Promise<{ message: MastraDBMessage; suspended?: boolean } | undefined> {
    const state = this.createStreamState();
    const requestContext = await this.#machinery.buildRequestContext(requestContextInput);
    this.#session.run.nextOperation();
    this.#session.emit({ type: 'agent_start' });

    let result: { message: MastraDBMessage; suspended?: boolean } | undefined;
    let error = false;
    let aborted = false;

    for await (const chunk of response.fullStream) {
      result = await this.processStreamChunk(state, chunk, requestContext);
      if (chunk.type === 'error') {
        error = true;
      }
      if (chunk.type === 'abort') {
        aborted = true;
      }
      if (
        result ||
        chunk.type === 'finish' ||
        chunk.type === 'error' ||
        chunk.type === 'abort' ||
        chunk.type === 'tool-call-suspended' ||
        this.#session.run.isAbortRequested()
      ) {
        result ??= this.finishStreamState(state);
        break;
      }
    }

    result ??= this.finishStreamState(state);

    // A non-success terminal finish reason (e.g. a `claude-fable-5`
    // content-filter refusal) is surfaced as an explicit error so the run never
    // silently stops without a visible terminal state.
    if (state.terminalError && !error && !aborted && !this.#session.run.isAbortRequested() && !result.suspended) {
      error = true;
      this.#session.emit({ type: 'error', error: new Error(state.terminalError) });
    }

    this.#session.emit({
      type: 'agent_end',
      reason: error
        ? 'error'
        : result.suspended
          ? 'suspended'
          : aborted || this.#session.run.isAbortRequested()
            ? 'aborted'
            : 'complete',
    });

    this.#session.run.reset();
    await this.#session.drainFollowUpQueue();

    return result;
  }

  async processStreamChunk(
    state: StreamState,
    chunk: any,
    requestContext: RequestContext,
  ): Promise<{ message: MastraDBMessage; suspended?: boolean } | undefined> {
    if ('runId' in chunk && chunk.runId) {
      this.#session.run.setRunId({ runId: chunk.runId });
    }

    switch (chunk.type) {
      case 'text-start': {
        const textIndex = state.currentMessage.content.parts.length;
        state.currentMessage.content.parts.push({ type: 'text', text: '' });
        state.textContentById.set(chunk.payload.id, { index: textIndex, text: '' });
        this.#session.emit({ type: 'message_start', message: this.cloneMessage(state.currentMessage) });
        break;
      }

      case 'text-delta': {
        const textState = state.textContentById.get(chunk.payload.id);
        if (textState) {
          textState.text += chunk.payload.text;
          const textContent = state.currentMessage.content.parts[textState.index];
          if (textContent && textContent.type === 'text') {
            textContent.text = textState.text;
          }
          this.#session.emit({ type: 'message_update', message: this.cloneMessage(state.currentMessage) });
        }
        break;
      }

      case 'reasoning-start': {
        const thinkingIndex = state.currentMessage.content.parts.length;
        state.currentMessage.content.parts.push({ type: 'reasoning', reasoning: '', details: [] });
        state.thinkingContentById.set(chunk.payload.id, { index: thinkingIndex, text: '' });
        this.#session.emit({ type: 'message_update', message: this.cloneMessage(state.currentMessage) });
        break;
      }

      case 'reasoning-delta': {
        const thinkingState = state.thinkingContentById.get(chunk.payload.id);
        if (thinkingState) {
          thinkingState.text += chunk.payload.text;
          const thinkingContent = state.currentMessage.content.parts[thinkingState.index];
          if (thinkingContent && thinkingContent.type === 'reasoning') {
            thinkingContent.reasoning = thinkingState.text;
            thinkingContent.details = [{ type: 'text', text: thinkingState.text }];
          }
          this.#session.emit({ type: 'message_update', message: this.cloneMessage(state.currentMessage) });
        }
        break;
      }

      case 'tool-call-input-streaming-start': {
        const { toolCallId, toolName } = chunk.payload;
        this.#session.emit({ type: 'tool_input_start', toolCallId, toolName });
        break;
      }

      case 'tool-call-delta': {
        const { toolCallId, argsTextDelta, toolName } = chunk.payload;
        const transform = getTransformedToolPayload(chunk.metadata, 'display', 'input-delta');
        if (!transform?.suppress) {
          this.#session.emit({
            type: 'tool_input_delta',
            toolCallId,
            argsTextDelta: hasTransformedToolPayload(transform) ? transform.transformed : argsTextDelta,
            toolName,
          });
        }
        break;
      }

      case 'tool-call-input-streaming-end': {
        const { toolCallId } = chunk.payload;
        this.#session.emit({ type: 'tool_input_end', toolCallId });
        break;
      }

      case 'tool-call': {
        const toolCall = chunk.payload;
        const args = getDisplayTransform(chunk.metadata, 'input-available', toolCall.args);
        const toolIndex = state.currentMessage.content.parts.length;
        state.currentMessage.content.parts.push({
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args,
          },
        });
        state.toolPartById.set(toolCall.toolCallId, toolIndex);
        this.#session.emit({
          type: 'tool_start',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args,
        });
        this.#session.emit({ type: 'message_update', message: this.cloneMessage(state.currentMessage) });
        break;
      }

      case 'tool-result': {
        const toolResult = chunk.payload;
        const providerMetadata = toolResult.providerMetadata as Record<string, unknown> | undefined;
        const result = getDisplayTransform(chunk.metadata, 'output-available', toolResult.result);
        const toolIndex = state.toolPartById.get(toolResult.toolCallId);
        const existing = toolIndex !== undefined ? state.currentMessage.content.parts[toolIndex] : undefined;
        if (existing && existing.type === 'tool-invocation') {
          existing.toolInvocation = {
            ...existing.toolInvocation,
            state: 'result',
            result,
          };
          if (providerMetadata) {
            (existing as { providerMetadata?: unknown }).providerMetadata = providerMetadata;
          }
        } else {
          state.currentMessage.content.parts.push({
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName,
              args: {},
              result,
            },
            ...(providerMetadata ? { providerMetadata: providerMetadata as never } : {}),
          });
        }
        this.#session.emit({
          type: 'tool_end',
          toolCallId: toolResult.toolCallId,
          result,
          isError: toolResult.isError ?? false,
          ...(providerMetadata ? { providerMetadata } : {}),
        });
        this.#session.emit({ type: 'message_update', message: this.cloneMessage(state.currentMessage) });
        break;
      }

      case 'tool-error': {
        const toolError = chunk.payload;
        this.#session.emit({
          type: 'tool_end',
          toolCallId: toolError.toolCallId,
          result: getDisplayTransform(chunk.metadata, 'error', toolError.error),
          isError: true,
        });
        break;
      }

      case 'tool-call-approval': {
        const toolCallId = chunk.payload.toolCallId;
        const toolName = chunk.payload.toolName;
        const approvalTransform = getTransformedToolPayload(chunk.metadata, 'display', 'approval');
        const toolArgs = hasTransformedToolPayload(approvalTransform)
          ? approvalTransform.transformed
          : getDisplayTransform(chunk.metadata, 'input-available', chunk.payload.args);

        const policy = this.#session.resolveToolApproval(toolName);

        if (policy === 'allow') {
          await this.#session.approveToolCall({ toolCallId, requestContext });
          break;
        }

        if (policy === 'deny') {
          await this.#session.declineToolCall({ toolCallId, requestContext });
          break;
        }

        const approvalPromise = this.#session.approval.arm({ toolName, toolCallId });
        this.#session.emit({ type: 'tool_approval_required', toolCallId, toolName, args: toolArgs });

        const approval = await approvalPromise;
        this.#session.approval.clearToolName();

        if (approval.decision === 'approve') {
          await this.#session.approveToolCall({
            toolCallId,
            requestContext: approval.requestContext ?? requestContext,
          });
        } else {
          await this.#session.declineToolCall({
            toolCallId,
            requestContext: approval.requestContext ?? requestContext,
            declineContext: approval.declineContext,
          });
        }
        break;
      }

      case 'tool-call-suspended': {
        const suspToolCallId = chunk.payload.toolCallId;
        const suspToolName = chunk.payload.toolName;
        const suspArgs = getDisplayTransform(chunk.metadata, 'input-available', chunk.payload.args);
        const suspPayload = getDisplayTransform(chunk.metadata, 'suspend', chunk.payload.suspendPayload);
        const suspResumeSchema = chunk.payload.resumeSchema;

        const suspRunId = this.#session.run.getRunId();
        if (suspRunId) {
          this.#session.suspensions.register({
            toolCallId: suspToolCallId,
            runId: suspRunId,
            toolName: suspToolName,
          });
        }
        state.isSuspended = true;

        this.#session.emit({
          type: 'tool_suspended',
          toolCallId: suspToolCallId,
          toolName: suspToolName,
          args: suspArgs,
          suspendPayload: suspPayload,
          resumeSchema: suspResumeSchema,
        });

        break;
      }

      case 'error': {
        const streamError = getErrorFromUnknown(chunk.payload.error);
        this.#session.emit({ type: 'error', error: streamError });
        break;
      }

      case 'step-finish': {
        const usage = chunk.payload?.output?.usage;
        if (usage) {
          const usageRecord = usage as Record<string, unknown>;
          const promptTokens =
            getUsageNumber(usageRecord, 'promptTokens') ?? getUsageNumber(usageRecord, 'inputTokens') ?? 0;
          const completionTokens =
            getUsageNumber(usageRecord, 'completionTokens') ?? getUsageNumber(usageRecord, 'outputTokens') ?? 0;
          const totalTokens = getUsageNumber(usageRecord, 'totalTokens') ?? promptTokens + completionTokens;
          const stepUsage: TokenUsage = {
            promptTokens,
            completionTokens,
            totalTokens,
          };
          addOptionalUsageField(stepUsage, 'reasoningTokens', getUsageNumber(usageRecord, 'reasoningTokens'));
          addOptionalUsageField(stepUsage, 'cachedInputTokens', getUsageNumber(usageRecord, 'cachedInputTokens'));
          addOptionalUsageField(
            stepUsage,
            'cacheCreationInputTokens',
            getUsageNumber(usageRecord, 'cacheCreationInputTokens'),
          );
          if (usageRecord.raw !== undefined) {
            stepUsage.raw = usageRecord.raw;
          }

          this.#session.addUsage(stepUsage);

          this.#machinery.persistTokenUsage().catch(() => {});
          this.#session.emit({ type: 'usage_update', usage: stepUsage });
        }
        break;
      }

      case 'finish': {
        const finishReason = chunk.payload.stepResult?.reason;
        const finishProviderMetadata = chunk.payload?.metadata?.providerMetadata ?? chunk.payload?.providerMetadata;
        // A server-side fallback means the turn was answered by a different
        // model than the one the user selected (e.g. fable-5 declined and the
        // fallback served the response). Surface that, otherwise the
        // substitution is invisible.
        const fallbackNotice = describeServerSideFallback(finishProviderMetadata);
        if (fallbackNotice) {
          this.#session.emit({ type: 'info', message: fallbackNotice });
        }
        if (finishReason === 'stop' || finishReason === 'end-turn') {
          this.setStopReason(state.currentMessage, 'complete', true);
        } else if (finishReason === 'tool-calls') {
          this.setStopReason(state.currentMessage, 'tool_use', true);
        } else {
          // Non-success terminal reasons (e.g. `content-filter` from a
          // `claude-fable-5` refusal, `error`, or `length`) must surface as an
          // explicit terminal error rather than a silent `complete`. Otherwise
          // the run ends with no final message and no error, leaving the user
          // unable to tell whether it completed, failed, or is still active.
          const errorMessage = describeNonSuccessFinishReason(finishReason, finishProviderMetadata);
          if (errorMessage) {
            this.setStopReason(state.currentMessage, 'error', true);
            this.setErrorMessage(state.currentMessage, errorMessage);
            state.terminalError = errorMessage;
          } else {
            this.setStopReason(state.currentMessage, 'complete', true);
          }
        }
        break;
      }

      case 'goal': {
        // In-loop goal evaluation marks a boundary between assistant attempts.
        // Close the current assistant message before rendering the judge result
        // so a continuation starts a fresh message instead of overwriting the
        // previous attempt in streaming UIs.
        this.finishCurrentMessageAndRotate(state);
        // Forward the payload so consumers (the TUI's judge display) can render
        // judge progress and the decision.
        this.#session.emit({ type: 'goal_evaluation', payload: chunk.payload });
        break;
      }

      // Observational Memory data parts
      // NOTE: OM data parts arrive as { type, data: { ... } } — NOT { type, payload }
      case 'data-om-status': {
        const d = (chunk as any).data as Record<string, any> | undefined;
        if (d?.windows) {
          const w = d.windows;
          const active = w.active ?? {};
          const msgs = active.messages ?? {};
          const obs = active.observations ?? {};
          const buffObs = w.buffered?.observations ?? {};
          const buffRef = w.buffered?.reflection ?? {};

          this.#session.emit({
            type: 'om_status',
            windows: {
              active: {
                messages: { tokens: msgs.tokens ?? 0, threshold: msgs.threshold ?? 0 },
                observations: { tokens: obs.tokens ?? 0, threshold: obs.threshold ?? 0 },
              },
              buffered: {
                observations: {
                  status: buffObs.status ?? 'idle',
                  chunks: buffObs.chunks ?? 0,
                  messageTokens: buffObs.messageTokens ?? 0,
                  projectedMessageRemoval: buffObs.projectedMessageRemoval ?? 0,
                  observationTokens: buffObs.observationTokens ?? 0,
                },
                reflection: {
                  status: buffRef.status ?? 'idle',
                  inputObservationTokens: buffRef.inputObservationTokens ?? 0,
                  observationTokens: buffRef.observationTokens ?? 0,
                },
              },
            },
            recordId: d.recordId ?? '',
            threadId: d.threadId ?? '',
            stepNumber: d.stepNumber ?? 0,
            generationCount: d.generationCount ?? 0,
          });
        }
        break;
      }
      case 'data-om-observation-start': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload && payload.cycleId) {
          if (payload.operationType === 'observation') {
            this.#session.emit({
              type: 'om_observation_start',
              cycleId: payload.cycleId,
              operationType: payload.operationType,
              tokensToObserve: payload.tokensToObserve ?? 0,
            });
          } else if (payload.operationType === 'reflection') {
            this.#session.emit({
              type: 'om_reflection_start',
              cycleId: payload.cycleId,
              tokensToReflect: payload.tokensToObserve ?? 0,
            });
          }
        }
        break;
      }
      case 'data-om-observation-end': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload && payload.cycleId) {
          if (payload.operationType === 'reflection') {
            this.#session.emit({
              type: 'om_reflection_end',
              cycleId: payload.cycleId,
              durationMs: payload.durationMs ?? 0,
              compressedTokens: payload.observationTokens ?? 0,
              observations: payload.observations,
            });
          } else {
            this.#session.emit({
              type: 'om_observation_end',
              cycleId: payload.cycleId,
              durationMs: payload.durationMs ?? 0,
              tokensObserved: payload.tokensObserved ?? 0,
              observationTokens: payload.observationTokens ?? 0,
              observations: payload.observations,
              currentTask: payload.currentTask,
              suggestedResponse: payload.suggestedResponse,
            });
          }
        }
        break;
      }
      case 'data-om-observation-failed': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload) {
          const operationType = payload.operationType === 'reflection' ? 'reflection' : 'observation';
          const error = payload.error ?? 'Unknown error';

          if (operationType === 'reflection') {
            this.#session.emit({
              type: 'om_reflection_failed',
              cycleId: payload.cycleId ?? 'unknown',
              error,
              durationMs: payload.durationMs ?? 0,
            });
          } else {
            this.#session.emit({
              type: 'om_observation_failed',
              cycleId: payload.cycleId ?? 'unknown',
              error,
              durationMs: payload.durationMs ?? 0,
            });
          }

          this.abortForOmFailure({ operationType, stage: 'run', error });
          return { message: state.currentMessage };
        }
        break;
      }
      // Async buffering lifecycle
      case 'data-om-buffering-start': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload && payload.cycleId) {
          this.#session.emit({
            type: 'om_buffering_start',
            cycleId: payload.cycleId,
            operationType: payload.operationType ?? 'observation',
            tokensToBuffer: payload.tokensToBuffer ?? 0,
          });
        }
        break;
      }
      case 'data-om-buffering-end': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload && payload.cycleId) {
          this.#session.emit({
            type: 'om_buffering_end',
            cycleId: payload.cycleId,
            operationType: payload.operationType ?? 'observation',
            tokensBuffered: payload.tokensBuffered ?? 0,
            bufferedTokens: payload.bufferedTokens ?? 0,
            observations: payload.observations,
          });
        }
        break;
      }
      case 'data-om-buffering-failed': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload) {
          const operationType = payload.operationType ?? 'observation';
          const error = payload.error ?? 'Unknown error';

          this.#session.emit({
            type: 'om_buffering_failed',
            cycleId: payload.cycleId,
            operationType,
            error,
          });

          this.abortForOmFailure({ operationType, stage: 'buffering', error });
          return { message: state.currentMessage };
        }
        break;
      }
      case 'data-signal': {
        const payload = (chunk as any).data as Record<string, unknown> | undefined;
        if (payload) {
          const message = this.createSignalMessage('data-signal', payload);
          this.#session.emit({ type: 'message_start', message });
          this.#session.emit({ type: 'message_end', message });
        }
        break;
      }
      case 'data-user-message': {
        const payload = (chunk as any).data as Record<string, unknown> | undefined;
        if (payload) {
          // A user signal interrupts the in-flight assistant message: finalize and
          // rotate it first so the user signal is its own message in order.
          this.finishCurrentMessageAndRotate(state);
          const message = this.createSignalMessage('data-user-message', payload);
          this.#session.emit({ type: 'message_start', message });
          this.#session.emit({ type: 'message_end', message });
        }
        break;
      }
      // Back-compat: persisted streams may still contain data-system-reminder parts
      case 'data-system-reminder': {
        const payload = (chunk as any).data as Record<string, unknown> | undefined;
        if (payload) {
          const message = this.createSignalMessage('data-system-reminder', payload);
          this.#session.emit({ type: 'message_start', message });
          this.#session.emit({ type: 'message_end', message });
        }
        break;
      }
      case 'data-om-activation': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload && payload.cycleId) {
          this.#session.emit({
            type: 'om_activation',
            cycleId: payload.cycleId,
            operationType: payload.operationType ?? 'observation',
            chunksActivated: payload.chunksActivated ?? 0,
            tokensActivated: payload.tokensActivated ?? 0,
            observationTokens: payload.observationTokens ?? 0,
            messagesActivated: payload.messagesActivated ?? 0,
            generationCount: payload.generationCount ?? 0,
            triggeredBy: payload.triggeredBy,
            lastActivityAt: payload.lastActivityAt,
            ttlExpiredMs: payload.ttlExpiredMs,
            activateAfterIdle:
              typeof payload.config?.activateAfterIdle === 'number' ? payload.config.activateAfterIdle : undefined,
            previousModel: payload.previousModel,
            currentModel: payload.currentModel,
          });
        }
        break;
      }
      case 'data-om-thread-update': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload && payload.newTitle) {
          this.#session.emit({
            type: 'om_thread_title_updated',
            cycleId: payload.cycleId ?? 'unknown',
            threadId: payload.threadId ?? this.#session.thread.getId() ?? 'unknown',
            oldTitle: payload.oldTitle,
            newTitle: payload.newTitle,
          });
        }
        break;
      }

      // Sandbox streaming data chunks (from workspace execute_command tool)
      case 'data-sandbox-stdout': {
        const d = (chunk as any).data as Record<string, any> | undefined;
        if (d?.output && d?.toolCallId) {
          this.#session.emit({ type: 'shell_output', toolCallId: d.toolCallId, output: d.output, stream: 'stdout' });
        }
        break;
      }
      case 'data-sandbox-stderr': {
        const d = (chunk as any).data as Record<string, any> | undefined;
        if (d?.output && d?.toolCallId) {
          this.#session.emit({ type: 'shell_output', toolCallId: d.toolCallId, output: d.output, stream: 'stderr' });
        }
        break;
      }

      default:
        break;
    }
  }

  private finishStreamState(state: StreamState): { message: MastraDBMessage; suspended?: boolean } {
    if (this.hasCurrentMessageContent(state) || !state.lastFinishedMessage) {
      this.#session.emit({ type: 'message_end', message: state.currentMessage });
      return { message: state.currentMessage, suspended: state.isSuspended || undefined };
    }

    return { message: state.lastFinishedMessage, suspended: state.isSuspended || undefined };
  }

  private async finishSubscribedStreamRun({
    suspended,
    error,
    aborted,
  }: {
    suspended?: boolean;
    error?: boolean;
    aborted?: boolean;
  }): Promise<void> {
    const reason = error
      ? 'error'
      : suspended
        ? 'suspended'
        : aborted || this.#session.run.isAbortRequested()
          ? 'aborted'
          : 'complete';
    this.#session.emit({ type: 'agent_end', reason });
    this.#session.run.reset();
    await this.#session.drainFollowUpQueue();
  }

  private async handleSubscribedStreamError(error: unknown): Promise<void> {
    if (error instanceof Error && error.name === 'AbortError') {
      this.#session.emit({ type: 'agent_end', reason: 'aborted' });
    } else {
      this.#session.emit({ type: 'error', error: getErrorFromUnknown(error) });
      this.#session.emit({ type: 'agent_end', reason: 'error' });
    }
    this.#session.stream.detach();
    this.#session.run.reset();
    await this.#session.drainFollowUpQueue();
  }

  async processSubscribedThreadStream(subscription: AgentThreadSubscription<any>): Promise<void> {
    const requestContext = await this.#machinery.buildRequestContext();
    let currentRun: StreamState | undefined;

    try {
      for await (const chunk of subscription.stream) {
        if (!this.#session.stream.isCurrent({ subscription })) {
          subscription.unsubscribe();
          break;
        }

        if (!currentRun) {
          currentRun = this.createStreamState();
          this.#session.run.nextOperation();
          this.#session.run.ensureAbortController();
          this.#session.run.setRunId({ runId: subscription.activeRunId() ?? ('runId' in chunk ? chunk.runId : null) });
          this.#session.run.setTraceId({ traceId: null });
          this.#session.emit({ type: 'agent_start' });
        }

        if (chunk.type === 'start') {
          continue;
        }

        try {
          const streamResult = await this.processStreamChunk(currentRun, chunk, requestContext);
          if (
            streamResult ||
            chunk.type === 'finish' ||
            chunk.type === 'error' ||
            chunk.type === 'abort' ||
            chunk.type === 'tool-call-suspended'
          ) {
            const suspended =
              chunk.type === 'tool-call-suspended' ||
              (streamResult ?? this.finishStreamState(currentRun)).suspended ||
              undefined;
            const aborted = chunk.type === 'abort';
            // A non-success terminal finish reason (e.g. a `claude-fable-5`
            // content-filter refusal) is surfaced as an explicit error so the
            // run never silently stops without a visible terminal state.
            let isError = chunk.type === 'error';
            if (
              currentRun.terminalError &&
              !isError &&
              !aborted &&
              !this.#session.run.isAbortRequested() &&
              !suspended
            ) {
              isError = true;
              this.#session.emit({ type: 'error', error: new Error(currentRun.terminalError) });
            }
            await this.finishSubscribedStreamRun({
              suspended,
              error: isError,
              aborted,
            });
            currentRun = undefined;
            if (aborted) {
              // The abort chunk terminates this consumer loop, so the live
              // subscription is no longer being drained. Detach it so the next
              // signal (e.g. a follow-up message sent right after Ctrl+C)
              // re-subscribes and starts a fresh consumer — otherwise the new
              // run's chunks would never be processed and the follow-up would
              // get no response.
              this.#session.stream.detach();
              break;
            }
          }
        } catch (error) {
          await this.handleSubscribedStreamError(error);
          currentRun = undefined;
        }
      }

      // Graceful stream close without explicit terminal chunk.
      if (currentRun && this.#session.stream.isCurrent({ subscription })) {
        const streamResult = this.finishStreamState(currentRun);
        await this.finishSubscribedStreamRun({ suspended: streamResult.suspended });
        currentRun = undefined;
      }
    } catch (error) {
      if (this.#session.stream.isCurrent({ subscription })) {
        await this.handleSubscribedStreamError(error);
      }
    }
  }
}
