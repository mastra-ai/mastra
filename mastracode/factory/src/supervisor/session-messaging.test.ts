import { describe, expect, it, vi } from 'vitest';

import { messageWorkerSession } from './session-messaging.js';

describe('messageWorkerSession', () => {
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
