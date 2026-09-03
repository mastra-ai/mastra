import { describe, expect, it, vi } from 'vitest';

import { SlackFeedPublisher } from './feed-publisher.js';

const SLACK_ITEM = {
  id: 'wi-1',
  externalSource: { integrationId: 'slack', type: 'slack-thread', workspaceId: 'T-1', externalId: 'slack:C-1:1700.42' },
} as any;

const COMMENT = { id: 'c-1', body: 'ship it', author: { kind: 'user', id: 'user-1', displayName: 'Alice' } } as any;

function makeController(post = vi.fn().mockResolvedValue({ id: '1700.99' })) {
  const thread = vi.fn().mockReturnValue({ post });
  return { controller: { getChannels: () => ({ sdk: { thread } }) } as any, thread, post };
}

describe('SlackFeedPublisher', () => {
  it('posts the comment into the bound thread, attributed to its author', async () => {
    const { controller, thread, post } = makeController();

    const result = await new SlackFeedPublisher({ controller }).publish(COMMENT, SLACK_ITEM);

    expect(thread).toHaveBeenCalledWith('slack:C-1:1700.42');
    expect(post).toHaveBeenCalledWith({ markdown: '**Alice**: ship it' });
    // The write-back key must match what an ingested Slack message would carry,
    // or the same message could land twice under two different keys.
    expect(result).toEqual({
      source: { integrationId: 'slack', type: 'message', workspaceId: 'T-1', externalId: 'C-1:1700.99' },
    });
  });

  it('declines a work item no Slack thread is bound to', async () => {
    const { controller, post } = makeController();
    const githubItem = {
      ...SLACK_ITEM,
      externalSource: { integrationId: 'github', type: 'issue', externalId: '42' },
    };

    expect(await new SlackFeedPublisher({ controller }).publish(COMMENT, githubItem)).toBeNull();
    expect(await new SlackFeedPublisher({ controller }).publish(COMMENT, { id: 'wi-2' } as any)).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('skips the mirror rather than throwing while the channel SDK is still starting', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = { getChannels: () => ({ sdk: null }) } as any;

    expect(await new SlackFeedPublisher({ controller }).publish(COMMENT, SLACK_ITEM)).toBeNull();
  });

  it('trims a comment Slack would reject for length', async () => {
    const { controller, post } = makeController();

    await new SlackFeedPublisher({ controller }).publish({ ...COMMENT, body: 'x'.repeat(16_000) }, SLACK_ITEM);

    const { markdown } = post.mock.calls[0][0];
    expect(markdown.length).toBe(12_000);
    expect(markdown.endsWith('…')).toBe(true);
  });

  it('never cuts an emoji in half at the length limit', async () => {
    const { controller, post } = makeController();
    // `**Alice**: ` plus the x's put the cut between the two halves of an 😀.
    const body = `${'x'.repeat(11_987)}${'😀'.repeat(10)}`;

    await new SlackFeedPublisher({ controller }).publish({ ...COMMENT, body }, SLACK_ITEM);

    const { markdown } = post.mock.calls[0][0];
    expect(markdown).toMatch(/x…$/);
  });
});
