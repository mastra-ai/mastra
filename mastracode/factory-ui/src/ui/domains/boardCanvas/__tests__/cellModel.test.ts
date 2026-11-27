import { MAX_RULE_GROUP_DEPTH } from '@mastra/factory/rules/rule-group';
import type { RuleCondition, RuleGroup } from '@mastra/factory/rules/rule-group';
import { describe, expect, it } from 'vitest';

import { fromRule, isGroup, toRule } from '../../settings/components/conditionTree';
import type { Group, Row } from '../../settings/components/conditionTree';
import { addCondition, canJoin, joinRow, replaceRow, setLogic } from '../components/conditions/cellModel';

const BUG: RuleCondition = { field: 'item.labels', operator: 'contains', value: 'bug' };
const REPO: RuleCondition = { field: 'source.repository', operator: 'equals', value: 'acme/app' };
const RENOVATE: RuleCondition = { field: 'item.author', operator: 'equals', value: 'renovate' };
const DOCS: RuleCondition = { field: 'item.labels', operator: 'contains', value: 'docs' };

function depthOf(group: Group): number {
  return 1 + Math.max(0, ...group.items.filter(isGroup).map(depthOf));
}

function findRow(group: Group, value: string): Row | undefined {
  for (const item of group.items) {
    const found = isGroup(item) ? findRow(item, value) : item.value === value ? item : undefined;
    if (found) return found;
  }
  return undefined;
}

function rowWith(group: Group, value: string): Row {
  const row = findRow(group, value);
  if (!row) throw new Error(`no row with ${value}`);
  return row;
}

function groupHolding(group: Group, key: string, depth = 0): { group: Group; depth: number } | undefined {
  if (group.items.some(item => item.key === key)) return { group, depth };
  for (const item of group.items) {
    const found = isGroup(item) ? groupHolding(item, key, depth + 1) : undefined;
    if (found) return found;
  }
  return undefined;
}

function fill(root: Group, added: Row, condition: RuleCondition): Group {
  return replaceRow(root, added.key, { ...added, ...condition });
}

describe('Given a rule that matches any of two conditions', () => {
  const rule: RuleGroup = { operator: 'OR', conditions: [BUG, RENOVATE] };

  it('when "and" is joined to the first, then that pair must hold together while the other stays an alternative', () => {
    const root = fromRule(rule);
    const { root: joined, added } = joinRow(root, rowWith(root, 'bug').key, 'AND');

    expect(toRule(fill(joined, added, REPO))).toEqual({
      rule: { operator: 'OR', conditions: [{ operator: 'AND', conditions: [BUG, REPO] }, RENOVATE] },
      incomplete: false,
    });
  });

  it('when the top level is switched to all, then both must match and nothing else changes', () => {
    const root = fromRule(rule);

    expect(toRule(setLogic(root, root.key, 'AND')).rule).toEqual({ operator: 'AND', conditions: [BUG, RENOVATE] });
  });

  it('when a condition is added, then it joins as one more alternative', () => {
    const { root, added } = addCondition(fromRule(rule));

    expect(toRule(fill(root, added, DOCS)).rule).toEqual({ operator: 'OR', conditions: [BUG, RENOVATE, DOCS] });
  });
});

describe('Given a nested group', () => {
  it('switches only that group', () => {
    const root = fromRule({ operator: 'OR', conditions: [{ operator: 'AND', conditions: [BUG, REPO] }, RENOVATE] });
    const inner = root.items.find(isGroup);
    if (!inner) throw new Error('no nested group');

    expect(toRule(setLogic(root, inner.key, 'OR')).rule).toEqual({
      operator: 'OR',
      conditions: [{ operator: 'OR', conditions: [BUG, REPO] }, RENOVATE],
    });
  });
});

describe('Given a single condition', () => {
  it('when "or" is joined to it, then the top level becomes the alternatives instead of nesting them', () => {
    const root = fromRule({ operator: 'AND', conditions: [BUG] });
    const { root: joined, added } = joinRow(root, rowWith(root, 'bug').key, 'OR');

    expect(toRule(fill(joined, added, RENOVATE)).rule).toEqual({ operator: 'OR', conditions: [BUG, RENOVATE] });
  });
});

describe(`Given a rule already ${MAX_RULE_GROUP_DEPTH} groups deep`, () => {
  const rule: RuleGroup = {
    operator: 'OR',
    conditions: [{ operator: 'AND', conditions: [{ operator: 'OR', conditions: [BUG, DOCS] }, REPO] }, RENOVATE],
  };

  it('when a condition is added, then it goes on the top level without nesting deeper', () => {
    const root = fromRule(rule);
    const { root: next, added } = addCondition(root);

    expect(depthOf(next)).toBe(MAX_RULE_GROUP_DEPTH);
    expect(groupHolding(next, added.key)?.group.key).toBe(root.key);
  });

  it('only offers to join the deepest conditions the way their group already joins', () => {
    const root = fromRule(rule);
    const deepest = groupHolding(root, rowWith(root, 'bug').key);
    if (!deepest) throw new Error('no group holds the row');

    expect(canJoin(deepest.group, deepest.depth, 'OR')).toBe(true);
    expect(canJoin(deepest.group, deepest.depth, 'AND')).toBe(false);
    expect(depthOf(joinRow(root, rowWith(root, 'bug').key, 'AND').root)).toBe(MAX_RULE_GROUP_DEPTH);
  });

  it('still nests "and" under a condition one level up', () => {
    const root = fromRule(rule);
    const { root: next, added } = joinRow(root, rowWith(root, 'renovate').key, 'AND');

    expect(depthOf(next)).toBe(MAX_RULE_GROUP_DEPTH);
    expect(toRule(fill(next, added, DOCS)).rule?.conditions[1]).toEqual({
      operator: 'AND',
      conditions: [RENOVATE, DOCS],
    });
  });
});
