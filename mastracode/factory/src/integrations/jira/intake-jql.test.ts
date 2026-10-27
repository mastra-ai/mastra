import { describe, expect, it } from 'vitest';

import { bindingLabelSlice } from '../../storage/domains/intake/base.js';
import type { IntakeSourceBinding } from '../../storage/domains/intake/base.js';
import { buildIntakeJql, unfilteredJiraScopes } from './intake-jql.js';
import type { JiraIntakeScope } from './intake-jql.js';
import { matchesJql } from './test-utils.js';
import type { FakeJiraIssue } from './test-utils.js';

const ops = (key: string, labels: string[], extra: Partial<FakeJiraIssue> = {}): FakeJiraIssue => ({
  key,
  projectId: '10000',
  projectKey: 'OPS',
  labels,
  ...extra,
});

/** Factory A takes all OPS issues, B takes `payments`, C takes `mobile` and `ios` (created in that order). */
const opsBindings: Array<Pick<IntakeSourceBinding, 'factoryProjectId' | 'labels' | 'createdAt'>> = [
  { factoryProjectId: 'A', labels: null, createdAt: new Date('2026-01-01') },
  { factoryProjectId: 'B', labels: ['payments'], createdAt: new Date('2026-01-02') },
  { factoryProjectId: 'C', labels: ['mobile', 'ios'], createdAt: new Date('2026-01-03') },
];

function scopeFor(factoryProjectId: string): JiraIntakeScope {
  const binding = opsBindings.find(candidate => candidate.factoryProjectId === factoryProjectId)!;
  return { projectId: '10000', ...bindingLabelSlice(binding, opsBindings) };
}

/** The factories whose JQL returns `issue`. */
function receivers(issue: FakeJiraIssue): string[] {
  return opsBindings
    .map(binding => binding.factoryProjectId)
    .filter(factoryProjectId => matchesJql(buildIntakeJql([scopeFor(factoryProjectId)])!, issue));
}

describe('buildIntakeJql', () => {
  it('keeps the plain project filter for unfiltered bindings', () => {
    expect(buildIntakeJql(unfilteredJiraScopes(['1', 'ENG']))).toBe(
      'project IN (1, "ENG") AND statusCategory != Done ORDER BY updated DESC',
    );
    expect(buildIntakeJql()).toBe('statusCategory != Done ORDER BY updated DESC');
  });

  it.each([
    { labels: [], factory: 'A' },
    { labels: ['bug'], factory: 'A' },
    { labels: ['payments'], factory: 'B' },
    { labels: ['ios', 'bug'], factory: 'C' },
    { labels: ['IOS'], factory: 'C' },
    // Carries labels of two label bindings: the older binding (B) wins.
    { labels: ['payments', 'mobile'], factory: 'B' },
  ])('sends an OPS issue labelled $labels to exactly factory $factory', ({ labels, factory }) => {
    expect(receivers(ops('OPS-1', labels))).toEqual([factory]);
  });

  it('never returns finished issues', () => {
    expect(receivers(ops('OPS-2', ['payments'], { done: true }))).toEqual([]);
  });

  it('keeps unlabelled issues for an all-issues binding that excludes claimed labels', () => {
    const jql = buildIntakeJql([scopeFor('A')])!;
    expect(jql).toContain('labels IS EMPTY OR labels NOT IN');
    expect(matchesJql(jql, ops('OPS-3', []))).toBe(true);
  });

  it('combines filtered and unfiltered projects in one query', () => {
    const jql = buildIntakeJql([{ projectId: 'ENG', include: null, exclude: [] }, scopeFor('B')])!;
    expect(matchesJql(jql, { key: 'ENG-1', projectId: '1', projectKey: 'ENG', labels: [] })).toBe(true);
    expect(matchesJql(jql, ops('OPS-4', ['payments']))).toBe(true);
    expect(matchesJql(jql, ops('OPS-5', ['bug']))).toBe(false);
  });

  it('narrows every project to the requested labels', () => {
    const jql = buildIntakeJql([scopeFor('A')], ['urgent'])!;
    expect(matchesJql(jql, ops('OPS-6', ['urgent']))).toBe(true);
    expect(matchesJql(jql, ops('OPS-7', ['bug']))).toBe(false);
  });

  it('strips quotes and backslashes from labels and drops unsafe project ids', () => {
    expect(
      buildIntakeJql([
        { projectId: 'bad id;', include: null, exclude: [] },
        { projectId: '10000', include: ['pay"ments\\'], exclude: ['mo"bile'] },
      ]),
    ).toBe(
      '(project = 10000 AND labels IN ("payments") AND labels NOT IN ("mobile")) AND statusCategory != Done ORDER BY updated DESC',
    );
  });

  it('returns null instead of reading the whole site when no scope is usable', () => {
    expect(buildIntakeJql([])).toBeNull();
    expect(buildIntakeJql([{ projectId: 'bad id;', include: null, exclude: [] }])).toBeNull();
    expect(buildIntakeJql([{ projectId: '10000', include: ['"'], exclude: [] }])).toBeNull();
  });
});
