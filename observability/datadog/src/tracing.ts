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

import tracer from 'dd-trace';
import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import { formatUsageMetrics } from './metrics';

/**
 * LLMObs span options with required name and kind properties.
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
  endTime?: Date;
}

/**
 * Datadog LLM Observability span kinds.
 */
type DatadogSpanKind = 'llm' | 'agent' | 'workflow' | 'tool' | 'task' | 'retrieval' | 'embedding';

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
   * Default user ID applied to all spans if not specified in metadata.
   */
  defaultUserId?: string;

  /**
   * Default session ID applied to all spans if not specified in metadata.
   */
  defaultSessionId?: string;
}

/**
 * Maps Mastra SpanTypes to Datadog LLMObs span kinds.
 */
const SPAN_TYPE_TO_KIND: Record<SpanType, DatadogSpanKind> = {
  [SpanType.AGENT_RUN]: 'agent',
  [SpanType.MODEL_GENERATION]: 'llm',
  [SpanType.MODEL_STEP]: 'llm',
  [SpanType.MODEL_CHUNK]: 'task',
  [SpanType.TOOL_CALL]: 'tool',
  [SpanType.MCP_TOOL_CALL]: 'tool',
  [SpanType.WORKFLOW_RUN]: 'workflow',
  [SpanType.WORKFLOW_STEP]: 'task',
  [SpanType.WORKFLOW_CONDITIONAL]: 'task',
  [SpanType.WORKFLOW_CONDITIONAL_EVAL]: 'task',
  [SpanType.WORKFLOW_PARALLEL]: 'task',
  [SpanType.WORKFLOW_LOOP]: 'task',
  [SpanType.WORKFLOW_SLEEP]: 'task',
  [SpanType.WORKFLOW_WAIT_EVENT]: 'task',
  [SpanType.PROCESSOR_RUN]: 'task',
  [SpanType.GENERIC]: 'task',
};

/**
 * Singleton flag to prevent multiple tracer initializations.
 * dd-trace should only be initialized once per process.
 */
const tracerInitFlag = { done: false };

/**
 * Ensures dd-trace is initialized exactly once.
 * Respects any existing tracer initialization by the application.
 */
function ensureTracer(config: {
  mlApp: string;
  site: string;
  apiKey?: string;
  agentless: boolean;
  service?: string;
  env?: string;
  integrationsEnabled?: boolean;
}): void {
  if (tracerInitFlag.done) return;

  // Set environment variables for dd-trace to pick up
  // (LLMObsEnableOptions only accepts mlApp and agentlessEnabled)
  // Always set when config is provided to ensure explicit config takes precedence
  // over any stale env vars that may already be set in the process
  if (config.site) {
    process.env.DD_SITE = config.site;
  }
  if (config.apiKey) {
    process.env.DD_API_KEY = config.apiKey;
  }

  // Check if tracer was already started by the application
  const alreadyStarted = (tracer as any)._tracer?.started;

  if (!alreadyStarted) {
    tracer.init({
      service: config.service || config.mlApp,
      env: config.env || process.env.DD_ENV,
      // Disable automatic integrations by default to avoid surprise instrumentation
      plugins: config.integrationsEnabled ?? false,
    });
  }

  // Enable LLM Observability with the resolved configuration
  tracer.llmobs.enable({
    mlApp: config.mlApp,
    agentlessEnabled: config.agentless,
  });

  tracerInitFlag.done = true;
}

/**
 * Returns the Datadog kind for a Mastra span type.
 */
function kindFor(spanType: SpanType): DatadogSpanKind {
  return SPAN_TYPE_TO_KIND[spanType] || 'task';
}

/**
 * Converts a value to a Date object.
 */
function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Formats input data for Datadog annotations.
 * LLM spans use message array format; others use raw or stringified data.
 */
function formatInput(input: any, spanType: SpanType): any {
  // LLM spans expect {role, content}[] format
  if (spanType === SpanType.MODEL_GENERATION || spanType === SpanType.MODEL_STEP) {
    // Already in message format
    if (Array.isArray(input) && input.every(m => m?.role && m?.content !== undefined)) {
      return input.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : safeStringify(m.content),
      }));
    }
    // String input becomes user message
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }
    // Object input gets stringified as user message
    return [{ role: 'user', content: safeStringify(input) }];
  }

  // Non-LLM spans: pass through strings/arrays, stringify objects
  if (typeof input === 'string' || Array.isArray(input)) return input;
  return safeStringify(input);
}

/**
 * Formats output data for Datadog annotations.
 * LLM spans use message array format; others use raw or stringified data.
 */
function formatOutput(output: any, spanType: SpanType): any {
  // LLM spans expect {role, content}[] format
  if (spanType === SpanType.MODEL_GENERATION || spanType === SpanType.MODEL_STEP) {
    // Already in message format
    if (Array.isArray(output) && output.every(m => m?.role && m?.content !== undefined)) {
      return output.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : safeStringify(m.content),
      }));
    }
    // String output becomes assistant message
    if (typeof output === 'string') {
      return [{ role: 'assistant', content: output }];
    }
    // Object with text property (common AI SDK format)
    if (output?.text) {
      return [{ role: 'assistant', content: output.text }];
    }
    // Other objects get stringified as assistant message
    return [{ role: 'assistant', content: safeStringify(output) }];
  }

  // Non-LLM spans: pass through strings, stringify objects
  if (typeof output === 'string') return output;
  return safeStringify(output);
}

/**
 * Safely stringifies data, handling circular references.
 */
function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    if (typeof data === 'object' && data !== null) {
      return `[Non-serializable ${data.constructor?.name || 'Object'}]`;
    }
    return String(data);
  }
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
    const mlApp = config.mlApp || process.env.DD_LLMOBS_ML_APP;
    const apiKey = config.apiKey || process.env.DD_API_KEY;
    const site = config.site || process.env.DD_SITE || 'datadoghq.com';

    // Default to agentless mode (true) for consistency with other Mastra exporters
    // Only disable if explicitly set to false via config or env var
    const envAgentless = process.env.DD_LLMOBS_AGENTLESS_ENABLED?.toLowerCase();
    const agentless = config.agentless ?? (envAgentless === 'false' || envAgentless === '0' ? false : true);

    // Validate required configuration
    if (!mlApp) {
      this.setDisabled('Missing required mlApp (set config.mlApp or DD_LLMOBS_ML_APP)');
      this.config = config as any;
      return;
    }

    if (agentless && !apiKey) {
      this.setDisabled('Missing required apiKey (set config.apiKey or DD_API_KEY)');
      this.config = config as any;
      return;
    }

    this.config = { ...config, mlApp, site, apiKey, agentless };

    // Initialize tracer and enable LLM Observability
    ensureTracer({
      mlApp,
      site,
      apiKey,
      agentless,
      service: config.service,
      env: config.env,
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
        userId: span.metadata?.userId || this.config.defaultUserId,
        sessionId: span.metadata?.sessionId || this.config.defaultSessionId,
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

    // Normalize and add token usage metrics
    const usage = (span.attributes as ModelGenerationAttributes | undefined)?.usage;
    const metrics = formatUsageMetrics(usage);
    if (metrics) {
      annotations.metrics = metrics;
    }

    // Forward span.attributes to metadata (minus known fields handled separately)
    // This ensures tool/workflow spans preserve custom attributes like other exporters
    const knownFields = ['usage', 'model', 'provider', 'parameters'];
    const otherAttributes = omitKeys((span.attributes ?? {}) as Record<string, any>, knownFields);

    // Merge span.metadata + remaining attributes into metadata
    const combinedMetadata = {
      ...span.metadata,
      ...otherAttributes,
    };
    if (Object.keys(combinedMetadata).length > 0) {
      annotations.metadata = combinedMetadata;
    }

    // Tags only for error info (structural data the exporter knows about)
    // Note: Datadog annotation tags are string key/values, so error is 'true' (string).
    // The native span error status is set separately via ddSpan.setTag('error', true) in emitSpan().
    // TODO: add config option to allow user tags to be added to the annotations.tags object
    if (span.errorInfo) {
      annotations.tags = {
        error: 'true',
        'error.message': span.errorInfo.message,
        ...(span.errorInfo.id ? { 'error.id': span.errorInfo.id } : {}),
        ...(span.errorInfo.domain ? { 'error.domain': span.errorInfo.domain } : {}),
        ...(span.errorInfo.category ? { 'error.category': span.errorInfo.category } : {}),
      };
    }

    return annotations;
  }

  /**
   * Submits an evaluation score to Datadog for a specific trace/span.
   * Scores can be used for quality metrics, feedback tracking, and model evaluation.
   */
  async addScoreToTrace({
    traceId,
    spanId,
    score,
    reason,
    scorerName,
    metadata,
  }: {
    traceId: string;
    spanId?: string;
    score: number;
    reason?: string;
    scorerName: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (this.isDisabled || !tracer.llmobs) return;

    const ctx = this.getDatadogSpanContext(traceId, spanId);
    if (!ctx) {
      this.logger.warn('Datadog span context not found for evaluation', { traceId, spanId });
      return;
    }

    const exported = ctx.exported ?? (tracer.llmobs.exportSpan ? tracer.llmobs.exportSpan(ctx.ddSpan) : undefined);
    if (!exported) {
      this.logger.warn('Unable to export Datadog span context for evaluation', { traceId, spanId });
      return;
    }

    try {
      tracer.llmobs.submitEvaluation(exported, {
        label: scorerName,
        metricType: 'score',
        value: score,
        tags: {
          ...(reason ? { reason } : {}),
          ...metadata,
        },
      });
    } catch (error) {
      this.logger.error('Error submitting evaluation to Datadog', {
        error,
        traceId,
        spanId,
        scorerName,
      });
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
    if (tracer.llmobs?.flush) {
      try {
        await tracer.llmobs.flush();
      } catch (e) {
        this.logger.error('Error flushing llmobs', { error: e });
      }
    } else if ((tracer as any).flush) {
      try {
        await (tracer as any).flush();
      } catch (e) {
        this.logger.error('Error flushing tracer', { error: e });
      }
    }

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

      // Find the root span in the buffer
      let rootSpan: AnyExportedSpan | undefined;
      for (const span of state.buffer.values()) {
        if (span.isRootSpan) {
          rootSpan = span;
          break;
        }
      }

      // If root span is not in buffer yet, wait
      if (!rootSpan) return;

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
      }, 60_000);
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
   * Recursively emits a span tree using nested llmobs.trace() calls.
   * This ensures parent-child relationships are properly established in Datadog
   * because child spans are created while their parent span is active in scope.
   */
  private emitSpanTree(node: SpanNode, state: TraceState): void {
    const span = node.span;
    const traceCtx = this.traceContext.get(span.traceId) || {
      userId: span.metadata?.userId || this.config.defaultUserId,
      sessionId: span.metadata?.sessionId || this.config.defaultSessionId,
    };

    const kind = kindFor(span.type);
    const attrs = span.attributes as ModelGenerationAttributes | undefined;

    const startTime = toDate(span.startTime);
    // Event spans are point-in-time markers; use startTime for endTime if not set (zero duration)
    // Regular spans fall back to current time if endTime is not set
    const endTime = span.endTime ? toDate(span.endTime) : span.isEvent ? startTime : new Date();

    const options: LLMObsSpanOptions = {
      kind,
      name: span.name,
      sessionId: traceCtx.sessionId,
      userId: traceCtx.userId,
      startTime,
      endTime,
      ...(kind === 'llm' && attrs?.model ? { modelName: attrs.model } : {}),
      ...(kind === 'llm' && attrs?.provider ? { modelProvider: attrs.provider } : {}),
    };

    // Use nested llmobs.trace() calls - children are emitted INSIDE the parent's callback
    // This ensures the Datadog SDK automatically establishes parent-child relationships
    tracer.llmobs.trace(options as any, (ddSpan: any) => {
      // Annotate this span
      const annotations = this.buildAnnotations(span);
      if (Object.keys(annotations).length > 0) {
        tracer.llmobs.annotate(ddSpan, annotations);
      }

      // Set native Datadog error status for proper UI highlighting
      if (span.errorInfo) {
        ddSpan.setTag('error', true);
      }

      // Store context for potential evaluation submissions
      const exported = tracer.llmobs.exportSpan ? tracer.llmobs.exportSpan(ddSpan) : undefined;
      state.contexts.set(span.id, { ddSpan, exported });

      // Recursively emit children INSIDE this span's callback
      // This is the key to establishing proper parent-child relationships
      for (const child of node.children) {
        this.emitSpanTree(child, state);
      }
    });
  }

  /**
   * Emit a single span with the proper Datadog parent context.
   * Used for late-arriving spans after the main tree has been emitted.
   */
  private emitSingleSpan(span: AnyExportedSpan, state: TraceState, parent?: any) {
    const traceCtx = this.traceContext.get(span.traceId) || {
      userId: span.metadata?.userId || this.config.defaultUserId,
      sessionId: span.metadata?.sessionId || this.config.defaultSessionId,
    };

    const kind = kindFor(span.type);
    const attrs = span.attributes as ModelGenerationAttributes | undefined;

    const startTime = toDate(span.startTime);
    // Event spans are point-in-time markers; use startTime for endTime if not set (zero duration)
    // Regular spans fall back to current time if endTime is not set
    const endTime = span.endTime ? toDate(span.endTime) : span.isEvent ? startTime : new Date();

    const options: LLMObsSpanOptions = {
      kind,
      name: span.name,
      sessionId: traceCtx.sessionId,
      userId: traceCtx.userId,
      startTime,
      endTime,
      ...(kind === 'llm' && attrs?.model ? { modelName: attrs.model } : {}),
      ...(kind === 'llm' && attrs?.provider ? { modelProvider: attrs.provider } : {}),
    };

    let capturedSpan: any;
    const runTrace = () =>
      tracer.llmobs.trace(options as any, (ddSpan: any) => {
        capturedSpan = ddSpan;
        const annotations = this.buildAnnotations(span);
        if (Object.keys(annotations).length > 0) {
          tracer.llmobs.annotate(ddSpan, annotations);
        }
      });

    if (parent) {
      tracer.scope().activate(parent, runTrace);
    } else {
      runTrace();
    }

    if (capturedSpan) {
      // Set native Datadog error status for proper UI highlighting
      if (span.errorInfo) {
        capturedSpan.setTag('error', true);
      }
      const exported = tracer.llmobs.exportSpan ? tracer.llmobs.exportSpan(capturedSpan) : undefined;
      state.contexts.set(span.id, { ddSpan: capturedSpan, exported });
    }
  }

  /**
   * Look up the Datadog span context for a Mastra span.
   * If spanId is omitted and only one span exists, return that context.
   */
  private getDatadogSpanContext(
    traceId: string,
    spanId?: string,
  ): { ddSpan: any; exported?: { traceId: string; spanId: string } } | undefined {
    const state = this.traceState.get(traceId);
    if (!state) return undefined;

    if (spanId) {
      return state.contexts.get(spanId);
    }

    if (state.contexts.size === 1) {
      return Array.from(state.contexts.values())[0];
    }

    return undefined;
  }
}
