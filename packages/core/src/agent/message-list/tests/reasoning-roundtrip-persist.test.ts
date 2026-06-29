import type { ModelMessage as AIV5ModelMessage, UIMessage as AIV5UIMessage } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { AIV5Adapter } from '../adapters';
import type { MastraDBMessage } from '../index';

describe('reasoning text persist round-trip', () => {
  it('fromModelMessage → toUIMessage preserves reasoning text', () => {
    const modelMsg: AIV5ModelMessage = {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'Step 1: consider the problem' },
        { type: 'text', text: 'The answer is 42.' },
      ],
    };

    const dbMsg = AIV5Adapter.fromModelMessage(modelMsg);
    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const reasoningPart = uiMsg.parts.find(p => p.type === 'reasoning');
    expect(reasoningPart).toBeDefined();
    expect(reasoningPart!.text).toBe('Step 1: consider the problem');
  });

  it('fromUIMessage → toUIMessage preserves reasoning text', () => {
    const uiMsg: AIV5UIMessage = {
      id: 'msg-1',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'thinking about this' },
        { type: 'text', text: 'Here is my answer.' },
      ],
    };

    const dbMsg = AIV5Adapter.fromUIMessage(uiMsg);
    const restored = AIV5Adapter.toUIMessage(dbMsg);

    const reasoningPart = restored.parts.find(p => p.type === 'reasoning');
    expect(reasoningPart).toBeDefined();
    expect(reasoningPart!.text).toBe('thinking about this');
  });

  it('empty reasoning text does not crash', () => {
    const modelMsg: AIV5ModelMessage = {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: '' },
        { type: 'text', text: 'Done.' },
      ],
    };

    expect(() => {
      const dbMsg = AIV5Adapter.fromModelMessage(modelMsg);
      AIV5Adapter.toUIMessage(dbMsg);
    }).not.toThrow();
  });

  it('primary reasoning field takes precedence over details fallback', () => {
    const dbMsg: MastraDBMessage = {
      id: 'msg-direct',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'reasoning',
            reasoning: 'primary text',
            details: [{ type: 'text', text: 'fallback text' }],
          },
          { type: 'text', text: 'response' },
        ],
      },
      createdAt: new Date(),
      threadId: 'thread-1',
    };

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);
    const reasoningPart = uiMsg.parts.find(p => p.type === 'reasoning');
    expect(reasoningPart).toBeDefined();
    expect(reasoningPart!.text).toBe('primary text');
  });
});
