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
  metadata: null as Record<string, unknown> | null,
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
      draft: false,
      merged: false,
      assignees: ['assignee'],
      requestedReviewers: ['reviewer'],
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
      creator: 'grace',
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
    expect(rules.work.intake?.issue?.onEnter).toBeTypeOf('function');
    expect(rules.work.triage?.issue?.onEnter).toBeTypeOf('function');
    expect(rules.work.done?.issue?.onEnter).toBeTypeOf('function');
    expect(rules.review.intake?.pullRequest?.onEnter).toBeTypeOf('function');
    expect(rules.review.review?.pullRequest?.onEnter).toBeTypeOf('function');
    expect(rules.tools.submit_plan?.onResult).toBeTypeOf('function');
    expect(rules.github.issueOpened?.onEvent).toBeTypeOf('function');
    expect(rules.github.issueEdited?.onEvent).toBeTypeOf('function');
    expect(rules.github.issueCommentCreated?.onEvent).toBeTypeOf('function');
    expect(rules.github.issueCommentEdited?.onEvent).toBeTypeOf('function');
    expect(rules.github.issueCommentDeleted?.onEvent).toBeTypeOf('function');
    expect(rules.github.pullRequestOpened?.onEvent).toBeTypeOf('function');
    expect(rules.github.pullRequestUpdated?.onEvent).toBeTypeOf('function');
    expect(rules.github.pullRequestReviewRequested?.onEvent).toBeTypeOf('function');
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
      metadata: { linearIssueId: 'issue-1', identifier: 'ENG-42' },
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

  it('transitions linked GitHub issue cards deterministically on closure', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).github.issueClosed?.onEvent;
    const github = githubContext('issueClosed');
    const done = await rule?.({
      ...github,
      item: { ...item, stages: ['planning'] },
      board: 'work',
      itemRevision: 4,
    });
    const canceled = await rule?.({
      ...github,
      ingress: { type: 'github', id: 'delivery-not-planned' },
      item: { ...item, stages: ['planning'] },
      board: 'work',
      itemRevision: 4,
      issue: {
        number: 42,
        title: 'Issue 42',
        url: 'https://github.test/acme/repo/issues/42',
        createdAt: '2026-07-01T00:00:00Z',
        stateReason: 'not_planned',
      },
    });

    expect(done).toMatchObject({
      type: 'transition',
      board: 'work',
      stage: 'done',
      idempotencyKey: 'delivery-1:issue-closed',
      message: { text: 'GitHub issue #42 was closed; this Work card was moved to Done.' },
    });
    expect(canceled).toMatchObject({
      type: 'transition',
      stage: 'canceled',
      idempotencyKey: 'delivery-not-planned:issue-closed',
      message: { text: 'GitHub issue #42 was closed (not_planned); this Work card was moved to Canceled.' },
    });
  });

  it('only closes non-terminal linked work-board issue cards', async () => {
    const githubRule = defaultFactoryRules({ version: 'deployment-7' }).github.issueClosed?.onEvent;
    const linearRule = defaultFactoryRules({ version: 'deployment-7' }).linear.issueClosed?.onEvent;
    const github = githubContext('issueClosed');
    const linear = linearContext();

    expect(
      githubRule?.({ ...github, item: { ...item, source: 'github-pr' }, board: 'review', itemRevision: 1 }),
    ).toBeUndefined();
    expect(
      githubRule?.({ ...github, item: { ...item, stages: ['done'] }, board: 'work', itemRevision: 1 }),
    ).toBeUndefined();
    expect(
      linearRule?.({
        ...linear,
        event: 'issueClosed',
        item: { ...item, source: 'linear-issue', stages: ['planning'] },
        board: 'work',
        itemRevision: 1,
        issue: { ...linear.issue, stateType: 'completed' },
      }),
    ).toMatchObject({
      type: 'transition',
      stage: 'done',
      idempotencyKey: 'linear:issue-1:2026-07-02T00:00:00Z:issue-closed',
    });
    expect(
      linearRule?.({
        ...linear,
        event: 'issueClosed',
        item: { ...item, source: 'linear-issue', stages: ['canceled'] },
        board: 'work',
        itemRevision: 1,
        issue: { ...linear.issue, stateType: 'canceled' },
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

  it.each(['issueEdited', 'issueCommentCreated', 'issueCommentEdited', 'issueCommentDeleted'] as const)(
    're-runs investigation when %s arrives for a linked GitHub issue',
    async event => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github[event]?.onEvent;
      const decision = await rule?.({
        ...githubContext(event),
        item: { ...item, source: 'github-issue' },
        board: 'work',
        itemRevision: 3,
      });
      expect(decision).toMatchObject({
        type: 'invokeSkill',
        role: 'triage',
        skillName: 'factory-triage',
        arguments: expect.stringContaining('https://github.test/acme/repo/issues/42'),
      });
    },
  );

  it('starts investigation when a board drag or reconciliation moves an issue into Triage', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.triage?.issue?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'work'),
      cause: 'board_drag',
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
    expect(await rule?.({ ...context, cause: 'linked_item_reconciled' })).toMatchObject({
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'factory-triage',
    });
  });

  it('cleans up triage labels whenever a GitHub issue moves to Done', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.done?.issue?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'work'),
      cause: 'board_drag',
      stage: 'done',
      fromStage: 'intake',
      toStage: 'done',
    } as FactoryStageRuleContext;

    expect(await rule?.(context)).toMatchObject({
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'factory-complete-issue',
      arguments: 'GitHub issue (https://github.test/acme/repo/issues/42)',
    });
    expect(await rule?.({ ...context, fromStage: 'triage' })).toMatchObject({
      type: 'invokeSkill',
      skillName: 'factory-complete-issue',
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
    const decision = await rule?.(context);
    expect(decision).toMatchObject({
      type: 'invokeSkill',
      role: 'review',
      skillName: 'factory-review',
      arguments: 'GitHub pull request (https://github.test/acme/repo/issues/42)',
    });
    // Human-triggered review passes must not cancel any in-flight run.
    expect(decision).not.toHaveProperty('cancelInFlight');
  });

  it('cancels an in-flight review pass and dispatches factory-rereview when a push into an already-reviewed PR restarts Review', async () => {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).review.review?.pullRequest?.onEnter;
    const context = {
      ...stageContext({ type: 'github', login: 'author', trusted: true, factoryAuthored: false }, 'review'),
      cause: 'github.pullRequestUpdated',
      stage: 'review',
      fromStage: 'done',
      toStage: 'review',
    } as FactoryStageRuleContext;
    expect(await rule?.(context)).toMatchObject({
      type: 'invokeSkill',
      role: 'review',
      skillName: 'factory-rereview',
      cancelInFlight: true,
    });
  });

  it('cancels an in-flight review pass but stays on factory-review when the re-entry did not follow a completed pass', async () => {
    // A first-time review that was superseded before it finished re-enters
    // Review from Review itself. There is no prior published review to
    // reconcile against, so the fresh pass is a regular factory-review — the
    // cancellation just clears the aborted in-flight run.
    const rule = defaultFactoryRules({ version: 'deployment-7' }).review.review?.pullRequest?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'review'),
      stage: 'review',
      fromStage: 'review',
      toStage: 'review',
    } as FactoryStageRuleContext;
    expect(await rule?.(context)).toMatchObject({
      type: 'invokeSkill',
      role: 'review',
      skillName: 'factory-review',
      cancelInFlight: true,
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

  it.each([
    ['issue', 'github-issue'],
    ['linearIssue', 'linear-issue'],
    ['manual', 'manual'],
  ] as const)('starts building a %s item from a prompt, with no skill to activate', async (source, itemSource) => {
    // The approved plan is the specification, and opening the pull request is
    // what signals the stage is done, so this run needs no skill contract.
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.execute?.[source]?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'work'),
      item: { ...item, source: itemSource },
      source,
      stage: 'execute',
      fromStage: 'planning',
      toStage: 'execute',
    } as FactoryStageRuleContext;

    const decision = await rule?.(context);
    expect(decision).toMatchObject({
      type: 'invokeSkill',
      idempotencyKey: 'delivery-1:build',
      role: 'work',
      prompt:
        'Implement the approved plan for https://github.test/acme/repo/issues/42. Open a pull request when the work is ready for review.',
    });
    expect(decision).not.toHaveProperty('skillName');
  });

  function buildPrompt(source: 'issue' | 'linearIssue' | 'manual', metadata: Record<string, unknown> | null) {
    const rule = defaultFactoryRules({ version: 'deployment-7' }).work.execute?.[source]?.onEnter;
    const context = {
      ...stageContext({ type: 'human', id: 'user-1' }, 'work'),
      item: { ...item, metadata },
      source,
      stage: 'execute',
      fromStage: 'planning',
      toStage: 'execute',
    } as FactoryStageRuleContext;
    return Promise.resolve(rule?.(context)).then(decision => (decision as { prompt?: string } | undefined)?.prompt);
  }

  it('asks the builder to credit the reporter whose issue caused the work', async () => {
    const prompt = await buildPrompt('issue', { author: 'octocat' });

    expect(prompt).toContain('reported by @octocat');
    expect(prompt).toContain('Co-Authored-By: octocat <ID+octocat@users.noreply.github.com>');
    // Intake stamps a login but never the numeric id the trailer needs, so the
    // builder is told where to get it rather than left to invent one.
    expect(prompt).toContain('gh api users/octocat --jq .id');
  });

  it('credits the login that intake actually stamped when the issue was opened', async () => {
    // The unit tests above hand `buildWorkItem` its metadata, so they pass even if
    // intake writes the reporter under a different key than the builder reads.
    // Join the two halves: take the metadata `issueOpened` really produces and
    // feed that to the build rule, so a rename on either side fails here.
    const opened = await defaultFactoryRules({ version: 'deployment-7' }).github.issueOpened?.onEvent?.({
      ...githubContext('issueOpened'),
      actor: { type: 'github', login: 'reporter-login', trusted: true, factoryAuthored: false },
    });
    const stamped = (opened as { metadata?: Record<string, unknown> } | undefined)?.metadata ?? null;

    expect(stamped).toMatchObject({ author: 'reporter-login' });
    expect(await buildPrompt('issue', stamped)).toContain(
      'Co-Authored-By: reporter-login <ID+reporter-login@users.noreply.github.com>',
    );
  });

  it('credits nobody when the reporter account is gone', async () => {
    // The issue poller stamps `__unknown__` when GitHub returns no author, which
    // is a string and not a bot, so only the login grammar stops it from becoming
    // a trailer crediting an account nobody owns.
    expect(await buildPrompt('issue', { author: '__unknown__' })).not.toContain('Co-Authored-By');
  });

  it('credits nobody when the reporter is the Factory itself', async () => {
    expect(await buildPrompt('issue', { author: 'mastra-platform[bot]' })).not.toContain('Co-Authored-By');
  });

  it.each([
    ['linearIssue', 'a Linear display name'],
    ['manual', 'nothing at all'],
  ] as const)('credits nobody on a %s card, whose reporter is %s', async (source, _reporterKind) => {
    // Only a GitHub login resolves to the identity a trailer needs; anything
    // else would produce a trailer that credits no real account.
    expect(await buildPrompt(source, { author: 'Ada Lovelace' })).not.toContain('Co-Authored-By');
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

  describe('pullRequestReviewSubmitted', () => {
    function reviewContext(overrides: Partial<FactoryGithubRuleContext> = {}): FactoryGithubRuleContext {
      return {
        ...githubContext('pullRequestReviewSubmitted'),
        item,
        board: 'work',
        itemRevision: 5,
        review: {
          id: 99,
          state: 'changes_requested',
          url: 'https://github.test/acme/repo/pull/17#pullrequestreview-99',
        },
        ...overrides,
      };
    }

    it('wakes the authoring Work agent when changes are requested', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestReviewSubmitted?.onEvent;
      const decision = await rule?.(reviewContext());
      expect(decision).toMatchObject({
        type: 'sendMessage',
        idempotencyKey: 'delivery-1:address-review-feedback',
        role: 'work',
        priority: 'high',
      });
      // The message has to carry the review URL: the agent reads the individual
      // line comments from its own PR subscription, not from this message.
      expect((decision as { message: string }).message).toContain('#pullrequestreview-99');
    });

    it('stays quiet for reviews that are not asking for changes', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestReviewSubmitted?.onEvent;
      for (const state of ['approved', 'commented', 'dismissed']) {
        expect(
          await rule?.(reviewContext({ review: { id: 99, state, url: 'https://github.test/r' } })),
        ).toBeUndefined();
      }
    });

    it('stays quiet when the pull request is closed or merged', async () => {
      // A closed or merged PR has no branch left to push fixes to, so waking
      // the author would only send them to a dead end.
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestReviewSubmitted?.onEvent;
      const base = reviewContext();
      for (const pullRequest of [
        { ...base.pullRequest!, state: 'closed' },
        { ...base.pullRequest!, merged: true },
      ]) {
        expect(await rule?.({ ...base, pullRequest })).toBeUndefined();
      }
    });

    it('never fires on the Review card that posted the review', async () => {
      // Only the PR's author can act on the feedback. Reacting on the Review
      // card would loop the reviewer against its own output.
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestReviewSubmitted?.onEvent;
      expect(await rule?.(reviewContext({ board: 'review' }))).toBeUndefined();
      expect(await rule?.(reviewContext({ item: undefined, board: undefined }))).toBeUndefined();
      expect(await rule?.(reviewContext({ review: undefined }))).toBeUndefined();
    });
  });

  describe('pullRequestCommentCreated', () => {
    function commentContext(overrides: Partial<FactoryGithubRuleContext> = {}): FactoryGithubRuleContext {
      return {
        ...githubContext('pullRequestCommentCreated'),
        item,
        board: 'work',
        itemRevision: 5,
        issueComment: {
          id: 555,
          body: 'This needs a null check.',
          url: 'https://github.test/acme/repo/pull/17#issuecomment-555',
          author: 'reviewer',
        },
        ...overrides,
      };
    }

    it('wakes the authoring Work agent when someone comments on the pull request', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestCommentCreated?.onEvent;
      const decision = await rule?.(commentContext());
      expect(decision).toMatchObject({
        type: 'sendMessage',
        idempotencyKey: 'delivery-1:address-pull-request-comment',
        role: 'work',
        priority: 'high',
      });
      expect((decision as { message: string }).message).toContain('#issuecomment-555');
    });

    it('ignores Factory-authored comments so the Work agent cannot wake itself', async () => {
      // `factoryAuthored` cannot tell the Work role from the Review role, so
      // reacting to Factory's own comments would let the Work agent's progress
      // notes wake it in a loop.
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestCommentCreated?.onEvent;
      expect(
        await rule?.(
          commentContext({
            actor: { type: 'github', login: 'factory[bot]', trusted: true, factoryAuthored: true },
          }),
        ),
      ).toBeUndefined();
    });

    it('stays quiet on the Review card and on pull requests that are no longer open', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestCommentCreated?.onEvent;
      expect(await rule?.(commentContext({ board: 'review' }))).toBeUndefined();
      expect(await rule?.(commentContext({ issueComment: undefined }))).toBeUndefined();
      const openPr = commentContext().pullRequest!;
      expect(await rule?.(commentContext({ pullRequest: { ...openPr, state: 'closed' } }))).toBeUndefined();
      expect(await rule?.(commentContext({ pullRequest: { ...openPr, merged: true } }))).toBeUndefined();
    });

    it('wakes on the review verdict Factory had to post as a comment on its own pull request', async () => {
      // GitHub refuses a self-review, so on Factory-authored PRs the verdict
      // arrives as a comment under Factory's own login. It is the handoff, so it
      // has to survive the self-loop guard.
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestCommentCreated?.onEvent;
      const decision = await rule?.(
        commentContext({
          actor: { type: 'github', login: 'factory[bot]', trusted: true, factoryAuthored: true },
          issueComment: {
            id: 556,
            body: '**Verdict: Request changes**\n\n## Findings\n\nThe retry loop never terminates.',
            url: 'https://github.test/acme/repo/pull/17#issuecomment-556',
            author: 'factory[bot]',
          },
        }),
      );
      expect(decision).toMatchObject({ type: 'sendMessage', role: 'work', priority: 'high' });
    });

    it('ignores a Factory verdict that approves, and a verdict only quoted in the body', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestCommentCreated?.onEvent;
      const factoryActor = { type: 'github', login: 'factory[bot]', trusted: true, factoryAuthored: true } as const;
      expect(
        await rule?.(
          commentContext({
            actor: factoryActor,
            issueComment: { id: 557, body: '**Verdict: Approve**\n\nLooks good.', author: 'factory[bot]' },
          }),
        ),
      ).toBeUndefined();
      expect(
        await rule?.(
          commentContext({
            actor: factoryActor,
            issueComment: { id: 558, body: 'Pushed the fixes.\n\n> Verdict: request changes', author: 'factory[bot]' },
          }),
        ),
      ).toBeUndefined();
      // A negated first line must not read as a request for changes.
      expect(
        await rule?.(
          commentContext({
            actor: factoryActor,
            issueComment: { id: 559, body: '**Verdict: do not request changes**\n\nAll good.', author: 'factory[bot]' },
          }),
        ),
      ).toBeUndefined();
    });
  });

  describe('pullRequestReviewRequested', () => {
    const prItem = {
      ...item,
      source: 'github-pr' as const,
      sourceKey: 'github-pr:17',
      title: 'PR 17',
      url: 'https://github.test/acme/repo/pull/17',
      stages: ['done'],
    };

    function reReviewContext(overrides: Partial<FactoryGithubRuleContext> = {}): FactoryGithubRuleContext {
      return {
        ...githubContext('pullRequestReviewRequested'),
        item: prItem,
        board: 'review',
        itemRevision: 5,
        reviewRequest: { reviewer: 'factory-app[bot]', factoryReviewer: true },
        ...overrides,
      };
    }

    it('re-enters Review when review is re-requested from Factory on a finished card', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestReviewRequested?.onEvent;
      expect(await rule?.(reReviewContext())).toMatchObject({
        type: 'transition',
        idempotencyKey: 'delivery-1:re-review-requested',
        board: 'review',
        stage: 'review',
      });
    });

    it('ignores re-requests that do not target Factory or come from untrusted senders', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestReviewRequested?.onEvent;
      for (const context of [
        // Review requested from a human reviewer, not Factory's bot.
        reReviewContext({ reviewRequest: { reviewer: 'ada', factoryReviewer: false } }),
        reReviewContext({ reviewRequest: undefined }),
        // Untrusted sender.
        reReviewContext({ actor: { type: 'github', login: 'reader', trusted: false, factoryAuthored: false } }),
        // Factory-authored ingress must not restart its own review.
        reReviewContext({ actor: { type: 'github', login: 'factory-app[bot]', trusted: true, factoryAuthored: true } }),
        // No linked Review card.
        reReviewContext({ item: undefined, board: undefined, itemRevision: undefined }),
        // Card already in Reviewing: a pass is pending or running.
        reReviewContext({ item: { ...prItem, stages: ['review'] } }),
      ]) {
        expect(await rule?.(context)).toBeUndefined();
      }
    });

    it('ignores re-requests on closed or merged pull requests', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestReviewRequested?.onEvent;
      const closed = reReviewContext();
      closed.pullRequest = { ...closed.pullRequest!, state: 'closed' };
      const merged = reReviewContext();
      merged.pullRequest = { ...merged.pullRequest!, merged: true };
      expect(await rule?.(closed)).toBeUndefined();
      expect(await rule?.(merged)).toBeUndefined();
    });
  });

  describe('pullRequestUpdated', () => {
    const prItem = {
      ...item,
      source: 'github-pr' as const,
      sourceKey: 'github-pr:17',
      title: 'PR 17',
      url: 'https://github.test/acme/repo/pull/17',
      stages: ['done'],
    };

    function pushContext(overrides: Partial<FactoryGithubRuleContext> = {}): FactoryGithubRuleContext {
      return {
        ...githubContext('pullRequestUpdated'),
        item: prItem,
        board: 'review',
        itemRevision: 5,
        ...overrides,
      };
    }

    it('re-enters Review when a push arrives for a PR whose card already finished Reviewing', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestUpdated?.onEvent;
      expect(await rule?.(pushContext())).toMatchObject({
        type: 'transition',
        idempotencyKey: 'delivery-1:re-review-updated',
        board: 'review',
        stage: 'review',
      });
    });

    it('supersedes the pass in flight when a push lands on a card still in Reviewing', async () => {
      // The push invalidates whatever the running pass is reading, so it has to
      // start over on the new head. Re-entering the stage is how that pass gets
      // cancelled; dropping the push would strand the review on stale code.
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestUpdated?.onEvent;
      expect(await rule?.(pushContext({ item: { ...prItem, stages: ['review'] } }))).toMatchObject({
        type: 'transition',
        board: 'review',
        stage: 'review',
        // Without the re-entry flag a same-stage transition is inert and the
        // in-flight pass is never superseded.
        reenter: true,
      });
    });

    it('does nothing when the PR is still in Intake, is unlinked, or is not on the Review board', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestUpdated?.onEvent;
      for (const context of [
        // Card is still in intake — a review pass has not started yet.
        pushContext({ item: { ...prItem, stages: ['intake'] } }),
        // No linked Review card to move.
        pushContext({ item: undefined, board: undefined, itemRevision: undefined }),
        // Card exists but is bound to the Work board (not a PR review card).
        pushContext({ item: { ...prItem, source: 'github-issue', stages: ['done'] }, board: 'work' }),
      ]) {
        expect(await rule?.(context)).toBeUndefined();
      }
    });

    it('ignores push events on closed or merged pull requests', async () => {
      const rule = defaultFactoryRules({ version: 'deployment-7' }).github.pullRequestUpdated?.onEvent;
      const closed = pushContext();
      closed.pullRequest = { ...closed.pullRequest!, state: 'closed' };
      const merged = pushContext();
      merged.pullRequest = { ...merged.pullRequest!, merged: true };
      expect(await rule?.(closed)).toBeUndefined();
      expect(await rule?.(merged)).toBeUndefined();
    });
  });

  it.each(['issueOpened', 'pullRequestOpened'] as const)(
    'keeps every %s in Intake and stamps whether it may be picked up on its own',
    async event => {
      const rules = defaultFactoryRules({ version: 'deployment-7' });
      const trusted = githubContext(event);
      const untrusted = {
        ...githubContext(event),
        actor: { type: 'github', login: 'reader', trusted: false, factoryAuthored: false } as const,
      };
      const factoryAuthored = {
        ...githubContext(event),
        actor: { type: 'github', login: 'factory-bot', trusted: false, factoryAuthored: true } as const,
      };

      const expectedEligibility = {
        issueOpened: { trusted: true, factoryAuthored: false },
        pullRequestOpened: { trusted: true, factoryAuthored: true },
      }[event];

      for (const [actor, eligible] of [
        [trusted, expectedEligibility.trusted],
        [untrusted, false],
        [factoryAuthored, expectedEligibility.factoryAuthored],
      ] as const) {
        expect(await rules.github[event]?.onEvent?.(actor)).toMatchObject({
          type: 'upsertLinkedWorkItem',
          stage: 'intake',
          metadata: { autoStartCandidate: eligible },
        });
      }
    },
  );

  it('suggests a review from Intake only for stamped pull requests materialized by webhook', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const rule = rules.review.intake?.pullRequest?.onEnter;

    expect(
      await rule?.({
        ...stageContext({ type: 'system', id: 'factory-rule-dispatcher' }, 'review'),
        cause: 'linked_item_materialized',
        item: { ...item, source: 'github-pr' as const, metadata: { autoStartCandidate: true } },
      }),
    ).toMatchObject({ type: 'invokeSkill', role: 'review', skillName: 'factory-review' });

    // An untrusted author's PR gets no suggestion — the card waits for a click.
    expect(
      await rule?.({
        ...stageContext({ type: 'system', id: 'factory-rule-dispatcher' }, 'review'),
        cause: 'linked_item_materialized',
        item: { ...item, source: 'github-pr' as const, metadata: { autoStartCandidate: false } },
      }),
    ).toBeUndefined();

    // A candidate filed by hand is not an arrival.
    expect(
      await rule?.({
        ...stageContext({ type: 'human', id: 'user-1' }, 'review'),
        cause: 'board_drag',
        item: { ...item, source: 'github-pr' as const, metadata: { autoStartCandidate: true } },
      }),
    ).toBeUndefined();
  });

  it('suggests an investigation from Intake only for stamped issues materialized by webhook', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const rule = rules.work.intake?.issue?.onEnter;

    expect(
      await rule?.({
        ...stageContext({ type: 'system', id: 'factory-rule-dispatcher' }, 'work'),
        cause: 'linked_item_materialized',
        item: { ...item, metadata: { autoStartCandidate: true } },
      }),
    ).toMatchObject({ type: 'invokeSkill', role: 'triage', skillName: 'factory-triage' });

    expect(
      await rule?.({
        ...stageContext({ type: 'system', id: 'factory-rule-dispatcher' }, 'work'),
        cause: 'linked_item_materialized',
        item: { ...item, metadata: {} },
      }),
    ).toBeUndefined();
  });

  it('keeps a factory-authored pull request opened before the Factory from being picked up on its own', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const older = {
      ...githubContext('pullRequestOpened', '2026-05-01T00:00:00Z'),
      actor: { type: 'github', login: 'factory-bot', trusted: false, factoryAuthored: true } as const,
    };

    expect(await rules.github.pullRequestOpened?.onEvent?.(older)).toMatchObject({
      type: 'upsertLinkedWorkItem',
      stage: 'intake',
      metadata: { autoStartCandidate: false },
    });
  });

  it.each(['issueOpened', 'pullRequestOpened'] as const)(
    'keeps trusted %s items created before the Factory in Intake',
    async event => {
      const rules = defaultFactoryRules({ version: 'deployment-7' });
      const olderContext = githubContext(event, '2026-05-01T00:00:00Z');

      expect(await rules.github[event]?.onEvent?.(olderContext)).toMatchObject({
        type: 'upsertLinkedWorkItem',
        stage: 'intake',
        metadata: { autoStartCandidate: false },
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

  it('records PR branches, status, assignments, and review requests on Review intake', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const context = githubContext('pullRequestOpened');
    context.pullRequest = { ...context.pullRequest!, draft: true };
    expect(await rules.github.pullRequestOpened?.onEvent?.(context)).toMatchObject({
      metadata: {
        state: 'open',
        draft: true,
        merged: false,
        assignees: ['assignee'],
        requestedReviewers: ['reviewer'],
        headBranch: 'feature',
        baseBranch: 'main',
      },
    });
  });

  it('stamps the GitHub author login on issue and PR intake metadata', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    expect(await rules.github.issueOpened?.onEvent?.(githubContext('issueOpened'))).toMatchObject({
      metadata: { author: 'author' },
    });
    expect(await rules.github.pullRequestOpened?.onEvent?.(githubContext('pullRequestOpened'))).toMatchObject({
      metadata: { author: 'author' },
    });
  });

  it('mirrors the Linear assignee under `assignee` and the creator under `author` for provider-agnostic attribution', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    expect(await rules.linear.issueObserved?.onEvent?.(linearContext())).toMatchObject({
      metadata: {
        linearAssignee: 'ada',
        assignee: 'ada',
        linearCreator: 'grace',
        creator: 'grace',
        author: 'grace',
      },
    });
  });

  it('moves the merged Review card to Done and carries a session-only message', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const context = githubContext('pullRequestMerged');
    context.item = { ...item, source: 'github-pr', sourceKey: 'github-pr:17' };
    context.board = 'review';
    context.pullRequest = { ...context.pullRequest!, state: 'closed', merged: true };
    const decision = await rules.github.pullRequestMerged?.onEvent?.(context);
    expect(decision).toMatchObject({
      type: 'transition',
      board: 'review',
      stage: 'done',
      message: { text: expect.stringContaining('merged') },
    });
  });

  it('reminds the provenance-linked Work agent after merge without transitioning the Work item', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const context = githubContext('pullRequestMerged');
    context.item = item;
    context.board = 'work';
    context.pullRequest = { ...context.pullRequest!, state: 'closed', merged: true };
    const decision = await rules.github.pullRequestMerged?.onEvent?.(context);
    expect(decision).toMatchObject({ type: 'sendMessage', role: 'work' });
    expect(decision).not.toMatchObject({ type: 'transition', stage: 'done' });
  });

  it('cancels the Review card when the PR is closed without merging', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const context = githubContext('pullRequestClosed');
    context.item = { ...item, source: 'github-pr', sourceKey: 'github-pr:17' };
    context.board = 'review';
    context.pullRequest = { ...context.pullRequest!, state: 'closed', merged: false };
    const decision = await rules.github.pullRequestClosed?.onEvent?.(context);
    expect(decision).toMatchObject({
      type: 'transition',
      board: 'review',
      stage: 'canceled',
      message: { text: expect.stringContaining('closed without merging') },
    });
  });

  it('leaves non-review items alone when a PR is closed without merging', async () => {
    const rules = defaultFactoryRules({ version: 'deployment-7' });
    const context = githubContext('pullRequestClosed');
    context.item = item;
    context.board = 'work';
    context.pullRequest = { ...context.pullRequest!, state: 'closed', merged: false };
    expect(await rules.github.pullRequestClosed?.onEvent?.(context)).toBeUndefined();
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

  it('preserves explicitly undefined handlers when they are merged from the base rules', () => {
    const merged = mergeFactoryRuleOverrides(
      {
        work: { planning: { issue: { onEnter: undefined, onExit: undefined } } },
        tools: { submit_plan: { onResult: undefined } },
        github: { pullRequestCommentCreated: { onEvent: undefined } },
        linear: { issueObserved: { onEvent: undefined } },
      },
      {},
    );

    expect(merged.work.planning?.issue).toHaveProperty('onEnter', undefined);
    expect(merged.work.planning?.issue).toHaveProperty('onExit', undefined);
    expect(merged.tools.submit_plan).toHaveProperty('onResult', undefined);
    expect(merged.github.pullRequestCommentCreated).toHaveProperty('onEvent', undefined);
    expect(merged.linear.issueObserved).toHaveProperty('onEvent', undefined);
  });

  it('keeps a disabled built-in disabled across repeated composition', () => {
    const configured = defaultFactoryRules({
      version: 'deployment-9',
      overrides: { github: { pullRequestCommentCreated: { onEvent: undefined } } },
    });
    const composed = mergeFactoryRuleOverrides(configured, {});
    const effective = defaultFactoryRules({ version: 'deployment-10', overrides: composed });

    expect(composed.github.pullRequestCommentCreated).toHaveProperty('onEvent', undefined);
    expect(effective.github.pullRequestCommentCreated).toHaveProperty('onEvent', undefined);
  });

  it('copies override containers so later mutation cannot replace configured leaves', () => {
    const leaf: FactoryBoardRuleLeaf = { onEnter: passThrough };
    const overrides: FactoryRulesOverrides = { work: { intake: { issue: leaf } } };
    const rules = defaultFactoryRules({ version: 'deployment-9', overrides });
    leaf.onEnter = vi.fn(reject);
    expect(rules.work.intake?.issue?.onEnter).toBe(passThrough);
  });
});
