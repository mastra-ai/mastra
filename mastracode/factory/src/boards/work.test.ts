import { describe, expect, it } from 'vitest';

import type { FactoryRuleItemContext, FactoryStageRuleContext } from '../rules/types.js';
import { workBoard } from './work.js';

function executeContext(source: FactoryRuleItemContext['source']): FactoryStageRuleContext {
  return {
    tenant: { orgId: 'org-1', projectId: 'project-1' },
    actor: { type: 'system', id: 'test' },
    ingress: { type: 'rule', id: 'ingress-1' },
    cause: 'test',
    causalChain: [],
    configVersion: 'test',
    item: {
      id: 'item-1',
      source,
      sourceKey: 'source-1',
      parentWorkItemId: null,
      title: 'Fix the issue',
      url: 'https://gitlab.com/acme/app/-/issues/3',
      stages: ['execute'],
      acceptedAt: null,
      metadata: { identifier: 'acme/app#3' },
    },
    board: 'work',
    itemRevision: 1,
    source: source === 'gitlab-issue' ? 'gitlabIssue' : 'issue',
    stage: 'execute',
    fromStage: 'triage',
    toStage: 'execute',
  };
}

describe('work board build prompt', () => {
  it('asks for a merge request for a GitLab issue', async () => {
    const decision = await workBoard.rules.execute?.gitlabIssue?.onEnter?.(executeContext('gitlab-issue'));
    expect(decision).toMatchObject({ type: 'invokeSkill', role: 'work' });
    if (!decision || decision.type !== 'invokeSkill') throw new Error('Expected build invocation.');
    expect(decision.prompt).toContain('Open a merge request when the work is ready for review.');
    expect(decision.prompt).toContain('GitLab issue acme/app#3');
    expect(decision.prompt).not.toContain('pull request');
  });

  it('retains the pull-request instruction for a GitHub issue', async () => {
    const decision = await workBoard.rules.execute?.issue?.onEnter?.(executeContext('github-issue'));
    expect(decision).toMatchObject({ type: 'invokeSkill', role: 'work' });
    if (!decision || decision.type !== 'invokeSkill') throw new Error('Expected build invocation.');
    expect(decision.prompt).toContain('Open a pull request when the work is ready for review.');
  });
});

describe('work board done policy', () => {
  function toDone(actor: { type: string; id: string; role?: string }, reviewVerdict?: string | null) {
    return workBoard.transitionPolicy!({
      actor,
      fromStage: 'review',
      toStage: 'done',
      isHumanTransition: actor.type === 'human',
      plansAutoApproved: false,
      planApproved: false,
      item: { ...executeContext('issue').item, stages: ['review'], triageType: 'bug', metadata: { reviewVerdict } },
    } as never);
  }

  it('keeps the builder from closing work while a review requests changes', () => {
    expect(toDone({ type: 'agent', id: 'binding-1', role: 'work' }, 'request changes')).toMatchObject({
      type: 'reject',
      code: 'invalid_transition',
    });
  });

  it('lets the builder close work once the review approves or the merge settles it', () => {
    expect(toDone({ type: 'agent', id: 'binding-1', role: 'work' }, 'approve')).toMatchObject({ type: 'allow' });
    expect(toDone({ type: 'agent', id: 'binding-1', role: 'work' }, null)).toMatchObject({ type: 'allow' });
  });

  it('still lets a maintainer close work with changes requested', () => {
    expect(toDone({ type: 'human', id: 'user-1' }, 'request changes')).toMatchObject({ type: 'allow' });
  });
});
