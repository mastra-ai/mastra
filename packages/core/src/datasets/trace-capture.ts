import type { DatasetsStorage } from '../storage/domains/datasets/base';
import type { ObservabilityStorage } from '../storage/domains/observability/base';
import type { CaptureToDatasetOptions, DatasetItem } from './types';

/**
 * Span data structure for capture operations.
 */
export interface CaptureSpan {
  spanId: string;
  traceId: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  spanType?: string;
  name?: string;
}

/**
 * Options for capturing a single span to a dataset.
 */
export interface CaptureSpanToDatasetOptions {
  /** Storage adapter for datasets */
  storage: DatasetsStorage;
  /** Span data to capture */
  span: CaptureSpan;
  /** Target dataset ID */
  datasetId: string;
  /** Optional transform function to modify span data before saving */
  transform?: CaptureToDatasetOptions['transform'];
}

/**
 * Options for capturing all spans from a trace to a dataset.
 */
export interface CaptureTraceToDatasetOptions {
  /** Storage adapter for datasets */
  storage: DatasetsStorage;
  /** Storage adapter for observability/traces */
  observabilityStorage: ObservabilityStorage;
  /** Trace ID to capture spans from */
  traceId: string;
  /** Capture configuration including filters and transforms */
  captureOptions: CaptureToDatasetOptions;
}

/**
 * Options for capturing spans from multiple traces to a dataset.
 */
export interface CaptureTracesToDatasetOptions {
  /** Storage adapter for datasets */
  storage: DatasetsStorage;
  /** Storage adapter for observability/traces */
  observabilityStorage: ObservabilityStorage;
  /** Trace IDs to capture spans from */
  traceIds: string[];
  /** Capture configuration including filters and transforms */
  captureOptions: CaptureToDatasetOptions;
}

/**
 * Creates a dataset item from a single span.
 *
 * @param options - Configuration for span capture
 * @returns The created dataset item
 * @throws Error if storage operation fails
 *
 * @example
 * ```typescript
 * const item = await captureSpanToDataset({
 *   storage: datasetsStorage,
 *   span: { spanId: 'span-1', traceId: 'trace-1', input: 'hello', output: 'world' },
 *   datasetId: 'my-dataset',
 * });
 * ```
 */
export async function captureSpanToDataset(options: CaptureSpanToDatasetOptions): Promise<DatasetItem> {
  const { storage, span, datasetId, transform } = options;

  // Apply transform if provided, otherwise use span data directly
  const itemData = transform
    ? transform({
        input: span.input,
        output: span.output,
        metadata: span.metadata,
      })
    : {
        input: span.input,
        expectedOutput: span.output,
        metadata: span.metadata,
      };

  const item = await storage.createDatasetItem({
    datasetId,
    input: itemData.input,
    expectedOutput: itemData.expectedOutput,
    metadata: itemData.metadata,
    sourceTraceId: span.traceId,
    sourceSpanId: span.spanId,
  });

  return item;
}

/**
 * Captures spans from a trace as dataset items.
 *
 * Fetches all spans for a trace, applies optional filtering,
 * and creates dataset items for each matching span.
 *
 * @param options - Configuration for trace capture
 * @returns Array of created dataset items
 * @throws Error if trace not found or storage operation fails
 *
 * @example
 * ```typescript
 * const items = await captureTraceToDataset({
 *   storage: datasetsStorage,
 *   observabilityStorage,
 *   traceId: 'trace-123',
 *   captureOptions: {
 *     datasetId: 'my-dataset',
 *     spanFilter: (span) => span.spanType === 'TOOL_CALL',
 *   },
 * });
 * ```
 */
export async function captureTraceToDataset(options: CaptureTraceToDatasetOptions): Promise<DatasetItem[]> {
  const { storage, observabilityStorage, traceId, captureOptions } = options;

  // Fetch all spans for the trace
  const traceData = await observabilityStorage.getTrace({ traceId });

  if (!traceData) {
    throw new Error(`Trace not found: ${traceId}`);
  }

  const { spans } = traceData;

  // Filter spans if filter function provided
  const filteredSpans = captureOptions.spanFilter
    ? spans.filter(span =>
        captureOptions.spanFilter!({
          spanId: span.spanId,
          spanType: span.spanType,
          name: span.name,
          input: span.input,
          output: span.output,
          metadata: span.metadata as Record<string, unknown> | undefined,
        }),
      )
    : spans;

  // Create dataset items for each matching span
  const items: DatasetItem[] = [];

  for (const span of filteredSpans) {
    const item = await captureSpanToDataset({
      storage,
      span: {
        spanId: span.spanId,
        traceId: span.traceId,
        input: span.input,
        output: span.output,
        metadata: span.metadata as Record<string, unknown> | undefined,
        spanType: span.spanType,
        name: span.name,
      },
      datasetId: captureOptions.datasetId,
      transform: captureOptions.transform,
    });

    items.push(item);
  }

  return items;
}

/**
 * Captures spans from multiple traces as dataset items.
 *
 * Iterates through each trace ID and captures matching spans
 * based on the provided capture options.
 *
 * @param options - Configuration for multi-trace capture
 * @returns Flattened array of all created dataset items
 * @throws Error if any trace not found or storage operation fails
 *
 * @example
 * ```typescript
 * const items = await captureTracesToDataset({
 *   storage: datasetsStorage,
 *   observabilityStorage,
 *   traceIds: ['trace-1', 'trace-2', 'trace-3'],
 *   captureOptions: {
 *     datasetId: 'my-dataset',
 *     spanFilter: (span) => span.spanType === 'AGENT_RUN',
 *     transform: ({ input, output }) => ({
 *       input,
 *       expectedOutput: output,
 *     }),
 *   },
 * });
 * ```
 */
export async function captureTracesToDataset(options: CaptureTracesToDatasetOptions): Promise<DatasetItem[]> {
  const { storage, observabilityStorage, traceIds, captureOptions } = options;

  const allItems: DatasetItem[] = [];

  for (const traceId of traceIds) {
    const items = await captureTraceToDataset({
      storage,
      observabilityStorage,
      traceId,
      captureOptions,
    });

    allItems.push(...items);
  }

  return allItems;
}
