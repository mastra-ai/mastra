import { describe, expect, it } from 'vitest';

import type { FactoryRuleItemContext, FactoryStageRuleContext } from '../rules/types.js';
import { openApprovedChangeRequest, workBoard } from './work.js';

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
    selfReviewEnabled: true,
  };
}

describe('work board triage dispatch', () => {
  it('passes the incident.io follow-up source key that incidentio_get_issue resolves', async () => {
    const context = executeContext('incidentio-follow-up');
    const decision = await workBoard.rules.triage?.incidentioFollowUp?.onEnter?.({
      ...context,
      item: {
        ...context.item,
        sourceKey: 'incidentio:issue:incidentio:follow-up:01HFOLLOWUP',
        metadata: { identifier: 'ENG-42' },
      },
      source: 'incidentioFollowUp',
      stage: 'triage',
      fromStage: 'intake',
      toStage: 'triage',
    });
    if (!decision || decision.type !== 'invokeSkill') throw new Error('Expected triage invocation.');
    expect(decision.skillName).toBe('factory-triage');
    expect(decision.arguments).toContain('incident.io follow-up ENG-42');
    expect(decision.arguments).toContain('reference incidentio:follow-up:01HFOLLOWUP');
  });
});

describe('work board build prompt', () => {
  it('hands a GitLab build to self-review without opening a merge request', async () => {
    const decision = await workBoard.rules.execute?.gitlabIssue?.onEnter?.(executeContext('gitlab-issue'));
    expect(decision).toMatchObject({ type: 'invokeSkill', role: 'work' });
    if (!decision || decision.type !== 'invokeSkill') throw new Error('Expected build invocation.');
    expect(decision.prompt).toContain('Do not open a pull or merge request.');
    expect(decision.prompt).toContain('stage `review`');
    expect(decision.prompt).toContain('GitLab issue acme/app#3');
    expect(decision.prompt).not.toContain('pull request');
  });

  it('asks the builder to open the change request itself when self-review is off, which is the default', async () => {
    const { selfReviewEnabled: _on, ...off } = executeContext('gitlab-issue');
    const build = await workBoard.rules.execute?.gitlabIssue?.onEnter?.(off);
    if (!build || build.type !== 'invokeSkill') throw new Error('Expected build invocation.');
    expect(build.prompt).toContain('Open a merge request when the work is ready for review.');
    expect(build.prompt).not.toContain('Do not open');

    const review = await workBoard.rules.review?.gitlabIssue?.onEnter?.({
      ...off,
      stage: 'review',
      fromStage: 'execute',
      toStage: 'review',
    });
    expect(review).toBeUndefined();
  });

  it('hands a GitHub build to self-review without opening a pull request', async () => {
    const decision = await workBoard.rules.execute?.issue?.onEnter?.(executeContext('github-issue'));
    expect(decision).toMatchObject({ type: 'invokeSkill', role: 'work' });
    if (!decision || decision.type !== 'invokeSkill') throw new Error('Expected build invocation.');
    expect(decision.prompt).toContain('Do not open a pull or merge request.');
  });

  it('passes self-review findings back to the builder', async () => {
    const context = executeContext('github-issue');
    const decision = await workBoard.rules.execute?.issue?.onEnter?.({
      ...context,
      fromStage: 'review',
      item: {
        ...context.item,
        metadata: {
          ...context.item.metadata,
          selfReviewVerdict: 'request changes',
          selfReviewRounds: 1,
          selfReviewedHeadSha: 'a'.repeat(40),
          selfReviewFindings: '1. Fix the test',
        },
      },
    });
    if (!decision || decision.type !== 'invokeSkill') throw new Error('Expected build invocation.');
    expect(decision.prompt).toContain(`Self-review requested changes on branch head ${'a'.repeat(40)}`);
    expect(decision.prompt).toContain('1. Fix the test');
  });

  it('passes the findings back with the approved plan when a card parked at the round limit is resumed through Planning', async () => {
    const context = executeContext('github-issue');
    const decision = await workBoard.rules.execute?.issue?.onEnter?.({
      ...context,
      fromStage: 'planning',
      item: {
        ...context.item,
        metadata: {
          ...context.item.metadata,
          selfReviewVerdict: 'request changes',
          selfReviewRounds: 3,
          selfReviewNeedsHuman: true,
          selfReviewFindings: '1. Fix the test',
        },
      },
    });
    if (!decision || decision.type !== 'invokeSkill') throw new Error('Expected build invocation.');
    expect(decision.prompt).toContain('Implement the approved plan for the work item.');
    expect(decision.prompt).toContain('1. Fix the test');
  });
});

describe('work board self-review', () => {
  it('runs factory-self-review in the review seat when a card enters Review without a change request', async () => {
    const context = executeContext('github-issue');
    const entry = { ...context, stage: 'review', fromStage: 'execute', toStage: 'review' } as const;
    const decision = await workBoard.rules.review?.issue?.onEnter?.(entry);
    expect(decision).toMatchObject({ type: 'invokeSkill', role: 'review', skillName: 'factory-self-review' });
    if (!decision || decision.type !== 'invokeSkill') throw new Error('Expected self-review invocation.');
    expect(decision.arguments).toContain('Self-review round 1 of at most 3');
    expect(
      await workBoard.rules.review?.issue?.onEnter?.({
        ...entry,
        item: { ...context.item, metadata: { ...context.item.metadata, openPullRequestNumber: 7 } },
      }),
    ).toBeUndefined();
  });

  it('wakes the builder to open the change request when self-review approves in place', () => {
    const context = executeContext('github-issue');
    const result = (metadata: Record<string, unknown>, role = 'review') =>
      openApprovedChangeRequest({
        ...context,
        actor: { type: 'agent', id: 'binding-1', role },
        item: { ...context.item, stages: ['review'], metadata: { ...context.item.metadata, ...metadata } },
        toolName: 'factory_record_review_verdict',
        threadId: 'thread-1',
        assistantMessageId: 'message-1',
        toolCallId: 'call-1',
        result: { status: 'success', value: { status: 'recorded' } },
      });
    const approved = result({
      selfReviewVerdict: 'approve',
      selfReviewedHeadSha: 'b'.repeat(40),
      selfReviewFindings: 'All checks passed',
    });
    expect(approved).toMatchObject({ type: 'invokeSkill', role: 'work' });
    expect(approved?.prompt).toContain(`at branch head ${'b'.repeat(40)}. Open the pull request now`);
    expect(approved?.prompt).toContain('All checks passed');
    expect(result({ selfReviewVerdict: 'request changes' })).toBeUndefined();
    expect(result({ selfReviewVerdict: 'approve', openPullRequestNumber: 7 })).toBeUndefined();
    expect(result({ selfReviewVerdict: 'approve' }, 'work')).toBeUndefined();
  });
});
