import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../state/types';
import { AIV5Adapter } from './AIV5Adapter';

/**
 * Regression coverage for issue #16017.
 *
 * When a tool-result arrives in a model message that does not also contain its
 * matching tool-call (the server `resumeStream` path, or an AG-UI host replaying
 * a tool-result on its own), `fromModelMessage` used to fabricate `args: {}`.
 * Persisting empty args poisons the LLM via in-context learning. The adapter now
 * recovers the original args from prior persisted messages.
 */
describe('AIV5Adapter tool-result arg recovery (issue #16017)', () => {
  const priorAssistantMessage = {
    id: 'msg-call',
    role: 'assistant',
    createdAt: new Date(),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call-1',
            toolName: 'buildSlide',
            args: { slideIndex: 0, title: 'Intro' },
          },
        },
      ],
    },
  } as unknown as MastraDBMessage;

  it('recovers args from prior persisted messages for an orphan tool-result', () => {
    const dbMessage = AIV5Adapter.fromModelMessage(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'buildSlide',
            output: { type: 'json', value: { ok: true } },
          },
        ],
      },
      undefined,
      { dbMessages: [priorAssistantMessage] },
    );

    expect(dbMessage.content.toolInvocations?.[0]?.args).toEqual({ slideIndex: 0, title: 'Intro' });

    const toolPart = dbMessage.content.parts?.find(
      part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-1',
    );
    expect(toolPart?.type).toBe('tool-invocation');
    if (toolPart?.type === 'tool-invocation') {
      expect(toolPart.toolInvocation.args).toEqual({ slideIndex: 0, title: 'Intro' });
    }
  });

  it('falls back to the tool-result input field when no prior message has args', () => {
    const dbMessage = AIV5Adapter.fromModelMessage(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'buildSlide',
            input: { slideIndex: 1 },
            output: { type: 'json', value: { ok: true } },
          } as never,
        ],
      },
      undefined,
      { dbMessages: [priorAssistantMessage] },
    );

    expect(dbMessage.content.toolInvocations?.[0]?.args).toEqual({ slideIndex: 1 });
  });

  it('falls back to empty args when neither prior messages nor input are available', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-3',
          toolName: 'buildSlide',
          output: { type: 'json', value: { ok: true } },
        },
      ],
    });

    expect(dbMessage.content.toolInvocations?.[0]?.args).toEqual({});
  });
});
