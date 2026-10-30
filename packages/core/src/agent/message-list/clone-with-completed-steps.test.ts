import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from './types';
import { MessageList } from './index';

const shape = (parts: MastraDBMessage['content']['parts']) =>
  parts.map(part => (part.type === 'text' ? { type: part.type, text: part.text } : { type: part.type }));

describe('MessageList.cloneWithCompletedSteps', () => {
  it('leaves the live list untouched when it cuts a step still in flight', () => {
    const list = new MessageList({ threadId: 't' });
    list.add(
      [
        {
          id: 'u1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
          createdAt: new Date(Date.now() - 1000),
        } as MastraDBMessage,
      ],
      'input',
    );
    list.add(
      [
        {
          id: 'a1',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'step-start' }, { type: 'text', text: 'done' }] },
          createdAt: new Date(Date.now() + 1000),
        } as MastraDBMessage,
      ],
      'response',
    );
    list.markStepCompleted();

    // The next step streams into the same message before the deadline.
    const live = list.get.response.db().find(m => m.id === 'a1')!;
    live.content.parts.push({ type: 'step-start' }, { type: 'text', text: 'pending' });
    live.content.content = 'pending';
    live.content.metadata = { structuredOutput: { answer: 1 } };

    const clone = list.cloneWithCompletedSteps();

    expect(shape(clone.get.response.db().find(m => m.id === 'a1')!.content.parts)).toEqual([
      { type: 'step-start' },
      { type: 'text', text: 'done' },
    ]);
    expect(shape(live.content.parts)).toEqual([
      { type: 'step-start' },
      { type: 'text', text: 'done' },
      { type: 'step-start' },
      { type: 'text', text: 'pending' },
    ]);
    expect(live.content.content).toBe('pending');
    expect(live.content.metadata).toEqual({ structuredOutput: { answer: 1 } });
  });

  it('keeps the structured output of a completed step when it cuts a later step', () => {
    const list = new MessageList({ threadId: 't' });
    list.add(
      [
        {
          id: 'a1',
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'step-start' }, { type: 'text', text: 'done' }],
            metadata: { structuredOutput: { answer: 1 } },
          },
          createdAt: new Date(),
        } as MastraDBMessage,
      ],
      'response',
    );
    list.markStepCompleted();

    const live = list.get.response.db().find(m => m.id === 'a1')!;
    live.content.parts.push({ type: 'step-start' }, { type: 'text', text: 'pending' });

    const clone = list.cloneWithCompletedSteps();

    expect(clone.get.response.db().find(m => m.id === 'a1')!.content.metadata).toEqual({
      structuredOutput: { answer: 1 },
    });
  });
});
