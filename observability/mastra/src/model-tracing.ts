/**
 * Model Span Tracing
 *
 * Provides span tracking for Model generations, including:
 * - MODEL_STEP spans (one per Model API call - includes processors and tool executions)
 * - MODEL_INFERENCE spans (the provider call itself - model latency only)
 * - MODEL_CHUNK spans (individual streaming chunks within an inference)
 *
 * Hierarchy: MODEL_GENERATION -> MODEL_STEP -> MODEL_INFERENCE -> MODEL_CHUNK
 *
 * Processors and tool executions remain children of MODEL_STEP (siblings of
 * MODEL_INFERENCE), so MODEL_INFERENCE measures pure model time.
 */

import { TransformStream } from 'node:stream/web';
import { coreFeatures } from '@mastra/core/features';
import * as coreObservability from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import type {
  EndGenerationOptions,
  ErrorSpanOptions,
  ModelInferenceContext,
  ModelSpanTrackerOptions,
  ModelStepInput,
  Span,
  SpanTermination,
  TracingContext,
  UpdateSpanOptions,
} from '@mastra/core/observability';
import type { ChunkType, StepStartPayload, StepFinishPayload } from '@mastra/core/stream';

/**
 * Feature gate for MODEL_INFERENCE spans. When the installed @mastra/core
 * predates the feature flag, `SpanType.MODEL_INFERENCE` resolves to undefined
 * at runtime; in that case the tracker falls back to parenting MODEL_CHUNK
 * spans directly under MODEL_STEP (the pre-MODEL_INFERENCE behavior).
 *
 * Read at every call so tests can toggle the flag between cases. The set
 * lookup is O(1) and not on a hot path.
 */
function supportsModelInference(): boolean {
  return coreFeatures.has('model-inference-span');
}

import { extractOpenRouterCost, extractUsageMetrics } from './usage';
import type { OpenRouterCostResult } from './usage';

type StepInputPreview = ModelStepInput | undefined;

function parseGatewayCost(providerMetadata: EndGenerationOptions['providerMetadata']): number | undefined {
  const rawCost = providerMetadata?.gateway?.cost;
  const cost =
    typeof rawCost === 'number'
      ? rawCost
      : typeof rawCost === 'string' && rawCost.trim().length > 0
        ? Number(rawCost)
        : undefined;

  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : undefined;
}

function getGatewayCostContext({ stepProviderMetadata }: Pick<EndGenerationOptions, 'stepProviderMetadata'>) {
  if (!stepProviderMetadata) {
    return undefined;
  }

  if (!stepProviderMetadata.some(metadata => metadata?.gateway !== undefined)) {
    return undefined;
  }

  const costs: number[] = [];
  for (const metadata of stepProviderMetadata) {
    const cost = parseGatewayCost(metadata);
    if (cost === undefined) {
      return undefined;
    }
    costs.push(cost);
  }

  const estimatedCost = costs.reduce((total, cost) => total + cost, 0);
  if (!Number.isFinite(estimatedCost)) {
    return undefined;
  }

  return {
    estimatedCost,
    costUnit: 'USD',
    costMetadata: {
      source: 'provider_reported',
      sdkProvider: 'vercel_ai_gateway',
      sdkCostField: 'gateway.cost',
      scope: 'query_total',
      reportedStepCount: costs.length,
    },
  };
}

function getOpenRouterCostContext({ providerMetadata, stepProviderMetadata }: EndGenerationOptions, model?: string) {
  const metadata = stepProviderMetadata ?? (providerMetadata ? [providerMetadata] : undefined);
  if (!metadata?.some(step => step?.openrouter !== undefined)) return undefined;

  const results = metadata.map(extractOpenRouterCost);
  if (results.some(result => result === undefined)) return undefined;

  const costs = results as OpenRouterCostResult[];
  const estimatedCost = costs.reduce((total, result) => total + result.total, 0);
  if (!Number.isFinite(estimatedCost)) return undefined;

  const sdkCostFields: string[] = [];
  if (costs.some(result => result.usedCost)) sdkCostFields.push('openrouter.usage.cost');
  if (costs.some(result => result.usedUpstreamCost)) {
    sdkCostFields.push('openrouter.usage.costDetails.upstreamInferenceCost');
  }

  return {
    provider: 'openrouter',
    model,
    estimatedCost,
    costUnit: 'USD',
    costMetadata: {
      source: 'provider_reported',
      sdkProvider: 'openrouter',
      sdkCostField: sdkCostFields.join('+'),
      scope: 'query_total',
      reportedStepCount: costs.length,
    },
  };
}

function formatPreviewLabel(label: unknown, fallback: string): string {
  return typeof label === 'string' && label.length > 0 ? label : fallback;
}

function formatToolResultPreviewValue(value: unknown): string {
  if (typeof value === 'string') return value;

  if (value && typeof value === 'object' && 'type' in value && (value as { type?: unknown }).type === 'text') {
    const textValue = (value as { value?: unknown }).value;
    if (typeof textValue === 'string') return textValue;
  }

  return JSON.stringify(value);
}

function summarizePart(part: unknown): string {
  if (typeof part === 'string') {
    return part;
  }

  if (!part || typeof part !== 'object') {
    return '';
  }

  if ('text' in part && typeof part.text === 'string') {
    return part.text;
  }

  if ('parts' in part && Array.isArray(part.parts)) {
    return part.parts.map(summarizePart).filter(Boolean).join('');
  }

  if ('inlineData' in part && part.inlineData && typeof part.inlineData === 'object') {
    return `[${formatPreviewLabel((part.inlineData as { mimeType?: unknown }).mimeType, 'binary')}]`;
  }

  if ('image_url' in part) {
    return '[image]';
  }

  if ('functionCall' in part && part.functionCall && typeof part.functionCall === 'object') {
    return `[tool: ${formatPreviewLabel((part.functionCall as { name?: unknown }).name, 'unknown')}]`;
  }

  if ('function_call' in part && part.function_call && typeof part.function_call === 'object') {
    return `[tool: ${formatPreviewLabel((part.function_call as { name?: unknown }).name, 'unknown')}]`;
  }

  if ('function' in part && part.function && typeof part.function === 'object') {
    return `[tool: ${formatPreviewLabel((part.function as { name?: unknown }).name, 'unknown')}]`;
  }

  if ('toolName' in part && !('type' in part && (part as { type: unknown }).type === 'tool-result')) {
    return `[tool: ${formatPreviewLabel((part as { toolName?: unknown }).toolName, 'unknown')}]`;
  }

  if ('type' in part && typeof part.type === 'string') {
    switch (part.type) {
      case 'image':
        return '[image]';
      case 'file':
        return '[file]';
      case 'reasoning':
        return '[reasoning]';
      case 'tool-call':
        return `[tool: ${formatPreviewLabel((part as { toolName?: unknown }).toolName, 'unknown')}]`;
      case 'tool-result': {
        const toolResult = part as {
          providerMetadata?: Record<string, unknown>;
          providerOptions?: Record<string, unknown>;
        };
        const mastraMeta = (toolResult.providerMetadata?.mastra ?? toolResult.providerOptions?.mastra) as
          | Record<string, unknown>
          | undefined;
        const toolName = formatPreviewLabel((part as { toolName?: unknown }).toolName, 'unknown');
        if (mastraMeta?.modelOutput !== undefined) {
          return formatToolResultPreviewValue(mastraMeta.modelOutput);
        }
        return `[tool-result: ${toolName}]`;
      }
      default:
        return `[${part.type}]`;
    }
  }

  if ('content' in part && typeof part.content === 'string') {
    return part.content;
  }

  return '[object]';
}

function summarizeMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(summarizePart).filter(Boolean).join('');
  }

  if (content && typeof content === 'object') {
    if ('parts' in content && Array.isArray(content.parts)) {
      return content.parts.map(summarizePart).filter(Boolean).join('');
    }

    return summarizePart(content);
  }

  if (content == null) {
    return '';
  }

  return String(content);
}

function appendToolPreview(preview: string, toolCalls: unknown): string {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return preview;
  }

  const toolPreview = toolCalls
    .map(toolCall => summarizePart(toolCall))
    .filter(Boolean)
    .join(' ');

  if (!toolPreview) {
    return preview;
  }

  return preview ? `${preview} ${toolPreview}` : toolPreview;
}

function appendPreview(preview: string, addition: string): string {
  if (!addition) {
    return preview;
  }

  return preview ? `${preview} ${addition}` : addition;
}

function normalizeMessages(messages: unknown[]): Array<{ role: string; content: string }> {
  return messages.map(message => {
    if (!message || typeof message !== 'object') {
      return { role: 'user', content: summarizeMessageContent(message) };
    }

    const role = typeof (message as { role?: unknown }).role === 'string' ? (message as { role: string }).role : 'user';

    const baseContent = summarizeMessageContent((message as { content?: unknown }).content);
    const contentWithToolArrays = appendToolPreview(
      appendToolPreview(baseContent, (message as { toolCalls?: unknown }).toolCalls),
      (message as { tool_calls?: unknown }).tool_calls,
    );
    const functionCall = (message as { functionCall?: unknown }).functionCall;
    const functionCallPreview = functionCall === undefined ? '' : summarizePart({ functionCall });
    const functionCallSnakeCase = (message as { function_call?: unknown }).function_call;
    const functionCallSnakeCasePreview =
      functionCallSnakeCase === undefined ? '' : summarizePart({ function_call: functionCallSnakeCase });
    const contentWithFunctionCall = appendPreview(
      appendPreview(contentWithToolArrays, functionCallPreview),
      functionCallSnakeCasePreview,
    );

    return { role, content: contentWithFunctionCall };
  });
}

function summarizeRequestBody(body: unknown): StepInputPreview {
  if (body == null) {
    return undefined;
  }

  if (typeof body !== 'object') {
    return typeof body === 'string' ? body : String(body);
  }

  if (Array.isArray((body as { messages?: unknown }).messages)) {
    return normalizeMessages((body as { messages: unknown[] }).messages);
  }

  if (Array.isArray((body as { input?: unknown }).input)) {
    return normalizeMessages((body as { input: unknown[] }).input);
  }

  if (Array.isArray((body as { contents?: unknown }).contents)) {
    return (body as { contents: Array<{ role?: unknown; parts?: unknown[] }> }).contents.map(item => ({
      role: typeof item?.role === 'string' ? item.role : 'user',
      content: Array.isArray(item?.parts) ? item.parts.map(summarizePart).filter(Boolean).join('') : '',
    }));
  }

  const summary: Record<string, unknown> = {};

  if (typeof (body as { model?: unknown }).model === 'string') {
    summary.model = (body as { model: string }).model;
  }

  const bodyKeys = Object.keys(body as Record<string, unknown>).filter(key => key !== 'body');
  if (bodyKeys.length > 0) {
    summary.keys = bodyKeys;
  }

  return Object.keys(summary).length > 0 ? summary : '[request body]';
}

/**
 * Extract a shallow conversation preview for model_step span input.
 */
function extractStepInput(payload?: StepStartPayload): StepInputPreview {
  if (Array.isArray(payload?.inputMessages)) {
    return normalizeMessages(payload.inputMessages);
  }

  const request = payload?.request;
  if (!request) return undefined;

  const { body } = request;
  if (body == null) return request;

  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return summarizeRequestBody(parsed);
  } catch {
    // body was not valid JSON; return as-is
    return request;
  }
}

/**
 * Chunks that come from the model provider. The first one marks the response's
 * first chunk, matching OTel's `gen_ai.response.time_to_first_chunk`. Everything
 * else, such as lifecycle markers or `data-*` parts a processor writes before the
 * model call, is Mastra's own and does not count.
 */
const MODEL_RESPONSE_CHUNK_TYPES = new Set<string>([
  'response-metadata',
  'raw',
  'text-start',
  'text-delta',
  'reasoning-start',
  'reasoning-delta',
  'reasoning-file',
  'tool-call-input-streaming-start',
  'tool-call-delta',
  'tool-call',
  'source',
  'file',
]);

/**
 * Manages MODEL_STEP and MODEL_CHUNK span tracking for streaming Model responses.
 *
 * Should be instantiated once per MODEL_GENERATION span and shared across
 * all streaming steps (including after tool calls).
 */
export class ModelSpanTracker {
  #modelSpan?: Span<SpanType.MODEL_GENERATION>;
  #currentStepSpan?: Span<SpanType.MODEL_STEP>;
  #currentInferenceSpan?: Span<SpanType.MODEL_INFERENCE>;
  #stepHasInference = false;
  #tracksProviderStream = false;
  #currentChunkSpan?: Span<SpanType.MODEL_CHUNK>;
  #currentChunkType?: string;
  #accumulator: Record<string, any> = {};
  #stepIndex: number = 0;
  #chunkSequence: number = 0;
  #completionStartTime?: Date;
  #inferenceCompletionStartTime?: Date;
  /**
   * True between a step's `step-start` and `step-finish` chunks, the window in which
   * the provider responds. Chunks outside it, such as a `tool-call` replayed for a
   * finished background task on resume, are Mastra's own and never start the clock.
   * Durable runs wrap one step's provider stream at a time, so every chunk there counts.
   */
  #inModelResponse = false;
  /** Set only by the agent's main loop; receives the first chunk's completionStartTime. */
  #agentRunSpan?: Span<SpanType.AGENT_RUN>;
  #currentStepInputIsFinal: boolean = false;
  /** When true, step-finish chunks don't auto-close the step span (for durable execution) */
  #deferStepClose: boolean = false;
  /** Stored step-finish payload when defer mode is enabled */
  #pendingStepFinishPayload?: StepFinishPayload<any, any>;
  #pendingInferenceFinish?: StepFinishPayload<any, any>;
  /** Static request-side context applied to every MODEL_INFERENCE span */
  #inferenceContext?: ModelInferenceContext;

  constructor(modelSpan?: Span<SpanType.MODEL_GENERATION>, options?: ModelSpanTrackerOptions) {
    this.#modelSpan = modelSpan;
    this.#agentRunSpan = options?.agentRunSpan;
  }

  /**
   * Set request-side context applied to subsequent MODEL_INFERENCE spans.
   * No-op when paired with an older @mastra/core that lacks the feature flag.
   */
  setInferenceContext(context: ModelInferenceContext): void {
    this.#inferenceContext = context;
  }

  /**
   * Record when the provider's first chunk arrived and copy that clock up the
   * agent's own chain (inference → step → generation → agent run), first write
   * wins at each level. Time to first chunk is derived later as
   * `completionStartTime - startTime` on whichever span is being read.
   */
  #captureCompletionStartTime(): void {
    this.#ensureStepAndInference();
    if (this.#inferenceCompletionStartTime) return;
    const now = new Date();
    this.#inferenceCompletionStartTime = now;
    this.#completionStartTime ??= now;
    for (const span of [this.#currentStepSpan, this.#modelSpan, this.#agentRunSpan]) {
      if (span && !span.attributes?.completionStartTime) {
        span.update({ attributes: { completionStartTime: now } });
      }
    }
  }

  /**
   * Get the tracing context for creating child spans.
   * Returns the current step span if active, otherwise the model span.
   */
  getTracingContext(): TracingContext {
    return {
      currentSpan: this.#currentStepSpan ?? this.#modelSpan,
    };
  }

  /**
   * Report an error on the generation span, also closing any still-open
   * MODEL_INFERENCE / MODEL_STEP children so a fatal error before step-finish
   * doesn't leave them dangling. No-op if they were already closed.
   */
  reportGenerationError(options: ErrorSpanOptions<SpanType.MODEL_GENERATION>): void {
    const termination =
      options.outcome != null
        ? { outcome: options.outcome, stopReason: options.stopReason, stopReasonContext: options.stopReasonContext }
        : coreObservability.executionFailureTermination?.(options.error);
    if (this.#currentInferenceSpan) {
      this.#currentInferenceSpan.error({ error: options.error, ...termination, endSpan: true });
      this.#currentInferenceSpan = undefined;
    }
    if (this.#currentStepSpan) {
      this.#currentStepSpan.error({ error: options.error, ...termination, endSpan: true });
      this.#currentStepSpan = undefined;
    }
    this.#modelSpan?.error(options);
  }

  /**
   * End the generation span with optional raw usage data.
   * If usage is provided, it will be converted to UsageStats with cache token details.
   */
  endGeneration(options?: EndGenerationOptions): void {
    const { usage, providerMetadata, stepProviderMetadata, ...spanOptions } = options ?? {};
    const model =
      spanOptions.attributes?.responseModel ??
      this.#modelSpan?.attributes?.responseModel ??
      this.#modelSpan?.attributes?.model;
    const providerCostContext = getOpenRouterCostContext({ providerMetadata, stepProviderMetadata }, model);

    if (providerCostContext && !spanOptions.attributes) {
      spanOptions.attributes = {};
    }

    if (spanOptions.attributes) {
      // Durable execution ends the generation from a fresh tracker and passes the
      // clock it carried through the loop state.
      spanOptions.attributes.completionStartTime =
        this.#completionStartTime ?? spanOptions.attributes.completionStartTime;
      spanOptions.attributes.usage = extractUsageMetrics(usage, providerMetadata);
      spanOptions.attributes.costContext = providerCostContext ?? spanOptions.attributes.costContext;
      if (!spanOptions.attributes.costContext) {
        spanOptions.attributes.costContext = getGatewayCostContext({ stepProviderMetadata });
      }
    }

    // Cancellation and deadlines terminate work that is still active. A loop
    // limit such as max_steps must not relabel a completed logical step.
    if (spanOptions.outcome === 'abort' || spanOptions.stopReason === 'timeout') {
      const termination = {
        outcome: spanOptions.outcome,
        stopReason: spanOptions.stopReason,
        stopReasonContext: spanOptions.stopReasonContext,
      };
      this.#endChunkSpan();
      this.#currentStepSpan?.endTree(termination);
      this.#currentStepSpan = undefined;
      this.#currentInferenceSpan = undefined;
      this.#currentStepInputIsFinal = false;
    }
    this.#modelSpan?.end(spanOptions);
  }

  getCompletionStartTime(): Date | undefined {
    return this.#completionStartTime;
  }

  /**
   * Update the generation span
   */
  updateGeneration(options: UpdateSpanOptions<SpanType.MODEL_GENERATION>): void {
    this.#modelSpan?.update(options);
  }

  /**
   * Enable or disable deferred step closing for durable execution.
   * When enabled, step-finish chunks won't automatically close the step span.
   * Use exportCurrentStep() to get the span data, then close it manually later.
   */
  setDeferStepClose(defer: boolean): void {
    this.#deferStepClose = defer;
  }

  /**
   * Export the current step span for later rebuilding (durable execution).
   * Returns undefined if no step span is active.
   */
  exportCurrentStep(): ReturnType<Span<SpanType.MODEL_STEP>['snapshot']> | undefined {
    return this.#currentStepSpan?.snapshot();
  }

  /**
   * Get the pending step finish payload (captured when defer mode is enabled).
   * This contains usage, finishReason, etc. for closing the step later.
   */
  getPendingStepFinishPayload(): StepFinishPayload<any, any> | undefined {
    return this.#pendingStepFinishPayload;
  }

  /**
   * Set the starting step index for durable execution.
   * Used when resuming across agentic loop iterations to maintain step continuity.
   */
  setStepIndex(index: number): void {
    this.#stepIndex = index;
  }

  /**
   * Get the current step index.
   */
  getStepIndex(): number {
    return this.#stepIndex;
  }

  /**
   * Start a new Model execution step.
   * This should be called at the beginning of LLM execution to capture accurate startTime.
   * The step-start chunk payload can be passed later via updateStep() if needed.
   *
   * Note: this only opens MODEL_STEP. The MODEL_INFERENCE child span is opened
   * separately via startInference() so its duration excludes input processor work.
   * Callers that don't call startInference() explicitly will get one auto-created
   * when the first model chunk arrives.
   */
  startStep(payload?: StepStartPayload): void {
    // Don't create duplicate step spans
    if (this.#currentStepSpan) {
      return;
    }

    this.#stepHasInference = false;
    const input = extractStepInput(payload);
    this.#currentStepSpan = this.#modelSpan?.createChildSpan({
      name: `step: ${this.#stepIndex}`,
      type: SpanType.MODEL_STEP,
      outcome: null,
      attributes: {
        stepIndex: this.#stepIndex,
        ...(payload?.messageId ? { messageId: payload.messageId } : {}),
        ...(payload?.warnings?.length ? { warnings: payload.warnings } : {}),
      },
      input,
      tracingPolicy: this.#modelSpan?.tracingPolicy,
    });
    this.#currentStepInputIsFinal = Array.isArray(payload?.inputMessages);
    // Reset chunk sequence and first-chunk clock for new step
    this.#chunkSequence = 0;
    this.#inferenceCompletionStartTime = undefined;
  }

  /**
   * End the current MODEL_INFERENCE span when the provider stream finishes.
   * Fields are duplicated onto MODEL_STEP (in #endStepSpan) so existing
   * integrations that read usage/finishReason from the step span continue
   * to work unchanged.
   *
   * Safe to call multiple times - no-ops if the span is already closed.
   */
  #endInferenceSpan<OUTPUT>(payload: StepFinishPayload<any, OUTPUT>): void {
    if (!this.#currentInferenceSpan) return;
    payload = this.#pendingInferenceFinish ?? payload;
    this.#pendingInferenceFinish = undefined;

    const { usage: rawUsage, ...otherOutput } = payload.output;
    const usage = extractUsageMetrics(rawUsage, payload.metadata?.providerMetadata);
    const responseModel = typeof payload.metadata?.modelId === 'string' ? payload.metadata.modelId : undefined;

    this.#currentInferenceSpan.end({
      // This is the provider stream's completion boundary, before tool work
      // or a later continuation decision can change the enclosing run's result.
      ...coreObservability.agentLoopTermination?.({
        stopCause: 'model_finished',
        finishReason: payload.stepResult.reason,
      }),
      ...(payload.stepResult.reason === 'error'
        ? { outcome: 'error' as const, stopReason: 'model_error' as const }
        : {}),
      output: otherOutput,
      attributes: {
        usage,
        finishReason: payload.stepResult.reason,
        warnings: payload.stepResult.warnings,
        completionStartTime: this.#inferenceCompletionStartTime,
        ...(responseModel?.trim() ? { responseModel } : {}),
      },
    });
    this.#currentInferenceSpan = undefined;
    this.#inferenceCompletionStartTime = undefined;
  }

  /**
   * Open the MODEL_INFERENCE span for the current step. Chunks (including tool-call
   * chunks emitted by the model) parent under this span so its duration reflects
   * pure model latency.
   *
   * Should be called immediately before invoking the model — after any input
   * processors / `prepareStep` work has completed — so the span's startTime
   * does not include processor time. The latest `#inferenceContext` (set via
   * setInferenceContext) is snapshotted onto the span at creation.
   *
   * No-ops when the installed @mastra/core lacks the `model-inference-span`
   * feature flag, or when called without an active step span. Auto-invoked from
   * chunk handlers as a safety net; explicit callers get the most accurate
   * start time.
   *
   * `payload.modelId` / `payload.provider` name the model the caller is about
   * to invoke and are recorded on MODEL_STEP, also when a fallback attempt
   * reuses the step's open inference span. The safety net never records them:
   * a replayed step-start chunk names the model of the original call.
   */
  startInference(payload?: StepStartPayload): void {
    if (payload?.modelId && payload.provider) {
      this.#currentStepSpan?.update({ attributes: { model: payload.modelId, provider: payload.provider } });
    }
    this.#openInference(payload);
  }

  /** Finish only the provider request; the logical step may still run processors or tools. */
  finishInference(payload: StepFinishPayload): void {
    // The upstream provider may finish before queued chunks reach wrapStream.
    // Retain its result, then close only after downstream chunk processing.
    this.#pendingInferenceFinish = payload;
  }

  /** End the current attempt only; generation and agent spans belong to their owners. */
  endAttempt(termination: SpanTermination): void {
    const payload = this.#pendingStepFinishPayload ?? this.#pendingInferenceFinish;
    if (payload) {
      this.#endStepSpan(payload, termination);
    } else {
      this.#endChunkSpan();
      this.#currentInferenceSpan?.end(termination);
      this.#currentStepSpan?.end(termination);
      this.#currentStepSpan = undefined;
      this.#currentInferenceSpan = undefined;
    }
    this.#pendingStepFinishPayload = undefined;
    this.#pendingInferenceFinish = undefined;
    this.#inferenceCompletionStartTime = undefined;
    this.#currentStepInputIsFinal = false;
  }

  #openInference(payload?: StepStartPayload): void {
    if (!supportsModelInference()) {
      return;
    }
    if (!this.#currentStepSpan || this.#currentInferenceSpan) {
      return;
    }

    this.#inferenceCompletionStartTime = undefined;
    this.#pendingInferenceFinish = undefined;
    const input = extractStepInput(payload);
    const generationAttrs = this.#modelSpan?.attributes;
    const ctx = this.#inferenceContext;
    this.#stepHasInference = true;
    this.#currentInferenceSpan = this.#currentStepSpan.createChildSpan({
      name: `inference: ${this.#stepIndex}`,
      type: SpanType.MODEL_INFERENCE,
      outcome: null,
      attributes: {
        stepIndex: this.#stepIndex,
        model: generationAttrs?.model,
        provider: generationAttrs?.provider,
        streaming: generationAttrs?.streaming,
        ...(ctx?.parameters !== undefined ? { parameters: ctx.parameters } : {}),
        ...(ctx?.providerOptions !== undefined ? { providerOptions: ctx.providerOptions } : {}),
        ...(ctx?.availableTools !== undefined ? { availableTools: ctx.availableTools } : {}),
        ...(ctx?.tools !== undefined ? { tools: ctx.tools } : {}),
        ...(ctx?.toolChoice !== undefined ? { toolChoice: ctx.toolChoice } : {}),
        ...(ctx?.responseFormat !== undefined ? { responseFormat: ctx.responseFormat } : {}),
      },
      input,
      tracingPolicy: this.#modelSpan?.tracingPolicy,
    });
  }

  /**
   * End the open MODEL_INFERENCE span as interrupted while keeping MODEL_STEP open,
   * so a replacement request for the same step gets its own inference span.
   */
  interruptInference(
    termination: SpanTermination = { outcome: 'interrupted', stopReason: null, stopReasonContext: null },
  ): void {
    this.#endChunkSpan();
    if (!this.#currentInferenceSpan) return;
    this.#currentInferenceSpan.end({
      attributes: { finishReason: 'interrupted' },
      ...termination,
    });
    this.#currentInferenceSpan = undefined;
    this.#inferenceCompletionStartTime = undefined;
    this.#pendingInferenceFinish = undefined;
  }

  /**
   * Update the current step span with additional payload data.
   * Called when step-start chunk arrives with request/warnings info.
   */
  updateStep(payload?: StepStartPayload): void {
    if (!this.#currentStepSpan || !payload) {
      return;
    }

    const hasFinalInput = Array.isArray(payload.inputMessages);
    const input = hasFinalInput || !this.#currentStepInputIsFinal ? extractStepInput(payload) : undefined;

    // Update span with request/warnings from the step-start chunk
    this.#currentStepSpan.update({
      ...(input !== undefined ? { input } : {}),
      attributes: {
        ...(payload.messageId ? { messageId: payload.messageId } : {}),
        ...(payload.warnings?.length ? { warnings: payload.warnings } : {}),
      },
    });
    if (hasFinalInput) {
      this.#currentStepInputIsFinal = true;
    }
  }

  /**
   * End the current Model execution step with token usage, finish reason, output, and metadata
   */
  #endStepSpan<OUTPUT>(payload: StepFinishPayload<any, OUTPUT>, termination?: SpanTermination) {
    // Flush any pending chunk span before ending the step
    // (handles case where text-delta arrives without text-end)
    this.#endChunkSpan();

    if (!this.#currentStepSpan) return;

    // Extract all data from step-finish chunk
    const output = payload.output;
    const { usage: rawUsage, ...otherOutput } = output;
    const stepResult = payload.stepResult;
    const metadata = payload.metadata;

    // Convert raw usage to UsageStats with cache token details
    const usage = extractUsageMetrics(rawUsage, metadata?.providerMetadata);

    // Remove verbose/redundant fields from metadata:
    // - request: too verbose
    // - body: raw provider HTTP response body; duplicates output/usage and can be very large.
    //   `headers` is intentionally kept: it carries provider request IDs and rate-limit info
    //   that are useful when debugging with the provider.
    // - id/timestamp: chunk-level data, not step-related
    // - modelId/modelVersion/modelProvider: duplicates of modelMetadata
    const cleanMetadata = metadata ? { ...metadata } : undefined;
    if (cleanMetadata) {
      for (const key of ['request', 'body', 'id', 'timestamp', 'modelId', 'modelVersion', 'modelProvider']) {
        delete cleanMetadata[key];
      }
    }

    // Inference may already be closed (closed eagerly on step-finish in defer
    // mode so its duration reflects pure model latency, not subsequent tool
    // execution). Close it here for the non-deferred path.
    this.#endInferenceSpan(payload);

    this.#currentStepSpan.end({
      ...(termination ??
        coreObservability.agentLoopTermination?.({
          stopCause: 'model_finished',
          finishReason: stepResult.reason,
          tripwire: output.steps?.at(-1)?.tripwire,
        })),
      output: otherOutput,
      attributes: {
        usage,
        isContinued: stepResult.isContinued,
        finishReason: stepResult.reason,
        warnings: stepResult.warnings,
      },
      metadata: {
        ...cleanMetadata,
      },
    });
    this.#currentStepSpan = undefined;
    this.#currentStepInputIsFinal = false;
    this.#stepIndex++;
  }

  /**
   * A suspended step emits no step-finish; its suspension chunk carries the
   * step usage instead. Close MODEL_INFERENCE and MODEL_STEP with that usage so
   * the suspended call is not reported without tokens.
   */
  #endSuspendedStep<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    if (chunk.type !== 'tool-call-suspended' && chunk.type !== 'tool-call-approval') return;
    const usage = chunk.payload.usage;
    if (!usage) return;

    this.#inModelResponse = false;
    this.#endStepSpan(
      {
        output: { usage },
        stepResult: { reason: 'suspended', isContinued: false, warnings: [] },
        metadata: {},
      } as unknown as StepFinishPayload<any, OUTPUT>,
      coreObservability.agentLoopTermination?.({
        finishReason: 'suspended',
        suspension: {
          approvalRequired: chunk.type === 'tool-call-approval',
          toolCallId: chunk.payload.toolCallId,
          toolName: chunk.payload.toolName,
        },
      }),
    );
  }

  /**
   * Returns the parent span for chunks. Chunks parent under MODEL_INFERENCE
   * (the provider call) when available, falling back to MODEL_STEP only if
   * startStep() was bypassed.
   */
  #chunkParent(): Span<SpanType.MODEL_INFERENCE> | Span<SpanType.MODEL_STEP> | undefined {
    return this.#currentInferenceSpan ?? this.#currentStepSpan;
  }

  /**
   * Safety-net invoked from chunk handlers: auto-create MODEL_STEP and
   * MODEL_INFERENCE if a chunk arrives before the loop has explicitly opened
   * them, so chunks parent under MODEL_INFERENCE rather than falling through
   * to MODEL_STEP. Idempotent — each public start* method is itself a no-op
   * when its span is already live.
   */
  #ensureStepAndInference(): void {
    if (!this.#currentStepSpan) {
      this.startStep();
    }
    // Post-provider tool events belong to the logical step. They must not
    // fabricate another inference; real replacement requests open explicitly.
    if (!this.#currentInferenceSpan && !this.#stepHasInference) {
      this.#openInference();
    }
  }

  /**
   * Create a new chunk span (for multi-part chunks like text-start/delta/end)
   */
  #startChunkSpan(chunkType: string, initialData?: Record<string, any>) {
    // End any existing chunk span before starting a new one
    // (handles transitions like text-delta → tool-call without text-end)
    this.#endChunkSpan();

    this.#ensureStepAndInference();

    this.#currentChunkSpan = this.#chunkParent()?.createChildSpan({
      name: `chunk: '${chunkType}'`,
      type: SpanType.MODEL_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.#chunkSequence,
      },
      tracingPolicy: this.#modelSpan?.tracingPolicy,
    });
    this.#currentChunkType = chunkType;
    this.#accumulator = initialData || {};
  }

  /**
   * Append string content to a specific field in the accumulator
   */
  #appendToAccumulator(field: string, text: string) {
    if (this.#accumulator[field] === undefined) {
      this.#accumulator[field] = text;
    } else {
      this.#accumulator[field] += text;
    }
  }

  /**
   * End the current chunk span.
   * Safe to call multiple times - will no-op if span already ended.
   */
  #endChunkSpan(output?: any) {
    if (!this.#currentChunkSpan) return;

    this.#currentChunkSpan.end({
      output: output !== undefined ? output : this.#accumulator,
    });
    this.#currentChunkSpan = undefined;
    this.#currentChunkType = undefined;
    this.#accumulator = {};
    this.#chunkSequence++;
  }

  /**
   * Create an event span (for single chunks like tool-call)
   */
  #createEventSpan(
    chunkType: string,
    output: any,
    options?: { attributes?: Record<string, any>; metadata?: Record<string, any> },
  ) {
    this.#ensureStepAndInference();

    const span = this.#chunkParent()?.createEventSpan({
      name: `chunk: '${chunkType}'`,
      type: SpanType.MODEL_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.#chunkSequence,
        ...options?.attributes,
      },
      metadata: options?.metadata,
      output,
      tracingPolicy: this.#modelSpan?.tracingPolicy,
    });

    if (span) {
      this.#chunkSequence++;
    }
  }

  /**
   * Check if there is currently an active chunk span
   */
  #hasActiveChunkSpan(): boolean {
    return !!this.#currentChunkSpan;
  }

  /**
   * Get the current accumulator value
   */
  #getAccumulator(): Record<string, any> {
    return this.#accumulator;
  }

  /**
   * Handle text chunk spans (text-start/delta/end)
   */
  #handleTextChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    switch (chunk.type) {
      case 'text-start':
        this.#startChunkSpan('text');
        break;

      case 'text-delta':
        // Auto-create span if we receive text-delta without text-start
        // (AI SDK streaming doesn't always emit wrapper events)
        // Allow transition from any other chunk type
        if (this.#currentChunkType !== 'text') {
          this.#startChunkSpan('text');
        }
        this.#appendToAccumulator('text', chunk.payload.text);
        break;

      case 'text-end': {
        this.#endChunkSpan();
        break;
      }
    }
  }

  /**
   * Handle reasoning chunk spans (reasoning-start/delta/end)
   */
  #handleReasoningChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    switch (chunk.type) {
      case 'reasoning-start':
        this.#startChunkSpan('reasoning');
        break;

      case 'reasoning-delta':
        // Auto-create span if we receive reasoning-delta without reasoning-start
        // (AI SDK streaming doesn't always emit wrapper events)
        // Allow transition from any other chunk type
        if (this.#currentChunkType !== 'reasoning') {
          this.#startChunkSpan('reasoning');
        }
        this.#appendToAccumulator('text', chunk.payload.text);
        break;

      case 'reasoning-end': {
        this.#endChunkSpan();
        break;
      }
    }
  }

  /**
   * Handle tool call chunk spans (tool-call-input-streaming-start/delta/end, tool-call)
   */
  #handleToolCallChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    switch (chunk.type) {
      case 'tool-call-input-streaming-start':
        this.#startChunkSpan('tool-call', {
          toolName: chunk.payload.toolName,
          toolCallId: chunk.payload.toolCallId,
        });
        break;

      case 'tool-call-delta':
        this.#appendToAccumulator('toolInput', chunk.payload.argsTextDelta);
        break;

      case 'tool-call-input-streaming-end':
      case 'tool-call': {
        // Build output with toolName, toolCallId, and parsed toolInput
        const acc = this.#getAccumulator();
        let toolInput;
        try {
          toolInput = acc.toolInput ? JSON.parse(acc.toolInput) : {};
        } catch {
          toolInput = acc.toolInput; // Keep as string if parsing fails
        }
        this.#endChunkSpan({
          toolName: acc.toolName,
          toolCallId: acc.toolCallId,
          toolInput,
        });
        break;
      }
    }
  }

  /**
   * Handle object chunk spans (object, object-result)
   */
  #handleObjectChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    switch (chunk.type) {
      case 'object':
        // Start span on first partial object chunk (only if not already started)
        // Multiple object chunks may arrive as the object is being generated
        // Check specifically for object chunk type to allow transitioning from other types
        if (this.#currentChunkType !== 'object') {
          this.#startChunkSpan('object');
        }
        break;

      case 'object-result':
        // End the span with the final complete object as output
        this.#endChunkSpan(chunk.object);
        break;
    }
  }

  /**
   * Handle tool-call-approval chunks.
   * Creates a span for approval requests so they can be seen in traces for debugging.
   */
  #handleToolApprovalChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    if (chunk.type !== 'tool-call-approval') return;
    const payload = chunk.payload;

    // Only the first approval request of a step carries its usage. A later one (surfaced after
    // that step was closed, e.g. in the leg resumed by the first approval) belongs to no model
    // call, so record it under the generation instead of opening empty step spans.
    if (payload.usage || this.#currentStepSpan) {
      this.#ensureStepAndInference();
    }
    const parent = this.#chunkParent() ?? this.#modelSpan;

    // Create an event span for the approval request
    // Using createEventSpan since approvals are point-in-time events (not time ranges)
    const span = parent?.createEventSpan({
      name: `chunk: 'tool-call-approval'`,
      type: SpanType.MODEL_CHUNK,
      attributes: {
        chunkType: 'tool-call-approval',
        sequenceNumber: this.#chunkSequence,
      },
      output: payload,
      tracingPolicy: this.#modelSpan?.tracingPolicy,
    });

    if (span) {
      this.#chunkSequence++;
    }
  }
  /**
   * Wraps a stream with model tracing transform to track MODEL_STEP and MODEL_CHUNK spans.
   *
   * This should be added to the stream pipeline to automatically
   * create MODEL_STEP and MODEL_CHUNK spans for each semantic unit in the stream.
   */
  /** Track physical provider chunks before processors can buffer or replace them. */
  wrapInferenceStream<T extends { pipeThrough: Function }>(stream: T): T {
    this.#tracksProviderStream = true;
    return this.wrapStream(stream, true);
  }

  wrapStream<T extends { pipeThrough: Function }>(stream: T, inferenceOnly = false): T {
    return stream.pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          if (
            !inferenceOnly &&
            this.#tracksProviderStream &&
            (MODEL_RESPONSE_CHUNK_TYPES.has(chunk.type) ||
              ['text-end', 'reasoning-end', 'tool-call-input-streaming-end', 'object', 'object-result'].includes(
                chunk.type,
              ))
          ) {
            controller.enqueue(chunk);
            return;
          }
          if (
            (inferenceOnly || this.#inModelResponse || this.#deferStepClose) &&
            MODEL_RESPONSE_CHUNK_TYPES.has(chunk.type)
          ) {
            this.#captureCompletionStartTime();
          }

          // Close the suspended step before forwarding: downstream handling of
          // the suspension finishes the run and ends the span tree.
          if (chunk.type === 'tool-call-suspended' || chunk.type === 'tool-call-approval') {
            if (chunk.type === 'tool-call-approval') {
              this.#handleToolApprovalChunk(chunk);
            }
            this.#endSuspendedStep(chunk);
          }

          // Handle chunk span tracking based on chunk type
          switch (chunk.type) {
            case 'text-start':
            case 'text-delta':
            case 'text-end':
              this.#handleTextChunk(chunk);
              break;

            case 'tool-call-input-streaming-start':
            case 'tool-call-delta':
            case 'tool-call-input-streaming-end':
            case 'tool-call':
              this.#handleToolCallChunk(chunk);
              break;

            case 'reasoning-start':
            case 'reasoning-delta':
            case 'reasoning-end':
              this.#handleReasoningChunk(chunk);
              break;

            case 'object':
            case 'object-result':
              this.#handleObjectChunk(chunk);
              break;

            case 'step-start':
              this.#inModelResponse = true;
              // If step already started (via startStep()), just update with payload data
              // Otherwise start a new step (for backwards compatibility)
              if (this.#currentStepSpan) {
                this.updateStep(chunk.payload);
              } else {
                this.startStep(chunk.payload);
              }
              // step-start fires when the provider stream has begun. Open the
              // inference span here as a safety net for callers that don't
              // explicitly call startInference() before invoking the model —
              // chunks that follow will parent under MODEL_INFERENCE.
              if (!this.#currentInferenceSpan && !this.#stepHasInference) {
                this.#openInference(chunk.payload);
              }
              break;

            case 'step-finish':
              this.#inModelResponse = false;
              if (this.#deferStepClose) {
                // Durable mode: save payload for later, don't close the step.
                // Close MODEL_INFERENCE eagerly though - the provider stream is
                // done, and any subsequent tool execution under the step should
                // not inflate inference duration.
                this.#pendingStepFinishPayload = chunk.payload;
                this.#endChunkSpan();
                this.#endInferenceSpan(chunk.payload);
              } else {
                // Normal mode: close the step immediately
                this.#endStepSpan(chunk.payload);
              }
              break;

            case 'tripwire': {
              // A tripwire chunk is a terminal runtime boundary; unlike a retry
              // step it closes the consumer without an onFinish callback.
              const termination = coreObservability.agentLoopTermination?.({ tripwire: chunk.payload });
              // Older supported core versions do not supply native outcomes.
              if (!termination) break;
              this.endAttempt(termination);
              break;
            }

            case 'finish':
              if (inferenceOnly) {
                this.#endChunkSpan();
                this.#endInferenceSpan(chunk.payload);
              }
              break;

            // Infrastructure chunks - skip creating spans for these
            // They are either redundant, metadata-only, or error/control flow
            case 'raw': // Redundant raw data
            case 'start': // Stream start marker
            case 'response-metadata': // Response metadata (not semantic content)
            case 'source': // Source references (metadata)
            case 'file': // Binary file data (too large/not semantic)
            case 'error': // Error handling
            case 'abort': // Abort signal
            case 'watch': // Internal watch event
            case 'tool-error': // Tool error handling
            case 'reasoning-signature': // Signature metadata
            case 'redacted-reasoning': // Redacted content metadata
            case 'step-output': // Step output wrapper (content is nested)
              // Don't create spans for these chunks
              break;

            case 'tool-call-suspended': // Suspension (handled before enqueue)
            case 'tool-call-approval': // Approval request (handled before enqueue)
              break;

            case 'tool-output':
              // tool-output chunks are streaming progress from tools (e.g., sub-agents)
              // No span created - the final tool-result event captures the result
              break;

            case 'tool-result': {
              // tool-result is always a point-in-time event span
              // (tool execution duration is captured by the parent tool_call span)
              const {
                // Metadata - tool call context (unique to tool-result chunks)
                toolCallId,
                toolName,
                isError,
                dynamic,
                providerExecuted,
                providerMetadata,
                // Keep provider-executed results on MODEL_CHUNK because they come
                // from the model/provider stream and may not have a sibling TOOL_CALL span.
                // For locally executed tools, the canonical payload lives on TOOL_CALL.
                result,
                // Stripped - redundant (already on TOOL_CALL span input)
                args: _args,
              } = (chunk.payload as Record<string, any>) || {};

              // All tool-result specific fields go in metadata
              const metadata: Record<string, any> = { toolCallId, toolName };
              if (isError !== undefined) metadata.isError = isError;
              if (dynamic !== undefined) metadata.dynamic = dynamic;
              if (providerExecuted !== undefined) metadata.providerExecuted = providerExecuted;
              if (providerMetadata !== undefined) metadata.providerMetadata = providerMetadata;

              const mastraMeta = providerMetadata?.mastra as Record<string, unknown> | undefined;
              const spanOutput = providerExecuted
                ? result
                : mastraMeta?.modelOutput !== undefined
                  ? mastraMeta.modelOutput
                  : undefined;

              this.#createEventSpan(chunk.type, spanOutput, { metadata });
              break;
            }

            // Default: skip creating spans for unrecognized chunk types
            // All semantic content chunks should be explicitly handled above
            // Unknown chunks are likely infrastructure or custom chunks that don't need tracing
            default:
              // No span created - reduces trace noise
              break;
          }
          controller.enqueue(chunk);
        },
      }),
    ) as T;
  }
}
