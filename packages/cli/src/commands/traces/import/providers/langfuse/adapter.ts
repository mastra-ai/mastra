import type { TraceImportProvider, TraceImportReadContext } from '../../provider.js';
import type {
  SkippedTrace,
  TraceImportRecord,
  TraceImportSourceIdentity,
  TraceImportSpan,
  TraceImportTrace,
} from '../../types.js';
import type { LangfuseClientDependencies, LangfuseClientOptions } from './client.js';
import { createLangfuseSpanImportId, createLangfuseTraceImportId, LANGFUSE_ID_ALGORITHM_VERSION } from './ids.js';
import { LangfuseObservationsReader, type LangfuseReadWindow, type LangfuseTraceReadOptions } from './reader.js';
import type { LangfuseObservation, LangfuseSourceTrace } from './types.js';

const MAPPER_VERSION = 'langfuse-api-v2@1';

const LANGFUSE_TYPE_MAP: Record<string, TraceImportSpan['spanType']> = {
  AGENT: 'agent_run',
  CHAIN: 'generic',
  EMBEDDING: 'rag_embedding',
  EVALUATOR: 'scorer_run',
  EVENT: 'generic',
  GENERATION: 'model_generation',
  GUARDRAIL: 'generic',
  RETRIEVER: 'generic',
  SPAN: 'generic',
  TOOL: 'tool_call',
};

const MASTRA_SPAN_TYPES = new Set<TraceImportSpan['spanType']>([
  'agent_run',
  'scorer_run',
  'scorer_step',
  'generic',
  'model_generation',
  'model_step',
  'model_inference',
  'model_chunk',
  'mcp_tool_call',
  'processor_run',
  'tool_call',
  'client_tool_call',
  'provider_tool_call',
  'workflow_run',
  'workflow_step',
  'workflow_conditional',
  'workflow_conditional_eval',
  'workflow_parallel',
  'workflow_loop',
  'workflow_sleep',
  'workflow_wait_event',
  'memory_operation',
  'workspace_action',
  'rag_ingestion',
  'rag_embedding',
  'rag_vector_operation',
  'rag_action',
  'graph_action',
  'mapping',
  'skill_resolution',
  'skill_action',
  'agent_signal',
]);

type TimestampedObservation = LangfuseObservation & {
  mastraImportDerivedEndTime?: true;
  mastraImportDerivedEndTimeSourceObservationId?: string;
};

interface OrderedLangfuseTrace {
  sourceTraceId: string;
  projectId: string;
  observations: TimestampedObservation[];
}

export interface MapLangfuseTraceOptions {
  importId: string;
  cutoffMs: number;
  snapshotMs: number;
}

export class LangfuseTraceImportProvider implements TraceImportProvider {
  private readonly reader: LangfuseObservationsReader;

  constructor(options: LangfuseClientOptions, dependencies: LangfuseClientDependencies = {}) {
    this.reader = new LangfuseObservationsReader(options, dependencies);
  }

  async identify(signal?: AbortSignal): Promise<TraceImportSourceIdentity> {
    const project = await this.reader.identify(signal);
    return {
      provider: 'langfuse',
      baseUrl: this.reader.baseUrl,
      projectId: project.id,
      mapperVersion: MAPPER_VERSION,
      idAlgorithmVersion: LANGFUSE_ID_ALGORITHM_VERSION,
    };
  }

  async *read(context: TraceImportReadContext): AsyncIterable<TraceImportRecord> {
    const importWindow = parseImportWindow(context.cutoffAt, context.snapshotAt);
    if (context.source.projectId.trim().length === 0) throw new Error('Langfuse project ID is required.');

    const window: LangfuseReadWindow = {
      cutoffAt: context.cutoffAt,
      snapshotAt: context.snapshotAt,
      projectId: context.source.projectId,
      signal: context.signal,
      onRetry: context.onRetry,
    };

    for await (const discovery of this.reader.discoverTraces(window)) {
      if (discovery.kind === 'missing-trace-id') {
        yield {
          kind: 'skipped',
          skipped: {
            sourceTraceId: null,
            spanCount: 1,
            reason: 'missing_trace_id',
            detail: discovery.observationId,
            sourceSpanIds: [discovery.observationId],
          },
        };
        continue;
      }

      const options: LangfuseTraceReadOptions = {
        traceId: discovery.traceId,
        projectId: context.source.projectId,
        signal: context.signal,
        onRetry: context.onRetry,
      };
      const sourceTrace = await this.reader.readTrace(options);
      yield mapLangfuseSourceTrace(sourceTrace, {
        importId: context.importId,
        ...importWindow,
      });
    }
  }
}

export function mapLangfuseSourceTrace(
  sourceTrace: LangfuseSourceTrace,
  options: MapLangfuseTraceOptions,
): TraceImportRecord {
  const ordered = validateAndOrderTrace(sourceTrace, options);
  if ('skipped' in ordered) return { kind: 'skipped', skipped: ordered.skipped };

  const unknownTypes = new Set<string>();
  const trace: TraceImportTrace = {
    sourceTraceId: ordered.trace.sourceTraceId,
    spans: ordered.trace.observations.map((observation, index) => {
      const mappedType = restoredMastraSpanType(observation) ?? LANGFUSE_TYPE_MAP[observation.type];
      if (mappedType === undefined) unknownTypes.add(observation.type);
      return mapObservationToSpan(observation, ordered.trace, options.importId, mappedType ?? 'generic', index);
    }),
  };

  const warnings = [...unknownTypes].sort().map(type => `Unknown Langfuse observation type: ${type}`);
  return warnings.length > 0 ? { kind: 'trace', trace, warnings } : { kind: 'trace', trace };
}

function validateAndOrderTrace(
  sourceTrace: LangfuseSourceTrace,
  options: MapLangfuseTraceOptions,
): { trace: OrderedLangfuseTrace } | { skipped: SkippedTrace } {
  const observations = sourceTrace.observations;
  if (observations.length === 0) {
    return { skipped: createSkippedTrace(sourceTrace.traceId, observations, 'empty_trace') };
  }

  const projectIds = new Set(observations.map(observation => observation.projectId));
  if (projectIds.size !== 1) {
    return { skipped: createSkippedTrace(sourceTrace.traceId, observations, 'mixed_project_ids') };
  }

  const byId = new Map<string, LangfuseObservation>();
  for (const observation of observations) {
    if (byId.has(observation.id)) {
      return {
        skipped: createSkippedTrace(sourceTrace.traceId, observations, 'duplicate_observation_id', observation.id),
      };
    }
    byId.set(observation.id, observation);
  }

  const roots = observations.filter(
    observation =>
      !observation.parentObservationId ||
      (observation.isRootObservation === true && !byId.has(observation.parentObservationId)),
  );
  if (roots.length === 0) return { skipped: createSkippedTrace(sourceTrace.traceId, observations, 'missing_root') };
  if (roots.length > 1) return { skipped: createSkippedTrace(sourceTrace.traceId, observations, 'multiple_roots') };

  const normalizedObservations = deriveVirtualRootEndTime(sourceTrace.traceId, observations, roots[0]!);
  const normalizedById = new Map(normalizedObservations.map(observation => [observation.id, observation]));
  const root = normalizedById.get(roots[0]!.id)!;

  for (const observation of normalizedObservations) {
    if (
      observation !== root &&
      observation.parentObservationId &&
      !normalizedById.has(observation.parentObservationId)
    ) {
      return {
        skipped: createSkippedTrace(
          sourceTrace.traceId,
          normalizedObservations,
          'missing_parent',
          observation.parentObservationId,
        ),
      };
    }

    const startMs = parseSourceTimestamp(observation.startTime);
    if (startMs === null) {
      return {
        skipped: createSkippedTrace(sourceTrace.traceId, normalizedObservations, 'invalid_timestamp', observation.id),
      };
    }

    if (observation.type === 'EVENT') {
      if (startMs > options.snapshotMs) {
        return {
          skipped: createSkippedTrace(
            sourceTrace.traceId,
            normalizedObservations,
            'completed_after_snapshot',
            observation.id,
          ),
        };
      }
      continue;
    }

    const endMs = parseSourceTimestamp(observation.endTime);
    if (endMs === null) {
      return {
        skipped: createSkippedTrace(sourceTrace.traceId, normalizedObservations, 'incomplete_duration', observation.id),
      };
    }
    if (endMs < startMs) {
      return {
        skipped: createSkippedTrace(sourceTrace.traceId, normalizedObservations, 'invalid_timestamp', observation.id),
      };
    }
    if (endMs > options.snapshotMs) {
      return {
        skipped: createSkippedTrace(
          sourceTrace.traceId,
          normalizedObservations,
          'completed_after_snapshot',
          observation.id,
        ),
      };
    }
  }

  const rootStartMs = parseSourceTimestamp(root.startTime)!;
  if (rootStartMs < options.cutoffMs || rootStartMs >= options.snapshotMs) {
    return { skipped: createSkippedTrace(sourceTrace.traceId, normalizedObservations, 'root_outside_window') };
  }

  const children = new Map<string, TimestampedObservation[]>();
  for (const observation of normalizedObservations) {
    if (observation === root || !observation.parentObservationId) continue;
    const siblings = children.get(observation.parentObservationId) ?? [];
    siblings.push(observation);
    children.set(observation.parentObservationId, siblings);
  }

  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
  }

  const ordered: TimestampedObservation[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (observation: TimestampedObservation): boolean => {
    if (visiting.has(observation.id)) return false;
    if (visited.has(observation.id)) return true;
    visiting.add(observation.id);
    ordered.push(observation);
    for (const child of children.get(observation.id) ?? []) {
      if (!visit(child)) return false;
    }
    visiting.delete(observation.id);
    visited.add(observation.id);
    return true;
  };

  if (!visit(root) || visited.size !== normalizedObservations.length) {
    return { skipped: createSkippedTrace(sourceTrace.traceId, normalizedObservations, 'cycle') };
  }

  return {
    trace: {
      sourceTraceId: sourceTrace.traceId,
      projectId: projectIds.values().next().value!,
      observations: ordered,
    },
  };
}

function mapObservationToSpan(
  observation: TimestampedObservation,
  trace: OrderedLangfuseTrace,
  importId: string,
  spanType: TraceImportSpan['spanType'],
  index: number,
): TraceImportSpan {
  const isEvent = observation.type === 'EVENT';
  return {
    traceId: createLangfuseTraceImportId(trace.projectId, trace.sourceTraceId),
    spanId: createLangfuseSpanImportId(trace.projectId, observation.id),
    parentSpanId:
      index > 0 && observation.parentObservationId
        ? createLangfuseSpanImportId(trace.projectId, observation.parentObservationId)
        : null,
    name: observation.name?.trim() || `langfuse:${observation.type.toLowerCase()}`,
    spanType,
    startedAt: observation.startTime,
    endedAt: isEvent ? observation.startTime : observation.endTime!,
    isEvent,
    attributes: buildAttributes(observation, spanType),
    metadata: buildMetadata(observation, trace, importId),
    tags: index === 0 && observation.tags ? observation.tags : undefined,
    input: parseIo(observation.input),
    output: parseIo(observation.output),
    error:
      observation.level === 'ERROR'
        ? {
            message: observation.statusMessage || 'Langfuse observation reported an error',
            name: 'LangfuseObservationError',
            details: { level: observation.level, sourceType: observation.type },
          }
        : null,
  };
}

function createSkippedTrace(
  sourceTraceId: string | null,
  observations: LangfuseObservation[],
  reason: string,
  detail?: string,
): SkippedTrace {
  const traceName = observations.find(observation => observation.traceName)?.traceName ?? undefined;
  return {
    sourceTraceId,
    spanCount: observations.length,
    reason,
    detail,
    traceName,
    sourceSpanIds: observations.map(observation => observation.id).sort(),
  };
}

function deriveVirtualRootEndTime(
  sourceTraceId: string,
  observations: LangfuseObservation[],
  root: LangfuseObservation,
): TimestampedObservation[] {
  if (root.endTime || root.id !== `t-${sourceTraceId}`) return observations;

  const latest = observations
    .filter(observation => observation.id !== root.id)
    .map(observation => ({
      observation,
      endMs: parseSourceTimestamp(
        observation.endTime ?? (observation.type === 'EVENT' ? observation.startTime : undefined),
      ),
    }))
    .filter((item): item is { observation: LangfuseObservation; endMs: number } => item.endMs !== null)
    .sort((left, right) => right.endMs - left.endMs || left.observation.id.localeCompare(right.observation.id))[0];

  if (!latest) return observations;

  return observations.map(observation =>
    observation.id === root.id
      ? {
          ...observation,
          endTime: new Date(latest.endMs).toISOString(),
          mastraImportDerivedEndTime: true,
          mastraImportDerivedEndTimeSourceObservationId: latest.observation.id,
        }
      : observation,
  );
}

function parseImportWindow(cutoffAt: string, snapshotAt: string): { cutoffMs: number; snapshotMs: number } {
  const cutoffMs = parseSourceTimestamp(cutoffAt);
  const snapshotMs = parseSourceTimestamp(snapshotAt);
  if (cutoffMs === null || snapshotMs === null || cutoffMs >= snapshotMs) {
    throw new Error('Langfuse import window must contain valid timestamps with cutoffAt before snapshotAt.');
  }
  return { cutoffMs, snapshotMs };
}

function parseSourceTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIo(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function definedRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function numericValue(record: Record<string, unknown> | null | undefined, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = finiteNumber(record?.[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function wrapSourceMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return { value };
}

function restoredMastraSpanType(observation: LangfuseObservation): TraceImportSpan['spanType'] | undefined {
  const metadata = wrapSourceMetadata(observation.metadata);
  if (!metadata) return undefined;

  const fromMastraExporter =
    metadata['scope.name'] === '@mastra/langfuse' ||
    metadata['resourceAttributes.telemetry.sdk.name'] === '@mastra/langfuse';
  if (!fromMastraExporter) return undefined;

  const spanType = metadata.spanType;
  return typeof spanType === 'string' && MASTRA_SPAN_TYPES.has(spanType as TraceImportSpan['spanType'])
    ? (spanType as TraceImportSpan['spanType'])
    : undefined;
}

function buildAttributes(
  observation: LangfuseObservation,
  spanType: TraceImportSpan['spanType'],
): Record<string, unknown> | undefined {
  const model = observation.model ?? observation.providedModelName ?? undefined;
  const usage = mapUsage(observation);

  if (spanType === 'rag_embedding') {
    const attributes = definedRecord({ model, usage });
    return Object.keys(attributes).length > 0 ? attributes : undefined;
  }

  if (spanType !== 'model_generation' && spanType !== 'model_step' && spanType !== 'model_inference') {
    return undefined;
  }

  const completionStartMs = observation.completionStartTime ? Date.parse(observation.completionStartTime) : Number.NaN;
  const attributes = definedRecord({
    model,
    usage,
    parameters: mapModelParameters(observation.modelParameters),
    costContext:
      typeof observation.totalCost === 'number' && Number.isFinite(observation.totalCost)
        ? { estimatedCost: observation.totalCost, costUnit: 'USD' }
        : undefined,
    completionStartTime: Number.isFinite(completionStartMs) ? new Date(completionStartMs).toISOString() : undefined,
  });
  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

function mapUsage(observation: LangfuseObservation): Record<string, unknown> | undefined {
  const inputTokens =
    finiteNumber(observation.inputUsage) ??
    numericValue(observation.usageDetails, 'input', 'inputTokens', 'input_tokens');
  const outputTokens =
    finiteNumber(observation.outputUsage) ??
    numericValue(observation.usageDetails, 'output', 'outputTokens', 'output_tokens');
  const inputDetails = definedRecord({
    cacheRead: numericValue(
      observation.usageDetails,
      'inputCachedTokens',
      'input_cached_tokens',
      'cacheReadInputTokens',
    ),
    cacheWrite: numericValue(observation.usageDetails, 'cacheCreationInputTokens', 'cache_creation_input_tokens'),
    audio: numericValue(observation.usageDetails, 'inputAudioTokens', 'input_audio_tokens'),
  });
  const outputDetails = definedRecord({
    reasoning: numericValue(observation.usageDetails, 'outputReasoningTokens', 'output_reasoning_tokens'),
    audio: numericValue(observation.usageDetails, 'outputAudioTokens', 'output_audio_tokens'),
  });
  const usage = definedRecord({
    inputTokens,
    outputTokens,
    inputDetails: Object.keys(inputDetails).length > 0 ? inputDetails : undefined,
    outputDetails: Object.keys(outputDetails).length > 0 ? outputDetails : undefined,
  });
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function mapModelParameters(parameters: unknown): Record<string, unknown> | undefined {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return undefined;
  const source = parameters as Record<string, unknown>;
  const stopSequences = source.stopSequences ?? source.stop_sequences ?? source.stop;
  const mapped = definedRecord({
    maxOutputTokens: numericValue(source, 'maxOutputTokens', 'max_output_tokens', 'max_tokens'),
    temperature: numericValue(source, 'temperature'),
    topP: numericValue(source, 'topP', 'top_p'),
    topK: numericValue(source, 'topK', 'top_k'),
    presencePenalty: numericValue(source, 'presencePenalty', 'presence_penalty'),
    frequencyPenalty: numericValue(source, 'frequencyPenalty', 'frequency_penalty'),
    seed: numericValue(source, 'seed'),
    maxRetries: numericValue(source, 'maxRetries', 'max_retries'),
    stopSequences:
      Array.isArray(stopSequences) && stopSequences.every(value => typeof value === 'string')
        ? stopSequences
        : undefined,
  });
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

function buildMetadata(
  observation: TimestampedObservation,
  trace: OrderedLangfuseTrace,
  importId: string,
): Record<string, unknown> {
  return definedRecord({
    source: 'langfuse',
    importSource: 'langfuse-api-v2',
    importBatchId: importId,
    langfuseTraceId: trace.sourceTraceId,
    langfuseObservationId: observation.id,
    langfuseProjectId: trace.projectId,
    environment: observation.environment ?? undefined,
    userId: observation.userId ?? undefined,
    sessionId: observation.sessionId ?? undefined,
    langfuseType: observation.type,
    langfuseMetadata: wrapSourceMetadata(observation.metadata),
    langfuse: definedRecord({
      isRootObservation: observation.isRootObservation ?? undefined,
      parentObservationId: observation.parentObservationId ?? undefined,
      level: observation.level ?? undefined,
      statusMessage: observation.statusMessage ?? undefined,
      version: observation.version ?? undefined,
      environment: observation.environment ?? undefined,
      createdAt: observation.createdAt ?? undefined,
      updatedAt: observation.updatedAt ?? undefined,
      release: observation.release ?? undefined,
      traceName: observation.traceName ?? undefined,
      bookmarked: observation.bookmarked ?? undefined,
      public: observation.public ?? undefined,
      model: observation.model ?? undefined,
      providedModelName: observation.providedModelName ?? undefined,
      internalModelId: observation.internalModelId ?? undefined,
      modelId: observation.modelId ?? undefined,
      modelParameters: observation.modelParameters ?? undefined,
      usageDetails: observation.usageDetails ?? undefined,
      inputUsage: observation.inputUsage ?? undefined,
      outputUsage: observation.outputUsage ?? undefined,
      totalUsage: observation.totalUsage ?? undefined,
      costDetails: observation.costDetails ?? undefined,
      inputCost: observation.inputCost ?? undefined,
      outputCost: observation.outputCost ?? undefined,
      totalCost: observation.totalCost ?? undefined,
      completionStartTime: observation.completionStartTime ?? undefined,
      inputPrice: observation.inputPrice ?? undefined,
      outputPrice: observation.outputPrice ?? undefined,
      totalPrice: observation.totalPrice ?? undefined,
      usagePricingTierId: observation.usagePricingTierId ?? undefined,
      usagePricingTierName: observation.usagePricingTierName ?? undefined,
      promptId: observation.promptId ?? undefined,
      promptName: observation.promptName ?? undefined,
      promptVersion: observation.promptVersion ?? undefined,
      latency: observation.latency ?? undefined,
      timeToFirstToken: observation.timeToFirstToken ?? undefined,
      tags: observation.tags ?? undefined,
      derivedEndTime: observation.mastraImportDerivedEndTime ?? undefined,
      derivedEndTimeSourceObservationId: observation.mastraImportDerivedEndTimeSourceObservationId ?? undefined,
    }),
  });
}
