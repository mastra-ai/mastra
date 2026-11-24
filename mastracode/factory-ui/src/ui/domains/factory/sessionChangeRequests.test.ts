import { describe, expect, it } from 'vitest';

import { changeRequestReference, changeRequestRepository } from './sessionChangeRequests';

describe('changeRequestRepository', () => {
  it.each([
    { url: 'https://github.com/mastra-ai/docs/pull/12', repository: 'mastra-ai/docs' },
    {
      url: 'https://gitlab.com/group/sub/app/-/merge_requests/7',
      repository: 'group/sub/app',
    },
    { url: 'https://github.com/mastra-ai/docs/issues/12', repository: undefined },
    { url: 'not a url', repository: undefined },
  ])('reads $repository from $url', ({ url, repository }) => {
    expect(changeRequestRepository(url)).toBe(repository);
  });
});

describe('changeRequestReference', () => {
  it.each([
    {
      provider: 'github',
      url: 'https://github.com/mastra-ai/docs/pull/12',
      inside: 'PR #12',
      outside: 'PR mastra-ai/docs#12',
    },
    {
      provider: 'gitlab',
      url: 'https://gitlab.com/group/sub/app/-/merge_requests/7',
      inside: 'MR !7',
      outside: 'MR group/sub/app!7',
    },
  ] as const)('names a $provider request with its repository only outside it', ({ provider, url, inside, outside }) => {
    const number = Number(url.split('/').at(-1));
    const repository = changeRequestRepository(url);

    expect(changeRequestReference({ provider, number, url }, repository)).toBe(inside);
    expect(changeRequestReference({ provider, number, url }, 'acme/app')).toBe(outside);
  });
});
