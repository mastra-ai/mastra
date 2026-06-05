import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../memory';
import { createSignal } from '../../signals';
import { MessageList } from '../index';

const threadId = 'om-thread';
const resourceId = 'om-user';

/**
 * ObservationalMemory step > 0 clears response DB, persists, then re-adds as memory.
 * Step-2 assistant text merges into the same assistant message and must move back to
 * the response source exclusively so later clears / persistence see merged content.
 */
describe('MessageList — OM multi-step source handoff', () => {
  it('removes memory source when merged assistant content is promoted to response', () => {
    const assistantId = 'asst-om-1';
    const originalCreatedAt = new Date(1);
    const step1: MastraDBMessage = {
      id: assistantId,
      role: 'assistant',
      type: 'text',
      createdAt: originalCreatedAt,
      threadId,
      resourceId,
      content: {
        format: 2,
        parts: [
          { type: 'step-start' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tc-1', toolName: 'noop', args: {} },
          },
        ],
      },
    };

    const list = new MessageList({ threadId, resourceId });
    list.add(step1, 'response');

    const cleared = list.clear.response.db();
    expect(cleared).toHaveLength(1);
    for (const m of cleared) {
      list.add(m, 'memory');
    }

    const step2Merge: MastraDBMessage = {
      id: assistantId,
      role: 'assistant',
      type: 'text',
      createdAt: new Date(2),
      threadId,
      resourceId,
      content: {
        format: 2,
        parts: [
          { type: 'step-start' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tc-1',
              toolName: 'noop',
              args: {},
              result: { ok: true },
            },
          },
          { type: 'text', text: 'Done.' },
        ],
      },
    };

    list.add(step2Merge, 'response');

    const responseDb = list.get.response.db();
    expect(responseDb).toHaveLength(1);
    expect(responseDb[0]!.id).toBe(assistantId);
    expect(responseDb[0]!.createdAt).toEqual(originalCreatedAt);
    expect(responseDb[0]!.content.parts?.some(p => p.type === 'text' && p.text === 'Done.')).toBe(true);

    // Must not still be tracked as a memory-only row for the same object identity
    expect(list.get.remembered.db().some(m => m.id === assistantId)).toBe(false);

    const secondClear = list.clear.response.db();
    expect(secondClear).toHaveLength(1);
    expect(secondClear[0]!.content.parts?.some(p => p.type === 'text' && p.text === 'Done.')).toBe(true);
  });

  it('does not let promoted memory part timestamps advance signal timestamps', () => {
    const now = Date.now();
    const assistantId = 'asst-om-late-part';
    const messageCreatedAt = new Date(now);
    const latePartCreatedAt = now + 30_000;

    const list = new MessageList({ threadId, resourceId });
    list.add(
      {
        id: assistantId,
        role: 'assistant',
        type: 'text',
        createdAt: messageCreatedAt,
        threadId,
        resourceId,
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Observed response start' },
            {
              type: 'tool-invocation',
              createdAt: latePartCreatedAt,
              toolInvocation: { state: 'call', toolCallId: 'tc-late', toolName: 'noop', args: {} },
            },
          ],
        },
      },
      'memory',
    );

    list.add(
      {
        id: assistantId,
        role: 'assistant',
        type: 'text',
        createdAt: new Date(now + 2_000),
        threadId,
        resourceId,
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'tc-late',
                toolName: 'noop',
                args: {},
                result: { ok: true },
              },
            },
            { type: 'text', text: 'Observed response complete' },
          ],
        },
      },
      'response',
    );

    const signalForTranscript = list.addSignal(
      createSignal({
        id: 'next-signal',
        type: 'user-message',
        contents: 'Next signal',
        createdAt: new Date(now + 3_000),
      }),
    );

    expect(signalForTranscript.createdAt.getTime()).toBeLessThan(latePartCreatedAt);
  });
});
