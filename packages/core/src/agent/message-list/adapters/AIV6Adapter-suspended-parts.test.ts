import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';
import type { MastraDBMessage } from '../state/types';
import { AIV6Adapter } from './AIV6Adapter';

const suspendedTool = {
  toolCallId: 'tc-1',
  toolName: 'waitForInput',
  args: { question: 'Continue?' },
  type: 'suspension',
  runId: 'run-1',
  suspendPayload: { question: 'Continue?' },
  resumeSchema: '{"type":"object"}',
};

function createMessage(extraParts: MastraDBMessage['content']['parts'] = [], withMetadata = true): MastraDBMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date('2024-01-01'),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'tc-1',
            toolName: 'waitForInput',
            args: { question: 'Continue?' },
            state: 'call',
          },
        },
        { type: 'text', text: 'Waiting for input.' },
        ...extraParts,
      ],
      ...(withMetadata ? { metadata: { suspendedTools: { waitForInput: suspendedTool } } } : {}),
    },
  };
}

describe('AIV6Adapter — suspended tool state rehydration', () => {
  it('synthesizes data-tool-call-suspended from metadata.suspendedTools after the tool part', () => {
    const uiMessage = AIV6Adapter.toUIMessage(createMessage());
    const types = uiMessage.parts.map(p => p.type);

    const suspended = uiMessage.parts.filter(p => p.type === 'data-tool-call-suspended');
    expect(suspended).toHaveLength(1);
    expect(suspended[0]).toMatchObject({
      data: {
        toolCallId: 'tc-1',
        toolName: 'waitForInput',
        runId: 'run-1',
        suspendPayload: { question: 'Continue?' },
        resumeSchema: '{"type":"object"}',
      },
    });
    const toolIndex = types.findIndex(t => t.startsWith('tool-') || t === 'dynamic-tool');
    expect(types[toolIndex + 1]).toBe('data-tool-call-suspended');
  });

  it('does not duplicate a persisted data-tool-call-suspended part', () => {
    const uiMessage = AIV6Adapter.toUIMessage(
      createMessage([{ type: 'data-tool-call-suspended', data: suspendedTool } as any]),
    );
    expect(uiMessage.parts.filter(p => p.type === 'data-tool-call-suspended')).toHaveLength(1);
  });

  it('adds no data part when there are no suspended tools', () => {
    const uiMessage = AIV6Adapter.toUIMessage(createMessage([], false));
    expect(uiMessage.parts.some(p => p.type.startsWith('data-'))).toBe(false);
  });

  it('includes the part in MessageList v6 and v7 UI output', () => {
    const list = new MessageList().add(createMessage(), 'memory');
    for (const messages of [list.get.all.aiV6.ui(), list.get.all.aiV7.ui()]) {
      expect(messages[0]!.parts.filter(p => p.type === 'data-tool-call-suspended')).toHaveLength(1);
    }
  });
});
