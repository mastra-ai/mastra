/**
 * Datadog Bridge for Mastra Observability
 *
 * This bridge enables bidirectional integration with dd-trace:
 * 1. Creates real dd-trace APM spans eagerly when Mastra spans are created
 * 2. Activates spans in dd-trace's scope so auto-instrumented operations
 *    (HTTP requests, database queries, etc.) have correct parent spans
 * 3. Emits LLMObs data retroactively when spans end, using dd-trace's
 *    own LLMObs pipeline for annotation and export
 *
 * This solves the core problem with the DatadogExporter: because the exporter
 * creates LLMObs spans retroactively (after execution completes), there is no
 * active dd-trace span in scope when tools and processors make outbound calls.
 * dd-trace's auto-instrumentation can't find the correct parent, so APM spans
 * fall back to the nearest active span (typically the request handler).
 *
 * The bridge uses two different dd-trace APIs for their respective strengths:
 * - tracer.startSpan() for eager APM spans (long-lived, manual finish)
 * - tracer.llmobs.trace() for retroactive LLMObs annotation (callback-scoped)
 */

import type {
  TracingEvent,
  AnyExportedSpan,
  ModelGenerationAttributes,
  ModelStepAttributes,
  ObservabilityBridge,
  CreateSpanOptions,
  SpanType,
  SpanIds,
} from '@mastra/core/observability';
import { SpanType as SpanTypeEnum } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { BaseExporter, getExternalParentId } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import tracer from 'dd-trace';
import { formatUsageMetrics } from './metrics';
import { ensureTracer, kindFor, toDate, formatInput, formatOutput } from './utils';
import type { DatadogSpanKind } from './utils';

/**
 * LLMObs span options passed to dd-trace's llmobs.trace().
 */
interface LLMObsSpanOptions {
  kind: DatadogSpanKind;
  name: string;
  sessionId?: string;
  userId?: string;
  mlApp?: string;
  modelName?: string;
  modelProvider?: string;
  startTime?: Date;
}

/**
 * Minimal per-trace context for user/session tagging.
 */
interface TraceContext {
  userId?: string;
  sessionId?: string;
}

type TraceState = {
  buffer: Map<string, AnyExportedSpan>;
  contexts: Map<string, { ddSpan: any; exported?: { traceId: string; spanId: string } }>;
  rootEnded: boolean;
  treeEmitted: boolean;
  createdAt: number;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  maxLifetimeTimer?: ReturnType<typeof setTimeout>;
};

/**
 * Tree node representing a span and its children for recursive emission.
 */
interface SpanNode {
  span: AnyExportedSpan;
  children: SpanNode[];
}

/**
 * Maximum lifetime for a trace state entry (30 minutes).
 */
const MAX_TRACE_LIFETIME_MS = 30 * 60 * 1000;

/**
 * Regular cleanup interval for trace state entries (1 minute).
 */
const REGULAR_CLEANUP_INTERVAL_MS = 1 * 60 * 1000;

/**
 * Configuration options for the Datadog Bridge.
 */
export interface DatadogBridgeConfig extends BaseExporterConfig {
  /**
   * Datadog API key. Required in agentless mode.
   * Falls back to DD_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * ML application name for grouping traces.
   * Required - falls back to DD_LLMOBS_ML_APP environment variable.
   */
  mlApp?: string;

  /**
   * Datadog site (e.g., 'datadoghq.com', 'datadoghq.eu').
   * Falls back to DD_SITE environment variable, defaults to 'datadoghq.com'.
   */
  site?: string;

  /**
   * Service name for the application.
   * Falls back to mlApp if not specified.
   */
  service?: string;

  /**
   * Environment name (e.g., 'production', 'staging').
   * Falls back to DD_ENV environment variable.
   */
  env?: string;

  /**
   * Use agentless mode (direct HTTPS intake without local Datadog Agent).
   * Defaults to true for consistency with other Mastra exporters.
   * Set to false to use a local Datadog Agent instead.
   * Falls back to DD_LLMOBS_AGENTLESS_ENABLED environment variable.
   */
  agentless?: boolean;

  /**
   * Enable dd-trace automatic integrations (HTTP, database, etc.).
   * Defaults to true since the bridge is designed for APM integration.
   */
  integrationsEnabled?: boolean;

  /**
   * Keys from the request context that should be promoted to flat Datadog
   * LLM Observability tags instead of being nested in annotations.metadata.
   *
   * @example
   * ```typescript
   * new DatadogBridge({
   *   mlApp: 'my-app',
   *   requestContextKeys: ['tenantId', 'agentId'],
   * })
   * ```
   */
  requestContextKeys?: string[];
}

/**
 * Datadog Bridge for Mastra Observability.
 *
 * Creates native dd-trace spans in real-time during execution for proper
 * APM context propagation, and emits LLMObs annotation data retroactively
 * through dd-trace's own pipeline.
 *
 * @example
 * ```typescript
 * import { DatadogBridge } from '@mastra/datadog';
 *
 * const mastra = new Mastra({
 *   observability: {
 *     configs: {
 *       default: {
 *         serviceName: 'my-service',
 *         bridge: new DatadogBridge({ mlApp: 'my-app' }),
 *       }
 *     }
 *   }
 * });
 * ```
 */
export class DatadogBridge extends BaseExporter implements ObservabilityBridge {
  name = 'datadog-bridge';

  private config: Required<Pick<DatadogBridgeConfig, 'mlApp' | 'site'>> & DatadogBridgeConfig;
  private ddSpanMap = new Map<string, any>();
  private traceContext = new Map<string, TraceContext>();
  private traceState = new Map<string, TraceState>();

  constructor(config: DatadogBridgeConfig = {}) {
    super(config);

    const mlApp = config.mlApp ?? process.env.DD_LLMOBS_ML_APP;
    const apiKey = config.apiKey ?? process.env.DD_API_KEY;
    const site = config.site ?? process.env.DD_SITE ?? 'datadoghq.com';
    const env = config.env ?? process.env.DD_ENV;

    const envAgentless = process.env.DD_LLMOBS_AGENTLESS_ENABLED?.toLowerCase();
    const agentless = config.agentless ?? (envAgentless === 'false' || envAgentless === '0' ? false : true);

    if (!mlApp) {
      this.setDisabled(`Missing required mlApp. Set DD_LLMOBS_ML_APP environment variable or pass mlApp in config.`);
      this.config = config as any;
      return;
    }

    if (agentless && !apiKey) {
      this.setDisabled(
        `Missing required apiKey for agentless mode. Set DD_API_KEY environment variable or pass apiKey in config.`,
      );
      this.config = config as any;
      return;
    }

    this.config = { ...config, mlApp, site, apiKey, agentless, env };

    ensureTracer({
      mlApp,
      site,
      apiKey,
      agentless,
      service: config.service,
      env,
      // Default to true — the bridge is designed for APM integration
      integrationsEnabled: config.integrationsEnabled ?? true,
    });

    this.logger.info('Datadog bridge initialized', { mlApp, site, agentless });
  }

  // ---------------------------------------------------------------------------
  // ObservabilityBridge interface
  // ---------------------------------------------------------------------------

  /**
   * Create a dd-trace APM span eagerly when a Mastra span is constructed.
   *
   * This is the core of the fix: the APM span is active in dd-trace's scope
   * during execution, so auto-instrumented calls (HTTP, DB, etc.) made by
   * tools and processors are parented correctly.
   */
  createSpan(options: CreateSpanOptions<SpanType>): SpanIds | undefined {
    if (this.isDisabled) return undefined;

    try {
      // Determine parent dd-trace span
      let parentDdSpan: any = undefined;

      const externalParentId = getExternalParentId(options);
      if (externalParentId) {
        parentDdSpan = this.ddSpanMap.get(externalParentId);
      }

      // Fall back to whatever is currently active in dd-trace scope
      // (e.g., an incoming request span from framework instrumentation)
      if (!parentDdSpan) {
        parentDdSpan = tracer.scope().active() ?? undefined;
      }

      // Create the APM span eagerly
      const ddSpan = tracer.startSpan(options.name, {
        ...(parentDdSpan ? { childOf: parentDdSpan } : {}),
      });

      // Generate Mastra-compatible hex IDs
      const spanId = generateSpanId();
      const traceId = externalParentId
        ? // Inherit parent's trace ID by looking up what Mastra assigned to the parent
          (options.parent?.traceId ?? generateTraceId())
        : generateTraceId();
      const parentSpanId = externalParentId;

      // Store the dd-trace span keyed by Mastra span ID
      this.ddSpanMap.set(spanId, ddSpan);

      this.logger.debug(
        `[DatadogBridge.createSpan] Created APM span [spanId=${spanId}] [traceId=${traceId}] ` +
          `[parentSpanId=${parentSpanId}] [type=${options.type}] [mapSize=${this.ddSpanMap.size}]`,
      );

      return { spanId, traceId, parentSpanId };
    } catch (error) {
      this.logger.error('[DatadogBridge] Failed to create span:', error);
      return undefined;
    }
  }

  /**
   * Execute an async function within the dd-trace context of a Mastra span.
   * Auto-instrumented operations inside fn will be parented under this span.
   */
  executeInContext<T>(spanId: string, fn: () => Promise<T>): Promise<T> {
    return this.executeWithSpanContext(spanId, fn);
  }

  /**
   * Execute a synchronous function within the dd-trace context of a Mastra span.
   */
  executeInContextSync<T>(spanId: string, fn: () => T): T {
    return this.executeWithSpanContext(spanId, fn);
  }

  private executeWithSpanContext<T>(spanId: string, fn: () => T): T {
    const ddSpan = this.ddSpanMap.get(spanId);

    this.logger.debug(`[DatadogBridge.executeWithSpanContext] spanId=${spanId}, inMap=${!!ddSpan}`);

    if (ddSpan) {
      return tracer.scope().activate(ddSpan, fn);
    }
    return fn();
  }

  // ---------------------------------------------------------------------------
  // BaseExporter override — tracing events from the bus
  // ---------------------------------------------------------------------------

  /**
   * Handle tracing events from the observability bus.
   *
   * - SPAN_STARTED: Capture trace context (userId/sessionId)
   * - SPAN_ENDED: Finish APM span + enqueue for LLMObs emission
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.isDisabled || !(tracer as any).llmobs) return;

    try {
      const span = event.exportedSpan;

      // Handle event spans (zero-duration)
      if (span.isEvent) {
        if (event.type === 'span_started') {
          this.captureTraceContext(span);
          this.finishApmSpan(span);
          this.enqueueSpan(span);
        }
        return;
      }

      switch (event.type) {
        case 'span_started':
          this.captureTraceContext(span);
          return;

        case 'span_updated':
          return;

        case 'span_ended':
          this.finishApmSpan(span);
          this.enqueueSpan(span);
          return;
      }
    } catch (error) {
      this.logger.error('Datadog bridge error', {
        error,
        eventType: event.type,
        spanId: event.exportedSpan?.id,
        spanName: event.exportedSpan?.name,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // APM span management
  // ---------------------------------------------------------------------------

  /**
   * Finish the eagerly-created APM span and remove it from the map.
   */
  private finishApmSpan(span: AnyExportedSpan): void {
    const ddSpan = this.ddSpanMap.get(span.id);
    if (!ddSpan) return;

    const endTime = span.endTime ? toDate(span.endTime) : span.isEvent ? toDate(span.startTime) : new Date();

    try {
      if (typeof ddSpan.finish === 'function') {
        ddSpan.finish(endTime.getTime());
      }
    } catch (error) {
      this.logger.error('[DatadogBridge] Failed to finish APM span', {
        error,
        spanId: span.id,
      });
    }

    this.ddSpanMap.delete(span.id);
  }

  // ---------------------------------------------------------------------------
  // Trace context capture
  // ---------------------------------------------------------------------------

  private captureTraceContext(span: AnyExportedSpan): void {
    if (span.isRootSpan && !this.traceContext.has(span.traceId)) {
      this.traceContext.set(span.traceId, {
        userId: span.metadata?.userId,
        sessionId: span.metadata?.sessionId,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // LLMObs emission (retroactive, using dd-trace's LLMObs pipeline)
  // ---------------------------------------------------------------------------

  /**
   * Queue span for LLMObs emission. Same buffering strategy as DatadogExporter.
   */
  private enqueueSpan(span: AnyExportedSpan): void {
    const state = this.getOrCreateTraceState(span.traceId);
    if (span.isRootSpan) {
      state.rootEnded = true;
    }

    state.buffer.set(span.id, span);
    this.tryEmitReadySpans(span.traceId);
  }

  private tryEmitReadySpans(traceId: string): void {
    const state = this.traceState.get(traceId);
    if (!state) return;

    if (!state.treeEmitted) {
      if (!state.rootEnded) return;

      const tree = this.buildSpanTree(state.buffer);
      if (tree) {
        this.emitSpanTree(tree, state);
      }

      state.buffer.clear();
      state.treeEmitted = true;
    } else {
      let emitted = false;
      do {
        emitted = false;
        for (const [spanId, span] of state.buffer) {
          const parentCtx = span.parentSpanId ? state.contexts.get(span.parentSpanId) : undefined;
          if (span.parentSpanId && !parentCtx) {
            continue;
          }

          this.emitSingleSpan(span, state, parentCtx?.ddSpan);
          state.buffer.delete(spanId);
          emitted = true;
        }
      } while (emitted);
    }

    // Schedule cleanup if root has ended and buffer is empty
    if (state.rootEnded && state.buffer.size === 0 && !state.cleanupTimer) {
      const timer = setTimeout(() => {
        const currentState = this.traceState.get(traceId);
        if (currentState) {
          if (currentState.buffer.size > 0) {
            this.logger.warn('Discarding orphaned spans during cleanup', {
              traceId,
              orphanedCount: currentState.buffer.size,
              spanIds: Array.from(currentState.buffer.keys()),
            });
          }
          if (currentState.maxLifetimeTimer) {
            clearTimeout(currentState.maxLifetimeTimer);
          }
        }
        this.traceState.delete(traceId);
        this.traceContext.delete(traceId);
      }, REGULAR_CLEANUP_INTERVAL_MS);
      (timer as any).unref?.();
      state.cleanupTimer = timer;
    }
  }

  private buildSpanTree(buffer: Map<string, AnyExportedSpan>): SpanNode | undefined {
    const nodes = new Map<string, SpanNode>();
    let rootNode: SpanNode | undefined;

    for (const span of buffer.values()) {
      nodes.set(span.id, { span, children: [] });
    }

    for (const node of nodes.values()) {
      if (node.span.isRootSpan) {
        rootNode = node;
      } else if (node.span.parentSpanId) {
        const parentNode = nodes.get(node.span.parentSpanId);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          this.logger.warn('Orphaned span detected during tree build', {
            spanId: node.span.id,
            parentSpanId: node.span.parentSpanId,
            traceId: node.span.traceId,
          });
        }
      }
    }

    // Sort children by start time for consistent ordering
    for (const node of nodes.values()) {
      node.children.sort((a, b) => {
        const aTime =
          a.span.startTime instanceof Date ? a.span.startTime.getTime() : new Date(a.span.startTime).getTime();
        const bTime =
          b.span.startTime instanceof Date ? b.span.startTime.getTime() : new Date(b.span.startTime).getTime();
        return aTime - bTime;
      });
    }

    return rootNode;
  }

  /**
   * Recursively emits a span tree using nested llmobs.trace() calls.
   * This ensures parent-child relationships are properly established in
   * Datadog's LLM Observability product.
   */
  private emitSpanTree(
    node: SpanNode,
    state: TraceState,
    inheritedModelAttrs?: { model?: string; provider?: string },
  ): void {
    const span = node.span;
    const { traceOptions, endTimeMs } = this.buildSpanOptions(span, inheritedModelAttrs);

    const childInheritedModelAttrs =
      span.type === SpanTypeEnum.MODEL_GENERATION
        ? {
            model: (span.attributes as ModelGenerationAttributes | undefined)?.model,
            provider: (span.attributes as ModelGenerationAttributes | undefined)?.provider,
          }
        : inheritedModelAttrs;

    tracer.llmobs.trace(traceOptions as any, (ddSpan: any) => {
      const annotations = this.buildAnnotations(span);
      if (Object.keys(annotations).length > 0) {
        tracer.llmobs.annotate(ddSpan, annotations);
      }

      if (span.errorInfo) {
        this.setErrorTags(ddSpan, span.errorInfo);
      }

      const exported = tracer.llmobs.exportSpan ? tracer.llmobs.exportSpan(ddSpan) : undefined;
      state.contexts.set(span.id, { ddSpan, exported });

      for (const child of node.children) {
        this.emitSpanTree(child, state, childInheritedModelAttrs);
      }

      if (typeof ddSpan.finish === 'function') {
        ddSpan.finish(endTimeMs);
      }
    });
  }

  /**
   * Emit a single span with the proper Datadog parent context.
   * Used for late-arriving spans after the main tree has been emitted.
   */
  private emitSingleSpan(span: AnyExportedSpan, state: TraceState, parent?: any) {
    const { traceOptions, endTimeMs } = this.buildSpanOptions(span);

    const runTrace = () =>
      tracer.llmobs.trace(traceOptions as any, (ddSpan: any) => {
        const annotations = this.buildAnnotations(span);
        if (Object.keys(annotations).length > 0) {
          tracer.llmobs.annotate(ddSpan, annotations);
        }

        if (span.errorInfo) {
          this.setErrorTags(ddSpan, span.errorInfo);
        }

        const exported = tracer.llmobs.exportSpan ? tracer.llmobs.exportSpan(ddSpan) : undefined;
        state.contexts.set(span.id, { ddSpan, exported });

        if (typeof ddSpan.finish === 'function') {
          ddSpan.finish(endTimeMs);
        }
      });

    if (parent) {
      tracer.scope().activate(parent, runTrace);
    } else {
      runTrace();
    }
  }

  // ---------------------------------------------------------------------------
  // LLMObs span options and annotations
  // ---------------------------------------------------------------------------

  private buildSpanOptions(
    span: AnyExportedSpan,
    inheritedModelAttrs?: { model?: string; provider?: string },
  ): { traceOptions: LLMObsSpanOptions; endTimeMs: number } {
    const traceCtx = this.traceContext.get(span.traceId) || {
      userId: span.metadata?.userId,
      sessionId: span.metadata?.sessionId,
    };

    const kind = kindFor(span.type);
    const ownAttrs = span.attributes as ModelGenerationAttributes | undefined;
    const attrs = {
      model: ownAttrs?.model ?? inheritedModelAttrs?.model,
      provider: ownAttrs?.provider ?? inheritedModelAttrs?.provider,
    };

    const startTime = toDate(span.startTime);
    const endTime = span.endTime ? toDate(span.endTime) : span.isEvent ? startTime : new Date();

    return {
      traceOptions: {
        kind,
        name: span.name,
        sessionId: traceCtx.sessionId,
        userId: traceCtx.userId,
        startTime,
        ...(kind === 'llm' && attrs?.model ? { modelName: attrs.model } : {}),
        ...(kind === 'llm' && attrs?.provider ? { modelProvider: attrs.provider } : {}),
      },
      endTimeMs: endTime.getTime(),
    };
  }

  private buildAnnotations(span: AnyExportedSpan): Record<string, any> {
    const annotations: Record<string, any> = {};

    if (span.input !== undefined) {
      annotations.inputData = formatInput(span.input, span.type);
    }

    if (span.output !== undefined) {
      annotations.outputData = formatOutput(span.output, span.type);
    }

    if (span.type === SpanTypeEnum.MODEL_STEP) {
      const usage = (span.attributes as ModelStepAttributes)?.usage;
      const metrics = formatUsageMetrics(usage);
      if (metrics) {
        annotations.metrics = metrics;
      }
    }

    const knownFields = ['usage', 'model', 'provider', 'parameters'];
    const otherAttributes = omitKeys((span.attributes ?? {}) as Record<string, any>, knownFields);

    const contextKeySet = new Set(this.config.requestContextKeys ?? []);
    const flatContextTags: Record<string, any> = {};
    const remainingMetadata: Record<string, any> = {};

    for (const [key, value] of Object.entries(span.metadata ?? {})) {
      if (contextKeySet.has(key)) {
        flatContextTags[key] = value;
      } else {
        remainingMetadata[key] = value;
      }
    }

    const remainingAttributes: Record<string, any> = {};
    for (const [key, value] of Object.entries(otherAttributes)) {
      if (contextKeySet.has(key)) {
        if (!(key in flatContextTags)) {
          flatContextTags[key] = value;
        }
      } else {
        remainingAttributes[key] = value;
      }
    }

    const combinedMetadata: Record<string, any> = {
      ...remainingMetadata,
      ...remainingAttributes,
    };
    if (span.errorInfo) {
      combinedMetadata['error.message'] = span.errorInfo.message;
    }
    if (Object.keys(combinedMetadata).length > 0) {
      annotations.metadata = combinedMetadata;
    }

    const tags: Record<string, any> = {
      ...flatContextTags,
    };

    if (span.tags?.length) {
      for (const tag of span.tags) {
        const colonIndex = tag.indexOf(':');
        if (colonIndex > 0) {
          tags[tag.substring(0, colonIndex)] = tag.substring(colonIndex + 1);
        } else {
          tags[tag] = true;
        }
      }
    }

    if (span.errorInfo) {
      tags.error = true;
      if (span.errorInfo.id) {
        tags['error.id'] = span.errorInfo.id;
      }
      if (span.errorInfo.domain) {
        tags['error.domain'] = span.errorInfo.domain;
      }
      if (span.errorInfo.category) {
        tags['error.category'] = span.errorInfo.category;
      }
    }

    if (Object.keys(tags).length > 0) {
      annotations.tags = tags;
    }

    return annotations;
  }

  private setErrorTags(ddSpan: any, errorInfo: NonNullable<AnyExportedSpan['errorInfo']>): void {
    ddSpan.setTag('error', true);
    ddSpan.setTag('error.message', errorInfo.message);
    ddSpan.setTag('error.type', errorInfo.name ?? errorInfo.category ?? 'Error');
    if (errorInfo.stack) {
      ddSpan.setTag('error.stack', errorInfo.stack);
    }
  }

  // ---------------------------------------------------------------------------
  // Trace state management
  // ---------------------------------------------------------------------------

  private getOrCreateTraceState(traceId: string): TraceState {
    const existing = this.traceState.get(traceId);
    if (existing) {
      if (existing.cleanupTimer) {
        clearTimeout(existing.cleanupTimer);
        existing.cleanupTimer = undefined;
      }
      return existing;
    }

    const created: TraceState = {
      buffer: new Map<string, AnyExportedSpan>(),
      contexts: new Map<string, { ddSpan: any; exported?: { traceId: string; spanId: string } }>(),
      rootEnded: false,
      treeEmitted: false,
      createdAt: Date.now(),
      cleanupTimer: undefined,
      maxLifetimeTimer: undefined,
    };

    const maxLifetimeTimer = setTimeout(() => {
      const state = this.traceState.get(traceId);
      if (state) {
        if (state.buffer.size > 0 || state.contexts.size > 0) {
          this.logger.warn('Discarding trace due to max lifetime exceeded', {
            traceId,
            bufferedSpans: state.buffer.size,
            emittedSpans: state.contexts.size,
            lifetimeMs: Date.now() - state.createdAt,
          });
        }
        if (state.cleanupTimer) {
          clearTimeout(state.cleanupTimer);
        }
        this.traceState.delete(traceId);
        this.traceContext.delete(traceId);
      }
    }, MAX_TRACE_LIFETIME_MS);
    (maxLifetimeTimer as any).unref?.();
    created.maxLifetimeTimer = maxLifetimeTimer;

    this.traceState.set(traceId, created);
    return created;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async flush(): Promise<void> {
    if (this.isDisabled || !(tracer as any).llmobs) return;

    if (tracer.llmobs?.flush) {
      try {
        await tracer.llmobs.flush();
        this.logger.debug('Datadog llmobs flushed');
      } catch (e) {
        this.logger.error('Error flushing llmobs', { error: e });
      }
    } else if ((tracer as any).flush) {
      try {
        await (tracer as any).flush();
        this.logger.debug('Datadog tracer flushed');
      } catch (e) {
        this.logger.error('Error flushing tracer', { error: e });
      }
    }
  }

  async shutdown(): Promise<void> {
    // Cancel all pending cleanup timers and clear state
    for (const [traceId, state] of this.traceState) {
      if (state.cleanupTimer) {
        clearTimeout(state.cleanupTimer);
      }
      if (state.maxLifetimeTimer) {
        clearTimeout(state.maxLifetimeTimer);
      }
      if (state.buffer.size > 0) {
        this.logger.warn('Shutdown with pending spans', {
          traceId,
          pendingCount: state.buffer.size,
          spanIds: Array.from(state.buffer.keys()),
        });
      }
    }
    this.traceState.clear();

    // Force-finish any remaining APM spans
    for (const [spanId, ddSpan] of this.ddSpanMap) {
      this.logger.warn(`[DatadogBridge] Force-finishing APM span that was not properly closed [id=${spanId}]`);
      try {
        if (typeof ddSpan.finish === 'function') {
          ddSpan.finish();
        }
      } catch {
        // Best-effort cleanup
      }
    }
    this.ddSpanMap.clear();

    await this.flush();

    if (tracer.llmobs?.disable) {
      try {
        tracer.llmobs.disable();
      } catch (e) {
        this.logger.error('Error disabling llmobs', { error: e });
      }
    }

    this.traceContext.clear();

    await super.shutdown();
  }
}

// ---------------------------------------------------------------------------
// ID generation helpers (same format as DefaultSpan)
// ---------------------------------------------------------------------------

function fillRandomBytes(bytes: Uint8Array): void {
  try {
    const webCrypto = globalThis.crypto;
    if (webCrypto?.getRandomValues) {
      webCrypto.getRandomValues.call(webCrypto, bytes);
      return;
    }
  } catch {
    // Fall through to fallback
  }
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
}

function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  fillRandomBytes(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  fillRandomBytes(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
