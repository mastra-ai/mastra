import { describe, expect, it } from 'vitest';
import type { AssembledTrace } from '../../types.js';
import { normalizeLangfuseTrace } from './adapter.js';
import type { LangfuseObservation } from './schema.js';

function observation(type = 'GENERATION', overrides: Partial<LangfuseObservation> = {}): LangfuseObservation {
  return {
    id: 'observation-1',
    traceId: 'trace-1',
    projectId: 'project-1',
    parentObservationId: null,
    type,
    name: 'answer',
    startTime: '2026-08-20T10:00:00.000Z',
    endTime: '2026-08-20T10:00:02.000Z',
    ...overrides,
  };
}

function trace(item: LangfuseObservation): AssembledTrace {
  return { sourceTraceId: 'trace-1', projectId: 'project-1', observations: [item] };
}

describe('normalizeLangfuseTrace', () => {
  it.each([
    ['EVENT', 'generic'],
    ['SPAN', 'generic'],
    ['GENERATION', 'model_generation'],
    ['AGENT', 'agent_run'],
    ['TOOL', 'tool_call'],
    ['CHAIN', 'generic'],
    ['RETRIEVER', 'generic'],
    ['EVALUATOR', 'scorer_run'],
    ['EMBEDDING', 'rag_embedding'],
    ['GUARDRAIL', 'generic'],
  ])('maps %s to %s', (sourceType, targetType) => {
    const result = normalizeLangfuseTrace(trace(observation(sourceType)), { importBatchId: crypto.randomUUID() });
    expect(result.spans[0]?.spanType).toBe(targetType);
    expect(result.spans[0]?.metadata.langfuseType).toBe(sourceType);
  });

  it('falls back for an unknown future type and preserves it', () => {
    const result = normalizeLangfuseTrace(trace(observation('FUTURE_KIND')), {
      importBatchId: crypto.randomUUID(),
    });
    expect(result.spans[0]?.spanType).toBe('generic');
    expect(result.unknownTypes).toEqual(['FUTURE_KIND']);
  });

  it.each([
    ['workflow_run', 'scope.name'],
    ['model_step', 'resourceAttributes.telemetry.sdk.name'],
  ] as const)('restores Mastra span type %s from %s provenance', (spanType, provenanceKey) => {
    const result = normalizeLangfuseTrace(
      trace(
        observation('SPAN', {
          metadata: {
            [provenanceKey]: '@mastra/langfuse',
            spanType,
          },
        }),
      ),
      { importBatchId: crypto.randomUUID() },
    );

    expect(result.spans[0]?.spanType).toBe(spanType);
  });

  it('does not trust Mastra span type metadata without Mastra exporter provenance', () => {
    const result = normalizeLangfuseTrace(trace(observation('SPAN', { metadata: { spanType: 'workflow_run' } })), {
      importBatchId: crypto.randomUUID(),
    });

    expect(result.spans[0]?.spanType).toBe('generic');
  });

  it('falls back to the Langfuse type when exporter span type metadata is invalid', () => {
    const result = normalizeLangfuseTrace(
      trace(
        observation('GENERATION', {
          metadata: {
            'scope.name': '@mastra/langfuse',
            spanType: 'not_a_mastra_span_type',
          },
        }),
      ),
      { importBatchId: crypto.randomUUID() },
    );

    expect(result.spans[0]?.spanType).toBe('model_generation');
  });

  it('preserves timestamps, structured I/O, and raw provider metadata', () => {
    const source = observation('GENERATION', {
      input: { question: 'hello' },
      output: 'plain text',
      model: 'gpt-4o-mini',
      inputUsage: 10,
      outputUsage: 4,
      totalCost: 0.001,
      modelParameters: { temperature: 0.2, top_p: 0.9, unsupported: true },
      metadata: ['non-object'],
      level: 'ERROR',
      statusMessage: 'provider failed',
      environment: 'production',
      tags: ['support'],
      createdAt: '2026-08-20T10:00:03.000Z',
    });
    const result = normalizeLangfuseTrace(trace(source), { importBatchId: crypto.randomUUID() });
    const span = result.spans[0]!;
    expect(span.startedAt).toBe(source.startTime);
    expect(span.endedAt).toBe(source.endTime);
    expect(span.input).toEqual({ question: 'hello' });
    expect(span.output).toBe('plain text');
    expect(span.attributes).toMatchObject({
      model: 'gpt-4o-mini',
      usage: { inputTokens: 10, outputTokens: 4 },
      parameters: { temperature: 0.2, topP: 0.9 },
      costContext: { estimatedCost: 0.001, costUnit: 'USD' },
    });
    expect(span.metadata).toMatchObject({
      source: 'langfuse',
      importSource: 'langfuse-api-v2',
      langfuseTraceId: 'trace-1',
      langfuseObservationId: 'observation-1',
      langfuseMetadata: { value: ['non-object'] },
      langfuse: { createdAt: source.createdAt },
    });
    expect(span.error).toMatchObject({ message: 'provider failed' });
    expect(span.tags).toEqual(['support']);
  });

  it('marks derived virtual-root end times in metadata', () => {
    const source = observation('SPAN', {
      id: 't-trace-1',
      mastraImportDerivedEndTime: true,
      mastraImportDerivedEndTimeSourceObservationId: 'child-1',
    });
    const span = normalizeLangfuseTrace(trace(source), { importBatchId: crypto.randomUUID() }).spans[0]!;

    expect(span.metadata.langfuse).toMatchObject({
      derivedEndTime: true,
      derivedEndTimeSourceObservationId: 'child-1',
    });
  });

  it('parses raw V2 JSON strings and tolerates non-string self-hosted I/O', () => {
    const parsedSpan = normalizeLangfuseTrace(
      trace(observation('SPAN', { input: '{"looks":"like-json"}', output: '42' })),
      { importBatchId: crypto.randomUUID() },
    ).spans[0]!;
    const compatibleSpan = normalizeLangfuseTrace(trace(observation('SPAN', { input: true, output: 42 })), {
      importBatchId: crypto.randomUUID(),
    }).spans[0]!;

    expect(parsedSpan.input).toEqual({ looks: 'like-json' });
    expect(parsedSpan.output).toBe(42);
    expect(compatibleSpan.input).toBe(true);
    expect(compatibleSpan.output).toBe(42);
  });

  it('preserves unusual model parameters as provenance without promoting an invalid shape', () => {
    const source = observation('GENERATION', { modelParameters: ['provider', 'specific'] });
    const span = normalizeLangfuseTrace(trace(source), { importBatchId: crypto.randomUUID() }).spans[0]!;

    expect(span.attributes?.parameters).toBeUndefined();
    expect(span.metadata.langfuse).toMatchObject({ modelParameters: source.modelParameters });
  });

  it('uses the current V2 model field and keeps the legacy spelling as a fallback', () => {
    const current = normalizeLangfuseTrace(
      trace(observation('GENERATION', { model: 'current-model', providedModelName: 'legacy-model' })),
      { importBatchId: crypto.randomUUID() },
    ).spans[0]!;
    const legacy = normalizeLangfuseTrace(trace(observation('GENERATION', { providedModelName: 'legacy-model' })), {
      importBatchId: crypto.randomUUID(),
    }).spans[0]!;

    expect(current.attributes?.model).toBe('current-model');
    expect(current.metadata.langfuse).toMatchObject({
      model: 'current-model',
      providedModelName: 'legacy-model',
    });
    expect(legacy.attributes?.model).toBe('legacy-model');
  });

  it('maps compatible model and usage details while preserving precision-bearing source fields', () => {
    const source = observation('GENERATION', {
      model: 'gpt-4o-mini',
      modelParameters: {
        max_tokens: 100,
        temperature: 0.25,
        top_p: 0.9,
        top_k: 40,
        presence_penalty: 0.1,
        frequency_penalty: 0.2,
        seed: 7,
        stop: ['DONE'],
        providerSpecific: { retained: true },
      },
      usageDetails: {
        input: 20,
        output: 8,
        input_cached_tokens: 5,
        cache_creation_input_tokens: 2,
        input_audio_tokens: 1,
        output_reasoning_tokens: 3,
        output_audio_tokens: 1,
      },
      costDetails: { input: 0.00000123456789, output: 0.00000987654321 },
      totalCost: 0.0000111111111,
      inputPrice: '0.000000123456789123456789',
      outputPrice: '0.000000987654321987654321',
      totalPrice: null,
      usagePricingTierId: 'tier-1',
      usagePricingTierName: 'Standard',
      completionStartTime: '2026-08-20T10:00:01.000Z',
      promptId: 'prompt-1',
      promptName: 'support',
      promptVersion: 4,
      latency: 2,
      timeToFirstToken: 1,
    });

    const span = normalizeLangfuseTrace(trace(source), {
      importBatchId: crypto.randomUUID(),
    }).spans[0]!;

    expect(span.attributes).toMatchObject({
      model: 'gpt-4o-mini',
      usage: {
        inputTokens: 20,
        outputTokens: 8,
        inputDetails: { cacheRead: 5, cacheWrite: 2, audio: 1 },
        outputDetails: { reasoning: 3, audio: 1 },
      },
      parameters: {
        maxOutputTokens: 100,
        temperature: 0.25,
        topP: 0.9,
        topK: 40,
        presencePenalty: 0.1,
        frequencyPenalty: 0.2,
        seed: 7,
        stopSequences: ['DONE'],
      },
      costContext: { estimatedCost: 0.0000111111111, costUnit: 'USD' },
      completionStartTime: '2026-08-20T10:00:01.000Z',
    });
    expect(span.metadata.langfuse).toMatchObject({
      modelParameters: source.modelParameters,
      usageDetails: source.usageDetails,
      costDetails: source.costDetails,
      inputPrice: '0.000000123456789123456789',
      outputPrice: '0.000000987654321987654321',
      usagePricingTierId: 'tier-1',
      usagePricingTierName: 'Standard',
      promptId: 'prompt-1',
      promptName: 'support',
      promptVersion: 4,
      latency: 2,
      timeToFirstToken: 1,
    });
  });

  it('keeps denormalized tags only on the physical root while retaining child tags in provenance', () => {
    const root = observation('SPAN', { id: 'root', tags: ['trace-tag'] });
    const child = observation('TOOL', {
      id: 'child',
      parentObservationId: 'root',
      tags: ['trace-tag'],
    });
    const spans = normalizeLangfuseTrace(
      { sourceTraceId: 'trace-1', projectId: 'project-1', observations: [root, child] },
      { importBatchId: crypto.randomUUID() },
    ).spans;

    expect(spans[0]?.tags).toEqual(['trace-tag']);
    expect(spans[1]?.tags).toBeUndefined();
    expect(spans[1]?.metadata.langfuse).toMatchObject({ tags: ['trace-tag'] });
  });

  it('detaches an imported logical root while preserving its source physical parent', () => {
    const source = observation('SPAN', {
      parentObservationId: 'external-parent',
      isRootObservation: true,
    });
    const span = normalizeLangfuseTrace(trace(source), {
      importBatchId: crypto.randomUUID(),
    }).spans[0]!;

    expect(span.parentSpanId).toBeNull();
    expect(span.metadata.langfuse).toMatchObject({
      isRootObservation: true,
      parentObservationId: 'external-parent',
    });
  });

  it('uses start time as event end time and applies an explicit environment override', () => {
    const source = observation('EVENT', { endTime: null, environment: 'source-env' });
    const span = normalizeLangfuseTrace(trace(source), {
      importBatchId: crypto.randomUUID(),
      environment: 'target-env',
    }).spans[0]!;
    expect(span.isEvent).toBe(true);
    expect(span.endedAt).toBe(source.startTime);
    expect(span.metadata.environment).toBe('target-env');
    expect(span.metadata.langfuse).toMatchObject({ environment: 'source-env' });
  });

  it('retains a warning without misclassifying it as an error', () => {
    const source = observation('GENERATION', {
      level: 'WARNING',
      statusMessage: 'Model used a fallback',
    });
    const span = normalizeLangfuseTrace(trace(source), {
      importBatchId: crypto.randomUUID(),
    }).spans[0]!;

    expect(span.error).toBeNull();
    expect(span.metadata.langfuse).toMatchObject({
      level: 'WARNING',
      statusMessage: 'Model used a fallback',
    });
  });
});
