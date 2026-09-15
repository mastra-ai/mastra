import { afterEach, describe, expect, it, vi } from 'vitest';

import { matchExplicitFactory, resolveFactoryFromContext, searchableMessageText } from './factory-routing.js';

const factories = [
  { id: 'fp-web', name: 'Shipyard Web', slackWorkItemsEnabled: false },
  { id: 'fp-api', name: 'API', slackWorkItemsEnabled: true },
] as any[];

function makeThread(id = 'slack:C-1:1700.10', roots: any[] = []) {
  return {
    id,
    adapter: { name: 'slack' },
    allMessages: (async function* () {
      for (const root of roots) yield root;
    })(),
  } as any;
}

function makeMessage(text: string, { id = '1700.42', raw = {} as unknown } = {}) {
  return { id, text, raw, author: { userId: 'U-1' } } as any;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('matchExplicitFactory', () => {
  it.each([
    'factory: API fix the login bug',
    'factory:api fix the login bug',
    '[API] fix the login bug',
    'can you fix the login bug in the API factory?',
    'fix this in API factory',
  ])('matches %j', text => {
    expect(matchExplicitFactory(text, factories)?.id).toBe('fp-api');
  });

  it('matches multi-word names and prefers the longest name', () => {
    const named = [...factories, { id: 'fp-ship', name: 'Shipyard', slackWorkItemsEnabled: false }] as any[];
    expect(matchExplicitFactory('factory: Shipyard Web please', named)?.id).toBe('fp-web');
    expect(matchExplicitFactory('factory: Shipyard please', named)?.id).toBe('fp-ship');
  });

  it('ignores a factory name mentioned without the explicit form', () => {
    expect(matchExplicitFactory('the API is slow today', factories)).toBeUndefined();
    expect(matchExplicitFactory('APIs are slow today', factories)).toBeUndefined();
  });
});

describe('searchableMessageText', () => {
  it('appends urls found anywhere in the raw platform payload', () => {
    const text = searchableMessageText({
      text: 'look at this',
      raw: {
        event: {
          attachments: [{ title_link: 'https://linear.app/acme/issue/PROD-35/broken', fallback: 'PROD-35' }],
          blocks: [{ elements: [{ url: 'https://github.com/acme/app/pull/12' }] }],
        },
      },
    });
    expect(text).toBe(
      'look at this\nhttps://linear.app/acme/issue/PROD-35/broken\nhttps://github.com/acme/app/pull/12',
    );
  });
});

describe('resolveFactoryFromContext', () => {
  it('resolves an explicit factory name without consulting resolvers', async () => {
    const resolver = vi.fn();
    const route = await resolveFactoryFromContext({
      thread: makeThread(),
      message: makeMessage('factory: API fix this'),
      orgId: 'org-1',
      factories,
      referenceResolvers: [resolver],
    });
    expect(route).toEqual({ status: 'resolved', factory: factories[1], via: 'explicit' });
    expect(resolver).not.toHaveBeenCalled();
  });

  it('routes to the single factory a reference resolves to', async () => {
    const resolver = vi.fn().mockResolvedValue([{ reference: 'PROD-35', factoryProjectId: 'fp-web' }]);
    const route = await resolveFactoryFromContext({
      thread: makeThread(),
      message: makeMessage('can you fix PROD-35?', { id: '1700.10' }),
      orgId: 'org-1',
      factories,
      referenceResolvers: [resolver],
    });
    expect(route).toEqual({ status: 'resolved', factory: factories[0], via: 'reference' });
    expect(resolver).toHaveBeenCalledWith({ orgId: 'org-1', text: 'can you fix PROD-35?\n' });
  });

  it('includes the thread root when the message is a reply', async () => {
    const resolver = vi.fn().mockResolvedValue([{ reference: 'PROD-35', factoryProjectId: 'fp-web' }]);
    const root = makeMessage('Joel created issue PROD-35', {
      id: '1700.10',
      raw: { attachments: [{ title_link: 'https://linear.app/acme/issue/PROD-35' }] },
    });
    const route = await resolveFactoryFromContext({
      thread: makeThread('slack:C-1:1700.10', [root]),
      message: makeMessage('can you fix this?', { id: '1700.42' }),
      orgId: 'org-1',
      factories,
      referenceResolvers: [resolver],
    });
    expect(route.status).toBe('resolved');
    expect(resolver.mock.calls[0]![0].text).toBe(
      'can you fix this?\nJoel created issue PROD-35\nhttps://linear.app/acme/issue/PROD-35',
    );
  });

  it('does not read the thread when the message is the root', async () => {
    const resolver = vi.fn().mockResolvedValue([]);
    const thread = makeThread('slack:C-1:1700.42');
    const spy = vi.fn();
    Object.defineProperty(thread, 'allMessages', { get: spy });
    await resolveFactoryFromContext({
      thread,
      message: makeMessage('hello', { id: '1700.42' }),
      orgId: 'org-1',
      factories,
      referenceResolvers: [resolver],
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls through when references disagree', async () => {
    const linear = vi.fn().mockResolvedValue([{ reference: 'PROD-35', factoryProjectId: 'fp-web' }]);
    const github = vi.fn().mockResolvedValue([{ reference: 'acme/api', factoryProjectId: 'fp-api' }]);
    const route = await resolveFactoryFromContext({
      thread: makeThread(),
      message: makeMessage('PROD-35 and https://github.com/acme/api', { id: '1700.10' }),
      orgId: 'org-1',
      factories,
      referenceResolvers: [linear, github],
    });
    expect(route).toEqual({ status: 'ambiguous', factoryProjectIds: ['fp-web', 'fp-api'] });
  });

  it('ignores references to factories outside the org and survives a failing resolver', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const foreign = vi.fn().mockResolvedValue([{ reference: 'X-1', factoryProjectId: 'fp-other-org' }]);
    const failing = vi.fn().mockRejectedValue(new Error('linear down'));
    const route = await resolveFactoryFromContext({
      thread: makeThread(),
      message: makeMessage('X-1', { id: '1700.10' }),
      orgId: 'org-1',
      factories,
      referenceResolvers: [foreign, failing],
    });
    expect(route).toEqual({ status: 'none' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('resolves once per message object', async () => {
    const resolver = vi.fn().mockResolvedValue([{ reference: 'PROD-35', factoryProjectId: 'fp-web' }]);
    const message = makeMessage('PROD-35', { id: '1700.10' });
    const args = { thread: makeThread(), message, orgId: 'org-1', factories, referenceResolvers: [resolver] };
    const first = await resolveFactoryFromContext(args);
    const second = await resolveFactoryFromContext(args);
    expect(second).toBe(first);
    expect(resolver).toHaveBeenCalledTimes(1);
  });
});
