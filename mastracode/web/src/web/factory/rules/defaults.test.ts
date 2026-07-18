import { describe, expect, it, vi } from 'vitest';
import { defaultFactoryRules, mergeFactoryRuleOverrides } from './defaults.js';
import type {
  FactoryBoardRuleLeaf,
  FactoryGithubRuleContext,
  FactoryRulesOverrides,
  FactoryStageRuleContext,
  FactoryToolResultRuleContext,
} from './types.js';

const passThrough = vi.fn(() => undefined);
const base = {
  tenant: { orgId: 'org-1', projectId: 'project-1' },
  ingress: { type: 'github' as const, id: 'delivery-1' },
  cause: 'test',
  causalChain: [],
  ruleSetVersion: 'deployment-1',
};
const item = {
  id: 'item-1',
  source: 'github-issue' as const,
  sourceKey: 'github:10:issue:42',
  parentWorkItemId: null,
  title: 'Issue 42',
  url: 'https://github.test/acme/repo/issues/42',
  stages: ['intake'],
};

function reject() {
  return { type: 'reject', code: 'forbidden', reason: 'Not allowed.' } as const;
}

function stageContext(actor: FactoryStageRuleContext['actor'], board: 'work' | 'review'): FactoryStageRuleContext {
  const source = board === 'work' ? 'issue' : 'pullRequest';
  return {
    ...base,
    actor,
    item: { ...item, source: board === 'work' ? 'github-issue' : 'github-pr' },
    board,
    itemRevision: 1,
    source,
    stage: 'intake',
    fromStage: 'intake',
    toStage: 'intake',
  };
}

function toolContext(value: unknown, overrides: Partial<FactoryToolResultRuleContext> = {}): FactoryToolResultRuleContext {
  return {
    ...base,
    actor: { type: 'agent', bindingId: 'binding-1', role: 'plan' },
    ingress: { type: 'toolResult', id: 'tool-ingress-1' },
    item: { ...item, stages: ['planning'] },
    board: 'work',
    itemRevision: 4,
    toolName: 'submit_plan',
    threadId: 'thread-1',
    assistantMessageId: 'message-1',
    toolCallId: 'call-1',
    result: { status: 'success', value: value as never },
    ...overrides,
  };
}

function githubContext(event: FactoryGithubRuleContext['event']): FactoryGithubRuleContext {
  return {
    ...base,
    actor: { type: 'github', login: 'author', trusted: true, factoryAuthored: false },
    event,
    deliveryId: 'delivery-1',
    repository: { id: 10, fullName: 'acme/repo' },
    issue: { number: 42, title: 'Issue 42', url: 'https://github.test/acme/repo/issues/42' },
    pullRequest: {
      number: 17,
      title: 'PR 17',
      url: 'https://github.test/acme/repo/pull/17',
      state: 'open',
      merged: false,
      headBranch: 'feature',
      baseBranch: 'main',
    },
  };
}

describe('defaultFactoryRules', () => {
  it('requires an explicit deployment version', () => {
    expect(() => defaultFactoryRules({ version: '' })).toThrow(/version is required/i);
  });

  it('ships ordinary visible default leaves', () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    expect(rules.version).toBe('deployment-7');
    expect(rules.work.intake?.issue?.onEnter).toBeTypeOf('function');
    expect(rules.review.intake?.pullRequest?.onEnter).toBeTypeOf('function');
    expect(rules.tools.submit_plan?.onResult).toBeTypeOf('function');
    expect(rules.github.issueOpened?.onEvent).toBeTypeOf('function');
    expect(rules.github.pullRequestOpened?.onEvent).toBeTypeOf('function');
    expect(rules.github.pullRequestMerged?.onEvent).toBeTypeOf('function');
  });

  it.each([
    ['write', { type: 'github', login: 'writer', trusted: true, factoryAuthored: false } as const, true],
    ['admin', { type: 'github', login: 'admin', trusted: true, factoryAuthored: false } as const, true],
    ['read', { type: 'github', login: 'reader', trusted: false, factoryAuthored: false } as const, false],
    ['none', { type: 'github', login: 'stranger', trusted: false, factoryAuthored: false } as const, false],
    ['error', { type: 'github', login: 'unknown', trusted: false, factoryAuthored: false } as const, false],
  ])('investigates issue authors normalized from %s permission only when trusted', async (_permission, actor, expected) => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.intake?.issue?.onEnter;
    const decision = await rule?.(stageContext(actor, 'work'));
    expect(decision?.type === 'invokeSkill').toBe(expected);
    if (decision?.type === 'invokeSkill') expect(decision.skillName).toBe('understand-issue');
  });

  it('reviews trusted or explicitly Factory-authored pull requests without heuristics', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).review.intake?.pullRequest?.onEnter;
    const trusted = await rule?.(
      stageContext({ type: 'github', login: 'writer', trusted: true, factoryAuthored: false }, 'review'),
    );
    const factoryAuthored = await rule?.(
      stageContext({ type: 'github', login: 'bot', trusted: false, factoryAuthored: true }, 'review'),
    );
    const untrusted = await rule?.(
      stageContext({ type: 'github', login: 'reader', trusted: false, factoryAuthored: false }, 'review'),
    );
    expect(trusted?.type).toBe('invokeSkill');
    expect(factoryAuthored?.type).toBe('invokeSkill');
    expect(untrusted).toBeUndefined();
  });

  it('advances only an approved plan from a bound planning role', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).tools.submit_plan?.onResult;
    expect(await rule?.(toolContext({ content: 'Plan approved. Proceed with implementation.' }))).toMatchObject({
      type: 'transition',
      board: 'work',
      stage: 'execute',
    });
    for (const context of [
      toolContext({ content: 'Plan submitted for review.' }),
      toolContext({ content: 'Plan was not approved. Revise it.' }),
      toolContext({ status: 'approved' }),
      toolContext({ content: 'Plan approved. Proceed.' }, { actor: { type: 'agent', bindingId: 'binding-1', role: 'chat' } }),
      toolContext({ content: 'Plan approved. Proceed.' }, { item: { ...item, stages: ['intake'] } }),
      toolContext({ content: 'Plan approved. Proceed.' }, { result: { status: 'error', value: 'failed' } }),
    ]) {
      expect(await rule?.(context)).toBeUndefined();
    }
  });

  it('materializes stable issue and pull-request source keys', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    expect(await rules.github.issueOpened?.onEvent?.(githubContext('issueOpened'))).toMatchObject({
      type: 'upsertLinkedWorkItem',
      source: 'github-issue',
      sourceKey: 'github:10:issue:42',
      stage: 'intake',
    });
    expect(await rules.github.pullRequestOpened?.onEvent?.(githubContext('pullRequestOpened'))).toMatchObject({
      type: 'upsertLinkedWorkItem',
      source: 'github-pr',
      sourceKey: 'github:10:pull-request:17',
      stage: 'intake',
    });
  });

  it('reminds the linked Work agent after merge without transitioning to Done', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const context = githubContext('pullRequestMerged');
    context.item = item;
    context.pullRequest = { ...context.pullRequest!, state: 'closed', merged: true };
    const decision = await rules.github.pullRequestMerged?.onEvent?.(context);
    expect(decision).toMatchObject({ type: 'sendMessage', role: 'work' });
    expect(decision).not.toMatchObject({ type: 'transition', stage: 'done' });
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
    expect(rules.github.issueOpened?.onEvent).toBeTypeOf('function');
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
