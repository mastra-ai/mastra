import { describe, expect, it, vi } from 'vitest';

import { resolveSlackMentions } from './slack-mentions';

const getUser = vi.fn(async (id: string) => ({
  userId: id,
  userName: id === 'U1' ? 'Yujohn Nattrass' : 'Eric (he/him)',
  fullName: 'Different legal name',
  isBot: false,
}));

describe('resolveSlackMentions', () => {
  it('resolves exact Slack display names and deduplicates IDs', async () => {
    getUser.mockClear();
    expect(await resolveSlackMentions({ name: 'slack', getUser }, { text: '<@U1> and <@U2> and <@U1>' })).toEqual([
      { id: 'U1', label: '@Yujohn Nattrass' },
      { id: 'U2', label: '@Eric (he/him)' },
    ]);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('handles raw event envelopes and labeled tokens', async () => {
    expect(await resolveSlackMentions({ name: 'slack', getUser }, { event: { text: '<@U1|old name>' } })).toEqual([
      { id: 'U1', label: '@Yujohn Nattrass' },
    ]);
  });

  it('does not infer mentions from plain names or other platforms', async () => {
    getUser.mockClear();
    expect(await resolveSlackMentions({ name: 'slack', getUser }, { text: '@Eric (he/him)' })).toEqual([]);
    expect(await resolveSlackMentions({ name: 'discord', getUser }, { text: '<@U1>' })).toEqual([]);
    expect(await resolveSlackMentions({ name: 'slack', getUser }, null)).toEqual([]);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('omits unavailable members', async () => {
    expect(await resolveSlackMentions({ name: 'slack', getUser: async () => null }, { text: '<@U1>' })).toEqual([]);
  });
});
