import type { TracingEvent, AnyExportedSpan, SpanErrorInfo } from '@mastra/core/observability';
import type { BaseExporterConfig } from './base';
import { BaseExporter } from './base';

export interface TrackingExporterConfig extends BaseExporterConfig {
  // Subclasses can extend this with vendor-specific config
}

export class TraceData<TRootData, TSpanData, TEventData, TMetadata> {
  #rootSpan?: TRootData;
  #rootSpanId?: string;
  #events: Map<string, TEventData>; // Maps eventId to vendor-specific events
  #spans: Map<string, TSpanData>; // Maps spanId to vendor-specific spans
  #tree: Map<string, string | undefined>; // Maps spanId to parentSpanId
  #activeSpanIds: Set<string>; // Set of span IDs that have started but not yet ended
  #metadata: Map<string, TMetadata>; // Mpa of id to vender-specific metadata
  #earlyData: TracingEvent[]; // Any tracing events that arrive before the root span
  #extraData: Map<string, unknown>; // Any extra data to be stored on a per-trace level

  constructor() {
    this.#events = new Map();
    this.#spans = new Map();
    this.#activeSpanIds = new Set();
    this.#tree = new Map();
    this.#metadata = new Map();
    this.#earlyData = [];
    this.#extraData = new Map();
  }

  hasRoot(): boolean {
    return !!this.#rootSpanId;
  }

  addRoot(args: { rootId: string; rootData: TRootData }): void {
    this.#rootSpanId = args.rootId;
    this.#rootSpan = args.rootData;
  }

  getRoot(): TRootData | undefined {
    return this.#rootSpan;
  }

  setExtraValue(key: string, value: unknown): void {
    this.#extraData.set(key, value);
  }

  hasExtraValue(key: string): boolean {
    return this.#extraData.has(key);
  }

  getExtraValue(key: string): unknown | undefined {
    return this.#extraData.get(key);
  }

  addEarly(args: { event: TracingEvent }) {
    this.#earlyData.push(args.event);
  }

  addBranch(args: { spanId: string; parentSpanId: string | undefined }): void {
    this.#tree.set(args.spanId, args.parentSpanId);
  }

  getParentId(args: { spanId: string }): string | undefined {
    return this.#tree.get(args.spanId);
  }

  addSpan(args: { spanId: string; spanData: TSpanData }): void {
    this.#spans.set(args.spanId, args.spanData);
    this.#activeSpanIds.add(args.spanId); //Track span as active
  }

  hasSpan(args: { spanId: string }): boolean {
    const { spanId } = args;
    return this.#spans.has(spanId);
  }

  getSpan(args: { spanId: string }): TSpanData | undefined {
    const { spanId } = args;
    return this.#spans.get(spanId);
  }

  endSpan(args: { spanId: string }): void {
    this.#activeSpanIds.delete(args.spanId);
  }

  isActiveSpan(args: { spanId: string }): boolean {
    return this.#activeSpanIds.has(args.spanId);
  }

  activeSpanCount(): number {
    return this.#activeSpanIds.size;
  }

  get activeSpanIds(): string[] {
    return [...this.#activeSpanIds];
  }

  addEvent(args: { eventId: string; eventData: TEventData }) {
    this.#events.set(args.eventId, args.eventData);
  }

  // TODO: ideally this would add to the span metadata if it already existed
  // and not just completely overwrite it.
  // Maybe the type here should be different?
  addMetadata(args: { spanId: string; metadata: TMetadata }): void {
    this.#metadata.set(args.spanId, args.metadata);
  }

  getMetadata(args: { spanId: string }): TMetadata | undefined {
    return this.#metadata.get(args.spanId);
  }

  getParent(args: { span: AnyExportedSpan }): TSpanData | TEventData | undefined {
    const parentId = args.span.parentSpanId;
    // if parentId is undefined, then span is the rootSpan (and has no parent)
    if (parentId) {
      if (this.#spans.has(parentId)) {
        return this.#spans.get(parentId);
      }
      if (this.#events.has(parentId)) {
        return this.#events.get(parentId);
      }
    }
    return undefined;
  }

  getParentOrRoot(args: { span: AnyExportedSpan }): TRootData | TSpanData | TEventData | undefined {
    return this.getParent(args) ?? this.getRoot();
  }
}

/**
 * Abstract base class for exporters that track trace/span state.
 *
 * @typeParam TTraceData - The type of data stored per trace (must extend BaseTraceData)
 * @typeParam TConfig - Configuration type (must extend TrackingExporterConfig)
 */
export abstract class TrackingExporter<
  TRootData,
  TSpanData,
  TEventData,
  TMetadata,
  TConfig extends TrackingExporterConfig,
> extends BaseExporter {
  /**
   * Map of traceId to trace-specific data.
   * Contains vendor SDK objects, span maps, and active span tracking.
   */
  #traceMap = new Map<string, TraceData<TRootData, TSpanData, TEventData, TMetadata>>();
  #shutdownStarted = false;

  /**
   * Subclass configuration (typed for subclass-specific options)
   */
  protected readonly config: TConfig;

  constructor(config: TConfig) {
    super(config);
    this.config = config;
  }

  protected async _preExportTracingEvent(event: TracingEvent): Promise<TracingEvent> {
    return event;
  }

  protected async _postExportTracingEvent(): Promise<void> {}

  protected abstract _buildRoot(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TRootData | undefined>;

  protected abstract _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TEventData | undefined>;

  protected abstract _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TSpanData | undefined>;

  protected abstract _updateSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<void>;

  protected abstract _finishSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<void>;

  protected abstract _abortSpan(args: {
    span: TSpanData;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
    reason: SpanErrorInfo;
  }): Promise<void>;

  protected skipBuildRootTask = false;
  protected skipSpanUpdateEvents = false;
  protected skipCachingEventSpans = false;

  private getMethod(event: TracingEvent): 'handleEventSpan' | 'handleSpanStart' | 'handleSpanUpdate' | 'handleSpanEnd' {
    if (!event.exportedSpan.isEvent) {
      switch (event.type) {
        case 'span_started':
          return 'handleSpanStart';
        case 'span_updated':
          return 'handleSpanUpdate';
        case 'span_ended':
          return 'handleSpanEnd';
      }
    }
    return 'handleEventSpan';
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.#shutdownStarted) {
      return;
    }

    const method = this.getMethod(event);
    if (method == 'handleSpanUpdate' && this.skipSpanUpdateEvents) {
      return;
    }

    const traceData = this.getTraceData({ traceId: event.exportedSpan.traceId, method });

    const { exportedSpan } = await this._preExportTracingEvent(event);

    if (!this.skipBuildRootTask && !traceData.hasRoot()) {
      if (exportedSpan.isRootSpan) {
        this.logger.debug(`${this.name}: Building root`, {
          traceId: exportedSpan.traceId,
          spanId: exportedSpan.id,
        });
        const rootData = await this._buildRoot({ span: exportedSpan, traceData });
        if (rootData) {
          this.logger.debug(`${this.name}: Adding root`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          traceData.addRoot({ rootId: exportedSpan.id, rootData });
        }
      } else {
        this.logger.debug(`${this.name}: Root does not exist, adding early span to queue.`, {
          traceId: exportedSpan.traceId,
          spanId: exportedSpan.id,
        });
        traceData.addEarly({ event });
        return;
      }
    }

    if (exportedSpan.metadata && this.name in exportedSpan.metadata) {
      const metadata = exportedSpan.metadata[this.name] as TMetadata;
      this.logger.debug(`${this.name}: Found provider metadata in span`, {
        traceId: exportedSpan.traceId,
        spanId: exportedSpan.id,
        metadata,
      });
      traceData.addMetadata({ spanId: exportedSpan.id, metadata });
    }

    try {
      switch (method) {
        case 'handleEventSpan':
          this.logger.debug(`${this.name}: handling event`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          traceData.addBranch({ spanId: exportedSpan.id, parentSpanId: exportedSpan.parentSpanId });
          const eventData = await this._buildEvent({ span: exportedSpan, traceData });
          if (eventData) {
            if (!this.skipCachingEventSpans) {
              this.logger.debug(`${this.name}: adding event to traceData`, {
                traceId: exportedSpan.traceId,
                spanId: exportedSpan.id,
              });
              traceData.addEvent({ eventId: exportedSpan.id, eventData });
            }
          } else {
            this.logger.debug(`${this.name}: adding event early queue`, {
              traceId: exportedSpan.traceId,
              spanId: exportedSpan.id,
            });
            traceData.addEarly({ event });
          }
          break;
        case 'handleSpanStart':
          this.logger.debug(`${this.name}: handling span start`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          traceData.addBranch({ spanId: exportedSpan.id, parentSpanId: exportedSpan.parentSpanId });
          const spanData = await this._buildSpan({ span: exportedSpan, traceData });
          if (spanData) {
            this.logger.debug(`${this.name}: adding span to traceData`, {
              traceId: exportedSpan.traceId,
              spanId: exportedSpan.id,
            });
            traceData.addSpan({ spanId: exportedSpan.id, spanData });
          } else {
            this.logger.debug(`${this.name}: adding span early queue`, {
              traceId: exportedSpan.traceId,
            });
            traceData.addEarly({ event });
          }
          break;
        case 'handleSpanUpdate':
          this.logger.debug(`${this.name}: handling span update`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          await this._updateSpan({ span: exportedSpan, traceData });
          break;
        case 'handleSpanEnd':
          this.logger.debug(`${this.name}: handling span end`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          traceData.endSpan({ spanId: exportedSpan.id });
          await this._finishSpan({ span: exportedSpan, traceData });
          if (traceData.activeSpanCount() == 0) {
            this.clearTraceData({ traceId: event.exportedSpan.traceId, method });
          }
          break;
      }
    } catch (error) {
      this.logger.error(`${this.name}: exporter error`, { error, event, method });
    }

    await this._postExportTracingEvent();
  }

  /**
   * Get trace data for a span, creating one if not found
   *
   * @param context - The span context for logging
   * @returns The trace data
   */
  protected getTraceData(args: {
    traceId: string;
    method: string;
  }): TraceData<TRootData, TSpanData, TEventData, TMetadata> {
    const { traceId, method } = args;

    //TODO: Ideally we should store some history of traces that ended recently
    // and log a warning if we see a span coming in for a old trace, instead of
    // creating a new TraceData object for the span.
    if (!this.#traceMap.has(traceId)) {
      this.#traceMap.set(traceId, new TraceData());
      this.logger.debug(`${this.name}: Created new trace data cache`, {
        traceId,
        method,
      });
    }
    return this.#traceMap.get(traceId)!;
  }

  protected clearTraceData(args: { traceId: string; method: string }): void {
    const { traceId, method } = args;

    // TODO: Ideally this should be scheduled for some time in the future
    // and not occur immediately.
    if (this.#traceMap.has(traceId)) {
      this.#traceMap.delete(traceId);
      this.logger.debug(`${this.name}: Deleted trace data cache`, {
        traceId,
        method,
      });
    }
  }

  protected traceMapSize(): number {
    return this.#traceMap.size;
  }

  protected async _preShutdown(): Promise<void> {}

  protected async _postShutdown(): Promise<void> {}

  async shutdown(): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    this.#shutdownStarted = true;
    await this._preShutdown();
    // End all active spans

    const reason: SpanErrorInfo = {
      id: 'SHUTDOWN',
      message: 'Observability is shutting down.',
      domain: 'MASTRA_OBSERVABILITY',
      category: 'SYSTEM',
    };

    for (const [_traceId, traceData] of this.#traceMap) {
      for (const spanId of traceData.activeSpanIds) {
        const span = traceData.getSpan({ spanId });
        if (span) {
          await this._abortSpan({ span, traceData, reason });
        }
      }
    }

    this.#traceMap.clear();
    await this._postShutdown();
    await super.shutdown();
  }
}
