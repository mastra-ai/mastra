import { describe, expect, it } from 'vitest';

import { genericExternalWorkItemUrl } from './workItemPresentation';

describe('genericExternalWorkItemUrl', () => {
  it('leaves pull request links to the review-specific header action', () => {
    expect(
      genericExternalWorkItemUrl({
        source: 'github-pr',
        url: 'https://github.com/mastra-ai/mastra/pull/20384',
      }),
    ).toBeUndefined();
  });

  it.each([
    ['github-issue' as const, 'https://github.com/mastra-ai/mastra/issues/20384'],
    ['linear-issue' as const, 'https://linear.app/mastra/issue/MASTRA-20384'],
  ])('keeps the generic external link for %s work items', (source, url) => {
    expect(genericExternalWorkItemUrl({ source, url })).toBe(url);
  });
});
