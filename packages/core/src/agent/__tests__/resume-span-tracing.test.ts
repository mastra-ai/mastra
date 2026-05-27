import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

describe('resumed AGENT_RUN span input and trace continuity', () => {
  let spanIdCounter = 0;

  function createFindUserTool() {
    return createTool({
      id: 'Find user tool',
      description: 'Returns the name and email of a user',
      inputSchema: z.object({ name: z.string() }),
      requireApproval: true,
      execute: async () => ({ name: 'Dero Israel', email: 'dero@mail.com' }),
    });
  }

  function createSuspendingUserTool() {
    return createTool({
      id: 'Find user tool',
      description: 'Returns the name and email of a user',
      inputSchema: z.object({ name: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ name: z.string() }),
      execute: async (_inputData, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ message: 'Please provide the name of the user' });
        }

        return {
          name: context.agent.resumeData.name,
          email: 'dero@mail.com',
        };
      },
    });
  }

  function createMockModel() {
    let callCount = 0;
    return new MockLanguageModelV2({
      doGenerate: async _options => {
        callCount++;
        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'findUserTool',
                input: '{"name":"Dero Israel"}',
              },
            ],
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text' as const, text: 'User found' }],
        };
      },
      doStream: async _options => {
        callCount++;
        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: '__GATEWAY_OPENAI_MODEL__', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'findUserTool',
                input: '{"name":"Dero Israel"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: '__GATEWAY_OPENAI_MODEL__', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'User found' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });
  }

  function createRegisteredAgent(findUserTool: any = createFindUserTool()) {
    const userAgent = new Agent({
      id: 'user-agent',
      name: 'User Agent',
      instructions: 'Find users.',
      model: createMockModel(),
      tools: { findUserTool },
    });

    const mastra = new Mastra({
      agents: { userAgent },
      logger: false,
      storage: new InMemoryStore(),
    });

    return mastra.getAgent('userAgent');
  }

  async function drainFullStream(output: { fullStream: AsyncIterable<unknown> }) {
    for await (const _chunk of output.fullStream) {
      void _chunk;
    }
  }

  function createMockSpan(type: string, parentSpan?: any) {
    spanIdCounter += 1;
    const span: Record<string, any> = {
      id: `mock-${type}-id-${spanIdCounter}`,
      traceId: 'mock-trace-id',
      name: type,
      type,
      startTime: new Date(),
      isInternal: false,
      isEvent: false,
      isValid: true,
      isRootSpan: !parentSpan,
      parent: parentSpan,

      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      exportSpan: vi.fn(),
      getParentSpanId: vi.fn(() => parentSpan?.id),
      findParent: vi.fn(),
      executeInContext: vi.fn(async (fn: () => Promise<any>) => fn()),
      executeInContextSync: vi.fn((fn: () => any) => fn()),
      get externalTraceId() {
        return 'mock-trace-id';
      },

      createTracker: vi.fn(() => ({
        getTracingContext: vi.fn(() => ({})),
        reportGenerationError: vi.fn(),
        endGeneration: vi.fn(),
        updateGeneration: vi.fn(),
        wrapStream: vi.fn(<T>(stream: T) => stream),
        startStep: vi.fn(),
      })),
      createChildSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'child', span)),
      createEventSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'event', span)),
      getCorrelationContext: vi.fn(),
      observabilityInstance: {} as any,
    };
    return span;
  }

  async function spyOnAgentRunSpans() {
    const agentRunCalls: any[] = [];
    const mod = await import('../../observability/utils');
    const spy = vi.spyOn(mod, 'getOrCreateSpan').mockImplementation((opts: any) => {
      const span = createMockSpan(opts.type ?? opts.name ?? 'unknown');
      if (opts.type === 'agent_run') {
        agentRunCalls.push(opts);
      }
      return span as any;
    });
    return { spy, agentRunCalls };
  }

  it('populates resumed AGENT_RUN span input with resumeData + tool info, and stitches to original trace', async () => {
    const { spy, agentRunCalls } = await spyOnAgentRunSpans();

    try {
      const agent = createRegisteredAgent();

      const stream = await agent.stream('Find Dero Israel', { requireToolApproval: true });

      let toolCallId = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
      }
      expect(toolCallId).toBeTruthy();

      const resumeStream = await agent.approveToolCall({ runId: stream.runId, toolCallId });
      await drainFullStream(resumeStream);

      expect(agentRunCalls.length).toBe(2);

      const initialCall = agentRunCalls[0];
      const resumedCall = agentRunCalls[1];

      expect(initialCall.name).toBe(`agent run: 'user-agent'`);
      expect(initialCall.metadata?.resumed).toBeUndefined();

      expect(resumedCall.name).toBe(`agent run: 'user-agent' (resumed)`);
      expect(resumedCall.metadata?.resumed).toBe(true);
      expect(resumedCall.metadata?.resumedFromSpanId).toBeTruthy();
      expect(resumedCall.input).toMatchObject({
        approved: true,
        toolName: 'findUserTool',
        toolCallId,
      });
      expect(resumedCall.tracingOptions?.traceId).toBe('mock-trace-id');
      expect(resumedCall.tracingOptions?.parentSpanId).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  }, 30000);

  it('caller-provided tracingOptions take precedence over persisted trace', async () => {
    const { spy, agentRunCalls } = await spyOnAgentRunSpans();

    try {
      const agent = createRegisteredAgent();

      const stream = await agent.stream('Find Dero Israel', { requireToolApproval: true });
      await drainFullStream(stream);

      const resumeStream = await agent.resumeStream(
        { approved: true },
        {
          runId: stream.runId,
          tracingOptions: { traceId: 'caller-trace-id', parentSpanId: 'caller-parent-span' },
        },
      );
      await drainFullStream(resumeStream);

      const resumedCall = agentRunCalls[1];
      expect(resumedCall.tracingOptions?.traceId).toBe('caller-trace-id');
      expect(resumedCall.tracingOptions?.parentSpanId).toBe('caller-parent-span');
    } finally {
      spy.mockRestore();
    }
  }, 30000);

  it('preserves generic resumeData as resumed AGENT_RUN span input', async () => {
    const { spy, agentRunCalls } = await spyOnAgentRunSpans();

    try {
      const agent = createRegisteredAgent(createSuspendingUserTool());

      const stream = await agent.stream('Find Dero Israel');

      let suspendedToolName = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-call-suspended') suspendedToolName = chunk.payload.toolName;
      }
      expect(suspendedToolName).toBe('findUserTool');

      const resumeData = { name: 'Dero Israel' };
      const resumeStream = await agent.resumeStream(resumeData, { runId: stream.runId });
      await drainFullStream(resumeStream);

      const resumedCall = agentRunCalls[1];
      expect(resumedCall.name).toBe(`agent run: 'user-agent' (resumed)`);
      expect(resumedCall.input).toMatchObject({
        ...resumeData,
        toolName: 'findUserTool',
      });
    } finally {
      spy.mockRestore();
    }
  }, 30000);

  it('populates resumed AGENT_RUN span input for declined generate approvals', async () => {
    const { spy, agentRunCalls } = await spyOnAgentRunSpans();

    try {
      const agent = createRegisteredAgent();

      const output = await agent.generate('Find Dero Israel', { requireToolApproval: true });
      expect(output.finishReason).toBe('suspended');
      expect(output.suspendPayload?.toolCallId).toBeTruthy();

      await agent.declineToolCallGenerate({ runId: output.runId!, toolCallId: output.suspendPayload!.toolCallId });

      expect(agentRunCalls.length).toBe(2);

      const resumedCall = agentRunCalls[1];
      expect(resumedCall.name).toBe(`agent run: 'user-agent' (resumed)`);
      expect(resumedCall.metadata?.resumed).toBe(true);
      expect(resumedCall.input).toMatchObject({
        approved: false,
        toolName: 'findUserTool',
        toolCallId: output.suspendPayload!.toolCallId,
      });
      expect(resumedCall.tracingOptions?.traceId).toBe('mock-trace-id');
      expect(resumedCall.tracingOptions?.parentSpanId).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  }, 30000);
});
