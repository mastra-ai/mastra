import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { ClaudeSDKAgent } from '@mastra/core/sdk-agents/claude';
import { CursorSDKAgent } from '@mastra/core/sdk-agents/cursor';
import { MockStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Observability } from './default';
import { TestExporter } from './exporters';

function createCursorAgent() {
  return {
    agentId: 'cursor-sdk-agent',
    model: { id: 'gpt-5.5' },
    send: async (_prompt: string, options?: { onDelta?: (args: { update: unknown }) => Promise<void> | void }) => {
      await options?.onDelta?.({
        update: {
          type: 'turn-ended',
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            cacheReadTokens: 2,
            cacheWriteTokens: 3,
          },
        },
      });

      return {
        id: 'cursor-run',
        agentId: 'cursor-sdk-agent',
        status: 'finished',
        result: 'Cursor SDK result',
        model: { id: 'gpt-5.5' },
        durationMs: 25,
        supports: (operation: string) => operation === 'stream',
        stream: async function* () {
          yield { type: 'task', text: 'Cursor ' };
          yield { type: 'task', text: 'SDK result' };
        },
        wait: async () => ({
          id: 'cursor-run',
          status: 'finished',
          result: 'Cursor SDK result',
          model: { id: 'gpt-5.5' },
          durationMs: 25,
        }),
      };
    },
  };
}

function createClaudeQuery() {
  return async function* () {
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: {
          type: 'text_delta',
          text: 'Claude SDK result',
        },
      },
    };
    yield {
      type: 'result',
      subtype: 'success',
      result: 'Claude SDK result',
      errors: [],
      usage: {
        input_tokens: 12,
        output_tokens: 5,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: 1,
      },
      total_cost_usd: 0.0123,
      modelUsage: {
        'claude-sonnet-4-6': {
          input_tokens: 12,
          output_tokens: 5,
          cache_read_input_tokens: 2,
          cache_creation_input_tokens: 1,
        },
      },
    };
  };
}

function createMastraWithSDKAgent(testExporter: TestExporter) {
  const agent = new CursorSDKAgent({
    id: 'cursor-agent',
    name: 'Cursor Agent',
    description: 'Cursor SDK agent',
    agent: createCursorAgent() as never,
  });

  return new Mastra({
    storage: new MockStore(),
    observability: new Observability({
      sensitiveDataFilter: false,
      configs: {
        test: {
          serviceName: 'sdk-agent-integration-test',
          exporters: [testExporter],
        },
      },
    }),
    agents: {
      cursorAgent: agent,
    },
  });
}

function createMastraWithClaudeSDKAgent(testExporter: TestExporter) {
  const agent = new ClaudeSDKAgent({
    id: 'claude-agent',
    name: 'Claude Agent',
    description: 'Claude SDK agent',
    agent: createClaudeQuery(),
    model: 'claude-sonnet-4-6',
  });

  return new Mastra({
    storage: new MockStore(),
    observability: new Observability({
      sensitiveDataFilter: false,
      configs: {
        test: {
          serviceName: 'sdk-agent-integration-test',
          exporters: [testExporter],
        },
      },
    }),
    agents: {
      claudeAgent: agent,
    },
  });
}

function expectCompleteTrace(testExporter: TestExporter) {
  const spans = testExporter.getAllSpans();
  const traceIds = [...new Set(spans.map(span => span.traceId))];

  expect(traceIds).toHaveLength(1);
  expect(testExporter.getIncompleteSpans()).toHaveLength(0);
}

describe('SDK agent observability integration', () => {
  it('exports registered SDK agent generate spans through the real observability pipeline', async () => {
    const testExporter = new TestExporter();
    const mastra = createMastraWithSDKAgent(testExporter);
    const agent = mastra.getAgent('cursorAgent');

    const result = await agent.generate('Generate prompt', { runId: 'sdk-generate-run' });
    await mastra.observability.getDefaultInstance()?.flush();

    const [agentRunSpan] = testExporter.getSpansByType(SpanType.AGENT_RUN);
    const [modelGenerationSpan] = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
    const rootSpans = testExporter.getRootSpans();

    expect(result.text).toBe('Cursor SDK result');
    expect(result.traceId).toBeDefined();
    expect(result.spanId).toBe(agentRunSpan?.id);
    expect(rootSpans).toHaveLength(1);
    expect(rootSpans[0]?.id).toBe(agentRunSpan?.id);
    expect(agentRunSpan?.name).toBe("agent run: 'cursor-agent'");
    expect(agentRunSpan?.metadata).toMatchObject({
      runId: 'sdk-generate-run',
      sdkAgent: true,
      sdkProvider: '@cursor/sdk',
      sdkMethod: 'generate',
    });
    expect(agentRunSpan?.output).toMatchObject({ text: 'Cursor SDK result' });
    expect(modelGenerationSpan?.parentSpanId).toBe(agentRunSpan?.id);
    expect(modelGenerationSpan?.name).toBe("llm: 'gpt-5.5'");
    expect(modelGenerationSpan?.attributes).toMatchObject({
      model: 'gpt-5.5',
      provider: '@cursor/sdk',
      streaming: false,
      usage: {
        inputTokens: 15,
        outputTokens: 4,
      },
    });
    expect(modelGenerationSpan?.metadata).toMatchObject({
      runId: 'sdk-generate-run',
      sdkAgent: true,
      sdkProvider: '@cursor/sdk',
      sdkMethod: 'generate',
    });
    expect(modelGenerationSpan?.output).toMatchObject({ text: 'Cursor SDK result' });
    expectCompleteTrace(testExporter);
  });

  it('exports registered SDK agent stream spans and model chunk spans through the real observability pipeline', async () => {
    const testExporter = new TestExporter();
    const mastra = createMastraWithSDKAgent(testExporter);
    const agent = mastra.getAgent('cursorAgent');

    const result = await agent.stream('Stream prompt', { runId: 'sdk-stream-run' });
    expect(await result.text).toBe('Cursor SDK result');
    await mastra.observability.getDefaultInstance()?.flush();

    const [agentRunSpan] = testExporter.getSpansByType(SpanType.AGENT_RUN);
    const [modelGenerationSpan] = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
    const [modelStepSpan] = testExporter.getSpansByType(SpanType.MODEL_STEP);
    const modelChunkSpans = testExporter.getSpansByType(SpanType.MODEL_CHUNK);
    const rootSpans = testExporter.getRootSpans();

    expect(result.traceId).toBeDefined();
    expect(result.spanId).toBe(agentRunSpan?.id);
    expect(rootSpans).toHaveLength(1);
    expect(rootSpans[0]?.id).toBe(agentRunSpan?.id);
    expect(agentRunSpan?.metadata).toMatchObject({
      runId: 'sdk-stream-run',
      sdkAgent: true,
      sdkProvider: '@cursor/sdk',
      sdkMethod: 'stream',
    });
    expect(modelGenerationSpan?.parentSpanId).toBe(agentRunSpan?.id);
    expect(modelGenerationSpan?.attributes).toMatchObject({
      model: 'gpt-5.5',
      provider: '@cursor/sdk',
      streaming: true,
      usage: {
        inputTokens: 15,
        outputTokens: 4,
      },
    });
    expect(modelGenerationSpan?.metadata).toMatchObject({
      runId: 'sdk-stream-run',
      sdkAgent: true,
      sdkProvider: '@cursor/sdk',
      sdkMethod: 'stream',
    });
    expect(modelStepSpan?.parentSpanId).toBe(modelGenerationSpan?.id);
    expect(modelChunkSpans.length).toBeGreaterThan(0);
    expectCompleteTrace(testExporter);
  });

  it('exports Claude SDK estimated cost on auto-extracted model token metrics', async () => {
    const testExporter = new TestExporter();
    const mastra = createMastraWithClaudeSDKAgent(testExporter);
    const agent = mastra.getAgent('claudeAgent');

    const result = await agent.generate('Generate prompt', { runId: 'claude-cost-run' });
    await mastra.observability.getDefaultInstance()?.flush();

    const [modelGenerationSpan] = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
    const inputTokenMetrics = testExporter.getMetricsByName('mastra_model_total_input_tokens');
    const outputTokenMetrics = testExporter.getMetricsByName('mastra_model_total_output_tokens');
    const costMetric = inputTokenMetrics.find(metric => metric.costContext?.costMetadata?.source === 'sdk_estimate');

    expect(result.text).toBe('Claude SDK result');
    expect(modelGenerationSpan?.attributes).toMatchObject({
      model: 'claude-sonnet-4-6',
      provider: '@anthropic-ai/claude-agent-sdk',
      usage: {
        inputTokens: 15,
        outputTokens: 5,
      },
      costContext: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        estimatedCost: 0.0123,
        costUnit: 'USD',
      },
    });
    expect(costMetric).toMatchObject({
      name: 'mastra_model_total_input_tokens',
      value: 15,
      costContext: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        estimatedCost: 0.0123,
        costUnit: 'USD',
        costMetadata: {
          source: 'sdk_estimate',
          sdkProvider: '@anthropic-ai/claude-agent-sdk',
          sdkCostField: 'total_cost_usd',
          allocation: 'query_total',
        },
      },
    });
    expect(outputTokenMetrics.some(metric => metric.costContext?.costMetadata?.source === 'sdk_estimate')).toBe(false);
    expectCompleteTrace(testExporter);
  });

  it('exports Claude SDK estimated cost on streamed auto-extracted model token metrics', async () => {
    const testExporter = new TestExporter();
    const mastra = createMastraWithClaudeSDKAgent(testExporter);
    const agent = mastra.getAgent('claudeAgent');

    const result = await agent.stream('Stream prompt', { runId: 'claude-stream-cost-run' });
    expect(await result.text).toBe('Claude SDK result');
    await mastra.observability.getDefaultInstance()?.flush();

    const [modelGenerationSpan] = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
    const inputTokenMetrics = testExporter.getMetricsByName('mastra_model_total_input_tokens');
    const costMetric = inputTokenMetrics.find(metric => metric.costContext?.costMetadata?.source === 'sdk_estimate');

    expect(modelGenerationSpan?.attributes).toMatchObject({
      model: 'claude-sonnet-4-6',
      provider: '@anthropic-ai/claude-agent-sdk',
      streaming: true,
      usage: {
        inputTokens: 15,
        outputTokens: 5,
      },
      costContext: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        estimatedCost: 0.0123,
        costUnit: 'USD',
      },
    });
    expect(costMetric?.costContext).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      estimatedCost: 0.0123,
      costUnit: 'USD',
      costMetadata: {
        source: 'sdk_estimate',
        allocation: 'query_total',
      },
    });
    expectCompleteTrace(testExporter);
  });
});
