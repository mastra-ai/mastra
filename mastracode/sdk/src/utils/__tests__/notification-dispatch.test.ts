import { describe, expect, it, vi } from 'vitest';

import { createResourceNotificationDispatcher } from '../notification-dispatch.js';

describe('createResourceNotificationDispatcher', () => {
  it('reports a failing tick instead of leaving an unhandled rejection', async () => {
    const failure = new Error('storage unavailable');
    const onError = vi.fn();
    const dispatcher = createResourceNotificationDispatcher({
      getMastra: () =>
        ({
          getStorage: () => {
            throw failure;
          },
        }) as never,
      getResourceIds: () => ['resource-a'],
      owner: 'owner-a',
      onError,
    });

    dispatcher.start();
    await expect(dispatcher.tick()).resolves.toBeUndefined();
    await dispatcher.stop();

    expect(onError).toHaveBeenCalledWith(failure);
  });
});
