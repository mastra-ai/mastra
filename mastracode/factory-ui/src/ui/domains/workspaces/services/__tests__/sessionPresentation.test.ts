import { describe, expect, it } from 'vitest';

import type { WorkItem } from '../../../factory/services/workItems';
import type { FactoryUserSession } from '../user-sessions';
import { getFactorySessionKind } from '../sessionPresentation';

const session = { branch: 'user/session-1' } as FactoryUserSession;

describe('getFactorySessionKind', () => {
  it.each(['github-pr', 'gitlab-pr'] as const)('classifies a %s work item as review', source => {
    expect(getFactorySessionKind(session, { source } as WorkItem)).toBe('review');
  });

  it.each(['github-issue', 'gitlab-issue'] as const)('classifies a %s work item as work', source => {
    expect(getFactorySessionKind(session, { source } as WorkItem)).toBe('work');
  });
});
