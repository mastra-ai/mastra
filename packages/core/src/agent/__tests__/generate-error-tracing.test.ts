import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { MastraError } from '../../error';
import { Agent } from '../agent';

function createMockSpan(type: string, spans: any[], parent?: any, isInternal = false): any {
  const span: Record<string, any> = {
    id: `span-${spans.length}`,
    traceId: 'agent-trace-id',
    name: type,
    type,
    startTime: new Date(),
    isInternal,
    isEvent: false,
    isValid: true,
    isRootSpan: !parent,
    parent,
    end: vi.fn(),
    endTree: vi.fn(),
    error: vi.fn(),
    update: vi.fn(),
    exportSpan: vi.fn(),
    getParentSpanId: vi.fn(() => parent?.id),
    getExportedSpanId: vi.fn(() => (isInternal ? parent?.getExportedSpanId() : span.id)),
    findParent: vi.fn(),
    executeInContext: vi.fn(async (fn: () => Promise<any>) => fn()),
    executeInContextSync: vi.fn((fn: () => any) => fn()),
    get externalTraceId() {
      return span.traceId;
    },
    createTracker: vi.fn(() => ({
      getTracingContext: vi.fn(() => ({ currentSpan: span })),
      reportGenerationError: vi.fn(),
      endGeneration: vi.fn(),
      updateGeneration: vi.fn(),
      wrapStream: vi.fn(<T>(stream: T) => stream),
      startStep: vi.fn(),
      updateStep: vi.fn(),
    })),
    createChildSpan: vi.fn((options: any) =>
      createMockSpan(options?.type ?? 'child', spans, span, options?.isInternal ?? false),
    ),
    createEventSpan: vi.fn((options: any) => createMockSpan(options?.type ?? 'event', spans, span)),
    getCorrelationContext: vi.fn(),
    observabilityInstance: {} as any,
  };
  spans.push(span);
  return span;
}

describe('agent generate error tracing', () => {
  it('preserves the existing trace on provider failures without creating a wrapper span', async () => {
    const providerError = new Error('Provider rejected request');
    const model = new MockLanguageModelV2({
      modelId: 'failing-model',
      doGenerate: async () => {
        throw providerError;
      },
    });
    const agent = new Agent({
      id: 'failing-agent',
      name: 'Failing Agent',
      instructions: 'Fail the request',
      model,
    });
    const spans: any[] = [];
    const parentSpan = createMockSpan('parent', spans);

    let thrown: unknown;
    try {
      await agent.generate('trigger failure', { tracingContext: { currentSpan: parentSpan } });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(MastraError);
    expect(thrown).toMatchObject({
      id: 'AGENT_GENERATE_FAILED',
      details: { traceId: 'agent-trace-id', spanId: expect.any(String) },
    });
    expect((thrown as MastraError).cause).toBe(providerError);

    const agentSpans = spans.filter(span => span.type === 'agent_run');
    expect(agentSpans).toHaveLength(1);
    expect(agentSpans[0]).toMatchObject({ traceId: 'agent-trace-id', parent: parentSpan });
    expect(spans.filter(span => span.type === 'generic')).toHaveLength(0);
  });

  it('preserves the existing trace on legacy provider failures', async () => {
    const providerError = new Error('Legacy provider rejected request');
    const model = new MockLanguageModelV1({
      modelId: 'failing-legacy-model',
      doGenerate: async () => {
        throw providerError;
      },
    });
    const agent = new Agent({
      id: 'failing-legacy-agent',
      name: 'Failing Legacy Agent',
      instructions: 'Fail the request',
      model,
    });
    const spans: any[] = [];
    const parentSpan = createMockSpan('parent', spans);

    let thrown: unknown;
    try {
      await agent.generateLegacy('trigger failure', { tracingContext: { currentSpan: parentSpan } });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(MastraError);
    expect(thrown).toMatchObject({
      id: 'LLM_GENERATE_TEXT_AI_SDK_EXECUTION_FAILED',
      details: {
        modelId: 'failing-legacy-model',
        traceId: 'agent-trace-id',
        spanId: expect.any(String),
      },
    });
    expect((thrown as MastraError).cause).toBe(providerError);

    const agentSpans = spans.filter(span => span.type === 'agent_run');
    expect(agentSpans).toHaveLength(1);
    expect(agentSpans[0]).toMatchObject({ traceId: 'agent-trace-id', parent: parentSpan });
    expect(spans.filter(span => span.type === 'generic')).toHaveLength(0);
  });
});
