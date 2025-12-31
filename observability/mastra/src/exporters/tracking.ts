import type { TracingEvent, AnyExportedSpan } from '@mastra/core/observability';
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
  #tree: Map<string, string|undefined>; // Maps spanId to parentSpanId
  #activeSpanIds: Set<string>; // Set of span IDs that have started but not yet ended
  #metadata: Map<string, TMetadata>; // Mpa of id to vender-specific metadata
  #earlyData: TracingEvent[]; // Any tracing events that arrive before the root span

  constructor() {
    this.#events = new Map();
    this.#spans = new Map();
    this.#activeSpanIds = new Set();
    this.#tree = new Map();
    this.#metadata = new Map();
    this.#earlyData = [];
  }

  hasRoot() : boolean {
    return !!this.#rootSpanId
  }

  addRoot(args: { rootId: string, rootData: TRootData }): void {
    this.#rootSpanId = args.rootId;
    this.#rootSpan = args.rootData;
  }

  getRoot() : TRootData | undefined {
    return this.#rootSpan;
  }

  addEarly(args: { event: TracingEvent}) {
    this.#earlyData.push(args.event);
  }

  addBranch(args: { spanId: string, parentSpanId: string | undefined }): void {
    this.#tree.set(args.spanId, args.parentSpanId);
  }

  getParentId(args: { spanId: string }): string | undefined {
    return this.#tree.get(args.spanId);
  }

  addSpan(args: { spanId: string; spanData: TSpanData }): void {
    this.#spans.set(args.spanId, args.spanData);
    this.#activeSpanIds.add(args.spanId); //Track span as active
  }

  isActiveSpan(args: { spanId: string}) : boolean {
    return this.#activeSpanIds.has(args.spanId);
  }

  addMetadata(args: { spanId: string; metadata: TMetadata}): void {
    this.#metadata.set(args.spanId, args.metadata);
  }

  getMetadata(args: { spanId: string }) : TMetadata | undefined {
    return this.#metadata.get(args.spanId);
  }

  getSpan(args: { spanId: string}): TRootData | TSpanData | undefined {
    const { spanId } = args;
    if (this.#rootSpanId == spanId) {
        return this.#rootSpan;
    }
    return this.#spans.get(spanId);
  }

  endSpan(args: { spanId: string}): void {
    this.#activeSpanIds.delete(args.spanId);
  }

  addEvent(args: { eventId: string; eventData: TEventData }) {
    this.#events.set(args.eventId, args.eventData);
  }

  getParent(args: {span: AnyExportedSpan} ): TRootData | TSpanData | TEventData | undefined {
    const parentId = args.span.parentSpanId;
    if (!parentId) {
      return this.#rootSpan;
    }
    if (this.#spans.has(parentId)) {
      return this.#spans.get(parentId);
    }
    if (this.#events.has(parentId)) {
      return this.#events.get(parentId);
    }
    return undefined;
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

  protected abstract _buildRoot( args: {
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



  private getMethod(event: TracingEvent): 'handleEventSpan' | 'handleSpanStart' | 'handleSpanUpdate' | 'handleSpanEnd'
  {
    if (!event.exportedSpan.isEvent) {
    switch (event.type) {
      case 'span_started':
        return 'handleSpanStart';
      case 'span_updated':
        return 'handleSpanUpdate';
      case 'span_ended':
        return 'handleSpanEnd'
    }
    }
    return 'handleEventSpan'
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const method = this.getMethod(event);
    const traceData = this.getTraceData({ traceId: event.exportedSpan.traceId, method });

    const { exportedSpan } = await this._preExportTracingEvent(event);

    if (!traceData.hasRoot()) {
        if (event.exportedSpan.isRootSpan) {
            const rootData = await this._buildRoot({ span: exportedSpan, traceData })
            if (rootData) {
                traceData.addRoot({rootId: exportedSpan.id, rootData});
            }
        } else {
            traceData.addEarly({event})
            return
        }
    }

    traceData.addBranch({spanId: exportedSpan.id, parentSpanId: exportedSpan.parentSpanId })

    if (exportedSpan.metadata && this.name in exportedSpan.metadata) {
        const metadata = exportedSpan.metadata[this.name] as TMetadata;
        traceData.addMetadata({spanId: exportedSpan.id, metadata})
    }

    switch (method) {
        case 'handleEventSpan':
            const eventData = await this._buildEvent({ span: exportedSpan, traceData });
            if (eventData) {
                traceData.addEvent({ eventId: exportedSpan.id, eventData });
            } else {
                traceData.addEarly({event})
            }
            break;
        case 'handleSpanStart':
            const spanData = await this._buildSpan({ span: exportedSpan, traceData });
            if (spanData) {
                traceData.addSpan({ spanId: exportedSpan.id, spanData });
            } else {
                traceData.addEarly({event})
            }
            break;
        case 'handleSpanUpdate':
            await this._updateSpan({span: exportedSpan, traceData })
            break;
        case 'handleSpanEnd':
            traceData.endSpan({spanId: exportedSpan.id})
            await this._finishSpan({span: exportedSpan, traceData })
            break;
    }

    await this._postExportTracingEvent();
  }



  //   /**
  //    * Create the initial trace data structure for a new trace.
  //    * Called when the root span of a trace is first encountered.
  //    * Note: Other (non-root) span data may have already arrived.
  //    *
  //    * @param span - The root span that initiated the trace
  //    * @returns The initial trace data structure
  //    */
  //   protected abstract createTraceData(span: AnyExportedSpan): TraceData<TRootData, TSpanData, TEventData> | Promise<TraceData<TRootData, TSpanData, TEventData>>;

  //   /**
  //    * Initialize trace data for a root span.
  //    * Creates the trace entry if it doesn't exist.
  //    *
  //    * @param span - The root span
  //    * @returns The trace data (existing or newly created)
  //    */
  //   protected async initTrace(span: AnyExportedSpan): Promise<TraceData<TRootData, TSpanData, TEventData>> {
  //     // Check if trace already exists - reuse it
  //     const existing = this.traceMap.get(span.traceId);
  //     if (existing) {
  //       this.logger.debug(`${this.name}: Reusing existing trace from local map`, {
  //         traceId: span.traceId,
  //         spanId: span.id,
  //         spanName: span.name,
  //       });
  //       return existing;
  //     }

  //     // Create new trace data
  //     const traceData = await this.createTraceData(span);
  //     this.traceMap.set(span.traceId, traceData);



  //     return traceData;
  //   }

  /**
   * Get trace data for a span, creating one if not found
   *
   * @param context - The span context for logging
   * @returns The trace data
   */
  protected getTraceData(args: { traceId: string, method: string}): TraceData<TRootData, TSpanData, TEventData, TMetadata> {
    const { traceId, method } = args;

    //TODO: Ideally we should store some history of traces that ended recently
    // and log a warning if we see a span coming in for a old trace, instead of
    // creating a new TraceData object for the span.
    if (!this.#traceMap.has(traceId)) {
        this.#traceMap.set(traceId, new TraceData())
        this.logger.debug(`${this.name}: Created new trace data cache`, {
            traceId,
            method,
        });
    }
    return this.#traceMap.get(traceId)!
  }


//   async shutdown(): Promise<void> {
//     if (this.client) {
//       await this.client.shutdownAsync();
//     }
//     this.traceMap.clear();
//     await super.shutdown();
//   }
}
