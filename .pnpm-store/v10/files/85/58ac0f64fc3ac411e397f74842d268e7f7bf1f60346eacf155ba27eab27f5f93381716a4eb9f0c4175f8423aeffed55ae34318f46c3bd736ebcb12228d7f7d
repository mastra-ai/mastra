import { Inngest } from "../../Inngest.js";
import { Span } from "@opentelemetry/api";
import { ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { IResource } from "@opentelemetry/resources";

//#region src/components/execution/otel/processor.d.ts

/**
 * An OTel span processor that is used to export spans to the Inngest endpoint.
 * This is used to track spans that are created within an Inngest run and export
 * them to the Inngest endpoint for tracing.
 *
 * It's careful to only pick relevant spans to export and will not send any
 * irrelevant spans to the Inngest endpoint.
 *
 * THIS IS THE INTERNAL IMPLEMENTATION OF THE SPAN PROCESSOR AND SHOULD NOT BE
 * USED BY USERS DIRECTLY. USE THE {@link PublicInngestSpanProcessor} CLASS
 * INSTEAD.
 */
declare class InngestSpanProcessor implements SpanProcessor {
  #private;
  /**
   * An OTel span processor that is used to export spans to the Inngest endpoint.
   * This is used to track spans that are created within an Inngest run and export
   * them to the Inngest endpoint for tracing.
   *
   * It's careful to only pick relevant spans to export and will not send any
   * irrelevant spans to the Inngest endpoint.
   */
  constructor(
  /**
   * The app that this span processor is associated with. This is used to
   * determine the Inngest endpoint to export spans to.
   *
   * It is optional here as this is the private constructor and only used
   * internally; we set `app` elsewhere as when we create the processor (as
   * early as possible when the process starts) we don't necessarily have the
   * app available yet.
   *
   * So, internally we can delay setting ths until later.
   */
  app?: Inngest.Like);
  /**
   * In order to only capture a subset of spans, we need to declare the initial
   * span that we care about and then export its children.
   *
   * Call this method (ideally just before execution starts) with that initial
   * span to trigger capturing all following children as well as initialize the
   * batcher.
   */
  declareStartingSpan({
    span,
    runId,
    traceparent,
    tracestate
  }: {
    span: Span;
    runId: string;
    traceparent: string | undefined;
    tracestate: string | undefined;
  }): void;
  /**
   * A getter for retrieving resource attributes for the current process. This
   * is used to set the resource attributes for the spans that are exported to
   * the Inngest endpoint, and cache them for later use.
   */
  static get resourceAttributes(): IResource;
  /**
   * The batcher is a singleton that is used to export spans to the OTel
   * endpoint. It is created lazily to avoid creating it until the Inngest App
   * has been initialized and has had a chance to receive environment variables,
   * which may be from an incoming request.
   *
   * The batcher is only referenced once we've found a span we're interested in,
   * so this should always have everything it needs on the app by then.
   */
  private ensureBatcherInitialized;
  /**
   * Mark a span as being tracked by this processor, meaning it will be exported
   * to the Inggest endpoint when it ends.
   */
  private trackSpan;
  /**
   * Clean up any references to a span that has ended. This is used to avoid
   * memory leaks in the case where a span is not exported, remains unended, and
   * is left in memory before being GC'd.
   */
  private cleanupSpan;
  /**
   * An implementation of the `onStart` method from the `SpanProcessor`
   * interface. This is called when a span is started, and is used to track
   * spans that are children of spans we care about.
   */
  onStart(span: Span): void;
  /**
   * An implementation of the `onEnd` method from the `SpanProcessor` interface.
   * This is called when a span ends, and is used to export spans to the Inngest
   * endpoint.
   */
  onEnd(span: ReadableSpan): void;
  /**
   * An implementation of the `forceFlush` method from the `SpanProcessor`
   * interface. This is called to force the processor to flush any spans that
   * are currently in the batcher. This is used to ensure that spans are
   * exported to the Inngest endpoint before the process exits.
   *
   * Notably, we call this in the `beforeResponse` middleware hook to ensure
   * that spans for a run as exported as soon as possible and before the
   * serverless process is killed.
   */
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}
/**
 * An OTel span processor that is used to export spans to the Inngest endpoint.
 * This is used to track spans that are created within an Inngest run and export
 * them to the Inngest endpoint for tracing.
 *
 * It's careful to only pick relevant spans to export and will not send any
 * irrelevant spans to the Inngest endpoint.
 */
declare class PublicInngestSpanProcessor extends InngestSpanProcessor {
  constructor(
  /**
   * The app that this span processor is associated with. This is used to
   * determine the Inngest endpoint to export spans to.
   */
  app: Inngest.Like);
}
//#endregion
export { PublicInngestSpanProcessor };
//# sourceMappingURL=processor.d.ts.map