import { EntityType, SpanType } from '@mastra/core/observability';
import type {
  AnyExportedSpan,
  ModelGenerationAttributes,
  RagEmbeddingAttributes,
  UsageStats,
} from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { MODEL_TOKENS } from '../../../docs/src/plugins/remark-model-tokens/models';
import { getAttributes, formatUsageMetrics, getSpanName } from './gen-ai-semantics';

function createModelGenerationSpan(attributes: ModelGenerationAttributes): AnyExportedSpan {
  return {
    id: 'test-span-id',
    traceId: 'test-trace-id',
    name: 'test-generation',
    type: SpanType.MODEL_GENERATION,
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
    const span = createModelGenerationSpan({
      model: 'gpt-4',
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.input_tokens']).toBe(100);
    expect(attrs['gen_ai.usage.output_tokens']).toBe(50);
  });

  it('should extract cacheRead from inputDetails using OTel-spec attribute name', () => {
    const span = createModelGenerationSpan({
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.cache_read.input_tokens']).toBe(800);
  });

  it('should extract cacheWrite from inputDetails using OTel-spec attribute name', () => {
    const span = createModelGenerationSpan({
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.cache_creation.input_tokens']).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const span = createModelGenerationSpan({
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
  it.each([SpanType.MODEL_GENERATION, SpanType.TOOL_CALL, SpanType.MCP_TOOL_CALL])(
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

/**
 * Workflow control-flow spans inherit entityName from the enclosing workflow, so
 * the exported span has to fall back to its own identity to stay distinguishable.
 */
function createWorkflowSpan(
  type: SpanType,
  name: string,
  attributes: Record<string, unknown>,
  entity?: { entityType?: EntityType; entityId?: string; entityName?: string },
): AnyExportedSpan {
  return {
    id: 'test-span-id',
    traceId: 'test-trace-id',
    name,
    type,
    startTime: new Date(),
    isRootSpan: false,
    isEvent: false,
    attributes,
    // Every span below sits inside 'demo-workflow', which is what entityName
    // resolves to once it has been inherited down the tree.
    entityName: 'demo-workflow',
    ...entity,
  } as AnyExportedSpan;
}

describe('getSpanName - workflow control flow', () => {
  it('keeps sibling steps apart instead of naming both after the workflow', () => {
    const left = createWorkflowSpan(
      SpanType.WORKFLOW_STEP,
      "workflow step: 'left'",
      {},
      {
        entityType: EntityType.WORKFLOW_STEP,
        entityId: 'left',
      },
    );
    const right = createWorkflowSpan(
      SpanType.WORKFLOW_STEP,
      "workflow step: 'right'",
      {},
      {
        entityType: EntityType.WORKFLOW_STEP,
        entityId: 'right',
      },
    );

    expect(getSpanName(left)).toBe('workflow_step left');
    expect(getSpanName(right)).toBe('workflow_step right');
    expect(getSpanName(left)).not.toBe(getSpanName(right));
  });

  it('keeps a step identified by itself rather than by the workflow that encloses it', () => {
    // A nested workflow: the inner step inherits the outer workflow's entityName.
    const step = createWorkflowSpan(
      SpanType.WORKFLOW_STEP,
      "workflow step: 'inner-step'",
      {},
      {
        entityType: EntityType.WORKFLOW_STEP,
        entityId: 'inner-step',
        entityName: 'outer-workflow',
      },
    );

    expect(getSpanName(step)).toBe('workflow_step inner-step');
    expect(getSpanName(step)).not.toContain('outer-workflow');
  });

  it('tells two predicates of the same branch apart', () => {
    const first = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL_EVAL, "condition '0'", {
      conditionIndex: 0,
      result: true,
    });
    const second = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL_EVAL, "condition '1'", {
      conditionIndex: 1,
      result: false,
    });

    expect(getSpanName(first)).toBe('condition 0');
    expect(getSpanName(second)).toBe('condition 1');
  });

  it('leaves span types that own their entity alone', () => {
    const run = createWorkflowSpan(
      SpanType.WORKFLOW_RUN,
      'workflow run',
      {},
      {
        entityType: EntityType.WORKFLOW_RUN,
        entityId: 'demo-workflow',
      },
    );

    expect(getSpanName(run)).toBe('invoke_workflow demo-workflow');
  });
});

describe('getAttributes - workflow control flow', () => {
  it('exports the branch decision', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL, "conditional: '2 conditions'", {
      conditionCount: 2,
      truthyIndexes: [0],
      selectedSteps: ['left'],
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_conditional.condition_count': 2,
      'mastra.workflow_conditional.truthy_indexes': '[0]',
      'mastra.workflow_conditional.selected_steps': '["left"]',
    });
  });

  it('exports which predicate this was and how it evaluated', () => {
    const span = createWorkflowSpan(SpanType.WORKFLOW_CONDITIONAL_EVAL, "condition '1'", {
      conditionIndex: 1,
      result: false,
    });

    // result is false, so a truthiness check on the way out would drop it.
    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_conditional_eval.condition_index': 1,
      'mastra.workflow_conditional_eval.result': false,
    });
  });

  it('exports the step id of a step span', () => {
    const span = createWorkflowSpan(
      SpanType.WORKFLOW_STEP,
      "workflow step: 'left'",
      { status: 'success' },
      {
        entityType: EntityType.WORKFLOW_STEP,
        entityId: 'left',
      },
    );

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_step.step_id': 'left',
      'mastra.workflow_step.status': 'success',
    });
  });

  it('exports parallel and loop routing', () => {
    const parallel = createWorkflowSpan(SpanType.WORKFLOW_PARALLEL, 'parallel', {
      branchCount: 2,
      parallelSteps: ['a', 'b'],
    });
    const loop = createWorkflowSpan(SpanType.WORKFLOW_LOOP, 'loop', {
      loopType: 'foreach',
      iteration: 3,
      concurrency: 2,
    });

    expect(getAttributes(parallel)).toMatchObject({
      'mastra.workflow_parallel.branch_count': 2,
      'mastra.workflow_parallel.parallel_steps': '["a","b"]',
    });
    expect(getAttributes(loop)).toMatchObject({
      'mastra.workflow_loop.loop_type': 'foreach',
      'mastra.workflow_loop.iteration': 3,
      'mastra.workflow_loop.concurrency': 2,
    });
  });

  it('serialises a sleep deadline rather than dropping it', () => {
    const until = new Date('2026-01-01T00:00:00.000Z');
    const span = createWorkflowSpan(SpanType.WORKFLOW_SLEEP, 'sleep', {
      durationMs: 500,
      untilDate: until,
      sleepType: 'dynamic',
    });

    expect(getAttributes(span)).toMatchObject({
      'mastra.workflow_sleep.duration_ms': 500,
      'mastra.workflow_sleep.until_date': until.toISOString(),
      'mastra.workflow_sleep.sleep_type': 'dynamic',
    });
  });

  it('adds nothing for a span type that carries no workflow attributes', () => {
    const attrs = getAttributes(createSpan(SpanType.AGENT_RUN));

    expect(Object.keys(attrs).some(key => key.startsWith('mastra.workflow_'))).toBe(false);
  });
});
