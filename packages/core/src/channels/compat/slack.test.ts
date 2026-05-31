import { describe, it, expect } from 'vitest';

import { resolveSlackTopLevelThreadId } from './slack';

function makeSlackAdapter() {
  return {
    name: 'slack',
    decodeThreadId: (id: string) => {
      const [channel, threadTs = ''] = id.split(':');
      return { channel: channel ?? '', threadTs };
    },
    encodeThreadId: ({ channel, threadTs }: { channel: string; threadTs: string }) => `${channel}:${threadTs}`,
  } as any;
}

describe('resolveSlackTopLevelThreadId', () => {
  it('rewrites threadId when decoded threadTs equals messageId (top-level click)', () => {
    const adapter = makeSlackAdapter();
    const result = resolveSlackTopLevelThreadId({
      platform: 'slack',
      adapter,
      chatThreadId: 'C123:1700000000.000100',
      messageId: '1700000000.000100',
    });
    expect(result).toBe('C123:');
  });

  it('returns null when click was inside a real thread (threadTs !== messageId)', () => {
    const adapter = makeSlackAdapter();
    const result = resolveSlackTopLevelThreadId({
      platform: 'slack',
      adapter,
      chatThreadId: 'C123:1700000000.000050',
      messageId: '1700000000.000100',
    });
    expect(result).toBeNull();
  });

  it('returns null for non-slack platforms', () => {
    const adapter = makeSlackAdapter();
    const result = resolveSlackTopLevelThreadId({
      platform: 'discord',
      adapter,
      chatThreadId: 'C123:1700000000.000100',
      messageId: '1700000000.000100',
    });
    expect(result).toBeNull();
  });

  it('returns null when messageId is missing', () => {
    const adapter = makeSlackAdapter();
    const result = resolveSlackTopLevelThreadId({
      platform: 'slack',
      adapter,
      chatThreadId: 'C123:1700000000.000100',
      messageId: undefined,
    });
    expect(result).toBeNull();
  });

  it('returns null when adapter lacks the slack thread-id codec', () => {
    const adapter = { name: 'slack' } as any;
    const result = resolveSlackTopLevelThreadId({
      platform: 'slack',
      adapter,
      chatThreadId: 'C123:1700000000.000100',
      messageId: '1700000000.000100',
    });
    expect(result).toBeNull();
  });
});
