import { describe, expect, it } from 'vitest';
import { SpanType } from '../observability';
import type { SpanRecord } from '../storage';
import { extractTrajectoryFromTrace } from './types';

function createSpan(overrides: Partial<SpanRecord> & { spanId: string; spanType: SpanRecord['spanType'] }): SpanRecord {
  return {
    traceId: 'trace-1',
    parentSpanId: null,
    name: overrides.name ?? 'test-span',
    startedAt: new Date('2025-01-01T00:00:00Z'),
    endedAt: new Date('2025-01-01T00:00:01Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:01Z'),
    scope: null,
    attributes: {},
    metadata: {},
    links: null,
    error: null,
    requestContext: null,
    isEvent: false,
    input: null,
    output: null,
    ...overrides,
  } as SpanRecord;
}

describe('extractTrajectoryFromTrace', () => {
  it('returns empty trajectory for empty spans', () => {
    const result = extractTrajectoryFromTrace([]);
    expect(result.steps).toEqual([]);
    expect(result.totalDurationMs).toBeUndefined();
  });

  it('extracts a simple flat trace with one tool call', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'agent-1',
        spanType: SpanType.AGENT_RUN,
        name: 'my-agent',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:02Z'),
      }),
      createSpan({
        spanId: 'tool-1',
        parentSpanId: 'agent-1',
        spanType: SpanType.TOOL_CALL,
        name: 'search',
        input: { query: 'hello' },
        output: { results: ['world'] },
        attributes: { success: true },
        startedAt: new Date('2025-01-01T00:00:00.500Z'),
        endedAt: new Date('2025-01-01T00:00:01Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.stepType).toBe('tool_call');
    expect(result.steps[0]!.name).toBe('search');
    if (result.steps[0]!.stepType === 'tool_call') {
      expect(result.steps[0]!.toolArgs).toEqual({ query: 'hello' });
      expect(result.steps[0]!.toolResult).toEqual({ results: ['world'] });
      expect(result.steps[0]!.success).toBe(true);
    }
    expect(result.steps[0]!.durationMs).toBe(500);
    expect(result.totalDurationMs).toBe(2000);
  });

  it('builds hierarchical trajectory: workflow → step → agent → tool_call', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'wf-run',
        spanType: SpanType.WORKFLOW_RUN,
        name: 'my-workflow',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:10Z'),
      }),
      createSpan({
        spanId: 'wf-step-1',
        parentSpanId: 'wf-run',
        spanType: SpanType.WORKFLOW_STEP,
        name: 'fetchData',
        output: { fetched: true },
        startedAt: new Date('2025-01-01T00:00:01Z'),
        endedAt: new Date('2025-01-01T00:00:05Z'),
      }),
      createSpan({
        spanId: 'agent-1',
        parentSpanId: 'wf-step-1',
        spanType: SpanType.AGENT_RUN,
        name: 'data-agent',
        startedAt: new Date('2025-01-01T00:00:01.5Z'),
        endedAt: new Date('2025-01-01T00:00:04Z'),
      }),
      createSpan({
        spanId: 'tool-1',
        parentSpanId: 'agent-1',
        spanType: SpanType.TOOL_CALL,
        name: 'search',
        input: { q: 'data' },
        output: { result: 'found' },
        attributes: { success: true },
        startedAt: new Date('2025-01-01T00:00:02Z'),
        endedAt: new Date('2025-01-01T00:00:03Z'),
      }),
      createSpan({
        spanId: 'wf-step-2',
        parentSpanId: 'wf-run',
        spanType: SpanType.WORKFLOW_STEP,
        name: 'processData',
        output: { processed: true },
        startedAt: new Date('2025-01-01T00:00:06Z'),
        endedAt: new Date('2025-01-01T00:00:09Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);

    // The root is a workflow_run, so its children become the top-level steps
    expect(result.steps).toHaveLength(2);
    expect(result.totalDurationMs).toBe(10000);

    // First step: fetchData
    const step1 = result.steps[0]!;
    expect(step1.stepType).toBe('workflow_step');
    expect(step1.name).toBe('fetchData');
    expect(step1.durationMs).toBe(4000);

    // fetchData has a child agent_run
    expect(step1.children).toHaveLength(1);
    const agentStep = step1.children![0]!;
    expect(agentStep.stepType).toBe('agent_run');
    expect(agentStep.name).toBe('data-agent');

    // agent has a child tool_call
    expect(agentStep.children).toHaveLength(1);
    const toolStep = agentStep.children![0]!;
    expect(toolStep.stepType).toBe('tool_call');
    expect(toolStep.name).toBe('search');
    if (toolStep.stepType === 'tool_call') {
      expect(toolStep.toolArgs).toEqual({ q: 'data' });
      expect(toolStep.toolResult).toEqual({ result: 'found' });
    }

    // Second step: processData (leaf node, children is undefined)
    const step2 = result.steps[1]!;
    expect(step2.stepType).toBe('workflow_step');
    expect(step2.name).toBe('processData');
    expect(step2.children).toBeUndefined();
  });

  it('maps all span types to correct TrajectoryStep types', () => {
    const root = createSpan({
      spanId: 'agent-root',
      spanType: SpanType.AGENT_RUN,
      name: 'test-agent',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      endedAt: new Date('2025-01-01T00:01:00Z'),
    });

    const children: SpanRecord[] = [
      createSpan({
        spanId: 'tool-call',
        parentSpanId: 'agent-root',
        spanType: SpanType.TOOL_CALL,
        name: 'my-tool',
        input: { arg: 1 },
        output: { res: 2 },
        attributes: { success: true },
        startedAt: new Date('2025-01-01T00:00:01Z'),
        endedAt: new Date('2025-01-01T00:00:02Z'),
      }),
      createSpan({
        spanId: 'mcp-call',
        parentSpanId: 'agent-root',
        spanType: SpanType.MCP_TOOL_CALL,
        name: 'mcp-tool',
        input: { arg: 'mcp' },
        output: { res: 'mcp' },
        attributes: { mcpServer: 'server-1', success: false },
        startedAt: new Date('2025-01-01T00:00:03Z'),
        endedAt: new Date('2025-01-01T00:00:04Z'),
      }),
      createSpan({
        spanId: 'model-gen',
        parentSpanId: 'agent-root',
        spanType: SpanType.MODEL_GENERATION,
        name: 'model-call',
        attributes: {
          model: 'gpt-4',
          usage: { inputTokens: 100, outputTokens: 50 },
          finishReason: 'stop',
        },
        startedAt: new Date('2025-01-01T00:00:05Z'),
        endedAt: new Date('2025-01-01T00:00:06Z'),
      }),
      createSpan({
        spanId: 'processor',
        parentSpanId: 'agent-root',
        spanType: SpanType.PROCESSOR_RUN,
        name: 'my-processor',
        startedAt: new Date('2025-01-01T00:00:07Z'),
        endedAt: new Date('2025-01-01T00:00:08Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace([root, ...children]);

    expect(result.steps).toHaveLength(4);

    // Tool call
    expect(result.steps[0]!.stepType).toBe('tool_call');
    if (result.steps[0]!.stepType === 'tool_call') {
      expect(result.steps[0]!.toolArgs).toEqual({ arg: 1 });
      expect(result.steps[0]!.toolResult).toEqual({ res: 2 });
      expect(result.steps[0]!.success).toBe(true);
    }

    // MCP tool call
    expect(result.steps[1]!.stepType).toBe('mcp_tool_call');
    if (result.steps[1]!.stepType === 'mcp_tool_call') {
      expect(result.steps[1]!.mcpServer).toBe('server-1');
      expect(result.steps[1]!.success).toBe(false);
    }

    // Model generation
    expect(result.steps[2]!.stepType).toBe('model_generation');
    if (result.steps[2]!.stepType === 'model_generation') {
      expect(result.steps[2]!.modelId).toBe('gpt-4');
      expect(result.steps[2]!.promptTokens).toBe(100);
      expect(result.steps[2]!.completionTokens).toBe(50);
      expect(result.steps[2]!.finishReason).toBe('stop');
    }

    // Processor run
    expect(result.steps[3]!.stepType).toBe('processor_run');
    expect(result.steps[3]!.name).toBe('my-processor');
  });

  it('maps workflow-specific span types correctly', () => {
    const root = createSpan({
      spanId: 'wf-run',
      spanType: SpanType.WORKFLOW_RUN,
      name: 'test-workflow',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      endedAt: new Date('2025-01-01T00:01:00Z'),
    });

    const children: SpanRecord[] = [
      createSpan({
        spanId: 'wf-step',
        parentSpanId: 'wf-run',
        spanType: SpanType.WORKFLOW_STEP,
        name: 'step-1',
        output: { data: 'hello' },
        startedAt: new Date('2025-01-01T00:00:01Z'),
        endedAt: new Date('2025-01-01T00:00:02Z'),
      }),
      createSpan({
        spanId: 'wf-cond',
        parentSpanId: 'wf-run',
        spanType: SpanType.WORKFLOW_CONDITIONAL,
        name: 'if-branch',
        startedAt: new Date('2025-01-01T00:00:03Z'),
        endedAt: new Date('2025-01-01T00:00:04Z'),
      }),
      createSpan({
        spanId: 'wf-parallel',
        parentSpanId: 'wf-run',
        spanType: SpanType.WORKFLOW_PARALLEL,
        name: 'parallel-1',
        startedAt: new Date('2025-01-01T00:00:05Z'),
        endedAt: new Date('2025-01-01T00:00:06Z'),
      }),
      createSpan({
        spanId: 'wf-loop',
        parentSpanId: 'wf-run',
        spanType: SpanType.WORKFLOW_LOOP,
        name: 'loop-1',
        startedAt: new Date('2025-01-01T00:00:07Z'),
        endedAt: new Date('2025-01-01T00:00:08Z'),
      }),
      createSpan({
        spanId: 'wf-sleep',
        parentSpanId: 'wf-run',
        spanType: SpanType.WORKFLOW_SLEEP,
        name: 'sleep-1',
        startedAt: new Date('2025-01-01T00:00:09Z'),
        endedAt: new Date('2025-01-01T00:00:10Z'),
      }),
      createSpan({
        spanId: 'wf-wait',
        parentSpanId: 'wf-run',
        spanType: SpanType.WORKFLOW_WAIT_EVENT,
        name: 'wait-1',
        startedAt: new Date('2025-01-01T00:00:11Z'),
        endedAt: new Date('2025-01-01T00:00:12Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace([root, ...children]);

    expect(result.steps).toHaveLength(6);
    expect(result.steps[0]!.stepType).toBe('workflow_step');
    expect(result.steps[1]!.stepType).toBe('workflow_conditional');
    expect(result.steps[2]!.stepType).toBe('workflow_parallel');
    expect(result.steps[3]!.stepType).toBe('workflow_loop');
    expect(result.steps[4]!.stepType).toBe('workflow_sleep');
    expect(result.steps[5]!.stepType).toBe('workflow_wait_event');
  });

  it('skips noise spans (generic, model_step, model_chunk, workflow_conditional_eval)', () => {
    const root = createSpan({
      spanId: 'agent-root',
      spanType: SpanType.AGENT_RUN,
      name: 'agent',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      endedAt: new Date('2025-01-01T00:01:00Z'),
    });

    const children: SpanRecord[] = [
      createSpan({
        spanId: 'generic',
        parentSpanId: 'agent-root',
        spanType: SpanType.GENERIC,
        name: 'generic-span',
        startedAt: new Date('2025-01-01T00:00:01Z'),
        endedAt: new Date('2025-01-01T00:00:02Z'),
      }),
      createSpan({
        spanId: 'model-step',
        parentSpanId: 'agent-root',
        spanType: SpanType.MODEL_STEP,
        name: 'model-step',
        startedAt: new Date('2025-01-01T00:00:02Z'),
        endedAt: new Date('2025-01-01T00:00:03Z'),
      }),
      createSpan({
        spanId: 'model-chunk',
        parentSpanId: 'agent-root',
        spanType: SpanType.MODEL_CHUNK,
        name: 'model-chunk',
        startedAt: new Date('2025-01-01T00:00:03Z'),
        endedAt: new Date('2025-01-01T00:00:04Z'),
      }),
      createSpan({
        spanId: 'wf-cond-eval',
        parentSpanId: 'agent-root',
        spanType: SpanType.WORKFLOW_CONDITIONAL_EVAL,
        name: 'cond-eval',
        startedAt: new Date('2025-01-01T00:00:04Z'),
        endedAt: new Date('2025-01-01T00:00:05Z'),
      }),
      createSpan({
        spanId: 'tool-real',
        parentSpanId: 'agent-root',
        spanType: SpanType.TOOL_CALL,
        name: 'real-tool',
        startedAt: new Date('2025-01-01T00:00:06Z'),
        endedAt: new Date('2025-01-01T00:00:07Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace([root, ...children]);

    // Only the real tool_call should appear
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.stepType).toBe('tool_call');
    expect(result.steps[0]!.name).toBe('real-tool');
  });

  it('promotes children of skipped spans rather than dropping them', () => {
    const root = createSpan({
      spanId: 'agent-root',
      spanType: SpanType.AGENT_RUN,
      name: 'agent',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      endedAt: new Date('2025-01-01T00:01:00Z'),
    });

    // model_step is skipped, but its child (model_generation) should be promoted
    const modelStep = createSpan({
      spanId: 'model-step',
      parentSpanId: 'agent-root',
      spanType: SpanType.MODEL_STEP,
      name: 'model-step',
      startedAt: new Date('2025-01-01T00:00:01Z'),
      endedAt: new Date('2025-01-01T00:00:03Z'),
    });

    const modelGeneration = createSpan({
      spanId: 'model-gen',
      parentSpanId: 'model-step',
      spanType: SpanType.MODEL_GENERATION,
      name: 'gpt-4-call',
      startedAt: new Date('2025-01-01T00:00:01Z'),
      endedAt: new Date('2025-01-01T00:00:02Z'),
      attributes: { model: 'gpt-4' },
    });

    const toolCall = createSpan({
      spanId: 'tool-1',
      parentSpanId: 'agent-root',
      spanType: SpanType.TOOL_CALL,
      name: 'search',
      startedAt: new Date('2025-01-01T00:00:04Z'),
      endedAt: new Date('2025-01-01T00:00:05Z'),
    });

    const result = extractTrajectoryFromTrace([root, modelStep, modelGeneration, toolCall]);

    // model_generation should be promoted from the skipped model_step
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]!.stepType).toBe('model_generation');
    expect(result.steps[0]!.name).toBe('gpt-4-call');
    expect(result.steps[1]!.stepType).toBe('tool_call');
    expect(result.steps[1]!.name).toBe('search');
  });

  it('uses rootSpanId to scope the trajectory', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'wf-1',
        spanType: SpanType.WORKFLOW_RUN,
        name: 'outer-workflow',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:01:00Z'),
      }),
      createSpan({
        spanId: 'step-1',
        parentSpanId: 'wf-1',
        spanType: SpanType.WORKFLOW_STEP,
        name: 'step-a',
        startedAt: new Date('2025-01-01T00:00:01Z'),
        endedAt: new Date('2025-01-01T00:00:02Z'),
      }),
      createSpan({
        spanId: 'agent-inner',
        parentSpanId: 'step-1',
        spanType: SpanType.AGENT_RUN,
        name: 'inner-agent',
        startedAt: new Date('2025-01-01T00:00:01.5Z'),
        endedAt: new Date('2025-01-01T00:00:01.9Z'),
      }),
      createSpan({
        spanId: 'tool-inner',
        parentSpanId: 'agent-inner',
        spanType: SpanType.TOOL_CALL,
        name: 'inner-tool',
        startedAt: new Date('2025-01-01T00:00:01.6Z'),
        endedAt: new Date('2025-01-01T00:00:01.8Z'),
      }),
    ];

    // Scope to the inner agent
    const result = extractTrajectoryFromTrace(spans, 'agent-inner');

    // agent_run is a container, so its children become the steps
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.stepType).toBe('tool_call');
    expect(result.steps[0]!.name).toBe('inner-tool');
    expect(result.totalDurationMs).toBe(400);
  });

  it('falls back to roots when rootSpanId is not found', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'tool-1',
        spanType: SpanType.TOOL_CALL,
        name: 'tool-a',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:01Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans, 'nonexistent-span');

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.name).toBe('tool-a');
  });

  it('calculates duration from startedAt and endedAt', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'tool-1',
        spanType: SpanType.TOOL_CALL,
        name: 'tool',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:03.5Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);
    expect(result.steps[0]!.durationMs).toBe(3500);
  });

  it('handles spans without endedAt (durationMs is undefined)', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'tool-1',
        spanType: SpanType.TOOL_CALL,
        name: 'tool',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: null as any, // Deliberately cast to simulate spans that haven't ended yet
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);
    expect(result.steps[0]!.durationMs).toBeUndefined();
  });

  it('extracts model generation attributes correctly', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'agent-root',
        spanType: SpanType.AGENT_RUN,
        name: 'agent',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:05Z'),
      }),
      createSpan({
        spanId: 'model-1',
        parentSpanId: 'agent-root',
        spanType: SpanType.MODEL_GENERATION,
        name: 'generate',
        attributes: {
          model: 'claude-sonnet-4-20250514',
          usage: { inputTokens: 200, outputTokens: 150 },
          finishReason: 'tool_calls',
        },
        startedAt: new Date('2025-01-01T00:00:01Z'),
        endedAt: new Date('2025-01-01T00:00:03Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);
    const step = result.steps[0]!;
    expect(step.stepType).toBe('model_generation');
    if (step.stepType === 'model_generation') {
      expect(step.modelId).toBe('claude-sonnet-4-20250514');
      expect(step.promptTokens).toBe(200);
      expect(step.completionTokens).toBe(150);
      expect(step.finishReason).toBe('tool_calls');
    }
  });

  it('handles orphan spans as roots', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'orphan-1',
        parentSpanId: 'missing-parent',
        spanType: SpanType.TOOL_CALL,
        name: 'orphan-tool-a',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:01Z'),
      }),
      createSpan({
        spanId: 'orphan-2',
        parentSpanId: 'another-missing',
        spanType: SpanType.TOOL_CALL,
        name: 'orphan-tool-b',
        startedAt: new Date('2025-01-01T00:00:02Z'),
        endedAt: new Date('2025-01-01T00:00:03Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]!.name).toBe('orphan-tool-a');
    expect(result.steps[1]!.name).toBe('orphan-tool-b');
  });

  it('sorts children by startedAt', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'agent-root',
        spanType: SpanType.AGENT_RUN,
        name: 'agent',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:01:00Z'),
      }),
      // Add children in reverse chronological order
      createSpan({
        spanId: 'tool-c',
        parentSpanId: 'agent-root',
        spanType: SpanType.TOOL_CALL,
        name: 'third',
        startedAt: new Date('2025-01-01T00:00:30Z'),
        endedAt: new Date('2025-01-01T00:00:35Z'),
      }),
      createSpan({
        spanId: 'tool-a',
        parentSpanId: 'agent-root',
        spanType: SpanType.TOOL_CALL,
        name: 'first',
        startedAt: new Date('2025-01-01T00:00:01Z'),
        endedAt: new Date('2025-01-01T00:00:05Z'),
      }),
      createSpan({
        spanId: 'tool-b',
        parentSpanId: 'agent-root',
        spanType: SpanType.TOOL_CALL,
        name: 'second',
        startedAt: new Date('2025-01-01T00:00:10Z'),
        endedAt: new Date('2025-01-01T00:00:15Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);
    expect(result.steps.map(s => s.name)).toEqual(['first', 'second', 'third']);
  });

  it('preserves metadata from span', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'tool-1',
        spanType: SpanType.TOOL_CALL,
        name: 'tool',
        metadata: { custom: 'value', nested: { a: 1 } },
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:01Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);
    expect(result.steps[0]!.metadata).toEqual({ custom: 'value', nested: { a: 1 } });
  });

  it('uses entityId as agentId for agent_run', () => {
    // Wrap in a workflow_step so agent_run is not a single root (containers
    // have their children promoted)
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'wf-step',
        spanType: SpanType.WORKFLOW_STEP,
        name: 'step-1',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:02Z'),
      }),
      createSpan({
        spanId: 'agent-1',
        parentSpanId: 'wf-step',
        spanType: SpanType.AGENT_RUN,
        name: 'agent-run-span-name',
        entityId: 'my-agent-id',
        startedAt: new Date('2025-01-01T00:00:00.5Z'),
        endedAt: new Date('2025-01-01T00:00:01.5Z'),
      } as any),
    ];

    const result = extractTrajectoryFromTrace(spans);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.stepType).toBe('workflow_step');

    // agent_run is a child of the workflow_step
    const agentStep = result.steps[0]!.children![0]!;
    expect(agentStep.stepType).toBe('agent_run');
    expect(agentStep.name).toBe('agent-run-span-name');
    if (agentStep.stepType === 'agent_run') {
      expect(agentStep.agentId).toBe('my-agent-id');
    }
  });

  it('handles deeply nested hierarchy (3+ levels)', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'wf',
        spanType: SpanType.WORKFLOW_RUN,
        name: 'root-workflow',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:01:00Z'),
      }),
      createSpan({
        spanId: 'wf-step',
        parentSpanId: 'wf',
        spanType: SpanType.WORKFLOW_STEP,
        name: 'orchestration-step',
        startedAt: new Date('2025-01-01T00:00:01Z'),
        endedAt: new Date('2025-01-01T00:00:50Z'),
      }),
      createSpan({
        spanId: 'agent',
        parentSpanId: 'wf-step',
        spanType: SpanType.AGENT_RUN,
        name: 'planning-agent',
        startedAt: new Date('2025-01-01T00:00:02Z'),
        endedAt: new Date('2025-01-01T00:00:40Z'),
      }),
      createSpan({
        spanId: 'model',
        parentSpanId: 'agent',
        spanType: SpanType.MODEL_GENERATION,
        name: 'plan',
        attributes: { model: 'gpt-4', usage: { inputTokens: 50, outputTokens: 25 } },
        startedAt: new Date('2025-01-01T00:00:03Z'),
        endedAt: new Date('2025-01-01T00:00:10Z'),
      }),
      createSpan({
        spanId: 'tool',
        parentSpanId: 'agent',
        spanType: SpanType.TOOL_CALL,
        name: 'execute-plan',
        input: { plan: 'do-stuff' },
        output: { done: true },
        startedAt: new Date('2025-01-01T00:00:11Z'),
        endedAt: new Date('2025-01-01T00:00:30Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);

    // workflow_run → children become top level
    expect(result.steps).toHaveLength(1);
    const wfStep = result.steps[0]!;
    expect(wfStep.stepType).toBe('workflow_step');

    // workflow_step → agent_run child
    expect(wfStep.children).toHaveLength(1);
    const agentStep = wfStep.children![0]!;
    expect(agentStep.stepType).toBe('agent_run');

    // agent_run → model_generation + tool_call children
    expect(agentStep.children).toHaveLength(2);
    expect(agentStep.children![0]!.stepType).toBe('model_generation');
    expect(agentStep.children![1]!.stepType).toBe('tool_call');
    expect(agentStep.children![1]!.name).toBe('execute-plan');
  });

  it('extracts MCP tool call attributes', () => {
    const spans: SpanRecord[] = [
      createSpan({
        spanId: 'mcp-1',
        spanType: SpanType.MCP_TOOL_CALL,
        name: 'mcp-search',
        input: { query: 'test' },
        output: { results: [] },
        attributes: { mcpServer: 'my-mcp-server', success: true },
        startedAt: new Date('2025-01-01T00:00:00Z'),
        endedAt: new Date('2025-01-01T00:00:01Z'),
      }),
    ];

    const result = extractTrajectoryFromTrace(spans);
    const step = result.steps[0]!;
    expect(step.stepType).toBe('mcp_tool_call');
    if (step.stepType === 'mcp_tool_call') {
      expect(step.mcpServer).toBe('my-mcp-server');
      expect(step.toolArgs).toEqual({ query: 'test' });
      expect(step.toolResult).toEqual({ results: [] });
      expect(step.success).toBe(true);
    }
  });
});
