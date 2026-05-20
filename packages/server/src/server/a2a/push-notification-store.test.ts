import { describe, expect, it } from 'vitest';
import { InMemoryPushNotificationStore } from './push-notification-store';

describe('InMemoryPushNotificationStore', () => {
  it('keeps agent/task keys collision-safe', () => {
    const store = new InMemoryPushNotificationStore();

    store.set({
      agentId: 'a-b',
      config: {
        taskId: 'c',
        pushNotificationConfig: {
          url: 'https://example.com/one',
        },
      },
    });

    store.set({
      agentId: 'a',
      config: {
        taskId: 'b-c',
        pushNotificationConfig: {
          url: 'https://example.com/two',
        },
      },
    });

    expect(
      store.get({
        agentId: 'a-b',
        params: { id: 'c' },
      }),
    ).toEqual({
      taskId: 'c',
      pushNotificationConfig: {
        id: 'c',
        url: 'https://example.com/one',
      },
    });

    expect(
      store.get({
        agentId: 'a',
        params: { id: 'b-c' },
      }),
    ).toEqual({
      taskId: 'b-c',
      pushNotificationConfig: {
        id: 'b-c',
        url: 'https://example.com/two',
      },
    });
  });
});
