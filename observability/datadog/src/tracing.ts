/**
 * Datadog LLM Observability Exporter for Mastra
 *
 * Exports Mastra observability data to Datadog's LLM Observability product.
 * Uses a completion-only pattern where spans are emitted on span_ended events.
 *
 * Key features:
 * - Maps Mastra span types to Datadog span kinds
 * - Normalizes AI SDK v4/v5 token usage formats
 * - Formats LLM inputs/outputs as message arrays
 * - Flattens metadata into searchable tags
 * - Supports both agent and agentless modes
 */

import type {
  TracingEvent,
  AnyExportedSpan,
  ModelGenerationAttributes,
  ModelStepAttributes,
} from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import tracer from 'dd-trace';
import { formatUsageMetrics } from './metrics';
import { ensureTracer, kindFor, toDate, formatInput, formatOutput } from './utils';
import type { DatadogSpanKind } from './utils';

/**
 * LLMObs span options passed to dd-trace's llmobs.trace().
 * Note: endTime is not included because dd-trace does not honor it in trace options.
 * Instead, we call ddSpan.finish(endTimeMs) explicitly inside the trace callback.
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
  treeEmitted: boolean; // Whether the initial span tree has been emitted
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
 * This is a fallback cleanup mechanism for traces that never receive a root span
 * or have all spans marked as non-root, preventing unbounded memory growth.
 */
const MAX_TRACE_LIFETIME_MS = 30 * 60 * 1000;

/**
 * Regular cleanup interval for trace state entries (1 minute).
 */
const REGULAR_CLEANUP_INTERVAL_MS = 1 * 60 * 1000;

/**
 * Configuration options for the Datadog LLM Observability exporter.
 */
export interface DatadogExporterConfig extends BaseExporterConfig {
  /**
   * Datadog API key. Required (agentless mode is the default).
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
   * Enable dd-trace automatic integrations.
   * Defaults to false to avoid unexpected instrumentation.
   */
  integrationsEnabled?: boolean;

  /**
   * Keys from the request context (set via `requestContextKeys` in the Mastra
   * Observability config) that should be promoted to flat Datadog LLM Observability
   * tags instead of being nested inside `annotations.metadata`.
   *
   * Flat tags are indexable and filterable in the Datadog LLM Observability UI,
   * which makes them suitable for multi-tenant filtering (e.g. tenantId, agentId).
   *
   * @example
   * ```typescript
   * new DatadogExporter({
   *   mlApp: 'my-app',
   *   requestContextKeys: ['tenantId', 'agentId'],
   * })
   * ```
   */
  requestContextKeys?: string[];
}

/**
 * Datadog LLM Observability Exporter for Mastra.
 *
 * Exports observability data to Datadog's LLM Observability product using
 * a completion-only pattern where spans are emitted on span_ended events.
 */
export class DatadogExporter extends BaseExporter {
  name = 'datadog';

  private config: Required<Pick<DatadogExporterConfig, 'mlApp' | 'site'>> & DatadogExporterConfig;
  private traceContext = new Map<string, TraceContext>();
  private traceState = new Map<string, TraceState>();

  constructor(config: DatadogExporterConfig = {}) {
    super(config);

    // Resolve configuration from config object and environment variables
    const mlApp = config.mlApp ?? process.env.DD_LLMOBS_ML_APP;
    const apiKey = config.apiKey ?? process.env.DD_API_KEY;
    const site = config.site ?? process.env.DD_SITE ?? 'datadoghq.com';
    const env = config.env ?? process.env.DD_ENV;

    // Default to agentless mode (true) for consistency with other Mastra exporters
    // Only disable if explicitly set to false via config or env var
    const envAgentless = process.env.DD_LLMOBS_AGENTLESS_ENABLED?.toLowerCase();
    const agentless = config.agentless ?? (envAgentless === 'false' || envAgentless === '0' ? false : true);

    // Validate required configuration
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

    // Initialize tracer and enable LLM Observability
    ensureTracer({
      mlApp,
      site,
      apiKey,
      agentless,
      service: config.service,
      env,
      integrationsEnabled: config.integrationsEnabled,
    });

    this.logger.info('Datadog exporter initialized', { mlApp, site, agentless });
  }

  /**
   * Main entry point for tracing events from Mastra.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.isDisabled || !(tracer as any).llmobs) return;

    try {
      const span = event.exportedSpan;

      // Handle event spans (zero-duration spans) - buffer like regular spans for parent-first emission
      if (span.isEvent) {
        if (event.type === 'span_started') {
          this.captureTraceContext(span);
          this.enqueueSpan(span); // Route through buffer for proper parent context
        }
        return; // Skip span_updated and span_ended for events
      }

      // Handle regular spans based on event type
      switch (event.type) {
        case 'span_started':
          this.captureTraceContext(span);
          return;

        case 'span_updated':
          // No-op: completion-only pattern ignores mid-span updates
          return;

        case 'span_ended':
          this.enqueueSpan(span);
          return;
      }
    } catch (error) {
      this.logger.error('Datadog exporter error', {
        error,
        eventType: event.type,
        spanId: event.exportedSpan?.id,
        spanName: event.exportedSpan?.name,
      });
    }
  }

  /**
   * Captures user/session context from root spans for tagging all spans in the trace.
   */
  private captureTraceContext(span: AnyExportedSpan): void {
    if (span.isRootSpan && !this.traceContext.has(span.traceId)) {
      this.traceContext.set(span.traceId, {
        userId: span.metadata?.userId,
        sessionId: span.metadata?.sessionId,
      });
    }
  }

  /**
   * Queue span until its parent context is available, then emit spans parent-first.
   */
  private enqueueSpan(span: AnyExportedSpan): void {
    const state = this.getOrCreateTraceState(span.traceId);
    if (span.isRootSpan) {
      state.rootEnded = true;
    }

    state.buffer.set(span.id, span);
    this.tryEmitReadySpans(span.traceId);
  }

  /**
   * Sets native dd-trace error tags required by Datadog's Error Tracking UI.
   */
  private setErrorTags(ddSpan: any, errorInfo: NonNullable<AnyExportedSpan['errorInfo']>): void {
    ddSpan.setTag('error', true);
    ddSpan.setTag('error.message', errorInfo.message);
    ddSpan.setTag('error.type', errorInfo.name ?? errorInfo.category ?? 'Error');
    if (errorInfo.stack) {
      ddSpan.setTag('error.stack', errorInfo.stack);
    }
  }

  /**
   * Builds annotations object for llmobs.annotate().
   * Uses dd-trace's expected property names: inputData, outputData, metadata, tags, metrics.
   */
  private buildAnnotations(span: AnyExportedSpan): Record<string, any> {
    const annotations: Record<string, any> = {};

    // Format and add input (dd-trace expects 'inputData')
    if (span.input !== undefined) {
      annotations.inputData = formatInput(span.input, span.type);
    }

    // Format and add output (dd-trace expects 'outputData')
    if (span.output !== undefined) {
      annotations.outputData = formatOutput(span.output, span.type);
    }

    // Add token usage metrics on MODEL_STEP spans only.
    // MODEL_STEP is the actual LLM API call; MODEL_GENERATION is its parent wrapper.
    // Reporting on both would double-count cost in Datadog.
    if (span.type === SpanType.MODEL_STEP) {
      const usage = (span.attributes as ModelStepAttributes)?.usage;
      const metrics = formatUsageMetrics(usage);
      if (metrics) {
        annotations.metrics = metrics;
      }
    }

    // Forward span.attributes to metadata (minus known fields handled separately)
    // This ensures tool/workflow spans preserve custom attributes like other exporters
    const knownFields = ['usage', 'model', 'provider', 'parameters'];
    const otherAttributes = omitKeys((span.attributes ?? {}) as Record<string, any>, knownFields);

    // Separate requestContextKeys from span.metadata AND span.attributes:
    // - Keys listed in this.config.requestContextKeys are promoted to flat LLM Obs tags,
    //   making them indexable and filterable in the Datadog UI (e.g. tenantId, agentId).
    // - All remaining keys stay nested in annotations.metadata as before.
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

    // Also promote matching keys from span.attributes so requestContextKeys
    // are consistently elevated regardless of where the caller stored them.
    const remainingAttributes: Record<string, any> = {};
    for (const [key, value] of Object.entries(otherAttributes)) {
      if (contextKeySet.has(key)) {
        // Only promote if not already set from span.metadata (metadata wins)
        if (!(key in flatContextTags)) {
          flatContextTags[key] = value;
        }
      } else {
        remainingAttributes[key] = value;
      }
    }

    // Merge remaining span.metadata + span attributes into metadata
    // Error message goes into metadata (not tags) because tags get normalized/truncated
    // which mangles free-form error text (e.g. colons split into key/value, spaces become underscores)
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

    // Build tags from span.tags (user-provided string[] converted to object),
    // promoted requestContextKeys values (flat, indexable in Datadog), and error info.
    // Datadog annotation tags accept Record<string, any>, so we use proper types.
    // The native span error status is also set via ddSpan.setTag('error', true) in emitSpan()
    const tags: Record<string, any> = {
      // Promote requestContextKeys values to flat, searchable LLM Observability tags
      ...flatContextTags,
    };

    // Convert span.tags (string[]) to object format
    // Tags in "key:value" format (e.g. "instance_name:career-scout-api") are split into { key: "value" }
    // Tags without a colon (e.g. "production") are set as { tag: true } (preserving existing behavior)
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

    // Add error status and structured error fields as tags (short, structured values that survive normalization)
    // The error message itself is in metadata above to avoid tag normalization/truncation
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

  /**
   * Force flush any buffered spans without shutting down the exporter.
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated.
   */
  async flush(): Promise<void> {
    if (this.isDisabled || !(tracer as any).llmobs) return;

    // Flush any pending data to Datadog
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

  /**
   * Gracefully shuts down the exporter.
   */
  async shutdown(): Promise<void> {
    // Cancel all pending cleanup timers and clear state FIRST
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

    // Flush any pending data
    await this.flush();

    // Disable LLM Observability
    if (tracer.llmobs?.disable) {
      try {
        tracer.llmobs.disable();
      } catch (e) {
        this.logger.error('Error disabling llmobs', { error: e });
      }
    }

    // Clear local state
    this.traceContext.clear();

    await super.shutdown();
  }

  /**
   * Retrieve or initialize trace state for buffering and parent tracking.
   */
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

    // Schedule fallback cleanup after max lifetime to prevent memory leaks
    // when traces never receive a root span or all spans are non-root
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
    // Prevent the timer from keeping the process alive
    (maxLifetimeTimer as any).unref?.();
    created.maxLifetimeTimer = maxLifetimeTimer;

    this.traceState.set(traceId, created);
    return created;
  }

  /**
   * Attempt to emit spans from the buffer.
   *
   * Two modes of operation:
   * 1. Initial tree emission: When root span ends and tree hasn't been emitted yet,
   *    build a tree from all buffered spans and emit recursively using nested
   *    llmobs.trace() calls. This ensures proper parent-child relationships in Datadog.
   * 2. Late-arriving spans: After the tree has been emitted, emit individual spans
   *    with their parent context for proper linking.
   */
  private tryEmitReadySpans(traceId: string): void {
    const state = this.traceState.get(traceId);
    if (!state) return;

    // If tree hasn't been emitted yet, wait for root and emit as tree
    if (!state.treeEmitted) {
      // Wait until the root span has ended before emitting any spans
      if (!state.rootEnded) return;

      // Build tree and emit recursively
      const tree = this.buildSpanTree(state.buffer);
      if (tree) {
        this.emitSpanTree(tree, state);
      }

      // Clear the buffer and mark tree as emitted
      state.buffer.clear();
      state.treeEmitted = true;
    } else {
      // Tree already emitted - handle late-arriving spans individually
      // Use the old parent-first emission pattern for these
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
          // Clear the max lifetime timer since normal cleanup is handling this
          if (currentState.maxLifetimeTimer) {
            clearTimeout(currentState.maxLifetimeTimer);
          }
        }
        this.traceState.delete(traceId);
        this.traceContext.delete(traceId);
      }, REGULAR_CLEANUP_INTERVAL_MS);
      // Prevent the timer from keeping the process alive
      (timer as any).unref?.();
      state.cleanupTimer = timer;
    }
  }

  /**
   * Builds a tree structure from buffered spans based on parentSpanId relationships.
   * Returns the root node of the tree, or undefined if no root span is found.
   */
  private buildSpanTree(buffer: Map<string, AnyExportedSpan>): SpanNode | undefined {
    // Create nodes for all spans
    const nodes = new Map<string, SpanNode>();
    let rootNode: SpanNode | undefined;

    for (const span of buffer.values()) {
      nodes.set(span.id, { span, children: [] });
    }

    // Build parent-child relationships
    for (const node of nodes.values()) {
      if (node.span.isRootSpan) {
        rootNode = node;
      } else if (node.span.parentSpanId) {
        const parentNode = nodes.get(node.span.parentSpanId);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          // Orphaned span - parent not in buffer, treat as root-level
          // This shouldn't happen normally but handles edge cases
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
   * Builds LLMObs span options from a Mastra span.
   * Handles trace context, timestamps, and conditional model information for LLM spans.
   */
  private buildSpanOptions(
    span: AnyExportedSpan,
    inheritedModelAttrs?: { model?: string; provider?: string },
  ): { traceOptions: LLMObsSpanOptions; endTimeMs: number } {
    const traceCtx = this.traceContext.get(span.traceId) || {
      userId: span.metadata?.userId,
      sessionId: span.metadata?.sessionId,
    };

    const kind = kindFor(span.type);
    // MODEL_GENERATION carries model/provider; MODEL_STEP children inherit it from their parent.
    const ownAttrs = span.attributes as ModelGenerationAttributes | undefined;
    const attrs = {
      model: ownAttrs?.model ?? inheritedModelAttrs?.model,
      provider: ownAttrs?.provider ?? inheritedModelAttrs?.provider,
    };

    const startTime = toDate(span.startTime);
    // Event spans are point-in-time markers; use startTime for endTime if not set (zero duration)
    // Regular spans fall back to current time if endTime is not set
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
      // endTime as milliseconds for ddSpan.finish() — dd-trace's llmobs.trace() does not
      // honor endTime in options, so we must call finish(ms) explicitly on the span.
      endTimeMs: endTime.getTime(),
    };
  }

  /**
   * Recursively emits a span tree using nested llmobs.trace() calls.
   * This ensures parent-child relationships are properly established in Datadog
   * because child spans are created while their parent span is active in scope.
   */
  private emitSpanTree(
    node: SpanNode,
    state: TraceState,
    inheritedModelAttrs?: { model?: string; provider?: string },
  ): void {
    const span = node.span;
    const { traceOptions, endTimeMs } = this.buildSpanOptions(span, inheritedModelAttrs);

    // If this is a MODEL_GENERATION, propagate its model/provider to MODEL_STEP descendants
    // so the LLM-kind step spans in Datadog have a model name attached.
    const childInheritedModelAttrs =
      span.type === SpanType.MODEL_GENERATION
        ? {
            model: (span.attributes as ModelGenerationAttributes | undefined)?.model,
            provider: (span.attributes as ModelGenerationAttributes | undefined)?.provider,
          }
        : inheritedModelAttrs;

    // Use nested llmobs.trace() calls - children are emitted INSIDE the parent's callback
    // This ensures the Datadog SDK automatically establishes parent-child relationships
    tracer.llmobs.trace(traceOptions as any, (ddSpan: any) => {
      // Annotate this span (must happen before finish — annotate throws on finished spans)
      const annotations = this.buildAnnotations(span);
      if (Object.keys(annotations).length > 0) {
        tracer.llmobs.annotate(ddSpan, annotations);
      }

      // Set native Datadog error tags for proper Error Tracking UI
      if (span.errorInfo) {
        this.setErrorTags(ddSpan, span.errorInfo);
      }

      // Store context for potential evaluation submissions
      const exported = tracer.llmobs.exportSpan ? tracer.llmobs.exportSpan(ddSpan) : undefined;
      state.contexts.set(span.id, { ddSpan, exported });

      // Recursively emit children INSIDE this span's callback
      // This is the key to establishing proper parent-child relationships
      for (const child of node.children) {
        this.emitSpanTree(child, state, childInheritedModelAttrs);
      }

      // Explicitly finish with the correct end time. dd-trace's llmobs.trace() does not
      // honor endTime in span options — it auto-finishes with Date.now() when the callback
      // returns. By calling finish() here first, the auto-finish becomes a no-op (dd-trace
      // skips finish if _duration is already set).
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

        // Set native Datadog error tags for proper Error Tracking UI
        if (span.errorInfo) {
          this.setErrorTags(ddSpan, span.errorInfo);
        }

        const exported = tracer.llmobs.exportSpan ? tracer.llmobs.exportSpan(ddSpan) : undefined;
        state.contexts.set(span.id, { ddSpan, exported });

        // Explicitly finish with the correct end time (see emitSpanTree for details)
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
}
