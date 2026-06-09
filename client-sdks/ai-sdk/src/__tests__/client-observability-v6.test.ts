/**
 * Integration tests for client-side tool observability through handleChatStream (v6).
 *
 * Request 1: agent stream emits a client tool call with a W3C carrier →
 *   handleChatStream must surface tool-input-available.toolMetadata.__mastraObservability.
 *
 * Request 2: client returns tool output with buffered OTLP in toolMetadata →
 *   Agent must forward payload to ClientObservabilityProxy.receive and strip metadata.
 */
import type { UIMessage } from '@internal/ai-v6';
import { convertArrayToReadableStream, MockLanguageModelV3 } from '@internal/ai-v6/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { ChunkFrom } from '@mastra/core/stream';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { handleChatStream } from '../chat-route';

async function collectStreamChunks(stream: ReadableStream): Promise<any[]> {
  const chunks: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe('handleChatStream v6 client observability', () => {
  it('streams toolMetadata.__mastraObservability on tool-input-available', async () => {
    const carrier = {
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
    };

    const mockAgent = {
      stream: vi.fn().mockResolvedValue({
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'start',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: { messageId: 'msg-assistant-1' },
            });
            controller.enqueue({
              type: 'tool-call',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'get_clipboard',
                args: {},
                observability: carrier,
              },
            });
            controller.enqueue({
              type: 'finish',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                stepResult: { reason: 'tool-calls' },
                output: {
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              },
            });
            controller.close();
          },
        }),
      }),
    };

    const mockMastra = {
      getAgentById: vi.fn().mockReturnValue(mockAgent),
    };

    const stream = await handleChatStream({
      mastra: mockMastra as any,
      agentId: 'test-agent',
      version: 'v6',
      params: {
        messages: [
          {
            id: 'user-1',
            role: 'user',
            parts: [{ type: 'text', text: 'read clipboard' }],
          },
        ],
      } as any,
    });

    const chunks = await collectStreamChunks(stream);
    const toolInputAvailable = chunks.find(c => c.type === 'tool-input-available');

    expect(toolInputAvailable).toMatchObject({
      type: 'tool-input-available',
      toolCallId: 'call-1',
      toolName: 'get_clipboard',
      toolMetadata: {
        __mastraObservability: carrier,
      },
    });
  });

  it('receives client observability payload on continuation through handleChatStream', async () => {
    const receive = vi.fn();
    const carrier = {
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
    };
    const payload = {
      spans: [{ name: 'client-span' }],
      executionDurationMs: 8,
      toolName: 'get_clipboard',
    };

    let callCount = 0;
    const model = new MockLanguageModelV3({
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date() },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-clipboard-1',
                toolName: 'get_clipboard',
                args: '{}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ] as any),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        }

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ] as any),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      },
    });

    const clipboardTool = createTool({
      id: 'get_clipboard',
      description: 'Gets clipboard contents',
      inputSchema: z.object({}),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Use get_clipboard when asked.',
      model,
      tools: { get_clipboard: clipboardTool },
    });

    const mastra = new Mastra({
      logger: false,
      observability: {
        getDefaultInstance: () => undefined,
        getSelectedInstance: () => undefined,
        setLogger: () => undefined,
        setMastraContext: () => undefined,
        getClientObservabilityProxy: () => ({
          inject: () => carrier,
          receive,
        }),
      } as any,
      agents: { 'test-agent': agent },
    });

    const userMessage = {
      id: 'user-1',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'read clipboard' }],
    };

    const stream1 = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      version: 'v6',
      params: { messages: [userMessage] },
    });
    const chunks1 = await collectStreamChunks(stream1);
    const startChunk = chunks1.find(c => c.type === 'start');
    expect(startChunk?.messageId).toBeDefined();

    const continuationMessages: UIMessage[] = [
      userMessage,
      {
        id: startChunk!.messageId!,
        role: 'assistant',
        parts: [
          {
            type: 'tool-get_clipboard',
            toolCallId: 'call-clipboard-1',
            state: 'output-available',
            input: {},
            output: 'clipboard text',
            toolMetadata: {
              __mastraObservability: {
                parentContext: carrier,
                payload,
              },
            },
          } as any,
        ],
      },
    ];

    const stream2 = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      version: 'v6',
      params: { messages: continuationMessages },
    });
    await collectStreamChunks(stream2);

    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith(payload, carrier);
    expect(continuationMessages[1]!.parts[0]).toMatchObject({
      toolMetadata: {},
    });
    expect(
      (continuationMessages[1]!.parts[0] as { toolMetadata?: { __mastraObservability?: unknown } }).toolMetadata
        ?.__mastraObservability,
    ).toBeUndefined();
  });
});
