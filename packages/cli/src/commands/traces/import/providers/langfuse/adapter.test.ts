import { describe, expect, it, vi } from 'vitest';

import { LangfuseTraceImportProvider, mapLangfuseSourceTrace } from './adapter.js';
import { createLangfuseSpanImportId, createLangfuseTraceImportId } from './ids.js';
import type { LangfuseObservation } from './types.js';

const clientOptions = {
  baseUrl: 'https://cloud.langfuse.com',
  publicKey: 'pk-lf-test',
  secretKey: 'sk-lf-test',
};

const window = {
  cutoffAt: '2026-08-02T00:00:00.000Z',
  snapshotAt: '2026-09-01T12:00:00.000Z',
};

const mappedWindow = {
  cutoffMs: Date.parse(window.cutoffAt),
  snapshotMs: Date.parse(window.snapshotAt),
};

function observation(overrides: Partial<LangfuseObservation> = {}): LangfuseObservation {
  return {
    id: 'root',
    traceId: 'trace-1',
    startTime: '2026-08-20T10:00:00.000Z',
    endTime: '2026-08-20T10:00:02.000Z',
    projectId: 'project-1',
    parentObservationId: null,
    type: 'SPAN',
    name: 'root',
    ...overrides,
  };
}

function sourceTrace(observations: LangfuseObservation[]) {
  return { traceId: 'trace-1', observations };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe('mapLangfuseSourceTrace', () => {
  it('validates, orders, and maps a complete Langfuse tree into Mastra spans', () => {
    const child = observation({
      id: 'child',
      parentObservationId: 'root',
      type: 'GENERATION',
      name: 'answer-generation',
      startTime: '2026-08-20T10:00:01.000Z',
      endTime: '2026-08-20T10:00:02.000Z',
      input: '{"question":"hello"}',
      output: { answer: 'hi' },
      model: 'gpt-4o-mini',
      providedModelName: 'openai/gpt-4o-mini',
      internalModelId: 'internal-model-1',
      inputUsage: 10,
      outputUsage: 4,
      totalUsage: 14,
      inputCost: 0.001,
      modelParameters: { temperature: 0.2, top_p: 0.9, ignored: true },
      usageDetails: { input: 10, output: 4, input_cache_creation: 3, reasoning_tokens: 2, customUnits: 1 },
      metadata: { customer: 'acme' },
      tags: ['child-tag'],
      createdAt: '2026-08-20T10:00:00.000Z',
      bookmarked: true,
    });

    const record = mapLangfuseSourceTrace(sourceTrace([child, observation({ tags: ['trace-tag'] })]), {
      importId: 'import-1',
      ...mappedWindow,
    });

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.sourceTraceId).toBe('trace-1');
    expect(record.trace.spans.map(span => span.spanId)).toEqual([
      createLangfuseSpanImportId('project-1', 'root'),
      createLangfuseSpanImportId('project-1', 'child'),
    ]);
    expect(record.trace.spans[0]).toMatchObject({
      traceId: createLangfuseTraceImportId('project-1', 'trace-1'),
      parentSpanId: null,
      spanType: 'generic',
      tags: ['trace-tag'],
    });
    expect(record.trace.spans[1]).toMatchObject({
      parentSpanId: createLangfuseSpanImportId('project-1', 'root'),
      spanType: 'model_generation',
      input: { question: 'hello' },
      output: { answer: 'hi' },
      attributes: {
        model: 'gpt-4o-mini',
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          inputDetails: { cacheWrite: 3 },
          outputDetails: { reasoning: 2 },
        },
        parameters: { temperature: 0.2, topP: 0.9 },
      },
      metadata: {
        source: 'langfuse',
        importSource: 'langfuse-api-v2',
        importBatchId: 'import-1',
        langfuseTraceId: 'trace-1',
        langfuseObservationId: 'child',
        langfuseProjectId: 'project-1',
        langfuseType: 'GENERATION',
        langfuseMetadata: { customer: 'acme' },
        langfuse: {
          providedModelName: 'openai/gpt-4o-mini',
          internalModelId: 'internal-model-1',
          modelParameters: { ignored: true },
          usageDetails: { customUnits: 1 },
          totalUsage: 14,
          inputCost: 0.001,
        },
      },
    });
    expect(record.trace.spans[1]?.tags).toBeUndefined();
    expect(record.trace.spans[1]?.metadata.langfuse).toEqual({
      parentObservationId: 'root',
      providedModelName: 'openai/gpt-4o-mini',
      internalModelId: 'internal-model-1',
      modelParameters: { ignored: true },
      usageDetails: { customUnits: 1 },
      totalUsage: 14,
      inputCost: 0.001,
    });
  });

  it('orders siblings by their actual time and uses the observation ID to break ties', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({
          id: 'later',
          parentObservationId: 'root',
          startTime: '2026-08-20T05:00:02.000-05:00',
          endTime: '2026-08-20T05:00:03.000-05:00',
        }),
        observation({
          id: 'same-time-b',
          parentObservationId: 'root',
          startTime: '2026-08-20T10:00:01.000Z',
          endTime: '2026-08-20T10:00:02.000Z',
        }),
        observation(),
        observation({
          id: 'same-time-a',
          parentObservationId: 'root',
          startTime: '2026-08-20T11:00:01.000+01:00',
          endTime: '2026-08-20T11:00:02.000+01:00',
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans.map(span => span.spanId)).toEqual(
      ['root', 'same-time-a', 'same-time-b', 'later'].map(id => createLangfuseSpanImportId('project-1', id)),
    );
  });

  it('falls back to valid usage details when direct usage values are malformed', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({
          type: 'GENERATION',
          inputUsage: 'invalid' as unknown as number,
          outputUsage: Number.POSITIVE_INFINITY,
          usageDetails: { input: 7, output: 3 },
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]?.attributes).toMatchObject({
      usage: { inputTokens: 7, outputTokens: 3 },
    });
  });

  it('does not duplicate a provided model name used as the canonical fallback', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([observation({ type: 'GENERATION', model: null, providedModelName: 'fallback-model' })]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]?.attributes).toMatchObject({ model: 'fallback-model' });
    expect(record.trace.spans[0]?.metadata.langfuse).not.toHaveProperty('providedModelName');
  });

  it('keeps model and usage fields in metadata when the span type has no canonical destination', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({
          model: 'custom-model',
          modelParameters: { custom: true },
          usageDetails: { customUnits: 12 },
          inputUsage: 7,
          outputUsage: 5,
          totalCost: 0.01,
          completionStartTime: '2026-08-20T10:00:01.000Z',
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]?.metadata).toMatchObject({
      langfuse: {
        model: 'custom-model',
        modelParameters: { custom: true },
        usageDetails: { customUnits: 12 },
        inputUsage: 7,
        outputUsage: 5,
        totalCost: 0.01,
        completionStartTime: '2026-08-20T10:00:01.000Z',
      },
    });
  });

  it.each([
    ['GENERATION', 'model_generation'],
    ['AGENT', 'agent_run'],
    ['TOOL', 'tool_call'],
    ['EVALUATOR', 'scorer_run'],
    ['EMBEDDING', 'rag_embedding'],
    ['EVENT', 'generic'],
    ['CHAIN', 'generic'],
    ['RETRIEVER', 'generic'],
    ['GUARDRAIL', 'generic'],
    ['FUTURE_KIND', 'generic'],
  ])('maps Langfuse type %s to Mastra span type %s', (langfuseType, spanType) => {
    const record = mapLangfuseSourceTrace(sourceTrace([observation({ type: langfuseType })]), {
      importId: 'import-1',
      ...mappedWindow,
    });

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]?.spanType).toBe(spanType);
    expect(record.trace.spans[0]?.metadata.langfuseType).toBe(langfuseType);
    expect(record.warnings).toEqual(
      langfuseType === 'FUTURE_KIND' ? ['Unknown Langfuse observation type: FUTURE_KIND'] : undefined,
    );
  });

  it('restores Mastra span types only from recognized Mastra Langfuse exporter metadata', () => {
    const restored = mapLangfuseSourceTrace(
      sourceTrace([
        observation({
          metadata: { 'scope.name': '@mastra/langfuse', spanType: 'workflow_run' },
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );
    const ignored = mapLangfuseSourceTrace(sourceTrace([observation({ metadata: { spanType: 'workflow_run' } })]), {
      importId: 'import-1',
      ...mappedWindow,
    });

    expect(restored.kind).toBe('trace');
    expect(ignored.kind).toBe('trace');
    if (restored.kind !== 'trace' || ignored.kind !== 'trace') return;
    expect(restored.trace.spans[0]?.spanType).toBe('workflow_run');
    expect(ignored.trace.spans[0]?.spanType).toBe('generic');
  });

  it('names the owning primitive from Langfuse observation types', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({ type: 'AGENT', name: 'support-agent' }),
        observation({ id: 'tool', parentObservationId: 'root', type: 'TOOL', name: 'lookup-order' }),
        observation({ id: 'eval', parentObservationId: 'root', type: 'EVALUATOR', name: 'helpfulness' }),
        observation({ id: 'plain', parentObservationId: 'root', type: 'SPAN', name: 'retry-loop' }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    const byName = (name: string) => record.trace.spans.find(span => span.name === name);
    const [root, tool, evaluator, plain] = ['support-agent', 'lookup-order', 'helpfulness', 'retry-loop'].map(byName);
    expect(root).toMatchObject({ spanType: 'agent_run', entityType: 'agent', entityName: 'support-agent' });
    expect(tool).toMatchObject({ spanType: 'tool_call', entityType: 'tool', entityName: 'lookup-order' });
    expect(evaluator).toMatchObject({ spanType: 'scorer_run', entityType: 'scorer', entityName: 'helpfulness' });
    // A plain child inherits the primitive that owns it, like native spans do.
    expect(plain).toMatchObject({ spanType: 'generic', entityType: 'agent', entityName: 'support-agent' });
  });

  it('recovers agent and tool spans from OpenTelemetry GenAI attributes on plain Langfuse spans', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({
          name: 'invoke_agent Agent',
          metadata: {
            'attributes.gen_ai.operation.name': 'invoke_agent',
            'attributes.gen_ai.agent.name': 'Agent',
            'attributes.gen_ai.agent.id': 'agent-1',
          },
        }),
        observation({
          id: 'tool',
          parentObservationId: 'root',
          name: 'execute_tool get_weather',
          metadata: {
            'attributes.gen_ai.operation.name': 'execute_tool',
            'attributes.gen_ai.tool.name': 'get_weather',
          },
        }),
        observation({
          id: 'chat',
          parentObservationId: 'root',
          name: 'chat gpt-4o',
          metadata: { 'attributes.gen_ai.operation.name': 'chat' },
        }),
        observation({
          id: 'unknown-op',
          parentObservationId: 'root',
          metadata: { 'attributes.gen_ai.operation.name': 'custom_thing' },
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    const byName = (name: string) => record.trace.spans.find(span => span.name === name);
    const [root, tool, chat, unknown] = ['invoke_agent Agent', 'execute_tool get_weather', 'chat gpt-4o', 'root'].map(
      byName,
    );
    expect(root).toMatchObject({
      spanType: 'agent_run',
      entityType: 'agent',
      entityId: 'agent-1',
      entityName: 'Agent',
    });
    expect(tool).toMatchObject({
      spanType: 'tool_call',
      entityType: 'tool',
      entityId: 'get_weather',
      entityName: 'get_weather',
    });
    expect(chat).toMatchObject({ spanType: 'model_generation', entityType: 'agent', entityName: 'Agent' });
    expect(unknown).toMatchObject({ spanType: 'generic' });
  });

  it('types the virtual trace root Langfuse creates for OTLP-ingested agent traces', () => {
    // Real shape from Langfuse OTLP ingestion: metadata.attributes is a nested object, and the
    // trace root is a plain SPAN named `t-<traceId>` above the typed AGENT observation.
    const otel = {
      scope: { name: 'openai-agents-sdk-like', version: '0.1.0' },
      attributes: {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.agent.name': 'Agent',
        'gen_ai.agent.id': 'agent-paul',
      },
    };
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({ id: 't-trace-1', name: 'invoke_agent Agent', metadata: otel }),
        observation({
          id: 'agent',
          parentObservationId: 't-trace-1',
          type: 'AGENT',
          name: 'invoke_agent Agent',
          metadata: otel,
        }),
        observation({
          id: 'tool',
          parentObservationId: 'agent',
          type: 'TOOL',
          name: 'execute_tool get_weather',
          metadata: { attributes: { 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': 'get_weather' } },
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    const root = record.trace.spans.find(span => span.parentSpanId === null);
    expect(root).toMatchObject({
      spanType: 'agent_run',
      entityType: 'agent',
      entityId: 'agent-paul',
      entityName: 'Agent',
    });
    expect(record.trace.spans.find(span => span.name === 'execute_tool get_weather')).toMatchObject({
      entityType: 'tool',
      entityName: 'get_weather',
    });
  });

  it("drops Langfuse's placeholder environment and keeps environments the user set", () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({ environment: 'default' }),
        observation({ id: 'staging', name: 'staging', parentObservationId: 'root', environment: 'staging' }),
        observation({ id: 'unset', name: 'unset', parentObservationId: 'root', environment: null }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    const byName = (name: string) => record.trace.spans.find(span => span.name === name)!.metadata;
    expect(byName('root')).not.toHaveProperty('environment');
    expect(byName('root').langfuseMetadata).toBeUndefined();
    expect(byName('staging').environment).toBe('staging');
    expect(byName('unset')).not.toHaveProperty('environment');
  });

  it('gives the Langfuse virtual trace root the primitive of its single real root', () => {
    // Langfuse SDK style: the typed AGENT is the real root; Langfuse adds a plain `t-<traceId>` above it.
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({ id: 't-trace-1', name: 'booking-agent', metadata: { scope: { name: 'langfuse-sdk' } } }),
        observation({ id: 'agent', parentObservationId: 't-trace-1', type: 'AGENT', name: 'booking-agent' }),
        observation({ id: 'tool', parentObservationId: 'agent', type: 'TOOL', name: 'find-restaurant' }),
        observation({
          id: 'llm',
          parentObservationId: 'agent',
          type: 'GENERATION',
          name: 'llm-call',
          model: 'gpt-4o-mini',
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    const byName = (name: string) => record.trace.spans.find(span => span.name === name)!;
    const root = record.trace.spans.find(span => span.parentSpanId === null)!;
    expect(root).toMatchObject({ spanType: 'generic', entityType: 'agent', entityName: 'booking-agent' });
    expect(byName('find-restaurant')).toMatchObject({ entityType: 'tool', entityName: 'find-restaurant' });
    expect(byName('llm-call')).toMatchObject({ entityType: 'agent', entityName: 'booking-agent' });
  });

  it('leaves a virtual root untyped when it has several real roots or an untyped one', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({ id: 't-trace-1', name: 'two-roots' }),
        observation({ id: 'a', parentObservationId: 't-trace-1', type: 'AGENT', name: 'a' }),
        observation({ id: 'b', parentObservationId: 't-trace-1', type: 'AGENT', name: 'b' }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );
    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans.find(span => span.parentSpanId === null)).not.toHaveProperty('entityType');
  });

  it('keeps Mastra agent and workflow identity on traces exported by @mastra/langfuse', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({
          type: 'AGENT',
          metadata: {
            'scope.name': '@mastra/langfuse',
            spanType: 'agent_run',
            agentName: 'Weather Agent',
            agentId: 'weather-agent',
            'attributes.gen_ai.operation.name': 'invoke_agent',
          },
        }),
        observation({
          id: 'workflow',
          parentObservationId: 'root',
          metadata: {
            'scope.name': '@mastra/langfuse',
            spanType: 'workflow_run',
            workflowName: 'Daily Digest',
            workflowId: 'daily-digest',
            'attributes.gen_ai.operation.name': 'invoke_workflow',
          },
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]).toMatchObject({
      spanType: 'agent_run',
      entityType: 'agent',
      entityId: 'weather-agent',
      entityName: 'Weather Agent',
    });
    expect(record.trace.spans[1]).toMatchObject({
      spanType: 'workflow_run',
      entityType: 'workflow_run',
      entityId: 'daily-digest',
      entityName: 'Daily Digest',
    });
  });

  it('derives Langfuse virtual root end time from the latest child', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation({ id: 't-trace-1', endTime: null }),
        observation({
          id: 'child',
          parentObservationId: 't-trace-1',
          startTime: '2026-08-20T10:00:01.000Z',
          endTime: '2026-08-20T10:00:05.000Z',
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]).toMatchObject({
      spanId: createLangfuseSpanImportId('project-1', 't-trace-1'),
      endedAt: '2026-08-20T10:00:05.000Z',
      metadata: {
        langfuse: {
          derivedEndTime: true,
          derivedEndTimeSourceObservationId: 'child',
        },
      },
    });
  });

  it.each([
    ['empty_trace', []],
    ['mixed_project_ids', [observation(), observation({ id: 'other-project-root', projectId: 'project-2' })]],
    ['duplicate_observation_id', [observation(), observation()]],
    [
      'missing_root',
      [observation({ parentObservationId: 'child' }), observation({ id: 'child', parentObservationId: 'root' })],
    ],
    ['multiple_roots', [observation(), observation({ id: 'other-root' })]],
    ['missing_parent', [observation(), observation({ id: 'child', parentObservationId: 'missing' })]],
    [
      'cycle',
      [
        observation(),
        observation({ id: 'child', parentObservationId: 'grandchild' }),
        observation({ id: 'grandchild', parentObservationId: 'child' }),
      ],
    ],
    ['invalid_timestamp', [observation({ endTime: '2026-08-20T09:59:59.000Z' })]],
    ['incomplete_duration', [observation({ endTime: null })]],
    ['completed_after_snapshot', [observation({ endTime: '2026-09-02T00:00:00.000Z' })]],
    ['root_outside_window', [observation({ startTime: '2026-08-01T23:59:59.000Z' })]],
  ])('skips invalid traces with reason %s', (reason, observations) => {
    const record = mapLangfuseSourceTrace(sourceTrace(observations), { importId: 'import-1', ...mappedWindow });

    expect(record).toMatchObject({
      kind: 'skipped',
      skipped: {
        sourceTraceId: 'trace-1',
        reason,
        spanCount: observations.length,
      },
    });
  });

  it('detaches an imported logical root while keeping the source parent in metadata', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([observation({ parentObservationId: 'external-parent', isRootObservation: true })]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]).toMatchObject({
      parentSpanId: null,
      metadata: {
        langfuse: {
          isRootObservation: true,
          parentObservationId: 'external-parent',
        },
      },
    });
  });

  it('uses start time as event end time and preserves provider warning state as metadata', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([observation({ type: 'EVENT', endTime: null, level: 'WARNING', statusMessage: 'fallback used' })]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]).toMatchObject({
      isEvent: true,
      endedAt: '2026-08-20T10:00:00.000Z',
      error: null,
      metadata: { langfuse: { level: 'WARNING', statusMessage: 'fallback used' } },
    });
  });

  it('ignores an event end time because events use their start time as an instantaneous duration', () => {
    const record = mapLangfuseSourceTrace(sourceTrace([observation({ type: 'EVENT', endTime: 'not-a-timestamp' })]), {
      importId: 'import-1',
      ...mappedWindow,
    });

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]).toMatchObject({
      startedAt: '2026-08-20T10:00:00.000Z',
      endedAt: '2026-08-20T10:00:00.000Z',
      isEvent: true,
    });
  });

  it('skips the complete trace when an event occurs after the snapshot', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([
        observation(),
        observation({
          id: 'late-event',
          parentObservationId: 'root',
          type: 'EVENT',
          startTime: '2026-09-01T12:05:00.000Z',
          endTime: null,
        }),
      ]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record).toMatchObject({
      kind: 'skipped',
      skipped: {
        sourceTraceId: 'trace-1',
        reason: 'completed_after_snapshot',
        detail: 'late-event',
      },
    });
  });

  it('turns Langfuse error observations into Mastra span errors', () => {
    const record = mapLangfuseSourceTrace(
      sourceTrace([observation({ type: 'GENERATION', level: 'ERROR', statusMessage: 'provider failed' })]),
      { importId: 'import-1', ...mappedWindow },
    );

    expect(record.kind).toBe('trace');
    if (record.kind !== 'trace') return;
    expect(record.trace.spans[0]?.error).toEqual({
      message: 'provider failed',
      name: 'LangfuseObservationError',
      details: { level: 'ERROR', sourceType: 'GENERATION' },
    });
  });
});

describe('LangfuseTraceImportProvider', () => {
  it('identifies the Langfuse source and ID strategy', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json({
        data: [{ id: 'project-1', name: 'Demo' }],
        meta: { cursor: null },
      }),
    );
    const provider = new LangfuseTraceImportProvider(clientOptions, { fetch });

    await expect(provider.identify()).resolves.toEqual({
      provider: 'langfuse',
      baseUrl: 'https://cloud.langfuse.com',
      projectId: 'project-1',
      projectName: 'Demo',
      idAlgorithmVersion: 'langfuse-sha256-v1',
    });
  });

  it('reads discoveries and yields neutral trace import records', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async input => {
      const url = new URL(String(input));
      if (url.searchParams.get('fields') === 'core') {
        return Response.json({
          data: [observation(), observation({ id: 'orphan', traceId: null })],
          meta: { cursor: null },
        });
      }

      return Response.json({
        data: [observation()],
        meta: { cursor: null },
      });
    });
    const provider = new LangfuseTraceImportProvider(clientOptions, { fetch });

    const records = await collect(
      provider.read({
        importId: 'import-1',
        source: {
          provider: 'langfuse',
          baseUrl: 'https://cloud.langfuse.com',
          projectId: 'project-1',
          idAlgorithmVersion: 'langfuse-sha256-v1',
        },
        onRetry: vi.fn(),
        ...window,
      }),
    );

    expect(records.map(record => record.kind)).toEqual(['trace', 'skipped']);
    expect(records[0]).toMatchObject({ kind: 'trace', trace: { sourceTraceId: 'trace-1' } });
    expect(records[1]).toMatchObject({
      kind: 'skipped',
      skipped: {
        sourceTraceId: null,
        reason: 'missing_trace_id',
        sourceSpanIds: ['orphan'],
      },
    });
  });

  it('reports Langfuse API retries through the shared read context', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ data: [observation()], meta: { cursor: null } }))
      .mockResolvedValueOnce(Response.json({ data: [observation()], meta: { cursor: null } }));
    const onRetry = vi.fn();
    const provider = new LangfuseTraceImportProvider(clientOptions, {
      fetch,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    await collect(
      provider.read({
        importId: 'import-1',
        source: {
          provider: 'langfuse',
          baseUrl: 'https://cloud.langfuse.com',
          projectId: 'project-1',
          idAlgorithmVersion: 'langfuse-sha256-v1',
        },
        onRetry,
        ...window,
      }),
    );

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('validates the import window once at the provider boundary before making a request', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const provider = new LangfuseTraceImportProvider(clientOptions, { fetch });

    await expect(
      collect(
        provider.read({
          importId: 'import-1',
          source: {
            provider: 'langfuse',
            baseUrl: 'https://cloud.langfuse.com',
            projectId: 'project-1',
            idAlgorithmVersion: 'langfuse-sha256-v1',
          },
          cutoffAt: '2026-09-02T00:00:00.000Z',
          snapshotAt: '2026-09-01T00:00:00.000Z',
          onRetry: vi.fn(),
        }),
      ),
    ).rejects.toThrow('cutoffAt before snapshotAt');
    expect(fetch).not.toHaveBeenCalled();
  });
});
