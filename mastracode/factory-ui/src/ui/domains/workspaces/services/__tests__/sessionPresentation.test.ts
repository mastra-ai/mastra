import { describe, expect, it } from 'vitest';

import type { WorkItem } from '../../../factory/services/workItems';
import type { FactoryUserSession } from '../user-sessions';
import { getFactorySessionKind, getReviewBranchIdentifier } from '../sessionPresentation';

const session = { branch: 'user/session-1' } as FactoryUserSession;

describe('getFactorySessionKind', () => {
  it.each(['github-pr', 'gitlab-pr'] as const)('classifies a %s work item as review', source => {
    expect(getFactorySessionKind(session, { source } as WorkItem)).toBe('review');
  });

  it.each(['github-issue', 'gitlab-issue'] as const)('classifies a %s work item as work', source => {
    expect(getFactorySessionKind(session, { source } as WorkItem)).toBe('work');
  });

  it.each([
    ['factory/pr-17', '#17'],
    ['factory/gitlab-mr-8-ab12cd34', '!8'],
  ])('classifies an unbound %s branch as review', (branch, identifier) => {
    expect(getFactorySessionKind({ ...session, branch }, undefined)).toBe('review');
    expect(getReviewBranchIdentifier(branch)).toBe(identifier);
  });

  it.each(['factory/gitlab-mr-0-ab12cd34', 'factory/gitlab-mr-8', 'factory/pr-0', 'factory/issue-17'])(
    'does not misclassify %s as review',
    branch => {
      expect(getFactorySessionKind({ ...session, branch }, undefined)).toBe('work');
      expect(getReviewBranchIdentifier(branch)).toBeUndefined();
    },
  );
});
