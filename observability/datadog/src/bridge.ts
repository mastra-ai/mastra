/**
 * Datadog Bridge for Mastra Observability
 *
 * This bridge enables bidirectional integration with dd-trace:
 * 1. Creates real dd-trace APM spans eagerly when Mastra spans are created
 * 2. Activates spans in dd-trace's scope so auto-instrumented operations
 *    (HTTP requests, database queries, etc.) have correct parent spans
 * 3. Registers those same spans with Datadog LLMObs and annotates them
 *    before finish, avoiding a second synthetic APM span tree
 *
 * This fixes the core problem with the DatadogExporter: because the exporter
 * creates LLMObs spans retroactively (after execution completes), there is no
 * active dd-trace span in scope when tools and processors make outbound calls.
 * dd-trace's auto-instrumentation can't find the correct parent, so APM spans
 * fall back to the nearest active span (typically the request handler).
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
import { ensureTracer, formatInput, formatOutput, kindFor, toDate } from './utils';
import type { DatadogSpanKind } from './utils';

type LLMObsTagger = {
  registerLLMObsSpan: (
    span: any,
    options: {
      parent?: any;
      kind: DatadogSpanKind;
      name: string;
      userId?: string;
      sessionId?: string;
      modelName?: string;
      modelProvider?: string;
    },
  ) => void;
};

type LLMObsInternalApi = {
  _activate?: <T>(span: any, options: Record<string, never> | undefined, fn: () => T) => T;
};

interface TraceContext {
  userId?: string;
  sessionId?: string;
}

type LifecycleLogger = Pick<DatadogBridge['logger'], 'debug' | 'info' | 'warn' | 'error'>;

let spanLifecycleLogger: LifecycleLogger | undefined;
let spanLifecyclePatchInstalled = false;
const lifecycleWrappedSpans = new WeakSet<object>();

function flushApmExporter(): Promise<void> {
  const exporterFlush = (tracer as any)?._tracer?._exporter?.flush;
  if (typeof exporterFlush !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const done = (error?: unknown) => {
      if (settled) return;
      settled = true;

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    try {
      exporterFlush.call((tracer as any)._tracer._exporter, done);
    } catch (error) {
      reject(error);
    }
  });
}

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
   * Use agentless mode (direct HTTPS intake without a local Datadog Agent).
   *
   * Defaults to `false` for the bridge — most users running dd-trace
   * auto-instrumentation already have a local Datadog Agent (required for
   * APM data). Agentless mode only routes LLMObs data directly to Datadog
   * intake, which would split your APM and LLMObs telemetry across two
   * paths.
   *
   * Set to `true` if you only want LLMObs data (no APM auto-instrumentation)
   * and don't have a local Datadog Agent. Falls back to the
   * `DD_LLMOBS_AGENTLESS_ENABLED` environment variable.
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
   */
  requestContextKeys?: string[];

  /**
   * Enable verbose dd-trace span lifecycle logging for troubleshooting.
   *
   * When enabled, the bridge wraps `tracer.startSpan()` and logs each dd span
   * open/finish event it can observe, including ids and parent ids.
   *
   * This is intentionally noisy and should only be used for debugging.
   * Falls back to `MASTRA_DATADOG_BRIDGE_SPAN_DEBUG`.
   */
  spanLifecycleDebug?: boolean;
}

/**
 * Datadog Bridge for Mastra Observability.
 *
 * Creates native dd-trace spans in real time during execution for proper APM
 * context propagation, and uses the same live dd span for Datadog LLMObs
 * tagging and annotations.
 */
export class DatadogBridge extends BaseExporter implements ObservabilityBridge {
  name = 'datadog-bridge';

  private config: Required<Pick<DatadogBridgeConfig, 'mlApp' | 'site'>> & DatadogBridgeConfig;
  private ddSpanMap = new Map<string, any>();
  private traceContext = new Map<string, TraceContext>();
  private openSpanCounts = new Map<string, number>();

  constructor(config: DatadogBridgeConfig = {}) {
    super(config);

    const mlApp = config.mlApp ?? process.env.DD_LLMOBS_ML_APP;
    const apiKey = config.apiKey ?? process.env.DD_API_KEY;
    const site = config.site ?? process.env.DD_SITE ?? 'datadoghq.com';
    const env = config.env ?? process.env.DD_ENV;

    // Default to false for the bridge — assume a local Datadog Agent is
    // present (required for the APM auto-instrumentation the bridge enables)
    const envAgentless = process.env.DD_LLMOBS_AGENTLESS_ENABLED?.toLowerCase();
    const agentless = config.agentless ?? (envAgentless === 'true' || envAgentless === '1' ? true : false);
    const spanLifecycleDebug = config.spanLifecycleDebug ?? isTruthyEnv(process.env.MASTRA_DATADOG_BRIDGE_SPAN_DEBUG);

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

    this.config = { ...config, mlApp, site, apiKey, agentless, env, spanLifecycleDebug };

    ensureTracer({
      mlApp,
      site,
      apiKey,
      agentless,
      service: config.service,
      env,
      integrationsEnabled: config.integrationsEnabled ?? true,
    });

    if (spanLifecycleDebug) {
      spanLifecycleLogger = this.logger;
      installSpanLifecycleDebugPatch();
      this.logger.info('[DatadogBridge] Enabled dd-trace span lifecycle debug logging');
    }

    this.logger.debug('[DatadogBridge] Tracer ready', {
      mlApp,
      service: config.service ?? mlApp,
      env,
      agentless,
      tracerStarted: Boolean((tracer as any)._tracer?.started),
      llmobsAvailable: Boolean((tracer as any).llmobs),
      activeScopeSpan: Boolean(tracer.scope().active()),
    });

    this.logger.info('Datadog bridge initialized', { mlApp, site, agentless });
  }

  override __setLogger(logger: any): void {
    super.__setLogger(logger);
    if (this.config?.spanLifecycleDebug) {
      spanLifecycleLogger = this.logger;
    }
  }

  /**
   * Create a dd-trace span eagerly when a Mastra span is constructed.
   */
  createSpan(options: CreateSpanOptions<SpanType>): SpanIds | undefined {
    if (this.isDisabled) return undefined;

    try {
      let apmParentDdSpan: any = undefined;
      let llmobsParentDdSpan: any = undefined;
      let parentSource: 'external-parent' | 'active-scope' | 'none' = 'none';

      const externalParentId = getExternalParentId(options);
      if (externalParentId) {
        apmParentDdSpan = this.ddSpanMap.get(externalParentId);
        llmobsParentDdSpan = apmParentDdSpan;
        if (apmParentDdSpan) {
          parentSource = 'external-parent';
        } else {
          this.logger.warn('[DatadogBridge.createSpan] External parent span not found in bridge map', {
            spanName: options.name,
            spanType: options.type,
            externalParentId,
            hasMastraParent: Boolean(options.parent),
          });
        }
      }

      if (!apmParentDdSpan && externalParentId) {
        apmParentDdSpan = tracer.scope().active() ?? undefined;
        if (apmParentDdSpan) {
          parentSource = 'active-scope';
        }
      }

      if (!apmParentDdSpan && !externalParentId) {
        apmParentDdSpan = tracer.scope().active() ?? undefined;
        if (apmParentDdSpan) {
          parentSource = 'active-scope';
        } else {
          this.logger.debug('[DatadogBridge.createSpan] No active dd-trace scope for new root span', {
            spanName: options.name,
            spanType: options.type,
            mapSize: this.ddSpanMap.size,
          });
        }
      }

      if (!llmobsParentDdSpan && externalParentId) {
        llmobsParentDdSpan = apmParentDdSpan;
      }

      const ddSpan = tracer.startSpan(options.name, {
        ...(apmParentDdSpan ? { childOf: apmParentDdSpan } : {}),
        ...(options.startTime ? { startTime: toDate(options.startTime).getTime() } : {}),
      });

      const ddContext = ddSpan.context?.() as
        | {
            toSpanId?: (hex?: boolean) => string;
            toTraceId?: (hex?: boolean) => string;
          }
        | undefined;
      const spanId = ddContext?.toSpanId?.(true) ?? generateSpanId();
      const traceId =
        ddContext?.toTraceId?.(true) ??
        (externalParentId ? (options.parent?.traceId ?? generateTraceId()) : generateTraceId());
      const parentContext = apmParentDdSpan?.context?.() as { toSpanId?: (hex?: boolean) => string } | undefined;
      const parentSpanId = parentContext?.toSpanId?.(true) ?? externalParentId;

      this.captureTraceContext(traceId, options);
      this.openSpanCounts.set(traceId, (this.openSpanCounts.get(traceId) ?? 0) + 1);
      this.ddSpanMap.set(spanId, ddSpan);
      this.registerLlmObsSpan(ddSpan, traceId, options, llmobsParentDdSpan);

      this.logger.debug(
        `[DatadogBridge.createSpan] Created APM span [spanId=${spanId}] [traceId=${traceId}] ` +
          `[parentSpanId=${parentSpanId}] [type=${options.type}] [mapSize=${this.ddSpanMap.size}] ` +
          `[parentSource=${parentSource}] [externalParentId=${externalParentId ?? 'none'}]`,
        {
          ...(this.config.spanLifecycleDebug
            ? {
                ddTraceState: getTraceDebugState(ddSpan),
                parentDdTraceState: apmParentDdSpan ? getTraceDebugState(apmParentDdSpan) : undefined,
              }
            : {}),
        },
      );

      return { spanId, traceId, parentSpanId };
    } catch (error) {
      this.logger.error('[DatadogBridge] Failed to create span:', error);
      return undefined;
    }
  }

  /**
   * Execute an async function within the dd-trace context of a Mastra span.
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
      return tracer.scope().activate(ddSpan, () => {
        const llmobs = (tracer as any).llmobs as LLMObsInternalApi | undefined;
        if (typeof llmobs?._activate === 'function') {
          return llmobs._activate(ddSpan, undefined, fn);
        }

        return fn();
      });
    }

    this.logger.debug(
      '[DatadogBridge.executeWithSpanContext] Falling back to raw execution because dd span is missing',
      {
        spanId,
        mapSize: this.ddSpanMap.size,
        openSpanIds: this.previewOpenSpanIds(),
        ...(this.config.spanLifecycleDebug ? { callStack: captureCallStack('executeWithSpanContext') } : {}),
      },
    );

    return fn();
  }

  /**
   * Handle tracing events from the observability bus.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.isDisabled) return;

    try {
      const span = event.exportedSpan;

      if (span.isEvent) {
        if (event.type === 'span_started' || event.type === 'span_ended') {
          this.annotateAndFinishSpan(span);
        } else {
          this.logger.debug('[DatadogBridge] Ignoring event span tracing event', {
            eventType: event.type,
            spanId: span.id,
            spanName: span.name,
          });
        }
        return;
      }

      switch (event.type) {
        case 'span_started':
        case 'span_updated':
          this.logger.debug('[DatadogBridge] Observed non-terminal tracing event', {
            eventType: event.type,
            spanId: span.id,
            spanName: span.name,
            spanType: span.type,
          });
          return;
        case 'span_ended':
          this.annotateAndFinishSpan(span);
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

  private registerLlmObsSpan(
    ddSpan: any,
    traceId: string,
    options: CreateSpanOptions<SpanType>,
    parentDdSpan?: any,
  ): void {
    const tagger = this.getLlmObsTagger();
    if (!tagger) {
      this.logger.debug('[DatadogBridge] Skipping LLMObs registration because no tagger is available', {
        spanName: options.name,
        spanType: options.type,
      });
      return;
    }

    try {
      const kind = kindFor(options.type);
      const ownAttrs = options.attributes as ModelGenerationAttributes | undefined;
      const inheritedModelAttrs =
        options.parent?.type === SpanTypeEnum.MODEL_GENERATION
          ? (options.parent.attributes as ModelGenerationAttributes | undefined)
          : undefined;
      const traceCtx = this.resolveTraceContext(traceId, options);

      tagger.registerLLMObsSpan(ddSpan, {
        parent: parentDdSpan,
        kind,
        name: options.name,
        userId: traceCtx.userId,
        sessionId: traceCtx.sessionId,
        ...(kind === 'llm' && (ownAttrs?.model ?? inheritedModelAttrs?.model)
          ? { modelName: ownAttrs?.model ?? inheritedModelAttrs?.model }
          : {}),
        ...(kind === 'llm' && (ownAttrs?.provider ?? inheritedModelAttrs?.provider)
          ? { modelProvider: ownAttrs?.provider ?? inheritedModelAttrs?.provider }
          : {}),
      });
      this.logger.debug('[DatadogBridge] Registered LLMObs span', {
        spanName: options.name,
        spanType: options.type,
        kind,
        hasParent: Boolean(parentDdSpan),
        userId: traceCtx.userId,
        sessionId: traceCtx.sessionId,
      });
    } catch (error) {
      this.logger.warn('[DatadogBridge] Failed to register LLMObs span', {
        error,
        spanName: options.name,
        spanType: options.type,
      });
    }
  }

  private getLlmObsTagger(): LLMObsTagger | undefined {
    const tagger = (tracer as any).llmobs?._tagger;
    if (tagger && typeof tagger.registerLLMObsSpan === 'function') {
      return tagger as LLMObsTagger;
    }
    return undefined;
  }

  /**
   * Annotate the eagerly-created dd span and finish it using the final Mastra
   * span state.
   */
  private annotateAndFinishSpan(span: AnyExportedSpan): void {
    const ddSpan = this.ddSpanMap.get(span.id);
    if (!ddSpan) {
      this.logger.warn('[DatadogBridge] No dd span found when finalizing Mastra span', {
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
        mapSize: this.ddSpanMap.size,
        openSpanIds: this.previewOpenSpanIds(),
      });
      return;
    }

    const endTime = span.endTime ? toDate(span.endTime) : span.isEvent ? toDate(span.startTime) : new Date();

    const annotations = this.buildAnnotations(span);

    try {
      if (Object.keys(annotations).length > 0 && tracer.llmobs?.annotate) {
        tracer.llmobs.annotate(ddSpan, annotations);
        this.logger.debug('[DatadogBridge] Annotated dd span before finish', {
          spanId: span.id,
          spanName: span.name,
          annotationKeys: Object.keys(annotations),
        });
      } else {
        this.logger.debug('[DatadogBridge] Skipping LLMObs annotation before finish', {
          spanId: span.id,
          spanName: span.name,
          hasAnnotations: Object.keys(annotations).length > 0,
          llmobsAvailable: Boolean(tracer.llmobs),
        });
      }
    } catch (error) {
      this.logger.error('[DatadogBridge] Failed to annotate span before finish', {
        error,
        spanId: span.id,
        spanName: span.name,
      });
    }

    try {
      if (span.errorInfo) {
        this.setErrorTags(ddSpan, span.errorInfo);
      }
    } catch (error) {
      this.logger.error('[DatadogBridge] Failed to set error tags on dd span', {
        error,
        spanId: span.id,
        spanName: span.name,
      });
    }

    try {
      if (typeof ddSpan.finish === 'function') {
        ddSpan.finish(endTime.getTime());
        this.logger.debug('[DatadogBridge] Finished dd span', {
          spanId: span.id,
          spanName: span.name,
          endTimeMs: endTime.getTime(),
          ...(this.config.spanLifecycleDebug ? { ddTraceState: getTraceDebugState(ddSpan) } : {}),
        });
      }
    } catch (error) {
      this.logger.error('[DatadogBridge] Failed to finish dd span', {
        error,
        spanId: span.id,
        spanName: span.name,
      });
    } finally {
      this.ddSpanMap.delete(span.id);
      this.releaseTraceContext(span.traceId);
      this.logger.debug('[DatadogBridge] Removed dd span from bridge map', {
        spanId: span.id,
        spanName: span.name,
        remainingMapSize: this.ddSpanMap.size,
        remainingOpenSpanIds: this.previewOpenSpanIds(),
      });
    }
  }

  private previewOpenSpanIds(limit = 8): string[] {
    return Array.from(this.ddSpanMap.keys()).slice(0, limit);
  }

  private captureTraceContext(traceId: string, options: CreateSpanOptions<SpanType>): void {
    const existing = this.traceContext.get(traceId);
    const next: TraceContext = {
      userId: firstString(options.metadata?.userId, options.parent?.metadata?.userId, existing?.userId),
      sessionId: firstString(options.metadata?.sessionId, options.parent?.metadata?.sessionId, existing?.sessionId),
    };

    if (next.userId || next.sessionId) {
      this.traceContext.set(traceId, next);
    }
  }

  private resolveTraceContext(traceId: string, options: CreateSpanOptions<SpanType>): TraceContext {
    const stored = this.traceContext.get(traceId);
    return {
      userId: firstString(options.metadata?.userId, options.parent?.metadata?.userId, stored?.userId),
      sessionId: firstString(options.metadata?.sessionId, options.parent?.metadata?.sessionId, stored?.sessionId),
    };
  }

  private releaseTraceContext(traceId: string): void {
    const nextCount = (this.openSpanCounts.get(traceId) ?? 1) - 1;
    if (nextCount > 0) {
      this.openSpanCounts.set(traceId, nextCount);
      return;
    }

    this.openSpanCounts.delete(traceId);
    this.traceContext.delete(traceId);
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

  async flush(): Promise<void> {
    if (this.isDisabled) return;

    if (tracer.llmobs?.flush) {
      try {
        await tracer.llmobs.flush();
        this.logger.debug('Datadog llmobs flushed');
      } catch (e) {
        this.logger.error('Error flushing llmobs', { error: e });
      }
    }

    try {
      await flushApmExporter();
      this.logger.debug('Datadog APM exporter flushed');
    } catch (e) {
      this.logger.error('Error flushing Datadog APM exporter', { error: e });
    }
  }

  async shutdown(): Promise<void> {
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
    this.openSpanCounts.clear();
    this.traceContext.clear();

    await this.flush();

    if (tracer.llmobs?.disable) {
      try {
        tracer.llmobs.disable();
      } catch (e) {
        this.logger.error('Error disabling llmobs', { error: e });
      }
    }

    await super.shutdown();
  }
}

function firstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

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

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function captureCallStack(marker?: string, maxFrames = 8): string | undefined {
  const stack = new Error(marker ? `[DatadogBridge] ${marker}` : undefined).stack;
  if (!stack) return undefined;

  const lines = stack
    .split('\n')
    .slice(1)
    .filter(line => !line.includes('captureCallStack'))
    .slice(0, maxFrames)
    .map(line => line.trim());

  return lines.length > 0 ? lines.join('\n') : undefined;
}

function getTraceDebugState(ddSpan: any):
  | {
      traceRecord?: boolean;
      traceIsRecording?: boolean;
      startedCount?: number;
      finishedCount?: number;
      openSpans?: string[];
    }
  | undefined {
  const trace = ddSpan?.context?.()?._trace;
  if (!trace) return undefined;

  const openSpans = Array.isArray(trace.started)
    ? trace.started
        .filter((span: any) => span?._duration === undefined)
        .slice(0, 12)
        .map((span: any) => {
          const context = span?.context?.();
          const name = context?._name ?? span?._name ?? 'unknown';
          const resource = context?._tags?.['resource.name'];
          return resource ? `${name}:${resource}` : name;
        })
    : undefined;

  return {
    traceRecord: trace.record,
    traceIsRecording: trace.isRecording,
    startedCount: Array.isArray(trace.started) ? trace.started.length : undefined,
    finishedCount: Array.isArray(trace.finished) ? trace.finished.length : undefined,
    openSpans: openSpans && openSpans.length > 0 ? openSpans : undefined,
  };
}

function installSpanLifecycleDebugPatch(): void {
  if (spanLifecyclePatchInstalled) return;

  const originalStartSpan = tracer.startSpan.bind(tracer);

  (tracer as any).startSpan = function patchedStartSpan(name: string, options?: Record<string, unknown>) {
    const span = originalStartSpan(name, options);
    logSpanLifecycleOpen(name, span, options);
    wrapSpanFinishForLifecycleDebug(span, name);
    return span;
  };

  spanLifecyclePatchInstalled = true;
}

function wrapSpanFinishForLifecycleDebug(span: any, name: string): void {
  if (!span || typeof span !== 'object' || typeof span.finish !== 'function') return;
  if (lifecycleWrappedSpans.has(span)) return;

  const originalFinish = span.finish;

  // Preserve mocked finish functions in tests to avoid altering matcher behavior.
  if ((originalFinish as any).mock) return;

  span.finish = function patchedFinish(this: any, ...args: any[]) {
    logSpanLifecycleFinish(name, span, args);
    return originalFinish.apply(this, args);
  };

  lifecycleWrappedSpans.add(span);
}

function logSpanLifecycleOpen(name: string, span: any, options?: Record<string, unknown>): void {
  const ids = getDdSpanIds(span);
  const parentIds = getDdSpanIds((options?.childOf as any) ?? undefined);
  const message =
    `[DatadogBridge.span.open] name=${name} traceId=${ids.traceId ?? 'unknown'} ` +
    `spanId=${ids.spanId ?? 'unknown'} parentSpanId=${parentIds.spanId ?? 'none'} ` +
    `hasChildOf=${Boolean(options?.childOf)}`;

  spanLifecycleLogger?.debug(message);
  console.error(message);
}

function logSpanLifecycleFinish(name: string, span: any, finishArgs: unknown[]): void {
  const ids = getDdSpanIds(span);
  const finishTime = finishArgs[0];
  const message =
    `[DatadogBridge.span.finish] name=${name} traceId=${ids.traceId ?? 'unknown'} ` +
    `spanId=${ids.spanId ?? 'unknown'} finishArg=${String(finishTime ?? 'none')}`;

  spanLifecycleLogger?.debug(message);
  console.error(message);
}

function getDdSpanIds(span: any): { spanId?: string; traceId?: string } {
  try {
    const context = span?.context?.();
    return {
      spanId: context?.toSpanId?.(true),
      traceId: context?.toTraceId?.(true),
    };
  } catch {
    return {};
  }
}
