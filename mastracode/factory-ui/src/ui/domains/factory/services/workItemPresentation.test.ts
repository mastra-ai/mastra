import { describe, expect, it } from 'vitest';

import { genericExternalWorkItemUrl } from './workItemPresentation';

describe('genericExternalWorkItemUrl', () => {
  it.each([
    ['github-pr' as const, 'https://github.com/mastra-ai/mastra/pull/20384'],
    ['gitlab-pr' as const, 'https://gitlab.com/rhys-group1/app/-/merge_requests/7'],
  ])('leaves %s links to the review-specific header action', (source, url) => {
    expect(genericExternalWorkItemUrl({ source, url })).toBeUndefined();
  });

  it.each([
    ['github-issue' as const, 'https://github.com/mastra-ai/mastra/issues/20384'],
    ['linear-issue' as const, 'https://linear.app/mastra/issue/MASTRA-20384'],
  ])('keeps the generic external link for %s work items', (source, url) => {
    expect(genericExternalWorkItemUrl({ source, url })).toBe(url);
  });
});
