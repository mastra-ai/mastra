import { SessionStartupCancelledError } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { messageWorkerSession } from './session-messaging.js';

describe('messageWorkerSession', () => {
  it.each(['send', 'queue'] as const)(
    'reports interrupted %s delivery without hiding transport errors',
    async delivery => {
      const dispatch = vi.fn().mockRejectedValueOnce(new SessionStartupCancelledError());
      const controller = {
        getSessionByResource: vi.fn(async () => ({ sendMessage: dispatch, queueMessage: dispatch })),
      };
      const input = { controller, sessionId: 'worker-session', message: 'Guidance', delivery };
      await expect(messageWorkerSession(input)).resolves.toEqual({ status: 'interrupted' });

      const error = new DOMException('MCP transport aborted', 'AbortError');
      dispatch.mockRejectedValueOnce(error);
      await expect(messageWorkerSession(input)).rejects.toBe(error);
    },
  );

  it('dispatches queued worker guidance through Session.queueMessage', async () => {
    const sendMessage = vi.fn();
    const queueMessage = vi.fn();
    const getSessionByResource = vi.fn(async () => ({ sendMessage, queueMessage }));

    await messageWorkerSession({
      controller: { getSessionByResource },
      sessionId: 'worker-session',
      message: 'Run the tests after the current task.',
      delivery: 'queue',
    });

    expect(getSessionByResource).toHaveBeenCalledWith('worker-session');
    expect(queueMessage).toHaveBeenCalledWith({ content: 'Run the tests after the current task.' });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('uses Session.sendMessage for immediate worker guidance', async () => {
    const sendMessage = vi.fn();
    const queueMessage = vi.fn();
    const getSessionByResource = vi.fn(async () => ({ sendMessage, queueMessage }));

    await messageWorkerSession({
      controller: { getSessionByResource },
      sessionId: 'worker-session',
      message: 'Stop and report now.',
      delivery: 'send',
    });

    expect(sendMessage).toHaveBeenCalledWith({ content: 'Stop and report now.' });
    expect(queueMessage).not.toHaveBeenCalled();
  });
});
