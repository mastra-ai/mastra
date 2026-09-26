import type { AgentSideConnection, ContentBlock } from '@agentclientprotocol/sdk';
import type { AgentController, AgentControllerEvent, Session } from '@mastra/core/agent-controller';

import { describe, it, expect, vi } from 'vitest';

import { MastraCodeAcpAgent, extractTextFromContentBlocks, mapStopReason } from './agent.js';

describe('ACP Agent - Text Extraction', () => {
  it('extracts text from text blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'text', text: 'Hello, world!' }];

    expect(extractTextFromContentBlocks(blocks)).toBe('Hello, world!');
  });

  it('concatenates multiple text blocks with newlines', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Line 1' },
      { type: 'text', text: 'Line 2' },
      { type: 'text', text: 'Line 3' },
    ];

    expect(extractTextFromContentBlocks(blocks)).toBe('Line 1\nLine 2\nLine 3');
  });

  it('handles resource_link blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Check this file:' },
      { type: 'resource_link', uri: 'file:///path/to/file.ts', name: 'file.ts' },
    ];

    expect(extractTextFromContentBlocks(blocks)).toBe('Check this file:\n[resource: file:///path/to/file.ts]');
  });

  it('handles resource blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Here is the content:' },
      {
        type: 'resource',
        resource: {
          uri: 'file:///path/to/file.ts',
          mimeType: 'text/plain',
          text: 'file content',
        },
      },
    ];

    expect(extractTextFromContentBlocks(blocks)).toBe(
      'Here is the content:\n[resource: file:///path/to/file.ts]\nfile content',
    );
  });

  it('handles mixed content blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Start' },
      { type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' },
      { type: 'text', text: 'Middle' },
      {
        type: 'resource',
        resource: {
          uri: 'file:///b.ts',
          mimeType: 'text/plain',
          text: 'content',
        },
      },
      { type: 'text', text: 'End' },
    ];

    expect(extractTextFromContentBlocks(blocks)).toBe(
      'Start\n[resource: file:///a.ts]\nMiddle\n[resource: file:///b.ts]\ncontent\nEnd',
    );
  });

  it.each<ContentBlock>([
    { type: 'image', data: 'AA==', mimeType: 'image/png' },
    { type: 'audio', data: 'AA==', mimeType: 'audio/wav' },
    { type: 'resource', resource: { uri: 'file:///binary', blob: 'AA==' } },
  ])('rejects unsupported content instead of silently discarding it: $type', block => {
    expect(() => extractTextFromContentBlocks([{ type: 'text', text: 'Keep this' }, block])).toThrow();
  });

  it('handles empty blocks array', () => {
    expect(extractTextFromContentBlocks([])).toBe('');
  });
});

describe('ACP Agent - StopReason Mapping', () => {
  it('maps complete to end_turn', () => {
    expect(mapStopReason('complete')).toBe('end_turn');
  });

  it('maps aborted to cancelled', () => {
    expect(mapStopReason('aborted')).toBe('cancelled');
  });

  it('does not map failure to a successful stop reason', () => {
    expect(() => mapStopReason('error')).toThrow();
  });

  it('maps suspended to end_turn', () => {
    expect(mapStopReason('suspended')).toBe('end_turn');
  });
});

describe('ACP Agent - Turn failures and cancellation', () => {
  function setup() {
    let listener: (event: AgentControllerEvent) => void = () => {};
    let nextThreadId = 0;
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const abort = vi.fn();
    const session = {
      subscribe: (callback: typeof listener) => {
        listener = callback;
        return () => {};
      },
      thread: {
        create: async () => ({ id: `thread-${++nextThreadId}` }),
        switch: async () => {},
      },
      mode: { get: () => 'default' },
      model: { get: () => 'test-model' },
      sendMessage,
      abort,
    } as unknown as Session;
    const agent = new MastraCodeAcpAgent(
      { sessionUpdate: vi.fn().mockResolvedValue(undefined) } as unknown as AgentSideConnection,
      async () => ({
        controller: { listAvailableModels: async () => [] } as unknown as AgentController,
        session,
        modes: [],
      }),
    );
    return { agent, sendMessage, abort, emit: (event: AgentControllerEvent) => listener(event) };
  }

  it('rejects a failed turn with its error and allows the next prompt to succeed', async () => {
    const { agent, emit, sendMessage } = setup();
    const { sessionId } = await agent.newSession({ cwd: '/tmp', mcpServers: [] });
    sendMessage.mockImplementationOnce(async () => {
      emit({ type: 'error', error: new Error('Provider authentication failed') });
      emit({ type: 'agent_end', reason: 'error' });
    });
    await expect(agent.prompt({ sessionId, prompt: [{ type: 'text', text: 'Hello' }] })).rejects.toMatchObject({
      code: -32603,
      message: expect.stringContaining('Provider authentication failed'),
    });
    sendMessage.mockImplementationOnce(async () => emit({ type: 'agent_end', reason: 'complete' }));
    await expect(agent.prompt({ sessionId, prompt: [{ type: 'text', text: 'Try again' }] })).resolves.toMatchObject({
      stopReason: 'end_turn',
    });
  });

  it('reports failure even when agent_end has no preceding error event', async () => {
    const { agent, emit, sendMessage } = setup();
    const { sessionId } = await agent.newSession({ cwd: '/tmp', mcpServers: [] });
    sendMessage.mockImplementationOnce(async () => emit({ type: 'agent_end', reason: 'error' }));
    await expect(agent.prompt({ sessionId, prompt: [] })).rejects.toMatchObject({ code: -32603 });
  });

  it('does not fail a turn that recovers from a retryable error', async () => {
    const { agent, emit, sendMessage } = setup();
    const { sessionId } = await agent.newSession({ cwd: '/tmp', mcpServers: [] });
    sendMessage.mockImplementationOnce(async () => {
      emit({ type: 'error', error: new Error('Retrying'), retryable: true });
      emit({ type: 'agent_end', reason: 'complete' });
    });
    await expect(agent.prompt({ sessionId, prompt: [] })).resolves.toMatchObject({ stopReason: 'end_turn' });
  });

  it('does not abort another session when an unknown session is cancelled', async () => {
    const { agent, emit, sendMessage, abort } = setup();
    const first = await agent.newSession({ cwd: '/tmp', mcpServers: [] });
    const prompt = agent.prompt({ sessionId: first.sessionId, prompt: [] });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    await agent.cancel({ sessionId: 'unknown' });
    expect(abort).not.toHaveBeenCalled();
    await agent.cancel({ sessionId: first.sessionId });
    expect(abort).toHaveBeenCalledTimes(1);
    emit({ type: 'agent_end', reason: 'aborted' });
    await expect(prompt).resolves.toMatchObject({ stopReason: 'cancelled' });
    await agent.cancel({ sessionId: first.sessionId });
    expect(abort).toHaveBeenCalledTimes(1);
  });
});
