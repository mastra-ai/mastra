import { ChunkFrom } from '@mastra/core/stream';
import { describe, expect, it, vi } from 'vitest';

import { chatRoute, handleChatStream } from '../chat-route';
import { APPROVAL_ID_SEPARATOR } from '../helpers';

/** Regression coverage for https://github.com/mastra-ai/mastra/issues/25955. */

function createSupervisorStream() {
  const chunks = [
    { type: 'start', runId: 'outer-run', from: ChunkFrom.AGENT, payload: { id: 'message-1' } },
    {
      type: 'tool-output',
      runId: 'outer-run',
      from: ChunkFrom.USER,
      payload: {
        toolCallId: 'call-helper',
        toolName: 'agent-helper',
        output: {
          type: 'text-delta',
          runId: 'inner-run',
          from: ChunkFrom.AGENT,
          payload: { id: 'text-1', text: 'sub-agent says hi' },
        },
      },
    },
    {
      type: 'tool-output',
      runId: 'outer-run',
      from: ChunkFrom.USER,
      payload: {
        toolCallId: 'call-helper',
        toolName: 'agent-helper',
        output: {
          type: 'step-finish',
          runId: 'inner-run',
          from: ChunkFrom.AGENT,
          payload: {
            id: 'step-1',
            stepResult: { reason: 'stop', warnings: [] },
            output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            metadata: {},
          },
        },
      },
    },
    {
      type: 'finish',
      runId: 'outer-run',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: { reason: 'stop' },
        output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      },
    },
  ];

  return {
    fullStream: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  };
}

function createMastra() {
  const agent = {
    stream: vi.fn().mockImplementation(async () => createSupervisorStream()),
    resumeStream: vi.fn().mockImplementation(async () => createSupervisorStream()),
  };
  return { agent, mastra: { getAgentById: vi.fn().mockReturnValue(agent) } };
}

const userMessages = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];

const approvalMessages = [
  ...userMessages,
  {
    id: 'assistant-1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-myTool',
        toolCallId: 'tooluse-1',
        state: 'approval-responded',
        input: {},
        approval: { id: `run-1${APPROVAL_ID_SEPARATOR}tooluse-1`, approved: true },
      },
    ],
  },
];

async function collectParts(stream: ReadableStream<any>) {
  const parts: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return parts;
}

function countAgentParts(parts: any[]) {
  return parts.filter(part => part.type === 'data-tool-agent').length;
}

function countAgentStepParts(parts: any[]) {
  return parts.filter(part => part.type === 'data-tool-agent-step').length;
}

describe('handleChatStream sub-agent metadata', () => {
  it.each(['v5', 'v6', 'v7'] as const)('emits data-tool-agent parts by default (%s)', async version => {
    const { mastra } = createMastra();
    const stream = await handleChatStream({
      mastra: mastra as any,
      agentId: 'supervisor',
      version: version as any,
      params: { messages: userMessages as any },
    });

    const parts = await collectParts(stream as ReadableStream<any>);
    const agentParts = parts.filter(part => part.type === 'data-tool-agent');
    expect(agentParts.length).toBeGreaterThan(0);
    expect(agentParts.at(-1)).toMatchObject({ id: 'inner-run', data: { text: 'sub-agent says hi' } });
    expect(countAgentStepParts(parts)).toBe(1);
  });

  it.each(['v5', 'v6', 'v7'] as const)('omits data-tool-agent parts when opted out (%s)', async version => {
    const { mastra } = createMastra();
    const stream = await handleChatStream({
      mastra: mastra as any,
      agentId: 'supervisor',
      version: version as any,
      includeSubAgentMetadata: false,
      params: { messages: userMessages as any },
    });

    const parts = await collectParts(stream as ReadableStream<any>);
    expect(countAgentParts(parts)).toBe(0);
    expect(countAgentStepParts(parts)).toBe(0);
  });

  it.each(['v6', 'v7'] as const)('emits data-tool-agent parts on the %s approval-resume path', async version => {
    const { mastra, agent } = createMastra();
    const stream = await handleChatStream({
      mastra: mastra as any,
      agentId: 'supervisor',
      version,
      params: { messages: approvalMessages as any },
    });

    const parts = await collectParts(stream as ReadableStream<any>);
    expect(agent.resumeStream).toHaveBeenCalledTimes(1);
    expect(countAgentParts(parts)).toBeGreaterThan(0);
    expect(countAgentStepParts(parts)).toBe(1);
  });
});

describe('chatRoute sub-agent metadata', () => {
  async function invokeRoute(route: ReturnType<typeof chatRoute>) {
    const { mastra } = createMastra();
    const body = { messages: userMessages };
    const context = {
      req: {
        raw: new Request('http://localhost/chat/supervisor', { method: 'POST', body: JSON.stringify(body) }),
        json: () => Promise.resolve(body),
        param: (name: string) => (name === 'agentId' ? 'supervisor' : undefined),
        query: () => undefined,
      },
      get: (key: string) => (key === 'mastra' ? mastra : undefined),
    };
    if (!('handler' in route)) throw new Error('Expected chatRoute to return a route handler');
    const response = await route.handler(context as never, async () => {});
    if (!(response instanceof Response)) throw new Error('Expected a Response');
    return response.text();
  }

  it.each(['v5', 'v6', 'v7'] as const)('streams data-tool-agent parts by default (%s)', async version => {
    const body = await invokeRoute(chatRoute({ path: '/chat/:agentId', version }));
    expect(body).toContain('"type":"data-tool-agent"');
    expect(body).toContain('"type":"data-tool-agent-step"');
  });

  it('omits data-tool-agent parts when opted out', async () => {
    const body = await invokeRoute(chatRoute({ path: '/chat/:agentId', includeSubAgentMetadata: false }));
    expect(body).not.toContain('"type":"data-tool-agent"');
    expect(body).not.toContain('"type":"data-tool-agent-step"');
  });
});
