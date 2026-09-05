import { createTargetSpanId, createTargetTraceId } from '../../ids.js';
import { collectorSpanSchema, mastraSpanTypeSchema, type CollectorSpan } from '../../target/collector-schema.js';
import type { AssembledTrace } from '../../types.js';
import type { LangfuseObservation } from './schema.js';

const TYPE_MAP: Record<string, CollectorSpan['spanType']> = {
  EVENT: 'generic',
  SPAN: 'generic',
  GENERATION: 'model_generation',
  AGENT: 'agent_run',
  TOOL: 'tool_call',
  CHAIN: 'generic',
  RETRIEVER: 'generic',
  EVALUATOR: 'scorer_run',
  EMBEDDING: 'rag_embedding',
  GUARDRAIL: 'generic',
};

function definedRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
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

function numericValue(record: Record<string, unknown> | null | undefined, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function mapUsage(observation: LangfuseObservation): Record<string, unknown> | undefined {
  const inputTokens =
    observation.inputUsage ?? numericValue(observation.usageDetails, 'input', 'inputTokens', 'input_tokens');
  const outputTokens =
    observation.outputUsage ?? numericValue(observation.usageDetails, 'output', 'outputTokens', 'output_tokens');
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

function compatibleNumber(source: Record<string, unknown> | null | undefined, ...keys: string[]): number | undefined {
  return numericValue(source, ...keys);
}

function mapModelParameters(parameters: unknown): Record<string, unknown> | undefined {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return undefined;
  const parameterRecord = parameters as Record<string, unknown>;
  const stopSequences = parameterRecord.stopSequences ?? parameterRecord.stop_sequences ?? parameterRecord.stop;
  const mapped = definedRecord({
    maxOutputTokens: compatibleNumber(parameterRecord, 'maxOutputTokens', 'max_output_tokens', 'max_tokens'),
    temperature: compatibleNumber(parameterRecord, 'temperature'),
    topP: compatibleNumber(parameterRecord, 'topP', 'top_p'),
    topK: compatibleNumber(parameterRecord, 'topK', 'top_k'),
    presencePenalty: compatibleNumber(parameterRecord, 'presencePenalty', 'presence_penalty'),
    frequencyPenalty: compatibleNumber(parameterRecord, 'frequencyPenalty', 'frequency_penalty'),
    seed: compatibleNumber(parameterRecord, 'seed'),
    maxRetries: compatibleNumber(parameterRecord, 'maxRetries', 'max_retries'),
    stopSequences:
      Array.isArray(stopSequences) && stopSequences.every(value => typeof value === 'string')
        ? stopSequences
        : undefined,
  });
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

function wrapSourceMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return { value };
}

function restoredMastraSpanType(observation: LangfuseObservation): CollectorSpan['spanType'] | undefined {
  const metadata = wrapSourceMetadata(observation.metadata);
  if (!metadata) return undefined;

  const fromMastraExporter =
    metadata['scope.name'] === '@mastra/langfuse' ||
    metadata['resourceAttributes.telemetry.sdk.name'] === '@mastra/langfuse';
  if (!fromMastraExporter) return undefined;

  const result = mastraSpanTypeSchema.safeParse(metadata.spanType);
  return result.success ? result.data : undefined;
}

function buildAttributes(observation: LangfuseObservation): Record<string, unknown> | undefined {
  const type = TYPE_MAP[observation.type] ?? 'generic';
  if (type !== 'model_generation' && type !== 'rag_embedding') return undefined;

  const model = observation.model ?? observation.providedModelName ?? undefined;
  const usage = mapUsage(observation);
  if (type === 'rag_embedding') {
    const attributes = definedRecord({ model, usage });
    return Object.keys(attributes).length > 0 ? attributes : undefined;
  }

  const costContext =
    observation.totalCost !== null && observation.totalCost !== undefined
      ? { estimatedCost: observation.totalCost, costUnit: 'USD' }
      : undefined;
  const completionStart = observation.completionStartTime ? Date.parse(observation.completionStartTime) : Number.NaN;
  const completionStartTime = Number.isFinite(completionStart) ? new Date(completionStart).toISOString() : undefined;
  const attributes = definedRecord({
    model,
    usage,
    parameters: mapModelParameters(observation.modelParameters),
    costContext,
    completionStartTime,
  });
  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

function buildMetadata(
  observation: LangfuseObservation,
  trace: AssembledTrace,
  importBatchId: string,
  environment?: string,
): Record<string, unknown> {
  return definedRecord({
    source: 'langfuse',
    importSource: 'langfuse-api-v2',
    importBatchId,
    langfuseTraceId: trace.sourceTraceId,
    langfuseObservationId: observation.id,
    langfuseProjectId: trace.projectId,
    environment: environment ?? observation.environment ?? undefined,
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

export interface NormalizeTraceResult {
  spans: CollectorSpan[];
  unknownTypes: string[];
}

export function normalizeLangfuseTrace(
  trace: AssembledTrace,
  options: { importBatchId: string; environment?: string },
): NormalizeTraceResult {
  const targetTraceId = createTargetTraceId(trace.projectId, trace.sourceTraceId);
  const unknownTypes = new Set<string>();
  const spans = trace.observations.map((observation, index) => {
    const spanType = restoredMastraSpanType(observation) ?? TYPE_MAP[observation.type] ?? 'generic';
    if (!TYPE_MAP[observation.type]) unknownTypes.add(observation.type);
    const isEvent = observation.type === 'EVENT';
    const span = collectorSpanSchema.parse({
      traceId: targetTraceId,
      spanId: createTargetSpanId(trace.projectId, observation.id),
      parentSpanId:
        index > 0 && observation.parentObservationId
          ? createTargetSpanId(trace.projectId, observation.parentObservationId)
          : null,
      name: observation.name?.trim() || `langfuse:${observation.type.toLowerCase()}`,
      spanType,
      attributes: buildAttributes(observation),
      metadata: buildMetadata(observation, trace, options.importBatchId, options.environment),
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
      startedAt: observation.startTime,
      endedAt: isEvent ? observation.startTime : observation.endTime,
      isEvent,
    });
    return span;
  });

  return { spans, unknownTypes: [...unknownTypes].sort() };
}
