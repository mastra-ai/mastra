import { describe, expect, it, vi } from 'vitest';
import { annotateSlackMentions } from './slack-mention-labels';

function stateWith(users: Record<string, string>) {
  return {
    get: vi.fn(async (key: string) => {
      const id = key.replace('slack:user:', '');
      return users[id] ? { displayName: users[id] } : null;
    }),
  } as any;
}

describe('annotateSlackMentions', () => {
  it('annotates a resolved display name with its id', async () => {
    const out = await annotateSlackMentions({
      state: stateWith({ U123: 'Caleb Barnes' }),
      raw: { text: 'hey <@U123> look' },
      text: 'hey @Caleb Barnes look',
    });
    expect(out).toBe('hey <@U123|Caleb Barnes> look');
  });

  it('reads the event out of a wrapped envelope', async () => {
    const out = await annotateSlackMentions({
      state: stateWith({ U123: 'Caleb Barnes' }),
      raw: { event: { text: '<@U123> ping' } },
      text: '@Caleb Barnes ping',
    });
    expect(out).toBe('<@U123|Caleb Barnes> ping');
  });

  it('annotates the unresolved self mention, which stays a bare id', async () => {
    const out = await annotateSlackMentions({
      state: stateWith({ U0BOT: 'shipyard' }),
      raw: { text: '<@U0BOT> status' },
      text: '@U0BOT status',
    });
    expect(out).toBe('<@U0BOT|shipyard> status');
  });

  it('falls back to the pipe label when the cache misses', async () => {
    const out = await annotateSlackMentions({
      state: stateWith({}),
      raw: { text: '<@U123|caleb> hi' },
      text: '@caleb hi',
    });
    expect(out).toBe('<@U123|caleb> hi');
  });

  it('leaves an uncacheable id untouched rather than fetching it', async () => {
    const state = stateWith({});
    const out = await annotateSlackMentions({
      state,
      raw: { text: '<@U999> hi' },
      text: '@Someone Else hi',
    });
    expect(out).toBe('@Someone Else hi');
    expect(state.get).toHaveBeenCalledTimes(1);
  });

  it('does not let a shorter name shadow a longer one', async () => {
    const out = await annotateSlackMentions({
      state: stateWith({ U1: 'Cal', U2: 'Caleb Barnes' }),
      raw: { text: '<@U1> and <@U2>' },
      text: '@Cal and @Caleb Barnes',
    });
    expect(out).toBe('<@U1|Cal> and <@U2|Caleb Barnes>');
  });

  it('ignores a plain-text lookalike when raw has no mention token', async () => {
    const out = await annotateSlackMentions({
      state: stateWith({ U123: 'Caleb Barnes' }),
      raw: { text: 'talking about @Caleb Barnes' },
      text: 'talking about @Caleb Barnes',
    });
    expect(out).toBe('talking about @Caleb Barnes');
  });

  it('annotates every occurrence exactly once', async () => {
    const out = await annotateSlackMentions({
      state: stateWith({ U123: 'Caleb Barnes' }),
      raw: { text: '<@U123> and <@U123>' },
      text: '@Caleb Barnes and @Caleb Barnes',
    });
    expect(out).toBe('<@U123|Caleb Barnes> and <@U123|Caleb Barnes>');
  });

  it('returns text unchanged when raw carries no usable payload', async () => {
    const out = await annotateSlackMentions({
      state: stateWith({ U123: 'Caleb Barnes' }),
      raw: undefined,
      text: '@Caleb Barnes hi',
    });
    expect(out).toBe('@Caleb Barnes hi');
  });
});
