import { describe, expect, it, vi } from 'vitest';
import { defaultFactoryRules, mergeFactoryRuleOverrides } from './defaults.js';
import type {
  FactoryBoardRuleLeaf,
  FactoryGithubRuleContext,
  FactoryLinearRuleContext,
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

function toolContext(
  value: unknown,
  overrides: Partial<FactoryToolResultRuleContext> = {},
): FactoryToolResultRuleContext {
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

function githubContext(
  event: FactoryGithubRuleContext['event'],
  sourceCreatedAt = '2026-07-01T00:00:00Z',
): FactoryGithubRuleContext {
  return {
    ...base,
    actor: { type: 'github', login: 'author', trusted: true, factoryAuthored: false },
    event,
    deliveryId: 'delivery-1',
    factory: { createdAt: '2026-06-01T00:00:00Z' },
    repository: { id: 10, fullName: 'acme/repo' },
    issue: {
      number: 42,
      title: 'Issue 42',
      url: 'https://github.test/acme/repo/issues/42',
      createdAt: sourceCreatedAt,
    },
    pullRequest: {
      number: 17,
      title: 'PR 17',
      url: 'https://github.test/acme/repo/pull/17',
      createdAt: sourceCreatedAt,
      state: 'open',
      merged: false,
      headBranch: 'feature',
      baseBranch: 'main',
    },
  };
}

function linearContext(): FactoryLinearRuleContext {
  return {
    ...base,
    actor: { type: 'human', id: 'user-1' },
    ingress: { type: 'linear', id: 'linear:issue-1:2026-07-02T00:00:00Z' },
    event: 'issueObserved',
    issue: {
      id: 'issue-1',
      identifier: 'ENG-42',
      title: 'Fix intake sync',
      url: 'https://linear.app/acme/issue/ENG-42',
      state: 'Todo',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: 'ada',
      team: 'ENG',
      labels: ['bug'],
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
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
    expect(rules.work.intake?.issue?.onEnter).toBeUndefined();
    expect(rules.work.triage?.issue?.onEnter).toBeTypeOf('function');
    expect(rules.review.intake?.pullRequest?.onEnter).toBeUndefined();
    expect(rules.review.review?.pullRequest?.onEnter).toBeTypeOf('function');
    expect(rules.tools.submit_plan?.onResult).toBeTypeOf('function');
    expect(rules.github.issueOpened?.onEvent).toBeTypeOf('function');
    expect(rules.github.pullRequestOpened?.onEvent).toBeTypeOf('function');
    expect(rules.github.pullRequestMerged?.onEvent).toBeTypeOf('function');
    expect(rules.linear.issueObserved?.onEvent).toBeTypeOf('function');
    expect(rules.work.triage?.linearIssue?.onEnter).toBeTypeOf('function');
  });

  it('materializes observed Linear issues directly in Triage', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).linear.issueObserved?.onEvent;

    expect(await rule?.(linearContext())).toMatchObject({
      type: 'upsertLinkedWorkItem',
      source: 'linear-issue',
      sourceKey: 'linear:ENG-42',
      title: 'ENG-42: Fix intake sync',
      stage: 'triage',
      metadata: { linearIssueId: 'issue-1', linearIssueIdentifier: 'ENG-42' },
    });
  });

  it('does not move an existing Linear issue backward when polling observes an update', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).linear.issueObserved?.onEvent;

    expect(
      await rule?.({
        ...linearContext(),
        item: {
          ...item,
          source: 'linear-issue',
          sourceKey: 'linear:ENG-42',
          stages: ['execute'],
        },
        board: 'work',
        itemRevision: 4,
      }),
    ).toBeUndefined();
  });

  it('starts Linear investigation when a human moves an issue into Triage', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.triage?.linearIssue?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'work'),
      item: {
        ...item,
        source: 'linear-issue',
        sourceKey: 'linear:ENG-42',
        title: 'ENG-42: Fix intake sync',
        url: 'https://linear.app/acme/issue/ENG-42',
      },
      source: 'linearIssue',
      stage: 'triage',
      fromStage: 'intake',
      toStage: 'triage',
    } as FactoryStageRuleContext;

    expect(await rule?.(context)).toMatchObject({
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'factory-triage',
      arguments: 'Linear issue ENG-42 (https://linear.app/acme/issue/ENG-42)',
    });
  });

  it('starts the same investigation when a human moves an issue into Triage', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.triage?.issue?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'work'),
      stage: 'triage',
      fromStage: 'intake',
      toStage: 'triage',
    } as FactoryStageRuleContext;
    expect(await rule?.(context)).toMatchObject({
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'factory-triage',
      arguments: 'GitHub issue (https://github.test/acme/repo/issues/42)',
    });
  });

  it('starts PR understanding when a human moves a pull request into Review', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).review.review?.pullRequest?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'review'),
      stage: 'review',
      fromStage: 'intake',
      toStage: 'review',
    } as FactoryStageRuleContext;
    expect(await rule?.(context)).toMatchObject({
      type: 'invokeSkill',
      role: 'review',
      skillName: 'factory-review',
      arguments: 'GitHub pull request (https://github.test/acme/repo/issues/42)',
    });
  });

  it.each([
    ['issue', 'github-issue'],
    ['linearIssue', 'linear-issue'],
    ['manual', 'manual'],
  ] as const)('starts factory planning when a %s item enters Planning', async (source, itemSource) => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.planning?.[source]?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'work'),
      item: { ...item, source: itemSource },
      source,
      stage: 'planning',
      fromStage: 'triage',
      toStage: 'planning',
    } as FactoryStageRuleContext;

    expect(await rule?.(context)).toMatchObject({
      type: 'invokeSkill',
      idempotencyKey: 'delivery-1:factory-plan',
      role: 'plan',
      skillName: 'factory-plan',
      arguments: 'Work item (https://github.test/acme/repo/issues/42)',
    });
  });

  it('keys the planning skill invocation once per ingress', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.planning?.issue?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'work'),
      stage: 'planning',
      fromStage: 'triage',
      toStage: 'planning',
    } as FactoryStageRuleContext;

    const first = await rule?.(context);
    const second = await rule?.(context);
    expect(first).toMatchObject({ idempotencyKey: 'delivery-1:factory-plan' });
    expect(second).toMatchObject({ idempotencyKey: 'delivery-1:factory-plan' });
    expect(await rule?.({ ...context, ingress: { type: 'human' as const, id: 'delivery-2' } })).toMatchObject({
      idempotencyKey: 'delivery-2:factory-plan',
    });
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
      toolContext(
        { content: 'Plan approved. Proceed.' },
        { actor: { type: 'agent', bindingId: 'binding-1', role: 'chat' } },
      ),
      toolContext({ content: 'Plan approved. Proceed.' }, { item: { ...item, stages: ['intake'] } }),
      toolContext({ content: 'Plan approved. Proceed.' }, { result: { status: 'error', value: 'failed' } }),
    ]) {
      expect(await rule?.(context)).toBeUndefined();
    }
  });

  it.each(['issueOpened', 'pullRequestOpened'] as const)(
    'advances trusted %s authors and leaves untrusted authors in Intake',
    async event => {
      const rules = defaultFactoryRules({ version: 'deployment-7' });
      const trustedStage = event === 'issueOpened' ? 'triage' : 'review';
      const trusted = githubContext(event);
      const untrusted = {
        ...githubContext(event),
        actor: { type: 'github', login: 'reader', trusted: false, factoryAuthored: false } as const,
      };
      const factoryAuthored = {
        ...githubContext(event),
        actor: { type: 'github', login: 'factory-bot', trusted: false, factoryAuthored: true } as const,
      };

      expect(await rules.github[event]?.onEvent?.(trusted)).toMatchObject({
        type: 'upsertLinkedWorkItem',
        stage: trustedStage,
      });
      expect(await rules.github[event]?.onEvent?.(untrusted)).toMatchObject({
        type: 'upsertLinkedWorkItem',
        stage: 'intake',
      });
      expect(await rules.github[event]?.onEvent?.(factoryAuthored)).toMatchObject({
        type: 'upsertLinkedWorkItem',
        stage: 'intake',
      });
    },
  );

  it.each(['issueOpened', 'pullRequestOpened'] as const)(
    'keeps trusted %s items created before the Factory in Intake',
    async event => {
      const rules = defaultFactoryRules({ version: 'deployment-7' });
      const olderContext = githubContext(event, '2026-05-01T00:00:00Z');

      expect(await rules.github[event]?.onEvent?.(olderContext)).toMatchObject({
        type: 'upsertLinkedWorkItem',
        stage: 'intake',
      });
    },
  );

  it('uses the same issue and pull-request identities as board Intake', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    expect(await rules.github.issueOpened?.onEvent?.(githubContext('issueOpened'))).toMatchObject({
      source: 'github-issue',
      sourceKey: 'github-issue:42',
    });
    expect(await rules.github.pullRequestOpened?.onEvent?.(githubContext('pullRequestOpened'))).toMatchObject({
      source: 'github-pr',
      sourceKey: 'github-pr:17',
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
    const linearEvent = vi.fn(() => undefined);
    const rules = defaultFactoryRules({
      version: 'deployment-8',
      overrides: {
        work: { planning: { issue: { onEnter: workEnter, onExit: workExit } } },
        review: { intake: { pullRequest: { onEnter: reviewEnter } } },
        tools: { submit_plan: { onResult: toolResult } },
        github: { pullRequestMerged: { onEvent: githubEvent } },
        linear: { issueObserved: { onEvent: linearEvent } },
      },
    });

    expect(rules.work.planning?.issue?.onEnter).toBe(workEnter);
    expect(rules.work.planning?.issue?.onExit).toBe(workExit);
    expect(rules.review.intake?.pullRequest?.onEnter).toBe(reviewEnter);
    expect(rules.tools.submit_plan?.onResult).toBe(toolResult);
    expect(rules.github.pullRequestMerged?.onEvent).toBe(githubEvent);
    expect(rules.github.issueOpened?.onEvent).toBeTypeOf('function');
    expect(rules.linear.issueObserved?.onEvent).toBe(linearEvent);
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
