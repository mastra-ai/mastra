import { describe, expect, it } from 'vitest';

import { auditActionsInNamespaces, auditNamespaces, isAuditAction, parseAuditAction } from './actions.js';

describe('audit action registry', () => {
  it('expands namespaces into the actions the list route filters by', () => {
    expect(auditActionsInNamespaces(['git'])).toEqual([
      'factory.git.commit',
      'factory.git.push',
      'factory.git.pr_opened',
    ]);
    expect(auditNamespaces()).toEqual(['work_item', 'run', 'git', 'agent', 'intake']);
  });

  it('reads an action back into its namespace and leaf, and knows what it never registered', () => {
    expect(parseAuditAction('factory.run.ended')).toEqual({ namespace: 'run', leaf: 'ended' });
    expect(parseAuditAction('factory.feed.touched')).toBeUndefined();
    expect(isAuditAction('factory.run.ended')).toBe(true);
    expect(isAuditAction('factory.run.paused')).toBe(false);
  });
});
