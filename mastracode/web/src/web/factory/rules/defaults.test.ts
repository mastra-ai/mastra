import { describe, expect, it, vi } from 'vitest';
import { defaultFactoryRules, mergeFactoryRuleOverrides } from './defaults.js';
import type { FactoryBoardRuleLeaf, FactoryRulesOverrides } from './types.js';

const passThrough = vi.fn(() => undefined);

function reject() {
  return { type: 'reject', code: 'forbidden', reason: 'Not allowed.' } as const;
}

describe('defaultFactoryRules', () => {
  it('requires an explicit deployment version', () => {
    expect(() => defaultFactoryRules({ version: '' })).toThrow(/version is required/i);
  });

  it('returns one rules tree with pass-through defaults', () => {
    expect(defaultFactoryRules({ version: 'deployment-7' })).toEqual({
      version: 'deployment-7',
      work: {},
      review: {},
      tools: {},
      github: {},
    });
  });

  it('replaces exact handler leaves while preserving siblings', () => {
    const workEnter = vi.fn(reject);
    const workExit = vi.fn(() => undefined);
    const reviewEnter = vi.fn(() => undefined);
    const toolResult = vi.fn(() => undefined);
    const githubEvent = vi.fn(() => undefined);
    const rules = defaultFactoryRules({
      version: 'deployment-8',
      overrides: {
        work: { planning: { issue: { onEnter: workEnter, onExit: workExit } } },
        review: { intake: { pullRequest: { onEnter: reviewEnter } } },
        tools: { submit_plan: { onResult: toolResult } },
        github: { pullRequestMerged: { onEvent: githubEvent } },
      },
    });

    expect(rules.work.planning?.issue?.onEnter).toBe(workEnter);
    expect(rules.work.planning?.issue?.onExit).toBe(workExit);
    expect(rules.review.intake?.pullRequest?.onEnter).toBe(reviewEnter);
    expect(rules.tools.submit_plan?.onResult).toBe(toolResult);
    expect(rules.github.pullRequestMerged?.onEvent).toBe(githubEvent);
    expect(rules.work.planning?.pullRequest).toBeUndefined();
  });

  it('merges defaults and overrides at each exact handler leaf', () => {
    const defaultEnter = vi.fn(() => undefined);
    const defaultExit = vi.fn(() => undefined);
    const overrideEnter = vi.fn(reject);
    const unrelatedDefault = vi.fn(() => undefined);
    const merged = mergeFactoryRuleOverrides(
      {
        work: {
          planning: {
            issue: { onEnter: defaultEnter, onExit: defaultExit },
            manual: { onEnter: unrelatedDefault },
          },
        },
      },
      { work: { planning: { issue: { onEnter: overrideEnter } } } },
    );

    expect(merged.work.planning?.issue).toEqual({ onEnter: overrideEnter, onExit: defaultExit });
    expect(merged.work.planning?.manual?.onEnter).toBe(unrelatedDefault);
  });

  it('copies override containers so later mutation cannot replace configured leaves', () => {
    const leaf: FactoryBoardRuleLeaf = { onEnter: passThrough };
    const overrides: FactoryRulesOverrides = { work: { intake: { issue: leaf } } };
    const rules = defaultFactoryRules({ version: 'deployment-9', overrides });
    leaf.onEnter = vi.fn(reject);
    expect(rules.work.intake?.issue?.onEnter).toBe(passThrough);
  });
});
