import { describe, expect, it } from 'vitest';

import { parsePlanMarkdown, resolveInlinePlan } from '../submit-plan-source';

describe('submit plan source', () => {
  it('prefers the durable submitted plan over stale invocation input', () => {
    expect(
      resolveInlinePlan(
        { path: '.artifacts/plans/current.md', title: 'Stale title', plan: 'Stale body' },
        {
          submittedPlan: {
            path: '.artifacts/plans/approved.md',
            title: 'Approved title',
            plan: 'Approved body',
            feedback: 'Add rollback steps',
          },
        },
      ),
    ).toEqual({
      path: '.artifacts/plans/approved.md',
      title: 'Approved title',
      plan: 'Approved body',
      feedback: 'Add rollback steps',
    });
  });

  it('supports legacy nested plan payloads', () => {
    expect(
      resolveInlinePlan(
        {
          path: '.artifacts/plans/legacy.md',
          plan: { title: 'Legacy title', content: 'Legacy body' },
        },
        undefined,
      ),
    ).toEqual({
      path: '.artifacts/plans/legacy.md',
      title: 'Legacy title',
      plan: 'Legacy body',
    });
  });

  it('keeps a path-only call fetchable by leaving the plan undefined', () => {
    expect(resolveInlinePlan({ path: '.artifacts/plans/fetch.md' }, undefined)).toEqual({
      path: '.artifacts/plans/fetch.md',
      title: undefined,
      plan: undefined,
    });
  });

  it('parses the first Markdown heading as the title', () => {
    expect(parsePlanMarkdown('\n# Ship it\n\n## Steps\n\n1. Verify')).toEqual({
      title: 'Ship it',
      plan: '## Steps\n\n1. Verify',
    });
  });

  it('keeps heading-free Markdown as the plan body', () => {
    expect(parsePlanMarkdown('## Steps\n\n1. Verify\n')).toEqual({
      plan: '## Steps\n\n1. Verify',
    });
  });
});
