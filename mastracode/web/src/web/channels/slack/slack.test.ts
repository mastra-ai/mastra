import { createChannelLinkStateSigner } from '@mastra/factory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { promptIfUnlinked } from './slack.js';

function makeThread() {
  return {
    adapter: { name: 'slack' },
    channelId: 'C-1',
    postEphemeral: vi.fn().mockResolvedValue({ id: 'eph-1' }),
  } as any;
}

function makeMessage(teamId?: string) {
  return {
    author: { userId: 'U-sender', userName: 'caleb' },
    raw: teamId ? { team_id: teamId } : {},
  } as any;
}

function makeStore(link: { orgId?: string; userId: string } | null) {
  return { getAccountLink: vi.fn().mockResolvedValue(link) } as any;
}

const OLD_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
});

describe('promptIfUnlinked', () => {
  it('returns false (dispatch) when no account-link store is configured', async () => {
    const thread = makeThread();
    const result = await promptIfUnlinked({ thread, message: makeMessage('T-1') });
    expect(result).toBe(false);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('returns false (dispatch) for a linked sender, no card posted', async () => {
    const thread = makeThread();
    const accountLinks = makeStore({ orgId: 'org-1', userId: 'user-1' });
    const result = await promptIfUnlinked({ thread, message: makeMessage('T-1'), accountLinks });
    expect(result).toBe(false);
    expect(accountLinks.getAccountLink).toHaveBeenCalledWith({
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-sender',
    });
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('returns true (skip run) and posts an ephemeral signed Connect card for an unlinked sender', async () => {
    process.env.MASTRACODE_CHANNELS_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const accountLinks = makeStore(null);
    const channelLinkStateSigner = createChannelLinkStateSigner('secret');

    const result = await promptIfUnlinked({
      thread,
      message: makeMessage('T-1'),
      accountLinks,
      channelLinkStateSigner,
    });

    expect(result).toBe(true);
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);

    // Ephemeral (visible only to the sender), with fallbackToDM.
    const [user, , options] = thread.postEphemeral.mock.calls[0];
    expect(user).toEqual(thread.postEphemeral.mock.calls[0][0]);
    expect(options).toEqual({ fallbackToDM: true });

    // The deep-link state round-trips back to the exact Slack identity.
    const card = thread.postEphemeral.mock.calls[0][1];
    const actions = card.children.find((c: any) => c.type === 'actions');
    const linkButton = actions.children.find((c: any) => c.type === 'link-button');
    const url: string = linkButton.url;
    expect(url.startsWith('https://mc.example.com/connect/slack?state=')).toBe(true);
    const state = decodeURIComponent(new URL(url).searchParams.get('state')!);
    expect(channelLinkStateSigner.verify(state)).toEqual({
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-sender',
      channelId: 'C-1',
    });
  });

  it('treats a missing team id as unlinked and blocks the run (no card without a team id)', async () => {
    process.env.MASTRACODE_CHANNELS_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const accountLinks = makeStore({ orgId: 'org-1', userId: 'user-1' });
    const channelLinkStateSigner = createChannelLinkStateSigner('secret');

    const result = await promptIfUnlinked({
      thread,
      message: makeMessage(undefined),
      accountLinks,
      channelLinkStateSigner,
    });

    // No team id → never even looks up the (workspace-scoped) link, blocks run.
    expect(result).toBe(true);
    expect(accountLinks.getAccountLink).not.toHaveBeenCalled();
    // Without a team id there's nothing safe to sign into the deep link.
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('blocks the run without a card when no public URL is configured', async () => {
    delete process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
    delete process.env.MASTRACODE_PUBLIC_URL;
    const thread = makeThread();
    const accountLinks = makeStore(null);
    const channelLinkStateSigner = createChannelLinkStateSigner('secret');

    const result = await promptIfUnlinked({
      thread,
      message: makeMessage('T-1'),
      accountLinks,
      channelLinkStateSigner,
    });

    expect(result).toBe(true);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });
});
