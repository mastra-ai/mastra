import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { TestExporter } from './exporters';

const SUSPENDED_STEP_USAGE = { inputTokens: 100, outputTokens: 20, totalTokens: 120 };
const RESUMED_STEP_USAGE = { inputTokens: 7, outputTokens: 3, totalTokens: 10 };

const askTool = createTool({
  id: 'ask',
  description: 'Ask a person',
  inputSchema: z.object({}),
  resumeSchema: z.object({ answer: z.string() }),
  execute: async (_input, { agent }) => {
    if (!agent?.resumeData) return agent!.suspend({ question: 'which one?' });
    return { answer: (agent.resumeData as { answer: string }).answer };
  },
});

const approvalTool = createTool({
  id: 'approve',
  description: 'Needs approval',
  inputSchema: z.object({}),
  requireApproval: true,
  execute: async () => ({ ok: true }),
});

const lookupTool = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({}),
  execute: async () => ({ found: true }),
});

const gatewayCost = (cost: string) => ({ gateway: { cost } });

const generationCosts = (exporter: TestExporter) =>
  exporter
    .getByEventType(TracingEventType.SPAN_ENDED)
    .filter(event => event.exportedSpan.type === SpanType.MODEL_GENERATION)
    .map(event => {
      const costContext = event.exportedSpan.attributes?.costContext;
      return (
        costContext && {
          estimatedCost: costContext.estimatedCost,
          reportedStepCount: costContext.costMetadata?.reportedStepCount,
        }
      );
    });

describe('tracing when a tool call suspends', () => {
  let observability: Observability | undefined;

  afterEach(async () => {
    await observability?.shutdown();
  });

  describe.each(['suspend', 'approval'] as const)('%s', kind => {
    it('records the suspended step usage on model spans and token metrics', async () => {
      const toolName = kind === 'suspend' ? 'ask' : 'approve';
      const exporter = new TestExporter();
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'call-1', toolName, input: '{}', providerExecuted: false },
            { type: 'finish', finishReason: 'tool-calls', usage: SUSPENDED_STEP_USAGE },
          ]),
        }),
      });
      const agent = new Agent({
        id: 'usage-agent',
        name: 'usage-agent',
        instructions: 'use the tool',
        model,
        tools: kind === 'suspend' ? { ask: askTool } : { approve: approvalTool },
      });
      observability = new Observability({
        configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
      });
      new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

      const output = await agent.stream('Hello');
      await output.consumeStream();
      expect(output.status).toBe('suspended');
      await new Promise(resolve => setTimeout(resolve, 100));

      const ended = (type: SpanType) =>
        exporter
          .getByEventType(TracingEventType.SPAN_ENDED)
          .filter(event => event.exportedSpan.type === type)
          .map(event => event.exportedSpan);

      const expectedUsage = { inputTokens: 100, outputTokens: 20 };
      for (const type of [SpanType.MODEL_GENERATION, SpanType.MODEL_STEP, SpanType.MODEL_INFERENCE]) {
        const spans = ended(type);
        expect(spans, `${type} spans`).toHaveLength(1);
        expect(spans[0]!.attributes?.usage, `${type} usage`).toMatchObject(expectedUsage);
      }
      expect(ended(SpanType.MODEL_STEP)[0]!.attributes?.finishReason).toBe('suspended');
      expect(exporter.getIncompleteSpans().map(entry => entry.span?.name)).toEqual([]);

      const metricValue = (name: string) =>
        exporter.getMetricsByName(name).reduce((sum, metric) => sum + metric.value, 0);
      expect(metricValue('mastra_model_total_input_tokens')).toBe(100);
      expect(metricValue('mastra_model_total_output_tokens')).toBe(20);
    });

    it('counts each step once in token metrics across suspend and resume', async () => {
      const toolName = kind === 'suspend' ? 'ask' : 'approve';
      const exporter = new TestExporter();
      let calls = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream(
            calls++ === 0
              ? [
                  { type: 'stream-start', warnings: [] },
                  { type: 'tool-call', toolCallId: 'call-1', toolName, input: '{}', providerExecuted: false },
                  { type: 'finish', finishReason: 'tool-calls', usage: SUSPENDED_STEP_USAGE },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'done' },
                  { type: 'text-end', id: 't' },
                  { type: 'finish', finishReason: 'stop', usage: RESUMED_STEP_USAGE },
                ],
          ),
        }),
      });
      const agent = new Agent({
        id: 'usage-agent',
        name: 'usage-agent',
        instructions: 'use the tool',
        model,
        tools: kind === 'suspend' ? { ask: askTool } : { approve: approvalTool },
      });
      observability = new Observability({
        configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
      });
      new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

      const output = await agent.stream('Hello');
      await output.consumeStream();
      expect(output.status).toBe('suspended');

      const resumed =
        kind === 'suspend'
          ? await agent.resumeStream({ answer: 'blue' }, { runId: output.runId })
          : await agent.approveToolCall({ runId: output.runId, toolCallId: 'call-1' });
      await resumed.consumeStream();
      expect(resumed.status).toBe('success');
      // The user-facing resumed total stays cumulative.
      expect(await resumed.totalUsage).toMatchObject({ inputTokens: 107, outputTokens: 23 });
      await new Promise(resolve => setTimeout(resolve, 100));

      const generationUsage = exporter
        .getByEventType(TracingEventType.SPAN_ENDED)
        .filter(event => event.exportedSpan.type === SpanType.MODEL_GENERATION)
        .map(event => event.exportedSpan.attributes?.usage);
      expect(generationUsage).toHaveLength(2);
      expect(generationUsage[0]).toMatchObject({ inputTokens: 100, outputTokens: 20 });
      expect(generationUsage[1]).toMatchObject({ inputTokens: 7, outputTokens: 3 });

      const metricValue = (name: string) =>
        exporter.getMetricsByName(name).reduce((sum, metric) => sum + metric.value, 0);
      expect(metricValue('mastra_model_total_input_tokens')).toBe(107);
      expect(metricValue('mastra_model_total_output_tokens')).toBe(23);
    });

    it('records each provider-reported cost on the generation span of the leg that ran it', async () => {
      const toolName = kind === 'suspend' ? 'ask' : 'approve';
      const exporter = new TestExporter();
      const steps = [
        [
          { type: 'stream-start' as const, warnings: [] },
          {
            type: 'tool-call' as const,
            toolCallId: 'call-0',
            toolName: 'lookup',
            input: '{}',
            providerExecuted: false,
          },
          {
            type: 'finish' as const,
            finishReason: 'tool-calls' as const,
            usage: RESUMED_STEP_USAGE,
            providerMetadata: gatewayCost('0.25'),
          },
        ],
        [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'tool-call' as const, toolCallId: 'call-1', toolName, input: '{}', providerExecuted: false },
          {
            type: 'finish' as const,
            finishReason: 'tool-calls' as const,
            usage: SUSPENDED_STEP_USAGE,
            providerMetadata: gatewayCost('0.5'),
          },
        ],
        [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't' },
          { type: 'text-delta' as const, id: 't', delta: 'done' },
          { type: 'text-end' as const, id: 't' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: RESUMED_STEP_USAGE,
            providerMetadata: gatewayCost('2'),
          },
        ],
      ];
      let calls = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>(steps[calls++]!),
        }),
      });
      const agent = new Agent({
        id: 'usage-agent',
        name: 'usage-agent',
        instructions: 'use the tools',
        model,
        tools:
          kind === 'suspend' ? { lookup: lookupTool, ask: askTool } : { lookup: lookupTool, approve: approvalTool },
      });
      observability = new Observability({
        configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
      });
      new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

      const output = await agent.stream('Hello');
      await output.consumeStream();
      expect(output.status).toBe('suspended');

      const resumed =
        kind === 'suspend'
          ? await agent.resumeStream({ answer: 'blue' }, { runId: output.runId })
          : await agent.approveToolCall({ runId: output.runId, toolCallId: 'call-1' });
      await resumed.consumeStream();
      expect(resumed.status).toBe('success');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(generationCosts(exporter)).toEqual([
        { estimatedCost: 0.75, reportedStepCount: 2 },
        { estimatedCost: 2, reportedStepCount: 1 },
      ]);
    });
  });

  it('counts each step once when a resumed run suspends again', async () => {
    const exporter = new TestExporter();
    const toolCallStep = (toolCallId: string, usage: typeof SUSPENDED_STEP_USAGE) => [
      { type: 'stream-start' as const, warnings: [] },
      { type: 'tool-call' as const, toolCallId, toolName: 'ask', input: '{}', providerExecuted: false },
      { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
    ];
    const steps = [
      toolCallStep('call-1', SUSPENDED_STEP_USAGE),
      toolCallStep('call-2', RESUMED_STEP_USAGE),
      [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 't' },
        { type: 'text-delta' as const, id: 't', delta: 'done' },
        { type: 'text-end' as const, id: 't' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 1, totalTokens: 6 },
        },
      ],
    ];
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>(steps[calls++]!),
      }),
    });
    const agent = new Agent({
      id: 'usage-agent',
      name: 'usage-agent',
      instructions: 'use the tool',
      model,
      tools: { ask: askTool },
    });
    observability = new Observability({
      configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
    });
    new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

    const output = await agent.stream('Hello');
    await output.consumeStream();
    expect(output.status).toBe('suspended');

    const resumed = await agent.resumeStream({ answer: 'blue' }, { runId: output.runId });
    await resumed.consumeStream();
    expect(resumed.status).toBe('suspended');

    const finished = await agent.resumeStream({ answer: 'red' }, { runId: output.runId });
    await finished.consumeStream();
    expect(finished.status).toBe('success');
    await new Promise(resolve => setTimeout(resolve, 100));

    const generationUsage = exporter
      .getByEventType(TracingEventType.SPAN_ENDED)
      .filter(event => event.exportedSpan.type === SpanType.MODEL_GENERATION)
      .map(event => event.exportedSpan.attributes?.usage);
    expect(generationUsage).toHaveLength(3);
    expect(generationUsage[0]).toMatchObject({ inputTokens: 100, outputTokens: 20 });
    expect(generationUsage[1]).toMatchObject({ inputTokens: 7, outputTokens: 3 });
    expect(generationUsage[2]).toMatchObject({ inputTokens: 5, outputTokens: 1 });

    const metricValue = (name: string) =>
      exporter.getMetricsByName(name).reduce((sum, metric) => sum + metric.value, 0);
    expect(metricValue('mastra_model_total_input_tokens')).toBe(112);
    expect(metricValue('mastra_model_total_output_tokens')).toBe(24);
  });

  it('records each provider-reported cost once when a resumed run suspends again', async () => {
    const exporter = new TestExporter();
    const toolCallStep = (toolCallId: string, cost: string) => [
      { type: 'stream-start' as const, warnings: [] },
      { type: 'tool-call' as const, toolCallId, toolName: 'ask', input: '{}', providerExecuted: false },
      {
        type: 'finish' as const,
        finishReason: 'tool-calls' as const,
        usage: SUSPENDED_STEP_USAGE,
        providerMetadata: gatewayCost(cost),
      },
    ];
    const steps = [
      toolCallStep('call-1', '0.25'),
      toolCallStep('call-2', '0.5'),
      [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 't' },
        { type: 'text-delta' as const, id: 't', delta: 'done' },
        { type: 'text-end' as const, id: 't' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: RESUMED_STEP_USAGE,
          providerMetadata: gatewayCost('2'),
        },
      ],
    ];
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>(steps[calls++]!),
      }),
    });
    const agent = new Agent({
      id: 'usage-agent',
      name: 'usage-agent',
      instructions: 'use the tool',
      model,
      tools: { ask: askTool },
    });
    observability = new Observability({
      configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
    });
    new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

    const output = await agent.stream('Hello');
    await output.consumeStream();
    const resumed = await agent.resumeStream({ answer: 'blue' }, { runId: output.runId });
    await resumed.consumeStream();
    expect(resumed.status).toBe('suspended');
    const finished = await agent.resumeStream({ answer: 'red' }, { runId: output.runId });
    await finished.consumeStream();
    expect(finished.status).toBe('success');
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(generationCosts(exporter)).toEqual([
      { estimatedCost: 0.25, reportedStepCount: 1 },
      { estimatedCost: 0.5, reportedStepCount: 1 },
      { estimatedCost: 2, reportedStepCount: 1 },
    ]);
  });

  it('leaves provider cost to the resumed leg when a retry before the suspension left the leg without usage', async () => {
    const exporter = new TestExporter();
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        if (calls === 1) {
          throw new APICallError({
            message: 'rate limited',
            url: 'https://example.test',
            requestBodyValues: {},
            statusCode: 429,
            isRetryable: true,
          });
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>(
            calls === 2
              ? [
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'approve',
                    input: '{}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: SUSPENDED_STEP_USAGE,
                    providerMetadata: gatewayCost('0.5'),
                  },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'done' },
                  { type: 'text-end', id: 't' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: RESUMED_STEP_USAGE,
                    providerMetadata: gatewayCost('2'),
                  },
                ],
          ),
        };
      },
    });
    const agent = new Agent({
      id: 'usage-agent',
      name: 'usage-agent',
      instructions: 'use the tool',
      model,
      tools: { approve: approvalTool },
    });
    observability = new Observability({
      configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
    });
    new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

    const output = await agent.stream('Hello');
    await output.consumeStream();
    expect(output.status).toBe('suspended');
    const resumed = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call-1' });
    await resumed.consumeStream();
    expect(resumed.status).toBe('success');
    expect(calls).toBe(3);
    await new Promise(resolve => setTimeout(resolve, 100));

    const generations = exporter
      .getByEventType(TracingEventType.SPAN_ENDED)
      .filter(event => event.exportedSpan.type === SpanType.MODEL_GENERATION)
      .map(event => event.exportedSpan.attributes);
    expect(generations).toHaveLength(2);
    // The retried attempt reported no usage, so the suspended leg records no tokens and the
    // resumed leg records the tokens of both model calls. Its cost must cover both calls too.
    expect(generations[0]?.usage?.inputTokens).toBeUndefined();
    expect(generations[1]?.usage).toMatchObject({ inputTokens: 107, outputTokens: 23 });
    expect(generationCosts(exporter)).toEqual([undefined, undefined]);
  });

  it('keeps provider cost on the suspended leg when it records only some token counts', async () => {
    const exporter = new TestExporter();
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>(
          calls++ === 0
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'approve', input: '{}', providerExecuted: false },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 100, outputTokens: undefined, totalTokens: undefined },
                  providerMetadata: gatewayCost('0.5'),
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: RESUMED_STEP_USAGE,
                  providerMetadata: gatewayCost('2'),
                },
              ],
        ),
      }),
    });
    const agent = new Agent({
      id: 'usage-agent',
      name: 'usage-agent',
      instructions: 'use the tool',
      model,
      tools: { approve: approvalTool },
    });
    observability = new Observability({
      configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
    });
    new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

    const output = await agent.stream('Hello');
    await output.consumeStream();
    const resumed = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call-1' });
    await resumed.consumeStream();
    expect(resumed.status).toBe('success');
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(generationCosts(exporter)).toEqual([
      { estimatedCost: 0.5, reportedStepCount: 1 },
      { estimatedCost: 2, reportedStepCount: 1 },
    ]);
  });

  it('records no new provider-reported cost for a later approval request from the same step', async () => {
    const exporter = new TestExporter();
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>(
          calls++ === 0
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'approve', input: '{}', providerExecuted: false },
                { type: 'tool-call', toolCallId: 'call-2', toolName: 'approve', input: '{}', providerExecuted: false },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: SUSPENDED_STEP_USAGE,
                  providerMetadata: gatewayCost('0.25'),
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: RESUMED_STEP_USAGE,
                  providerMetadata: gatewayCost('2'),
                },
              ],
        ),
      }),
    });
    const agent = new Agent({
      id: 'usage-agent',
      name: 'usage-agent',
      instructions: 'use the tool',
      model,
      tools: { approve: approvalTool },
    });
    observability = new Observability({
      configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
    });
    new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

    const output = await agent.stream('Hello');
    await output.consumeStream();
    const resumed = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call-1' });
    await resumed.consumeStream();
    expect(resumed.status).toBe('suspended');
    const finished = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call-2' });
    await finished.consumeStream();
    expect(finished.status).toBe('success');
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(generationCosts(exporter)).toEqual([
      { estimatedCost: 0.25, reportedStepCount: 1 },
      undefined,
      { estimatedCost: 2, reportedStepCount: 1 },
    ]);
  });

  it('does not open extra model spans for a later approval request from the same step', async () => {
    const exporter = new TestExporter();
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(
          calls++ === 0
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'approve', input: '{}', providerExecuted: false },
                { type: 'tool-call', toolCallId: 'call-2', toolName: 'approve', input: '{}', providerExecuted: false },
                { type: 'finish', finishReason: 'tool-calls', usage: SUSPENDED_STEP_USAGE },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: SUSPENDED_STEP_USAGE },
              ],
        ),
      }),
    });
    const agent = new Agent({
      id: 'usage-agent',
      name: 'usage-agent',
      instructions: 'use the tool',
      model,
      tools: { approve: approvalTool },
    });
    observability = new Observability({
      configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
    });
    new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

    const output = await agent.stream('Hello');
    await output.consumeStream();
    expect(output.status).toBe('suspended');

    // The second approval request surfaces in the leg resumed by the first approval.
    const resumed = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call-1' });
    await resumed.consumeStream();
    expect(resumed.status).toBe('suspended');
    await new Promise(resolve => setTimeout(resolve, 100));

    const started = (type: SpanType) =>
      exporter.getByEventType(TracingEventType.SPAN_STARTED).filter(event => event.exportedSpan.type === type);
    const approvalEvents = exporter
      .getAllSpans()
      .filter(span => span.type === SpanType.MODEL_CHUNK && span.attributes?.chunkType === 'tool-call-approval');

    expect(approvalEvents).toHaveLength(2);
    expect(started(SpanType.MODEL_STEP)).toHaveLength(1);
    expect(started(SpanType.MODEL_INFERENCE)).toHaveLength(1);
    expect(exporter.getIncompleteSpans().map(entry => entry.span?.name)).toEqual([]);
  });
});
