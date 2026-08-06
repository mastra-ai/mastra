import { describe, expect, it } from 'vitest';

import { factoryRuleBranch } from './surface.js';

describe('factoryRuleBranch', () => {
  const item = {
    id: 'item-1',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    externalSource: { integrationId: 'github', type: 'issue', externalId: '42' },
    parentWorkItemId: null,
    title: 'Issue 42',
    stages: ['triage'],
    sessions: {},
    stageHistory: [],
    metadata: {},
    revision: 1,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('supports canonical and legacy Linear issue metadata', () => {
    const linearItem = {
      ...item,
      externalSource: { integrationId: 'linear', type: 'issue', externalId: 'issue-1' },
    };

    expect(factoryRuleBranch({ ...linearItem, metadata: { identifier: 'ENG-42' } })).toBe('factory/linear-eng-42');
    expect(factoryRuleBranch({ ...linearItem, metadata: { linearIssueIdentifier: 'ENG-43' } })).toBe(
      'factory/linear-eng-43',
    );
  });
});
