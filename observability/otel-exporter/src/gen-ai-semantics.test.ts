import { SpanType } from '@mastra/core/observability';
import type {
  AnyExportedSpan,
  ModelGenerationAttributes,
  ModelInferenceAttributes,
  RagEmbeddingAttributes,
  UsageStats,
} from '@mastra/core/observability';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MODEL_TOKENS } from '../../../docs/src/plugins/remark-model-tokens/models';
import { __setObservabilityFeaturesForTest } from './features';
import { getAttributes, formatUsageMetrics, getSpanName } from './gen-ai-semantics';

const INFERENCE_ENABLED = new Set(['model-inference-span']);

// Paired packages emit MODEL_INFERENCE, so it is the exported `chat` call.
beforeAll(() => __setObservabilityFeaturesForTest(INFERENCE_ENABLED));

function createModelInferenceSpan(attributes: ModelInferenceAttributes): AnyExportedSpan {
  return {
    id: 'test-span-id',
    traceId: 'test-trace-id',
    name: 'test-inference',
    type: SpanType.MODEL_INFERENCE,
    startTime: new Date(),
    isRootSpan: false,
    isEvent: false,
    attributes,
  } as AnyExportedSpan;
}

function createRagEmbeddingSpan(attributes: RagEmbeddingAttributes): AnyExportedSpan {
  return {
    id: 'test-span-id',
    traceId: 'test-trace-id',
    name: 'test-embedding',
    type: SpanType.RAG_EMBEDDING,
    startTime: new Date(),
    isRootSpan: false,
    isEvent: false,
    attributes,
  } as AnyExportedSpan;
}

function createSpan(type: SpanType, metadata?: Record<string, unknown>): AnyExportedSpan {
  return {
    id: 'test-span-id',
    traceId: 'test-trace-id',
    name: 'test-span',
    type,
    startTime: new Date(),
    isRootSpan: false,
    isEvent: false,
    metadata,
    attributes: {},
  } as AnyExportedSpan;
}

describe('getAttributes - tool attributes', () => {
  it.each([SpanType.TOOL_CALL, SpanType.MCP_TOOL_CALL, SpanType.PROVIDER_TOOL_CALL])(
    'preserves shared tool attributes for %s',
    type => {
      const span = createSpan(type);
      span.entityName = 'lookup';
      span.attributes = { toolDescription: 'Look up a record', toolType: 'tool', toolCallId: 'call-1' };
      expect(getAttributes(span)).toMatchObject({
        'gen_ai.tool.name': 'lookup',
        'gen_ai.tool.description': 'Look up a record',
        'gen_ai.tool.type': 'tool',
        'gen_ai.tool.call.id': 'call-1',
      });
    },
  );

  it.each(['9.9.9', undefined])('exports MCP server metadata with version %s', serverVersion => {
    const span = createSpan(SpanType.MCP_TOOL_CALL);
    span.attributes = { mcpServer: 'roster', serverVersion };
    const attrs = getAttributes(span);
    expect(attrs['server.address']).toBe('roster');
    expect(attrs['mastra.mcp_tool_call.server_name']).toBe('roster');
    if (serverVersion) {
      expect(attrs['mastra.mcp_tool_call.server_version']).toBe(serverVersion);
    } else {
      expect(attrs).not.toHaveProperty('mastra.mcp_tool_call.server_version');
    }
    expect(attrs).not.toHaveProperty('gen_ai.tool.description');
    expect(attrs).not.toHaveProperty('gen_ai.tool.type');
  });

  it.each([SpanType.TOOL_CALL, SpanType.PROVIDER_TOOL_CALL])('does not export MCP metadata for %s', type => {
    const attrs = getAttributes(createSpan(type));
    expect(attrs).not.toHaveProperty('server.address');
    expect(attrs).not.toHaveProperty('mastra.mcp_tool_call.server_name');
    expect(attrs).not.toHaveProperty('mastra.mcp_tool_call.server_version');
    expect(attrs).not.toHaveProperty('gen_ai.tool.description');
    expect(attrs).not.toHaveProperty('gen_ai.tool.type');
  });
});

describe('getAttributes - token usage', () => {
  it('should extract basic tokens', () => {
    const span = createModelInferenceSpan({
      model: 'gpt-4',
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.input_tokens']).toBe(100);
    expect(attrs['gen_ai.usage.output_tokens']).toBe(50);
  });

  it('should extract cacheRead from inputDetails using OTel-spec attribute name', () => {
    const span = createModelInferenceSpan({
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.cache_read.input_tokens']).toBe(800);
  });

  it('should extract cacheWrite from inputDetails using OTel-spec attribute name', () => {
    const span = createModelInferenceSpan({
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.cache_creation.input_tokens']).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const span = createModelInferenceSpan({
      model: 'o1-preview',
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.reasoning_tokens']).toBe(400);
  });

  it('should extract model, provider, usage, and RAG metadata for embedding spans', () => {
    const span = createRagEmbeddingSpan({
      model: MODEL_TOKENS.__AI_SDK_OPENAI_EMBEDDING_MODEL__,
      provider: 'OpenAI',
      mode: 'ingest',
      dimensions: 1536,
      inputCount: 3,
      usage: { inputTokens: 120 },
    });
    const attrs = getAttributes(span);

    expect(attrs['gen_ai.operation.name']).toBe('embeddings');
    expect(attrs['gen_ai.request.model']).toBe(MODEL_TOKENS.__AI_SDK_OPENAI_EMBEDDING_MODEL__);
    expect(attrs['gen_ai.provider.name']).toBe('openai');
    expect(attrs['gen_ai.usage.input_tokens']).toBe(120);
    expect(attrs['gen_ai.embeddings.dimension.count']).toBe(1536);
    expect(attrs['mastra.rag_embedding.mode']).toBe('ingest');
    expect(attrs['mastra.rag_embedding.dimensions']).toBe(1536);
    expect(attrs['mastra.rag_embedding.input_count']).toBe(3);
  });
});

describe('formatUsageMetrics', () => {
  it('should extract basic tokens', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50 };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.input_tokens']).toBe(100);
    expect(result['gen_ai.usage.output_tokens']).toBe(50);
  });

  it('should extract cacheRead from inputDetails using OTel-spec attribute name', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.cache_read.input_tokens']).toBe(800);
  });

  it('should extract cacheWrite from inputDetails using OTel-spec attribute name', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.cache_creation.input_tokens']).toBe(500);
  });

  it('should preserve cache creation TTL splits as extension attributes', () => {
    const usage: UsageStats = {
      inputTokens: 1000,
      outputTokens: 200,
      inputDetails: { cacheWrite: 500, cacheWrite5m: 300, cacheWrite1h: 200 },
    };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.cache_creation.input_tokens']).toBe(500);
    expect(result['gen_ai.usage.cache_creation.5m_input_tokens']).toBe(300);
    expect(result['gen_ai.usage.cache_creation.1h_input_tokens']).toBe(200);
  });

  it('should extract reasoning from outputDetails', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.reasoning_tokens']).toBe(400);
  });

  it('should not emit non-spec cache attribute names that older versions used', () => {
    const usage: UsageStats = {
      inputTokens: 1000,
      outputTokens: 500,
      inputDetails: { cacheRead: 600, cacheWrite: 200 },
    };
    const result = formatUsageMetrics(usage) as Record<string, unknown>;
    expect(result['gen_ai.usage.cached_input_tokens']).toBeUndefined();
    expect(result['gen_ai.usage.cache_write_tokens']).toBeUndefined();
  });

  it('should return empty metrics for undefined usage', () => {
    const result = formatUsageMetrics(undefined);
    expect(result).toEqual({});
  });
});

describe('getAttributes - conversation id', () => {
  it.each([SpanType.MODEL_INFERENCE, SpanType.TOOL_CALL, SpanType.MCP_TOOL_CALL])(
    'should set gen_ai.conversation.id from metadata.threadId for %s spans',
    spanType => {
      const attrs = getAttributes(createSpan(spanType, { threadId: 'thread-123' }));

      expect(attrs['gen_ai.conversation.id']).toBe('thread-123');
    },
  );

  it('should not set gen_ai.conversation.id when metadata.threadId is absent', () => {
    const attrs = getAttributes(createSpan(SpanType.MODEL_GENERATION, { resourceId: 'resource-123' }));

    expect(attrs).not.toHaveProperty('gen_ai.conversation.id');
  });
});

function createWorkflowSpan(
  type: SpanType,
  overrides: Partial<AnyExportedSpan> & { attributes?: Record<string, unknown> } = {},
): AnyExportedSpan {
  return {
    id: 'test-span-id',
    traceId: 'test-trace-id',
    name: 'test-span',
    type,
    startTime: new Date(),
    isRootSpan: false,
    isEvent: false,
    attributes: {},
    ...overrides,
  } as AnyExportedSpan;
}

describe('getSpanName - workflow spans', () => {
  it('names a workflow step by its own step id, not the inherited workflow name', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_STEP, {
      name: "workflow step: 'left'",
      entityId: 'left',
      entityName: 'demo-workflow',
    });

    expect(getSpanName(span)).toBe('workflow_step left');
  });

  it('gives sibling steps distinct names', () => {
    const left = createWorkflowSpan(SpanType.WORKFLOW_STEP, { entityId: 'left', entityName: 'demo-workflow' });
    const right = createWorkflowSpan(SpanType.WORKFLOW_STEP, { entityId: 'right', entityName: 'demo-workflow' });

    expect(getSpanName(left)).not.toBe(getSpanName(right));
    expect(getSpanName(left)).toBe('workflow_step left');
    expect(getSpanName(right)).toBe('workflow_step right');
  });

  it('names a step nested in another workflow by its own step id', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_STEP, {
      entityId: 'inner-step',
      entityName: 'outer-workflow',
    });

    expect(getSpanName(span)).toBe('workflow_step inner-step');
  });

  it('keeps the authored name for a conditional-eval span instead of the inherited workflow name', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL_EVAL, {
      name: "condition '0'",
      entityName: 'demo-workflow',
    });

    expect(getSpanName(span)).toBe('condition 0');
  });

  it('keeps distinct authored names for two predicates of one branch', () => {
    const zero = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL_EVAL, {
      name: "condition '0'",
      entityName: 'demo-workflow',
    });
    const one = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL_EVAL, {
      name: "condition '1'",
      entityName: 'demo-workflow',
    });

    expect(getSpanName(zero)).toBe('condition 0');
    expect(getSpanName(one)).toBe('condition 1');
  });

  it.each([
    [SpanType.WORKFLOW_CONDITIONAL, "conditional: '2 conditions'", 'conditional 2 conditions'],
    [SpanType.WORKFLOW_PARALLEL, "parallel: '3 branches'", 'parallel 3 branches'],
    [SpanType.WORKFLOW_LOOP, "loop: 'foreach'", 'loop foreach'],
  ])('keeps the authored name for %s control-flow spans', (type, name, expected) => {
    const span = createWorkflowSpan(type, { name, entityName: 'demo-workflow' });

    expect(getSpanName(span)).toBe(expected);
  });
});

describe('getAttributes - workflow attributes', () => {
  it('preserves conditional branch attributes', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL, {
      attributes: { conditionCount: 2, truthyIndexes: [0], selectedSteps: ['left'] },
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_conditional.condition_count': 2,
      'mastra.workflow_conditional.truthy_indexes': '[0]',
      'mastra.workflow_conditional.selected_steps': '["left"]',
    });
  });

  it('preserves conditional-eval attributes including result: false', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL_EVAL, {
      attributes: { conditionIndex: 1, result: false },
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_conditional_eval.condition_index': 1,
      'mastra.workflow_conditional_eval.result': false,
    });
  });

  it('preserves step id and status', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_STEP, {
      entityId: 'left',
      attributes: { status: 'success' },
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_step.step_id': 'left',
      'mastra.workflow_step.status': 'success',
    });
  });

  it('preserves parallel attributes', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_PARALLEL, {
      attributes: { branchCount: 3, parallelSteps: ['a', 'b', 'c'] },
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_parallel.branch_count': 3,
      'mastra.workflow_parallel.parallel_steps': '["a","b","c"]',
    });
  });

  it('preserves loop attributes including iteration 0', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_LOOP, {
      attributes: { loopType: 'foreach', iteration: 0, totalIterations: 5, concurrency: 2 },
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_loop.loop_type': 'foreach',
      'mastra.workflow_loop.iteration': 0,
      'mastra.workflow_loop.total_iterations': 5,
      'mastra.workflow_loop.concurrency': 2,
    });
  });

  it('serializes a sleep deadline as an ISO string', () => {
    const untilDate = new Date('2026-01-01T00:00:00.000Z');
    const span = createWorkflowSpan(SpanType.WORKFLOW_SLEEP, {
      attributes: { durationMs: 1000, untilDate, sleepType: 'dynamic' },
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_sleep.duration_ms': 1000,
      'mastra.workflow_sleep.until_date': '2026-01-01T00:00:00.000Z',
      'mastra.workflow_sleep.sleep_type': 'dynamic',
    });
  });

  it('preserves wait-event attributes including eventReceived: false', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_WAIT_EVENT, {
      attributes: { eventName: 'approval', timeoutMs: 5000, eventReceived: false, waitDurationMs: 42 },
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_wait_event.event_name': 'approval',
      'mastra.workflow_wait_event.timeout_ms': 5000,
      'mastra.workflow_wait_event.event_received': false,
      'mastra.workflow_wait_event.wait_duration_ms': 42,
    });
  });

  it('preserves workflow run status', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_RUN, { attributes: { status: 'success' } });

    expect(getAttributes(span)['mastra.workflow_run.status']).toBe('success');
  });

  it('adds no workflow-specific keys when a workflow span carries no attributes', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_PARALLEL, { attributes: {} });
    const attrs = getAttributes(span);

    expect(attrs).not.toHaveProperty('mastra.workflow_parallel.branch_count');
    expect(attrs).not.toHaveProperty('mastra.workflow_parallel.parallel_steps');
  });

  describe('authored entry identity', () => {
    const entryMetadata = { phase: 'processing', enabled: false, count: 0, nested: { deep: true } };
    const entryFields = {
      entryId: 'parallel-group',
      entryDescription: 'Run two tasks in parallel',
      entryMetadata,
    };

    it('preserves parallel entry fields from attributes without relying on span.metadata', () => {
      const span = createWorkflowSpan(SpanType.WORKFLOW_PARALLEL, {
        name: "parallel: '2 branches'",
        metadata: {},
        attributes: { branchCount: 2, parallelSteps: ['first', 'second'], ...entryFields },
      });
      const attrs = getAttributes(span);

      expect(attrs).toMatchObject({
        'mastra.workflow_parallel.branch_count': 2,
        'mastra.workflow_parallel.entry_id': 'parallel-group',
        'mastra.workflow_parallel.entry_description': 'Run two tasks in parallel',
        'mastra.workflow_parallel.entry_metadata': JSON.stringify(entryMetadata),
      });
      expect(Object.keys(attrs).some(key => key.startsWith('mastra.metadata.'))).toBe(false);
    });

    it('round-trips nested and falsy entry metadata values', () => {
      const span = createWorkflowSpan(SpanType.WORKFLOW_PARALLEL, { attributes: { entryMetadata } });
      const serialized = getAttributes(span)['mastra.workflow_parallel.entry_metadata'];

      expect(JSON.parse(serialized as string)).toEqual(entryMetadata);
    });

    it.each([
      [SpanType.WORKFLOW_CONDITIONAL, 'workflow_conditional'],
      [SpanType.WORKFLOW_LOOP, 'workflow_loop'],
      [SpanType.WORKFLOW_SLEEP, 'workflow_sleep'],
    ])('preserves entry fields for %s spans', (type, prefix) => {
      const span = createWorkflowSpan(type, { attributes: entryFields });

      expect(getAttributes(span)).toMatchObject({
        [`mastra.${prefix}.entry_id`]: 'parallel-group',
        [`mastra.${prefix}.entry_description`]: 'Run two tasks in parallel',
        [`mastra.${prefix}.entry_metadata`]: JSON.stringify(entryMetadata),
      });
    });

    it('preserves step entry description and metadata', () => {
      const span = createWorkflowSpan(SpanType.WORKFLOW_STEP, {
        entityId: 'left',
        attributes: { status: 'success', entryDescription: 'Left branch', entryMetadata: { retries: 0 } },
      });

      expect(getAttributes(span)).toMatchObject({
        'mastra.workflow_step.step_id': 'left',
        'mastra.workflow_step.entry_description': 'Left branch',
        'mastra.workflow_step.entry_metadata': '{"retries":0}',
      });
    });

    it('adds no entry keys when entry fields are absent', () => {
      const span = createWorkflowSpan(SpanType.WORKFLOW_LOOP, { attributes: { loopType: 'foreach' } });
      const attrs = getAttributes(span);

      expect(attrs).not.toHaveProperty('mastra.workflow_loop.entry_id');
      expect(attrs).not.toHaveProperty('mastra.workflow_loop.entry_description');
      expect(attrs).not.toHaveProperty('mastra.workflow_loop.entry_metadata');
    });
  });
});

describe('getAttributes - one span per model call', () => {
  const usage: UsageStats = { inputTokens: 61, outputTokens: 14, inputDetails: { cacheRead: 40 } };

  function span(type: SpanType, attributes: Record<string, unknown>): AnyExportedSpan {
    return {
      ...createSpan(type),
      entityId: 'weather-agent',
      entityName: 'weather-agent',
      input: [{ role: 'user', content: 'hi' }],
      output: [{ role: 'assistant', content: 'hello' }],
      attributes,
    } as AnyExportedSpan;
  }

  it('exports the inference span as the chat call with model, usage and messages', () => {
    const attrs = getAttributes(
      span(SpanType.MODEL_INFERENCE, {
        model: MODEL_TOKENS.__AI_SDK_OPENAI_MODEL_BASE__,
        provider: 'openai',
        stepIndex: 1,
        finishReason: 'tool-calls',
        responseModel: 'gpt-5-2025-08-07',
        responseId: 'resp-1',
        usage,
      }),
    );
    expect(attrs).toMatchObject({
      'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': MODEL_TOKENS.__AI_SDK_OPENAI_MODEL_BASE__,
      'gen_ai.provider.name': 'openai',
      'gen_ai.usage.input_tokens': 61,
      'gen_ai.usage.output_tokens': 14,
      'gen_ai.usage.cache_read.input_tokens': 40,
      'gen_ai.response.finish_reasons': JSON.stringify(['tool-calls']),
      'gen_ai.response.model': 'gpt-5-2025-08-07',
      'gen_ai.response.id': 'resp-1',
      'gen_ai.agent.name': 'weather-agent',
    });
    expect(attrs).toHaveProperty('gen_ai.input.messages');
    expect(attrs).toHaveProperty('gen_ai.output.messages');
    expect(getSpanName(span(SpanType.MODEL_INFERENCE, { model: 'gpt-4o' }))).toBe('chat gpt-4o');
  });

  it('exports the generation span as a parent without model or usage so backends do not count it twice', () => {
    const attrs = getAttributes(
      span(SpanType.MODEL_GENERATION, { model: 'gpt-4o', provider: 'openai', finishReason: 'stop', usage }),
    );
    expect(attrs['gen_ai.operation.name']).toBe('model_generation');
    expect(attrs).not.toHaveProperty('gen_ai.request.model');
    expect(attrs).not.toHaveProperty('gen_ai.usage.input_tokens');
    expect(attrs).not.toHaveProperty('gen_ai.response.finish_reasons');
    expect(attrs).not.toHaveProperty('gen_ai.input.messages');
    expect(attrs).toHaveProperty('mastra.model_generation.input');
    expect(attrs).toHaveProperty('mastra.model_generation.output');
    expect(getSpanName(span(SpanType.MODEL_GENERATION, { model: 'gpt-4o' }))).toBe('model_generation gpt-4o');
  });

  it('exports the step span as agent_step with its index but no usage', () => {
    const attrs = getAttributes(span(SpanType.MODEL_STEP, { stepIndex: 0, isContinued: false, usage }));
    expect(attrs['gen_ai.operation.name']).toBe('agent_step');
    expect(attrs['mastra.model_step.step_index']).toBe(0);
    expect(attrs['mastra.model_step.is_continued']).toBe(false);
    expect(attrs).not.toHaveProperty('gen_ai.usage.input_tokens');
    expect(getSpanName(span(SpanType.MODEL_STEP, { stepIndex: 0 }))).toBe('agent_step weather-agent');
  });

  describe('paired with an older @mastra/observability that emits no inference spans', () => {
    beforeAll(() => __setObservabilityFeaturesForTest(undefined));
    afterAll(() => __setObservabilityFeaturesForTest(INFERENCE_ENABLED));

    it('keeps the generation span as the chat call', () => {
      const attrs = getAttributes(span(SpanType.MODEL_GENERATION, { model: 'gpt-4o', provider: 'openai', usage }));
      expect(attrs).toMatchObject({
        'gen_ai.operation.name': 'chat',
        'gen_ai.request.model': 'gpt-4o',
        'gen_ai.usage.input_tokens': 61,
      });
      expect(attrs).toHaveProperty('gen_ai.input.messages');
      expect(getSpanName(span(SpanType.MODEL_GENERATION, { model: 'gpt-4o' }))).toBe('chat gpt-4o');
    });

    it('does not export usage from a stray inference span', () => {
      const attrs = getAttributes(span(SpanType.MODEL_INFERENCE, { model: 'gpt-4o', usage }));
      expect(attrs['gen_ai.operation.name']).toBe('model_inference');
      expect(attrs).not.toHaveProperty('gen_ai.usage.input_tokens');
    });
  });
});
