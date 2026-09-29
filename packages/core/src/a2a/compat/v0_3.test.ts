import { describe, expect, it } from 'vitest';
import { v0_3Compat } from './v0_3';

describe('v0_3Compat', () => {
  it('creates v0.3 message and task requests', () => {
    expect(v0_3Compat.methods).toEqual({
      sendMessage: 'message/send',
      streamMessage: 'message/stream',
      getTask: 'tasks/get',
      resubscribeTask: 'tasks/resubscribe',
    });
    expect(
      v0_3Compat.createSendMessageParams({ prompt: 'hello', data: { answer: 42 }, contextId: 'context-1' }),
    ).toMatchObject({
      message: {
        role: 'user',
        kind: 'message',
        parts: [
          { kind: 'text', text: 'hello' },
          { kind: 'data', data: { answer: 42 } },
        ],
        contextId: 'context-1',
      },
    });
    expect(v0_3Compat.createSendMessageParams({ prompt: 'hello' })).toMatchObject({
      message: {
        messageId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      },
    });
    expect(v0_3Compat.createGetTaskParams('task-1')).toEqual({ id: 'task-1' });
    expect(v0_3Compat.createResubscribeParams('task-1')).toEqual({ id: 'task-1' });
  });

  it('rejects non-task task responses', () => {
    expect(() => v0_3Compat.decodeGetTaskResult({ kind: 'message' })).toThrow(
      'Remote A2A agent returned a non-task response for tasks/get.',
    );
  });
});
