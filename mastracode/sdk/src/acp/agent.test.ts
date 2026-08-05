import type { AgentSideConnection, ContentBlock, PromptResponse } from '@agentclientprotocol/sdk';
import type {
  AgentController,
  AgentControllerEvent,
  AgentControllerMode,
  Session,
} from '@mastra/core/agent-controller';

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

    expect(extractTextFromContentBlocks(blocks)).toBe('Here is the content:\n[resource: file:///path/to/file.ts]');
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
      'Start\n[resource: file:///a.ts]\nMiddle\n[resource: file:///b.ts]\nEnd',
    );
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

  it('maps error to end_turn', () => {
    expect(mapStopReason('error')).toBe('end_turn');
  });

  it('maps suspended to end_turn', () => {
    expect(mapStopReason('suspended')).toBe('end_turn');
  });
});

describe('ACP Agent - Prompt concurrency', () => {
  it('serializes thread switching for concurrent prompts', async () => {
    let eventListener: ((event: AgentControllerEvent) => void) | undefined;
    const switchThread = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const session = {
      subscribe: vi.fn(listener => {
        eventListener = listener;
        return vi.fn();
      }),
      thread: {
        create: vi.fn().mockResolvedValueOnce({ id: 'thread-1' }).mockResolvedValueOnce({ id: 'thread-2' }),
        switch: switchThread,
      },
      mode: { get: vi.fn(() => 'default') },
      model: { get: vi.fn(() => 'test-model') },
      sendMessage,
    } as unknown as Session;
    const controller = {
      listAvailableModels: vi.fn().mockResolvedValue([]),
    } as unknown as AgentController;
    const connection = {
      sessionUpdate: vi.fn().mockResolvedValue(undefined),
    } as unknown as AgentSideConnection;

    const agent = new MastraCodeAcpAgent(connection, controller, session, [] satisfies AgentControllerMode[]);
    const { sessionId: firstSessionId } = await agent.newSession({ cwd: '/tmp', mcpServers: [] });
    const { sessionId: secondSessionId } = await agent.newSession({ cwd: '/tmp', mcpServers: [] });
    switchThread.mockClear();

    const firstPrompt = agent.prompt({
      sessionId: firstSessionId,
      prompt: [{ type: 'text', text: 'first' }],
    });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    const secondPrompt = agent.prompt({
      sessionId: secondSessionId,
      prompt: [{ type: 'text', text: 'second' }],
    });
    await Promise.resolve();

    expect(switchThread).toHaveBeenCalledTimes(1);
    expect(switchThread).toHaveBeenNthCalledWith(1, { threadId: 'thread-1' });

    eventListener?.({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
    await expect(firstPrompt).resolves.toMatchObject({ stopReason: 'end_turn' });

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(switchThread).toHaveBeenCalledTimes(2);
    expect(switchThread).toHaveBeenNthCalledWith(2, { threadId: 'thread-2' });

    eventListener?.({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
    await expect(secondPrompt).resolves.toMatchObject({ stopReason: 'end_turn' } satisfies Partial<PromptResponse>);
  });
});
