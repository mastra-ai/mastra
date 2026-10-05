/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/25955.
 *
 * `handleChatStream` and `chatRoute` must emit `data-tool-agent` parts for
 * sub-agents by default and forward `includeSubAgentMetadata` to every
 * `toAISdkStream` call, including the v6/v7 approval-resume path.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it } from 'vitest';

import { chatRoute, handleChatStream } from '../chat-route';
import { toAISdkStream } from '../convert-streams';
import { APPROVAL_ID_SEPARATOR } from '../helpers';

const messages = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Delegate this' }] }];

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** A coordinator that delegates once to `helper`, then answers. */
function createMastra() {
  const helper = new Agent({
    id: 'helper',
    name: 'Helper',
    description: 'Answers delegated questions.',
    instructions: 'Answer briefly.',
    model: new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'helper-1', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Helper answer' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage },
        ] as any),
      }),
    }),
  });

  let coordinatorCalls = 0;
  const coordinator = new Agent({
    id: 'coordinator',
    name: 'Coordinator',
    instructions: 'Delegate to the helper.',
    model: new MockLanguageModelV2({
      doStream: async () => {
        coordinatorCalls++;
        const parts =
          coordinatorCalls === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'coord-1', modelId: 'mock-model', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'call-helper',
                  toolName: 'agent-helper',
                  input: '{"prompt":"help"}',
                  providerExecuted: false,
                },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'coord-2', modelId: 'mock-model', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Done' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage },
              ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream(parts as any),
        };
      },
    }),
    agents: { helper },
  });

  return new Mastra({ agents: { coordinator }, logger: false });
}

async function collect(stream: ReadableStream) {
  const chunks: any[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }
  return chunks;
}

const countSubAgentParts = (chunks: any[]) => chunks.filter(chunk => chunk.type === 'data-tool-agent').length;

describe('handleChatStream includeSubAgentMetadata (issue #25955)', () => {
  it.each(['v5', 'v6', 'v7'] as const)('emits data-tool-agent parts by default (%s)', async version => {
    const chunks = await collect(
      await handleChatStream({
        mastra: createMastra(),
        agentId: 'coordinator',
        params: { messages } as any,
        version,
      }),
    );

    expect(countSubAgentParts(chunks)).toBeGreaterThan(0);
  });

  it.each(['v5', 'v6', 'v7'] as const)(
    'omits data-tool-agent parts when includeSubAgentMetadata is false (%s)',
    async version => {
      const chunks = await collect(
        await handleChatStream({
          mastra: createMastra(),
          agentId: 'coordinator',
          params: { messages } as any,
          version,
          includeSubAgentMetadata: false,
        }),
      );

      expect(countSubAgentParts(chunks)).toBe(0);
      // The delegation itself is still streamed as a regular tool call.
      expect(chunks.some(chunk => chunk.type === 'tool-input-available' && chunk.toolName === 'agent-helper')).toBe(
        true,
      );
    },
  );

  it('keeps toAISdkStream opt-in', async () => {
    const result = await createMastra()
      .getAgentById('coordinator')
      .stream(messages as any);
    const chunks = await collect(toAISdkStream(result, { from: 'agent' }) as any);

    expect(countSubAgentParts(chunks)).toBe(0);
  });

  it.each([true, false])('forwards includeSubAgentMetadata=%s on the v6/v7 approval-resume path', async include => {
    const approvalMessages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'call-1',
            state: 'approval-responded',
            input: {},
            approval: { id: `run-1${APPROVAL_ID_SEPARATOR}call-1`, approved: true },
          },
        ],
      },
    ];

    for (const version of ['v6', 'v7'] as const) {
      // The resumed run is a real delegation, so its nested chunks go through the converter.
      const coordinator = createMastra().getAgentById('coordinator');
      const agent = { resumeStream: async () => coordinator.stream(messages as any) };

      const chunks = await collect(
        await handleChatStream({
          mastra: { getAgentById: () => agent } as any,
          agentId: 'coordinator',
          params: { messages: approvalMessages } as any,
          version,
          includeSubAgentMetadata: include,
        }),
      );

      expect(countSubAgentParts(chunks) > 0).toBe(include);
    }
  });
});

describe('chatRoute includeSubAgentMetadata (issue #25955)', () => {
  async function invokeRoute(route: ReturnType<typeof chatRoute>) {
    const body = { messages };
    const mastra = createMastra();
    const context = {
      req: {
        raw: new Request('http://localhost/chat/coordinator', { method: 'POST', body: JSON.stringify(body) }),
        json: () => Promise.resolve(body),
        param: (name: string) => (name === 'agentId' ? 'coordinator' : undefined),
        query: () => undefined,
      },
      get: (key: string) => (key === 'mastra' ? mastra : undefined),
    };
    if (!('handler' in route)) throw new Error('Expected chatRoute to return a route handler');
    const response = await route.handler(context as never, async () => {});
    if (!(response instanceof Response)) throw new Error('Expected chatRoute handler to return a Response');
    return response.text();
  }

  it.each(['v5', 'v6', 'v7'] as const)('emits data-tool-agent parts by default (%s)', async version => {
    const body = await invokeRoute(chatRoute({ path: '/chat/:agentId', version }));

    expect(body).toContain('"type":"data-tool-agent"');
  });

  it.each(['v5', 'v6', 'v7'] as const)(
    'omits data-tool-agent parts when includeSubAgentMetadata is false (%s)',
    async version => {
      const body = await invokeRoute(chatRoute({ path: '/chat/:agentId', version, includeSubAgentMetadata: false }));

      expect(body).not.toContain('"type":"data-tool-agent"');
      expect(body).toContain('agent-helper');
    },
  );
});
