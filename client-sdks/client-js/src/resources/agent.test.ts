import type { UIMessage } from '@ai-sdk/ui-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientOptions } from '../types';
import { Agent } from './agent';

// Mock fetch globally (following existing Mastra test patterns)
global.fetch = vi.fn();

describe('Agent onFinish callback', () => {
  let agent: Agent;
  const clientOptions: ClientOptions = {
    baseUrl: 'http://localhost:3000',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new Agent(clientOptions, 'test-agent');
  });

  const mockStreamResponse = (streamContent: string) => {
    const stream = new ReadableStream({
      start(controller) {
        const chunks = streamContent.split('\n').filter(chunk => chunk);
        chunks.forEach(chunk => {
          controller.enqueue(new TextEncoder().encode(chunk + '\n'));
        });
        controller.close();
      },
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: stream,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
    });
  };

  it('should invoke onFinish callback when provided to processDataStream', async () => {
    const streamContent =
      '0:"Hello"\n' +
      '0:" from"\n' +
      '0:" agent"\n' +
      'd:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":3}}\n';

    mockStreamResponse(streamContent);

    const onFinishSpy = vi.fn();
    let receivedMessage: UIMessage | undefined;
    let receivedFinishReason: string | undefined;
    let receivedUsage: unknown;

    const textSpy = vi.fn((_text: string) => {
      // This will receive text chunks during streaming
    });

    // Call the stream method
    const streamResponse = await agent.stream({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    // Call processDataStream with onFinish callback
    await streamResponse.processDataStream({
      onTextPart: textSpy,
      onFinish: ({ message, finishReason, usage }) => {
        onFinishSpy();
        receivedMessage = message;
        receivedFinishReason = finishReason;
        receivedUsage = usage;
      },
    });

    // Verify onFinish was called
    expect(onFinishSpy).toHaveBeenCalledTimes(1);

    // Verify the callback received proper data
    expect(receivedMessage).toBeDefined();
    expect(receivedMessage?.content).toBe('Hello from agent');
    expect(receivedFinishReason).toBe('stop');
    expect(receivedUsage).toEqual({
      promptTokens: 10,
      completionTokens: 3,
    });
  });

  it('should work without onFinish callback (backward compatibility)', async () => {
    const streamContent = '0:"Hello"\n0:" test"\n';
    mockStreamResponse(streamContent);

    const textSpy = vi.fn();

    // Call the stream method
    const streamResponse = await agent.stream({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    // Call processDataStream without onFinish callback
    await expect(
      streamResponse.processDataStream({
        onTextPart: textSpy,
      }),
    ).resolves.not.toThrow();

    // Verify text processing was called (basic functionality still works)
    expect(textSpy).toHaveBeenCalled();
  });

  it('should handle errors gracefully in onFinish processing', async () => {
    const streamContent = '0:"Error test"\nd:{"finishReason":"stop","usage":{"promptTokens":5,"completionTokens":1}}\n';
    mockStreamResponse(streamContent);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onFinishSpy = vi.fn(() => {
      throw new Error('Test error');
    });

    const textSpy = vi.fn();

    // Call the stream method
    const streamResponse = await agent.stream({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    // Call processDataStream with failing onFinish callback
    await expect(
      streamResponse.processDataStream({
        onTextPart: textSpy,
        onFinish: onFinishSpy,
      }),
    ).resolves.not.toThrow();

    // Verify error was logged but didn't break the stream processing
    expect(consoleSpy).toHaveBeenCalledWith('Error in onFinish processing:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});
