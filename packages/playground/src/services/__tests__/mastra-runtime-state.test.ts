import { describe, expect, it } from 'vitest';

import { getCanSendWhileStreaming } from '../mastra-runtime-state';

describe('getCanSendWhileStreaming', () => {
  it('allows server-side queued sends while a subscription thread is active', () => {
    expect(
      getCanSendWhileStreaming({
        isSupportedModel: true,
        threadSignalsEnabled: true,
        threadId: 'thread-1',
        threadSignalsUnsupported: false,
      }),
    ).toBe(true);
  });

  it.each([
    { isSupportedModel: false, threadSignalsEnabled: true, threadId: 'thread-1', threadSignalsUnsupported: false },
    { isSupportedModel: true, threadSignalsEnabled: false, threadId: 'thread-1', threadSignalsUnsupported: false },
    { isSupportedModel: true, threadSignalsEnabled: true, threadId: undefined, threadSignalsUnsupported: false },
    { isSupportedModel: true, threadSignalsEnabled: true, threadId: 'thread-1', threadSignalsUnsupported: true },
  ])('blocks sends when subscription send support is unavailable: %o', options => {
    expect(getCanSendWhileStreaming(options)).toBe(false);
  });
});
