/**
 * Test implementation of TrackingExporter for unit testing.
 * Exposes internals and tracks method calls for verification.
 */

import type { AnyExportedSpan, SpanErrorInfo } from '@mastra/core/observability';
import type { TraceData, TrackingExporterConfig } from '@mastra/observability';
import { TrackingExporter } from '@mastra/observability';

export interface TestTrackingExporterConfig extends TrackingExporterConfig {
  /** Simulate _buildSpan returning undefined for specific span IDs */
  failBuildSpanFor?: string[];
  /** Simulate _buildEvent returning undefined for specific span IDs */
  failBuildEventFor?: string[];
  /** Skip building root (like LangSmith) */
  skipRoot?: boolean;
}

type TestRootData = { type: 'root'; spanId: string };
type TestSpanData = { type: 'span'; spanId: string };
type TestEventData = { type: 'event'; spanId: string };
type TestMetadata = Record<string, unknown>;
type TestTraceData = TraceData<TestRootData, TestSpanData, TestEventData, TestMetadata>;

export interface MethodCall {
  method: string;
  spanId: string;
  traceId: string;
  timestamp: Date;
  args?: Record<string, unknown>;
}

export class TestTrackingExporter extends TrackingExporter<
  TestRootData,
  TestSpanData,
  TestEventData,
  TestMetadata,
  TestTrackingExporterConfig
> {
  name = 'test-exporter';

  // Track all method calls for verification
  public calls: MethodCall[] = [];

  // Track built spans/events for verification
  public builtRoots: Map<string, TestRootData> = new Map();
  public builtSpans: Map<string, TestSpanData> = new Map();
  public builtEvents: Map<string, TestEventData> = new Map();
  public abortedSpans: Map<string, SpanErrorInfo> = new Map();

  // Track root span ID for parent checking
  private rootSpanId?: string;

  private failBuildSpanFor: Set<string>;
  private failBuildEventFor: Set<string>;

  constructor(config: TestTrackingExporterConfig = {}) {
    super(config);

    this.failBuildSpanFor = new Set(config.failBuildSpanFor ?? []);
    this.failBuildEventFor = new Set(config.failBuildEventFor ?? []);

    if (config.skipRoot) {
      this.skipBuildRootTask = true;
    }
  }

  // Allow test access to protected method
  public async exportTracingEvent(event: Parameters<typeof this._exportTracingEvent>[0]): Promise<void> {
    return this._exportTracingEvent(event);
  }

  // Allow test access to trace data
  public getTraceDataPublic(args: { traceId: string; method: string }): TestTraceData {
    return this.getTraceData(args);
  }

  // Get trace map size for verification
  public getTraceMapSize(): number {
    return this.traceMapSize();
  }

  protected override async _buildRoot(args: {
    span: AnyExportedSpan;
    traceData: TestTraceData;
  }): Promise<TestRootData | undefined> {
    this.calls.push({
      method: '_buildRoot',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });

    const rootData: TestRootData = { type: 'root', spanId: args.span.id };
    this.builtRoots.set(args.span.id, rootData);
    this.rootSpanId = args.span.id;
    return rootData;
  }

  protected override async _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: TestTraceData;
  }): Promise<TestSpanData | undefined> {
    this.calls.push({
      method: '_buildSpan',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });

    // Simulate failure if configured
    if (this.failBuildSpanFor.has(args.span.id)) {
      return undefined;
    }

    // Check if parent exists (simulate real exporter behavior)
    // For non-root spans, we need the actual parent to exist (not just root)
    if (!args.span.isRootSpan) {
      const parentId = args.span.parentSpanId;
      if (parentId) {
        // Check if specific parent exists in spans
        const parent = args.traceData.getSpan({ spanId: parentId });
        // If parent doesn't exist in spans, check if parent is root
        if (!parent && parentId !== this.rootSpanId) {
          return undefined;
        }
      } else {
        // No parentId means direct child of root, check root exists
        if (!args.traceData.hasRoot() && !args.traceData.isRootProcessed()) {
          return undefined;
        }
      }
    }

    const spanData: TestSpanData = { type: 'span', spanId: args.span.id };
    this.builtSpans.set(args.span.id, spanData);

    // If this is a root span (skipRoot=true mode), track the root ID
    if (args.span.isRootSpan) {
      this.rootSpanId = args.span.id;
    }

    return spanData;
  }

  protected override async _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: TestTraceData;
  }): Promise<TestEventData | undefined> {
    this.calls.push({
      method: '_buildEvent',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });

    // Simulate failure if configured
    if (this.failBuildEventFor.has(args.span.id)) {
      return undefined;
    }

    // Check if parent exists (simulate real exporter behavior)
    const parent = args.traceData.getParentOrRoot({ span: args.span });
    if (!parent) {
      return undefined;
    }

    const eventData: TestEventData = { type: 'event', spanId: args.span.id };
    this.builtEvents.set(args.span.id, eventData);
    return eventData;
  }

  protected override async _updateSpan(args: { span: AnyExportedSpan; traceData: TestTraceData }): Promise<void> {
    this.calls.push({
      method: '_updateSpan',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });
  }

  protected override async _finishSpan(args: { span: AnyExportedSpan; traceData: TestTraceData }): Promise<void> {
    this.calls.push({
      method: '_finishSpan',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });
  }

  protected override async _abortSpan(args: {
    span: TestSpanData;
    traceData: TestTraceData;
    reason: SpanErrorInfo;
  }): Promise<void> {
    this.calls.push({
      method: '_abortSpan',
      spanId: args.span.spanId,
      traceId: 'unknown', // TraceData doesn't have traceId directly
      timestamp: new Date(),
      args: { reason: args.reason },
    });

    this.abortedSpans.set(args.span.spanId, args.reason);
  }

  // Helper methods for test assertions

  public getCallsForMethod(method: string): MethodCall[] {
    return this.calls.filter(c => c.method === method);
  }

  public getCallsForSpan(spanId: string): MethodCall[] {
    return this.calls.filter(c => c.spanId === spanId);
  }

  public wasMethodCalledForSpan(method: string, spanId: string): boolean {
    return this.calls.some(c => c.method === method && c.spanId === spanId);
  }

  public reset(): void {
    this.calls = [];
    this.builtRoots.clear();
    this.builtSpans.clear();
    this.builtEvents.clear();
    this.abortedSpans.clear();
  }
}
