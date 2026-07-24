import type {
  MastraDBMessage,
  MastraMessagePart,
  MastraProviderMetadata,
  MastraToolInvocationPart,
} from '../agent/message-list/state/types';
import type { AgentThreadSubscription } from '../agent/types';
import { getErrorFromUnknown } from '../error';
import type { RequestContext } from '../request-context';
import type { GoalEvaluationPayload } from '../stream/types';
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
type StreamDataPart = MastraMessagePart & { type: `data-${string}`; data: unknown };
type StreamChunkPayload = Record<string, unknown>;
type StreamChunkBase<TType extends string> = {
  type: TType;
  runId?: string | null;
  metadata?: unknown;
};
type StreamPayloadChunk<TType extends string> = StreamChunkBase<TType> & { payload?: unknown };
type StreamObjectChunk<TType extends string> = StreamChunkBase<TType> & { object?: unknown };
type StreamDataChunk<TType extends `data-${string}`> = StreamChunkBase<TType> & { data?: unknown };
type StreamIgnoredChunk =
  | StreamPayloadChunk<'start'>
  | StreamPayloadChunk<'abort'>
  | StreamPayloadChunk<'response-metadata'>
  | StreamPayloadChunk<'text-end'>
  | StreamPayloadChunk<'reasoning-end'>
  | StreamPayloadChunk<'reasoning-signature'>
  | StreamPayloadChunk<'redacted-reasoning'>
  | StreamPayloadChunk<'source'>
  | StreamPayloadChunk<'file'>
  | StreamPayloadChunk<'raw'>
  | StreamPayloadChunk<'step-start'>
  | StreamPayloadChunk<'tool-output'>
  | StreamPayloadChunk<'step-output'>
  | StreamPayloadChunk<'watch'>
  | StreamPayloadChunk<'tripwire'>
  | StreamPayloadChunk<'is-task-complete'>
  | StreamPayloadChunk<'background-task-started'>
  | StreamPayloadChunk<'background-task-completed'>
  | StreamPayloadChunk<'background-task-failed'>
  | StreamPayloadChunk<'background-task-progress'>
  | StreamPayloadChunk<'background-task-running'>
  | StreamPayloadChunk<'background-task-cancelled'>
  | StreamPayloadChunk<'background-task-output'>
  | StreamPayloadChunk<'background-task-suspended'>
  | StreamPayloadChunk<'background-task-resumed'>
  | StreamObjectChunk<'object'>
  | StreamObjectChunk<'object-result'>;
type StreamChunk =
  | StreamIgnoredChunk
  | StreamPayloadChunk<'text-start'>
  | StreamPayloadChunk<'text-delta'>
  | StreamPayloadChunk<'reasoning-start'>
  | StreamPayloadChunk<'reasoning-delta'>
  | StreamPayloadChunk<'tool-call-input-streaming-start'>
  | StreamPayloadChunk<'tool-call-delta'>
  | StreamPayloadChunk<'tool-call-input-streaming-end'>
  | StreamPayloadChunk<'tool-call'>
  | StreamPayloadChunk<'tool-result'>
  | StreamPayloadChunk<'tool-error'>
  | StreamPayloadChunk<'tool-call-approval'>
  | StreamPayloadChunk<'tool-call-suspended'>
  | StreamPayloadChunk<'error'>
  | StreamPayloadChunk<'step-finish'>
  | StreamPayloadChunk<'finish'>
  | StreamPayloadChunk<'goal'>
  | StreamDataChunk<'data-om-status'>
  | StreamDataChunk<'data-om-observation-start'>
  | StreamDataChunk<'data-om-observation-end'>
  | StreamDataChunk<'data-om-observation-failed'>
  | StreamDataChunk<'data-om-buffering-start'>
  | StreamDataChunk<'data-om-buffering-end'>
  | StreamDataChunk<'data-om-buffering-failed'>
  | StreamDataChunk<'data-signal'>
  | StreamDataChunk<'data-user-message'>
  | StreamDataChunk<'data-system-reminder'>
  | StreamDataChunk<'data-om-activation'>
  | StreamDataChunk<'data-om-thread-update'>
  | StreamDataChunk<'data-mastracode-tool-progress'>
  | StreamDataChunk<'data-sandbox-stdout'>
  | StreamDataChunk<'data-sandbox-stderr'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProviderMetadata(value: unknown): value is MastraProviderMetadata {
  return isRecord(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function getPayload(chunk: StreamChunk): StreamChunkPayload {
  return 'payload' in chunk ? (getRecord(chunk.payload) ?? {}) : {};
}

function getDataRecord(chunk: StreamChunk): Record<string, unknown> | undefined {
  return 'data' in chunk ? getRecord(chunk.data) : undefined;
}

function getNestedRecord(
  record: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  return record ? getRecord(record[key]) : undefined;
}

function isGoalEvaluationPayload(value: unknown): value is GoalEvaluationPayload {
  const record = getRecord(value);
  return Boolean(
    record &&
    typeof record.objective === 'string' &&
    typeof record.iteration === 'number' &&
    typeof record.maxRuns === 'number' &&
    typeof record.passed === 'boolean' &&
    (record.status === 'active' || record.status === 'paused' || record.status === 'done') &&
    Array.isArray(record.results) &&
    typeof record.duration === 'number' &&
    typeof record.timedOut === 'boolean' &&
    typeof record.maxRunsReached === 'boolean' &&
    typeof record.suppressFeedback === 'boolean',
  );
}

function getOperationType(value: unknown): 'observation' | 'reflection' {
  return value === 'reflection' ? 'reflection' : 'observation';
}

function getActivationTrigger(value: unknown): 'ttl' | 'threshold' | 'provider_change' | undefined {
  if (value === 'ttl' || value === 'threshold' || value === 'provider_change') return value;
  return undefined;
}

function getOmStatus(value: unknown): 'idle' | 'running' | 'complete' {
  if (value === 'running' || value === 'complete') return value;
  return 'idle';
}

function formatToolProgressOutput(progress: unknown): string {
  if (typeof progress === 'string') return progress.endsWith('\n') ? progress : `${progress}\n`;
  if (typeof progress !== 'object' || progress === null) return `${String(progress)}\n`;

  const record = progress as { status?: unknown; detail?: unknown };
  const parts = [record.status, record.detail].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return parts.length > 0 ? `${parts.join(': ')}\n` : `${JSON.stringify(progress)}\n`;
}

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
  private createSignalMessage(partType: `data-${string}`, payload: Record<string, unknown>): MastraDBMessage {
    const part: StreamDataPart = { type: partType, data: payload };
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
        parts: [part],
        metadata: { signal: payload },
      },
      createdAt,
    };
  }

  private hasCurrentMessageContent(state: StreamState): boolean {
    return state.currentMessage.content.parts.length > 0;
  }

  /**
   * Snapshot a message for emission. The engine mutates parts in place
   * (text/reasoning deltas, tool-invocation upgrades) and `setStopReason` /
   * `setErrorMessage` mutate `content.metadata`, so emitted snapshots must
   * deep-clone the content or later mutations rewrite earlier snapshots.
   */
  private cloneMessage(message: MastraDBMessage): MastraDBMessage {
    return { ...message, content: structuredClone(message.content) };
  }

  private setStopReason(message: MastraDBMessage, stopReason: string, force = false): void {
    message.content.metadata ??= {};
    const metadata = message.content.metadata;
    if (force) {
      metadata.stopReason = stopReason;
    } else {
      metadata.stopReason ??= stopReason;
    }
  }

  private setErrorMessage(message: MastraDBMessage, errorMessage: string): void {
    message.content.metadata ??= {};
    message.content.metadata.errorMessage = errorMessage;
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
    response: { fullStream: AsyncIterable<StreamChunk> },
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
    // content-filter refusal) becomes an explicit error so the run never
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
    chunk: StreamChunk,
    requestContext: RequestContext,
  ): Promise<{ message: MastraDBMessage; suspended?: boolean } | undefined> {
    if ('runId' in chunk && chunk.runId) {
      this.#session.run.setRunId({ runId: chunk.runId });
    }

    switch (chunk.type) {
      case 'text-start': {
        const textIndex = state.currentMessage.content.parts.length;
        state.currentMessage.content.parts.push({ type: 'text', text: '' });
        state.textContentById.set(getString(getPayload(chunk).id) ?? '', { index: textIndex, text: '' });
        this.#session.emit({ type: 'message_start', message: this.cloneMessage(state.currentMessage) });
        break;
      }

      case 'text-delta': {
        const textState = state.textContentById.get(getString(getPayload(chunk).id) ?? '');
        if (textState) {
          textState.text += getString(getPayload(chunk).text) ?? '';
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
        state.thinkingContentById.set(getString(getPayload(chunk).id) ?? '', { index: thinkingIndex, text: '' });
        this.#session.emit({ type: 'message_update', message: this.cloneMessage(state.currentMessage) });
        break;
      }

      case 'reasoning-delta': {
        const thinkingState = state.thinkingContentById.get(getString(getPayload(chunk).id) ?? '');
        if (thinkingState) {
          thinkingState.text += getString(getPayload(chunk).text) ?? '';
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
        const payload = getPayload(chunk);
        const toolCallId = getString(payload.toolCallId) ?? '';
        const toolName = getString(payload.toolName) ?? '';
        this.#session.emit({ type: 'tool_input_start', toolCallId, toolName });
        break;
      }

      case 'tool-call-delta': {
        const payload = getPayload(chunk);
        const toolCallId = getString(payload.toolCallId) ?? '';
        const argsTextDelta = getString(payload.argsTextDelta) ?? '';
        const toolName = getString(payload.toolName);
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
        const toolCallId = getString(getPayload(chunk).toolCallId) ?? '';
        this.#session.emit({ type: 'tool_input_end', toolCallId });
        break;
      }

      case 'tool-call': {
        const toolCall = getPayload(chunk);
        const toolCallId = getString(toolCall.toolCallId) ?? '';
        const toolName = getString(toolCall.toolName) ?? '';
        const args = getDisplayTransform(chunk.metadata, 'input-available', toolCall.args);
        const toolIndex = state.currentMessage.content.parts.length;
        state.currentMessage.content.parts.push({
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId,
            toolName,
            args,
          },
        });
        state.toolPartById.set(toolCallId, toolIndex);
        this.#session.emit({
          type: 'tool_start',
          toolCallId,
          toolName,
          args,
        });
        this.#session.emit({ type: 'message_update', message: this.cloneMessage(state.currentMessage) });
        break;
      }

      case 'tool-result': {
        const toolResult = getPayload(chunk);
        const toolCallId = getString(toolResult.toolCallId) ?? '';
        const toolName = getString(toolResult.toolName) ?? '';
        const providerMetadata = isProviderMetadata(toolResult.providerMetadata)
          ? toolResult.providerMetadata
          : undefined;
        const result = getDisplayTransform(chunk.metadata, 'output-available', toolResult.result);
        const isError = getBoolean(toolResult.isError, false);
        const toolIndex = state.toolPartById.get(toolCallId);
        const existing = toolIndex !== undefined ? state.currentMessage.content.parts[toolIndex] : undefined;
        if (existing && existing.type === 'tool-invocation') {
          existing.toolInvocation = Object.assign(existing.toolInvocation, {
            state: 'result' as const,
            result,
            isError,
          });
          if (providerMetadata) {
            existing.providerMetadata = providerMetadata;
          }
        } else {
          const toolInvocationPart: MastraToolInvocationPart = {
            type: 'tool-invocation',
            toolInvocation: Object.assign(
              {
                state: 'result' as const,
                toolCallId,
                toolName,
                args: {},
                result,
              },
              { isError },
            ),
          };
          if (providerMetadata) {
            toolInvocationPart.providerMetadata = providerMetadata;
          }
          state.currentMessage.content.parts.push(toolInvocationPart);
        }
        this.#session.emit({
          type: 'tool_end',
          toolCallId,
          result,
          isError,
          ...(providerMetadata ? { providerMetadata } : {}),
        });
        this.#session.emit({ type: 'message_update', message: this.cloneMessage(state.currentMessage) });
        break;
      }

      case 'tool-error': {
        const toolError = getPayload(chunk);
        const toolCallId = getString(toolError.toolCallId) ?? '';
        this.#session.emit({
          type: 'tool_end',
          toolCallId,
          result: getDisplayTransform(chunk.metadata, 'error', toolError.error),
          isError: true,
        });
        break;
      }

      case 'tool-call-approval': {
        const toolCallId = getString(getPayload(chunk).toolCallId) ?? '';
        const toolName = getString(getPayload(chunk).toolName) ?? '';
        const approvalTransform = getTransformedToolPayload(chunk.metadata, 'display', 'approval');
        const toolArgs = hasTransformedToolPayload(approvalTransform)
          ? approvalTransform.transformed
          : getDisplayTransform(chunk.metadata, 'input-available', getPayload(chunk).args);

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
        const suspToolCallId = getString(getPayload(chunk).toolCallId) ?? '';
        const suspToolName = getString(getPayload(chunk).toolName) ?? '';
        const suspArgs = getDisplayTransform(chunk.metadata, 'input-available', getPayload(chunk).args);
        const suspPayload = getDisplayTransform(chunk.metadata, 'suspend', getPayload(chunk).suspendPayload);
        const suspResumeSchema = getString(getPayload(chunk).resumeSchema);

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
        const streamError = getErrorFromUnknown(getPayload(chunk).error);
        this.#session.emit({ type: 'error', error: streamError });

        // A run that dies after emitting `tool_suspended` (e.g. persisting the
        // suspended snapshot failed) leaves its parked suspensions unresumable:
        // answering them would fail with a misleading "could not find a
        // suspended run" error that masks this primary failure. Retract them so
        // the UI dismisses the prompts and the user sees the real error.
        const failedRunId = chunk.runId ?? this.#session.run.getRunId();
        if (failedRunId) {
          for (const { toolCallId, toolName } of this.#session.suspensions.deleteForRun({ runId: failedRunId })) {
            this.#session.emit({
              type: 'tool_suspension_cancelled',
              toolCallId,
              toolName,
              reason: streamError.message,
            });
          }
        }
        break;
      }

      case 'step-finish': {
        const usage = getRecord(getPayload(chunk).output)?.usage;
        const usageRecord = getRecord(usage);
        if (usageRecord) {
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
        const finishReason = getString(getRecord(getPayload(chunk).stepResult)?.reason) ?? '';
        const finishProviderMetadata =
          getRecord(getPayload(chunk).metadata)?.providerMetadata ?? getPayload(chunk).providerMetadata;
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
          // `claude-fable-5` refusal, `error`, or `length`) must become an
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
        const goalPayload = getPayload(chunk);
        if (isGoalEvaluationPayload(goalPayload)) {
          this.#session.emit({ type: 'goal_evaluation', payload: goalPayload });
        }
        break;
      }

      // Observational Memory data parts
      // NOTE: OM data parts arrive in { type, data: { ... } } form — NOT { type, payload }
      case 'data-om-status': {
        const d = getDataRecord(chunk);
        const w = getRecord(d?.windows);
        if (d && w) {
          const active = getNestedRecord(w, 'active');
          const msgs = getNestedRecord(active, 'messages');
          const obs = getNestedRecord(active, 'observations');
          const buffered = getNestedRecord(w, 'buffered');
          const buffObs = getNestedRecord(buffered, 'observations');
          const buffRef = getNestedRecord(buffered, 'reflection');

          this.#session.emit({
            type: 'om_status',
            windows: {
              active: {
                messages: { tokens: getNumber(msgs?.tokens, 0), threshold: getNumber(msgs?.threshold, 0) },
                observations: { tokens: getNumber(obs?.tokens, 0), threshold: getNumber(obs?.threshold, 0) },
              },
              buffered: {
                observations: {
                  status: getOmStatus(buffObs?.status),
                  chunks: getNumber(buffObs?.chunks, 0),
                  messageTokens: getNumber(buffObs?.messageTokens, 0),
                  projectedMessageRemoval: getNumber(buffObs?.projectedMessageRemoval, 0),
                  observationTokens: getNumber(buffObs?.observationTokens, 0),
                },
                reflection: {
                  status: getOmStatus(buffRef?.status),
                  inputObservationTokens: getNumber(buffRef?.inputObservationTokens, 0),
                  observationTokens: getNumber(buffRef?.observationTokens, 0),
                },
              },
            },
            recordId: getString(d.recordId) ?? '',
            threadId: getString(d.threadId) ?? '',
            stepNumber: getNumber(d.stepNumber, 0),
            generationCount: getNumber(d.generationCount, 0),
          });
        }
        break;
      }
      case 'data-om-observation-start': {
        const payload = getDataRecord(chunk);
        const cycleId = getString(payload?.cycleId);
        if (payload && cycleId) {
          const operationType = getOperationType(payload.operationType);
          if (operationType === 'observation') {
            this.#session.emit({
              type: 'om_observation_start',
              cycleId,
              operationType,
              tokensToObserve: getNumber(payload.tokensToObserve, 0),
            });
          } else {
            this.#session.emit({
              type: 'om_reflection_start',
              cycleId,
              tokensToReflect: getNumber(payload.tokensToObserve, 0),
            });
          }
        }
        break;
      }
      case 'data-om-observation-end': {
        const payload = getDataRecord(chunk);
        const cycleId = getString(payload?.cycleId);
        if (payload && cycleId) {
          if (payload.operationType === 'reflection') {
            this.#session.emit({
              type: 'om_reflection_end',
              cycleId,
              durationMs: getNumber(payload.durationMs, 0),
              compressedTokens: getNumber(payload.observationTokens, 0),
              observations: getString(payload.observations),
            });
          } else {
            this.#session.emit({
              type: 'om_observation_end',
              cycleId,
              durationMs: getNumber(payload.durationMs, 0),
              tokensObserved: getNumber(payload.tokensObserved, 0),
              observationTokens: getNumber(payload.observationTokens, 0),
              observations: getString(payload.observations),
              currentTask: getString(payload.currentTask),
              suggestedResponse: getString(payload.suggestedResponse),
            });
          }
        }
        break;
      }
      case 'data-om-observation-failed': {
        const payload = getDataRecord(chunk);
        if (payload) {
          const operationType = getOperationType(payload.operationType);
          const error = getString(payload.error) ?? 'Unknown error';

          if (operationType === 'reflection') {
            this.#session.emit({
              type: 'om_reflection_failed',
              cycleId: getString(payload.cycleId) ?? 'unknown',
              error,
              durationMs: getNumber(payload.durationMs, 0),
            });
          } else {
            this.#session.emit({
              type: 'om_observation_failed',
              cycleId: getString(payload.cycleId) ?? 'unknown',
              error,
              durationMs: getNumber(payload.durationMs, 0),
            });
          }

          this.abortForOmFailure({ operationType, stage: 'run', error });
          return { message: state.currentMessage };
        }
        break;
      }
      // Async buffering lifecycle
      case 'data-om-buffering-start': {
        const payload = getDataRecord(chunk);
        const cycleId = getString(payload?.cycleId);
        if (payload && cycleId) {
          this.#session.emit({
            type: 'om_buffering_start',
            cycleId,
            operationType: getOperationType(payload.operationType),
            tokensToBuffer: getNumber(payload.tokensToBuffer, 0),
          });
        }
        break;
      }
      case 'data-om-buffering-end': {
        const payload = getDataRecord(chunk);
        const cycleId = getString(payload?.cycleId);
        if (payload && cycleId) {
          this.#session.emit({
            type: 'om_buffering_end',
            cycleId,
            operationType: getOperationType(payload.operationType),
            tokensBuffered: getNumber(payload.tokensBuffered, 0),
            bufferedTokens: getNumber(payload.bufferedTokens, 0),
            observations: getString(payload.observations),
          });
        }
        break;
      }
      case 'data-om-buffering-failed': {
        const payload = getDataRecord(chunk);
        if (payload) {
          const operationType = getOperationType(payload.operationType);
          const error = getString(payload.error) ?? 'Unknown error';

          this.#session.emit({
            type: 'om_buffering_failed',
            cycleId: getString(payload.cycleId) ?? 'unknown',
            operationType,
            error,
          });

          this.abortForOmFailure({ operationType, stage: 'buffering', error });
          return { message: state.currentMessage };
        }
        break;
      }
      case 'data-signal': {
        const payload = getDataRecord(chunk);
        if (payload) {
          const message = this.createSignalMessage('data-signal', payload);
          this.#session.emit({ type: 'message_start', message });
          this.#session.emit({ type: 'message_end', message });
        }
        break;
      }
      case 'data-user-message': {
        const payload = getDataRecord(chunk);
        if (payload) {
          this.finishCurrentMessageAndRotate(state);
          const message = this.createSignalMessage('data-user-message', payload);
          this.#session.emit({ type: 'message_start', message });
          this.#session.emit({ type: 'message_end', message });
        }
        break;
      }
      // Back-compat: persisted streams may still contain data-system-reminder parts
      case 'data-system-reminder': {
        const payload = getDataRecord(chunk);
        if (payload) {
          const message = this.createSignalMessage('data-system-reminder', payload);
          this.#session.emit({ type: 'message_start', message });
          this.#session.emit({ type: 'message_end', message });
        }
        break;
      }
      case 'data-om-activation': {
        const payload = getDataRecord(chunk);
        const cycleId = getString(payload?.cycleId);
        if (payload && cycleId) {
          this.#session.emit({
            type: 'om_activation',
            cycleId,
            operationType: getOperationType(payload.operationType),
            chunksActivated: getNumber(payload.chunksActivated, 0),
            tokensActivated: getNumber(payload.tokensActivated, 0),
            observationTokens: getNumber(payload.observationTokens, 0),
            messagesActivated: getNumber(payload.messagesActivated, 0),
            generationCount: getNumber(payload.generationCount, 0),
            triggeredBy: getActivationTrigger(payload.triggeredBy),
            lastActivityAt: getOptionalNumber(payload.lastActivityAt),
            ttlExpiredMs: getOptionalNumber(payload.ttlExpiredMs),
            activateAfterIdle: getOptionalNumber(getRecord(payload.config)?.activateAfterIdle),
            previousModel: getString(payload.previousModel),
            currentModel: getString(payload.currentModel),
          });
        }
        break;
      }
      case 'data-om-thread-update': {
        const payload = getDataRecord(chunk);
        const newTitle = getString(payload?.newTitle);
        if (payload && newTitle) {
          this.#session.emit({
            type: 'om_thread_title_updated',
            cycleId: getString(payload.cycleId) ?? 'unknown',
            threadId: getString(payload.threadId) ?? this.#session.thread.getId() ?? 'unknown',
            oldTitle: getString(payload.oldTitle),
            newTitle,
          });
        }
        break;
      }

      case 'data-mastracode-tool-progress': {
        const d = (chunk as any).data as Record<string, any> | undefined;
        if (d?.toolCallId && d?.progress !== undefined) {
          this.#session.emit({ type: 'tool_update', toolCallId: d.toolCallId, partialResult: d.progress });
          const output = formatToolProgressOutput(d.progress);
          if (output) {
            this.#session.emit({ type: 'shell_output', toolCallId: d.toolCallId, output, stream: 'stdout' });
          }
        }
        break;
      }

      // Sandbox streaming data chunks (from workspace execute_command tool)
      case 'data-sandbox-stdout': {
        const d = getDataRecord(chunk);
        const output = getString(d?.output);
        const toolCallId = getString(d?.toolCallId);
        if (output && toolCallId) {
          this.#session.emit({ type: 'shell_output', toolCallId, output, stream: 'stdout' });
        }
        break;
      }
      case 'data-sandbox-stderr': {
        const d = getDataRecord(chunk);
        const output = getString(d?.output);
        const toolCallId = getString(d?.toolCallId);
        if (output && toolCallId) {
          this.#session.emit({ type: 'shell_output', toolCallId, output, stream: 'stderr' });
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

  async processSubscribedThreadStream(subscription: AgentThreadSubscription<StreamChunk>): Promise<void> {
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
            // content-filter refusal) becomes an explicit error so the
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
