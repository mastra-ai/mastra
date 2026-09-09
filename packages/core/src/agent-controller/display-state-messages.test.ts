import { expect, it } from 'vitest';
import type { MastraDBMessage } from '../agent';
import { createTestSession } from './test-utils';

it('retains the input and each reply fragment in run order without duplicate updates', async () => {
  const { session } = await createTestSession();
  const prompt: MastraDBMessage = {
    id: 'prompt',
    role: 'signal',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: 'Review this PR' }] },
  };
  const reply: MastraDBMessage = {
    ...prompt,
    id: 'reply',
    role: 'assistant',
    content: { format: 2, parts: [{ type: 'text', text: 'Checking out' }] },
  };
  session.emit({ type: 'agent_start' });
  session.emit({ type: 'message_start', message: prompt });
  session.emit({ type: 'message_end', message: prompt });
  session.emit({ type: 'message_start', message: reply });
  session.emit({ type: 'message_update', message: reply });
  expect(session.displayState.get().messages).toEqual([
    { message: prompt, streaming: false },
    { message: reply, streaming: true },
  ]);
  session.emit({ type: 'message_end', message: reply });
  expect(session.displayState.get().messages?.every(entry => !entry.streaming)).toBe(true);
  session.emit({ type: 'agent_end', reason: 'complete' });
  expect(session.displayState.get().messages).toHaveLength(2);
  session.emit({ type: 'agent_start' });
  expect(session.displayState.get().messages).toEqual([]);
});

it('settles interrupted messages and clears them when switching threads', async () => {
  const { session } = await createTestSession();
  session.emit({ type: 'agent_start' });
  session.emit({
    type: 'message_update',
    message: { id: 'reply', role: 'assistant', createdAt: new Date(), content: { format: 2, parts: [] } },
  });
  session.emit({ type: 'agent_end', reason: 'aborted' });
  expect(session.displayState.get().messages?.[0]?.streaming).toBe(false);
  session.displayState.resetThread();
  expect(session.displayState.get().messages).toEqual([]);
});
