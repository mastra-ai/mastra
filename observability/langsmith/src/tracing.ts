/**
 * LangSmith Exporter for Mastra Tracing
 *
 * This exporter sends observability data to LangSmith
 * Root spans become top-level LangSmith RunTrees (no trace wrapper).
 * Events are handled as zero-duration RunTrees with matching start/end times.
 */

import { createHash } from 'node:crypto';
import type {
  AnyExportedSpan,
  ExportedScore,
  ModelGenerationAttributes,
  ScoreEvent,
  SpanErrorInfo,
} from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { TrackingExporter } from '@mastra/observability';
import type { TraceData, TrackingExporterConfig } from '@mastra/observability';
import type { ClientConfig, RunTreeConfig } from 'langsmith';
import { Client, RunTree } from 'langsmith';
import type { KVMap } from 'langsmith/schemas';
import type { LangSmithMetadataInput } from './helpers';
import { formatUsageMetrics } from './metrics';

export interface LangSmithExporterConfig extends ClientConfig, TrackingExporterConfig {
  /** LangSmith client instance */
  client?: Client;
  /**
   * The name of the LangSmith project to send traces to.
   * Overrides the LANGCHAIN_PROJECT environment variable.
   * If neither is set, traces are sent to the "default" project.
   */
  projectName?: string;
  /**
   * Maximum number of `spanId → langsmithRunId` mappings to keep in memory. The
   * cache lets `onScoreEvent` skip the LangSmith lookup for spans this process
   * exported; scores for spans outside the cache are still delivered. Older
   * entries are evicted in LRU order when the cap is exceeded.
   * Defaults to 10000.
   */
  runIdCacheMaxEntries?: number;
}

const DEFAULT_RUN_ID_CACHE_MAX_ENTRIES = 10_000;
/** Waits between LangSmith lookups for a span another process exported (ingestion takes ~5-8 s). */
const SCORE_LOOKUP_RETRY_DELAYS_MS = [2_000, 3_000, 5_000];

/** UUID v5 namespace for Mastra → LangSmith run ids. Changing it orphans existing runs from future scores. */
const RUN_ID_NAMESPACE = Buffer.from('a6f3c3f06b0e4a1e9f4c7e1b2d3c4f5a', 'hex');

/**
 * LangSmith run id for a Mastra id (UUID v5). Root runs use the Mastra trace id, every
 * other run uses its Mastra span id, so a score can be routed from any process without
 * remembering the ids LangSmith would otherwise allocate.
 */
export function langsmithRunIdFor(mastraId: string): string {
  const hash = createHash('sha1').update(RUN_ID_NAMESPACE).update(mastraId).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type LangSmithRoot = undefined;
type LangSmithSpan = RunTree;
type LangSmithEvent = RunTree;
type LangSmithMetadata = LangSmithMetadataInput;
type LangSmithTraceData = TraceData<LangSmithRoot, LangSmithSpan, LangSmithEvent, LangSmithMetadata>;

// Default span type for all spans
const DEFAULT_SPAN_TYPE = 'chain';

// Exceptions to the default mapping
const SPAN_TYPE_EXCEPTIONS: Partial<Record<SpanType, 'llm' | 'tool' | 'chain'>> = {
  [SpanType.MODEL_GENERATION]: 'llm',
  [SpanType.TOOL_CALL]: 'tool',
  [SpanType.MCP_TOOL_CALL]: 'tool',
  [SpanType.PROVIDER_TOOL_CALL]: 'tool',
  [SpanType.WORKFLOW_CONDITIONAL_EVAL]: 'chain',
  [SpanType.WORKFLOW_WAIT_EVENT]: 'chain',
};

// Mapping function - returns valid LangSmith span types
function mapSpanType(spanType: SpanType): 'llm' | 'tool' | 'chain' {
  return SPAN_TYPE_EXCEPTIONS[spanType] ?? DEFAULT_SPAN_TYPE;
}

function isKVMap(value: unknown): value is KVMap {
  return value != null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

export class LangSmithExporter extends TrackingExporter<
  LangSmithRoot,
  LangSmithSpan,
  LangSmithEvent,
  LangSmithMetadata,
  LangSmithExporterConfig
> {
  override name = 'langsmith';
  #client: Client | undefined;

  /**
   * Maps Mastra `span.id` to the run id this process gave its RunTree. Only a fast
   * path for `onScoreEvent`: ids are deterministic (see `langsmithRunIdFor`), so a
   * miss falls back to asking LangSmith which run exists.
   *
   * Bounded LRU keyed by Mastra span id — entries are evicted oldest-first when
   * size exceeds `#runIdCacheMaxEntries` so the cache cannot grow without bound.
   */
  #langsmithRunIdBySpanId = new Map<string, string>();
  /** Manual-mode client flushes, chained so an overlapping flush waits for the earlier upload */
  #manualFlushChain: Promise<void> = Promise.resolve();
  #runIdCacheMaxEntries: number;
  /** LangSmith project (session) id, which `createFeedback` now requires alongside the run id. */
  #feedbackSessionId?: Promise<string | undefined>;

  constructor(config: LangSmithExporterConfig = {}) {
    // Resolve env vars BEFORE calling super (config is readonly in base class)
    const apiKey = config.apiKey ?? process.env.LANGSMITH_API_KEY;

    super({
      ...config,
      apiKey,
    });

    this.#runIdCacheMaxEntries = Math.max(1, config.runIdCacheMaxEntries ?? DEFAULT_RUN_ID_CACHE_MAX_ENTRIES);

    if (!apiKey) {
      this.setDisabled(`Missing required credentials (apiKey: ${!!apiKey})`);
      return;
    }

    this.#client = config.client ?? new Client(this.config);
  }

  /** Look up the LangSmith runId for a Mastra span id, refreshing its LRU position on hit. */
  #getLangsmithRunId(spanId: string): string | undefined {
    const runId = this.#langsmithRunIdBySpanId.get(spanId);
    if (runId === undefined) return undefined;
    // Re-insert to mark as most-recently-used (Map preserves insertion order).
    this.#langsmithRunIdBySpanId.delete(spanId);
    this.#langsmithRunIdBySpanId.set(spanId, runId);
    return runId;
  }

  /** Remember the LangSmith runId for a Mastra span id, evicting oldest entries when full. */
  #rememberLangsmithRunId(spanId: string, runId: string): void {
    if (this.#langsmithRunIdBySpanId.has(spanId)) {
      this.#langsmithRunIdBySpanId.delete(spanId);
    }
    this.#langsmithRunIdBySpanId.set(spanId, runId);
    while (this.#langsmithRunIdBySpanId.size > this.#runIdCacheMaxEntries) {
      const oldest = this.#langsmithRunIdBySpanId.keys().next().value;
      if (oldest === undefined) break;
      this.#langsmithRunIdBySpanId.delete(oldest);
    }
  }

  /**
   * Send everything the LangSmith Client has queued. In manual flush mode only
   * `flush()` drains the queue (`awaitPendingTraceBatches()` just warns there);
   * otherwise `awaitPendingTraceBatches()` waits for queued and in-flight batches.
   */
  async #flushClient(): Promise<void> {
    if (!this.#client) return;
    // `manualFlushMode` is a private field in the SDK typings; fall back to our config
    const manualFlushMode =
      (this.#client as unknown as { manualFlushMode?: boolean }).manualFlushMode ?? this.config.manualFlushMode;
    if (manualFlushMode) {
      // The SDK's flush() empties its queue before uploading, so an overlapping call
      // would find nothing to wait for. Run each flush after the previous one settles.
      const client = this.#client;
      const flush = this.#manualFlushChain.then(() => client.flush());
      this.#manualFlushChain = flush.catch(() => {});
      await flush;
    } else {
      await this.#client.awaitPendingTraceBatches();
    }
  }

  /**
   * Flush pending trace batches to LangSmith.
   * The LangSmith Client internally batches API calls; this ensures
   * all queued runs are sent before the process exits or the flush
   * caller continues.
   */
  protected override async _flush(): Promise<void> {
    await this.#flushClient();
  }

  /** Spans aborted by shutdown() were only queued on the client; send them before releasing state. */
  protected override async _postShutdown(): Promise<void> {
    try {
      await this.#flushClient();
    } finally {
      this.#langsmithRunIdBySpanId.clear();
    }
  }

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    if (!this.#client) return;

    const { score } = event;
    const langsmithRunId = await this.#resolveLangsmithRunId(score);
    if (!langsmithRunId) {
      this.logger.warn(
        'LangSmith exporter: dropping score; no LangSmith run found for the target ' +
          '(score has neither traceId nor spanId, the span is not ingested yet, or it was exported by an older @mastra/langsmith)',
        {
          traceId: score.traceId,
          spanId: score.spanId,
          scorerId: score.scorerId,
        },
      );
      return;
    }

    const key = score.scorerName ?? score.scorerId;
    const sessionId = await this.#getFeedbackSessionId();

    try {
      await this.#client.createFeedback(langsmithRunId, key, {
        ...(sessionId ? { sessionId } : {}),
        score: score.score,
        ...(score.reason ? { comment: score.reason } : {}),
        feedbackId: score.scoreId,
        ...(score.scoreTraceId ? { sourceRunId: score.scoreTraceId } : {}),
        sourceInfo: {
          // User-supplied metadata is spread first so the authoritative reserved
          // fields below cannot be overwritten by `scorerId` / `scoreSource` keys
          // a caller may have set inside metadata.
          ...(score.metadata ?? {}),
          scorerId: score.scorerId,
          ...(score.scoreSource ? { scoreSource: score.scoreSource } : {}),
        },
      });
    } catch (err) {
      this.logger.error('LangSmith exporter: Failed to submit feedback', {
        error: err,
        traceId: score.traceId,
        spanId: score.spanId,
        scorerId: score.scorerId,
      });
    }
  }

  /**
   * Trace-level scores go to the root run (`langsmithRunIdFor(traceId)`). A span-level
   * score needs to know whether its span is that root: this process remembers the ids
   * it assigned; otherwise LangSmith is asked which of the two candidate runs exists.
   */
  async #resolveLangsmithRunId(score: ExportedScore): Promise<string | undefined> {
    const { traceId, spanId } = score;
    if (!spanId) return traceId ? langsmithRunIdFor(traceId) : undefined;

    const known = this.#getLangsmithRunId(spanId);
    if (known) return known;

    const asChild = langsmithRunIdFor(spanId);
    const asRoot = traceId ? langsmithRunIdFor(traceId) : undefined;
    // LangSmith makes posted runs readable a few seconds later, so a score that
    // arrives right after another process exported the span has to wait for it.
    for (let attempt = 0; ; attempt++) {
      if (await this.#readRun(asChild)) return asChild;
      if (asRoot) {
        const root = await this.#readRun(asRoot);
        if (root?.extra?.metadata?.mastra_span_id === spanId) return asRoot;
      }
      const delay = SCORE_LOOKUP_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) return undefined;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  async #readRun(runId: string): Promise<{ extra?: KVMap } | undefined> {
    try {
      return await this.#client!.readRun(runId);
    } catch {
      return undefined;
    }
  }

  #getFeedbackSessionId(): Promise<string | undefined> {
    if (!this.#feedbackSessionId) {
      const projectName =
        this.config.projectName ?? process.env.LANGSMITH_PROJECT ?? process.env.LANGCHAIN_PROJECT ?? 'default';
      this.#feedbackSessionId = Promise.resolve()
        .then(() => this.#client!.readProject({ projectName }))
        .then(project => project.id)
        .catch(err => {
          this.logger.debug('LangSmith exporter: could not resolve the project id for feedback', {
            projectName,
            error: err,
          });
          this.#feedbackSessionId = undefined;
          return undefined;
        });
    }
    return this.#feedbackSessionId;
  }

  protected override skipBuildRootTask = true;
  protected override async _buildRoot(_args: {
    span: AnyExportedSpan;
    traceData: LangSmithTraceData;
  }): Promise<LangSmithRoot | undefined> {
    throw new Error('Method not implemented.');
  }

  protected override async _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: LangSmithTraceData;
  }): Promise<LangSmithSpan | undefined> {
    const { span, traceData } = args;

    const parent = span.isRootSpan ? undefined : traceData.getParent(args);

    if (!span.isRootSpan && !parent) {
      // parent doesn't exist and not creating rootSpan, return early data
      return;
    }

    // The first root of a trace takes the trace id so trace-level scores find it;
    // any further root in the same Mastra trace keeps its own span id.
    const runId =
      span.isRootSpan && !traceData.isRootProcessed() ? langsmithRunIdFor(span.traceId) : langsmithRunIdFor(span.id);

    const payload = {
      name: span.name,
      id: runId,
      ...this.buildRunTreePayload(span, traceData, true),
    };

    const langSmithSpan = span.isRootSpan ? new RunTree(payload) : parent!.createChild(payload);
    this.#rememberLangsmithRunId(span.id, runId);

    await langSmithSpan.postRun();
    return langSmithSpan;
  }

  protected override async _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: LangSmithTraceData;
  }): Promise<LangSmithEvent | undefined> {
    const langSmithSpan = await this._buildSpan(args);

    if (!langSmithSpan) {
      // parent doesn't exist and not creating rootSpan, return early data
      return;
    }

    // use start-time as end-time to make an event span.
    await langSmithSpan.end({ endTime: args.span.startTime.getTime() });
    await langSmithSpan.patchRun();
    return langSmithSpan;
  }

  protected override async _updateSpan(args: { span: AnyExportedSpan; traceData: LangSmithTraceData }): Promise<void> {
    await this.handleSpanUpdateOrEnd({ ...args, isEnd: false });
  }

  protected override async _finishSpan(args: { span: AnyExportedSpan; traceData: LangSmithTraceData }): Promise<void> {
    await this.handleSpanUpdateOrEnd({ ...args, isEnd: true });
  }

  protected override async _abortSpan(args: {
    span: LangSmithSpan;
    traceData: LangSmithTraceData;
    reason: SpanErrorInfo;
  }): Promise<void> {
    const { span, reason } = args;
    span.error = reason.message;
    span.metadata = {
      ...span.metadata,
      errorDetails: reason,
    };
    await span.end();
    await span.patchRun();
  }

  private async handleSpanUpdateOrEnd(args: {
    span: AnyExportedSpan;
    traceData: LangSmithTraceData;
    isEnd: boolean;
  }): Promise<void> {
    const { span, traceData, isEnd } = args;

    const langSmithSpan = traceData.getSpan({ spanId: span.id });
    if (!langSmithSpan) {
      //update occurred before span start, return early data
      return;
    }

    const updatePayload = this.buildRunTreePayload(span, traceData);

    langSmithSpan.metadata = {
      ...langSmithSpan.metadata,
      ...updatePayload.metadata,
    };
    if (updatePayload.inputs != null) {
      langSmithSpan.inputs = updatePayload.inputs;
    }
    if (updatePayload.outputs != null) {
      langSmithSpan.outputs = updatePayload.outputs;
    }
    if (updatePayload.error != null) {
      langSmithSpan.error = updatePayload.error;
    }

    // Add new_token event for TTFT tracking on MODEL_GENERATION spans
    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = (span.attributes ?? {}) as ModelGenerationAttributes;
      if (modelAttr.completionStartTime !== undefined) {
        langSmithSpan.addEvent({
          name: 'new_token',
          time: modelAttr.completionStartTime.toISOString(),
        });
      }
    }

    // LangSmith accepts one update per run, so updates only mutate the local
    // RunTree and the single patch is sent on end with the final state.
    if (isEnd) {
      // End the span with the correct endTime
      if (span.endTime) {
        await langSmithSpan.end({ endTime: span.endTime.getTime() });
      } else {
        await langSmithSpan.end();
      }
      await langSmithSpan.patchRun();
    }
  }

  /**
   * Find LangSmith vendor metadata by walking up the span hierarchy and merging.
   * Metadata is merged from ancestors with child values taking precedence over parent values.
   *
   * TODO(2.0): Extract shared `findVendorMetadata()` to base TrackingExporter class
   * and reuse here and in LangfuseExporter.findLangfusePrompt()
   */
  private findLangsmithMetadata(
    traceData: LangSmithTraceData,
    span: AnyExportedSpan,
  ): LangSmithMetadataInput | undefined {
    // Collect metadata from all ancestors (current span first, then parents)
    const metadataChain: LangSmithMetadataInput[] = [];
    let currentSpanId: string | undefined = span.id;

    while (currentSpanId) {
      const providerMetadata = traceData.getMetadata({ spanId: currentSpanId });
      if (providerMetadata) {
        metadataChain.push(providerMetadata);
      }
      currentSpanId = traceData.getParentId({ spanId: currentSpanId });
    }

    if (metadataChain.length === 0) {
      return undefined;
    }

    // Merge from ancestors to current span (parent values first, child values override)
    const merged: LangSmithMetadataInput = {};
    for (let i = metadataChain.length - 1; i >= 0; i--) {
      const meta = metadataChain[i]!;
      if (meta.projectName !== undefined) merged.projectName = meta.projectName;
      if (meta.sessionId !== undefined) merged.sessionId = meta.sessionId;
      if (meta.sessionName !== undefined) merged.sessionName = meta.sessionName;
    }

    this.logger.debug(`${this.name}: merged vendor metadata from hierarchy`, {
      traceId: span.traceId,
      spanId: span.id,
      metadataKeys: Object.keys(merged),
      ancestorCount: metadataChain.length,
    });

    return merged;
  }

  /**
   * LangSmith groups runs into a Thread only by `session_id` / `thread_id` metadata and
   * needs it on every run of the trace. A child run follows the session its parent was
   * built with: sub-agents and Observational Memory run on derived threads, and their
   * own `threadId` would split the conversation into one-off Threads. The span's own
   * `sessionId` / `threadId` applies at the root, or when no ancestor carries a session.
   */
  private findSessionId(span: AnyExportedSpan, traceData: LangSmithTraceData): string | undefined {
    const inherited = span.isRootSpan ? undefined : traceData.getParent({ span })?.metadata?.session_id;
    if (typeof inherited === 'string' && inherited) return inherited;
    const own = span.metadata?.sessionId ?? span.metadata?.threadId;
    return typeof own === 'string' && own ? own : undefined;
  }

  private buildRunTreePayload(
    span: AnyExportedSpan,
    traceData: LangSmithTraceData,
    isNew = false,
  ): Partial<RunTreeConfig> {
    // Extract vendor metadata from span hierarchy
    const vendorMetadata = this.findLangsmithMetadata(traceData, span);

    // Build metadata, omitting the langsmith vendor key
    const spanMetadata = span.metadata ? omitKeys(span.metadata, ['langsmith']) : {};

    const payload: Partial<RunTreeConfig> & { metadata: KVMap } = {
      client: this.#client,
      metadata: {
        mastra_span_type: span.type,
        mastra_span_id: span.id,
        mastra_trace_id: span.traceId,
        ...spanMetadata,
      },
    };

    if (isNew) {
      payload.run_type = mapSpanType(span.type);
      payload.start_time = span.startTime.getTime();
    }

    // Add project name - vendor metadata takes precedence over config
    const projectName = vendorMetadata?.projectName ?? this.config.projectName;
    if (projectName) {
      payload.project_name = projectName;
    }

    // Explicit vendor sessionId wins; otherwise the Mastra conversation thread, so turns
    // on one memory thread land in one LangSmith Thread without extra setup.
    const sessionId = vendorMetadata?.sessionId ?? this.findSessionId(span, traceData);
    if (sessionId) {
      payload.metadata.session_id = sessionId;
    }
    if (vendorMetadata?.sessionName) {
      payload.metadata.session_name = vendorMetadata.sessionName;
    }

    // Add tags for root spans
    if (span.isRootSpan && span.tags?.length) {
      payload.tags = span.tags;
    }

    // Core span data
    if (span.input !== undefined) {
      payload.inputs = isKVMap(span.input) ? span.input : { input: span.input };
    }

    if (span.output !== undefined) {
      payload.outputs = isKVMap(span.output) ? span.output : { output: span.output };
    }

    const attributes = (span.attributes ?? {}) as Record<string, any>;

    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = attributes as ModelGenerationAttributes;

      // See: https://docs.langchain.com/langsmith/log-llm-trace
      if (modelAttr.model !== undefined) {
        // Note - this should map to a model name recognized by LangSmith
        // eg “gpt-4o-mini”, “claude-3-opus-20240307”, etc.
        payload.metadata.ls_model_name = modelAttr.model;
      }

      // Provider goes to metadata (if provided by attributes)
      if (modelAttr.provider !== undefined) {
        // Note - this should map to a provider name recognized by
        // LangSmith eg “openai”, “anthropic”, etc.
        payload.metadata.ls_provider = modelAttr.provider;
      }

      // Usage/token info goes to metrics
      payload.metadata.usage_metadata = formatUsageMetrics(modelAttr.usage);

      // Model parameters go to metadata
      if (modelAttr.parameters !== undefined) {
        payload.metadata.modelParameters = modelAttr.parameters;
      }

      // Other LLM attributes go to metadata
      const otherAttributes = omitKeys(attributes, ['model', 'provider', 'usage', 'parameters', 'completionStartTime']);
      payload.metadata = {
        ...payload.metadata,
        ...otherAttributes,
      };
    } else {
      // For non-LLM spans, put all attributes in metadata
      payload.metadata = {
        ...payload.metadata,
        ...attributes,
      };
    }

    // Handle errors
    if (span.errorInfo) {
      payload.error = span.errorInfo.message;
      payload.metadata.errorDetails = span.errorInfo;
    }

    return payload;
  }
}
