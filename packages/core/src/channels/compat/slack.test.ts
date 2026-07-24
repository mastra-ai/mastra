import { describe, it, expect } from 'vitest';

import { resolveSlackTeamId, resolveSlackTopLevelThreadId } from './slack';

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

describe('resolveSlackTeamId', () => {
  const msg = (raw: unknown) => ({ raw }) as any;

  it('reads team_id from the top-level Slack event envelope', () => {
    expect(resolveSlackTeamId({ platform: 'slack', message: msg({ team_id: 'T123' }) })).toBe('T123');
  });

  it('falls back to a string `team` field', () => {
    expect(resolveSlackTeamId({ platform: 'slack', message: msg({ team: 'T456' }) })).toBe('T456');
  });

  it('falls back to `team.id` on interactive payloads', () => {
    expect(resolveSlackTeamId({ platform: 'slack', message: msg({ team: { id: 'T789' } }) })).toBe('T789');
  });

  it('returns null for non-slack platforms', () => {
    expect(resolveSlackTeamId({ platform: 'discord', message: msg({ team_id: 'T123' }) })).toBeNull();
  });

  it('returns null when the raw payload carries no team id', () => {
    expect(resolveSlackTeamId({ platform: 'slack', message: msg({ channel: 'C1' }) })).toBeNull();
    expect(resolveSlackTeamId({ platform: 'slack', message: msg(undefined) })).toBeNull();
    expect(resolveSlackTeamId({ platform: 'slack', message: msg('not-an-object') })).toBeNull();
  });
});
