import { describe, expect, it, vi } from 'vitest';
import type { ReviewGroup } from '../../capabilities/review-group.js';
import { WorkItemUpdateConflictError } from '../../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { findGithubPullRequestCard, syncGithubReviewGroup } from './review-group-sync.js';
import type { ReconcilePullRequestState } from './rules.js';

const firstGroup: ReviewGroup = { key: 'github:acme/repo:100', label: 'Stack #7', position: 1 };
const latestGroup: ReviewGroup = { key: 'github:acme/repo:200', label: 'Stack #8', position: 2 };

function state(reviewGroup: ReviewGroup | null | undefined): ReconcilePullRequestState {
  return {
    title: 'Review this PR',
    url: 'https://github.com/acme/repo/pull/17',
    state: 'open',
    merged: false,
    assignees: [],
    reviewGroup,
  };
}

async function setup(reviewGroup?: ReviewGroup) {
  const { workItems: storage, projects } = await createFactoryStorageForTests();
  const project = await projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
  const { item: card } = await storage.upsert({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: project.id,
    input: {
      title: 'Review this PR',
      stages: ['review'],
      sessions: {},
      externalSource: {
        integrationId: 'github',
        type: 'pull-request',
        externalId: 'github-pr:17',
        url: 'https://github.com/acme/repo/pull/17',
      },
      metadata: { reviewGroup, labels: ['keep'] },
    },
  });
  return { storage, card, project: { orgId: 'org-1', factoryProjectId: project.id } };
}

describe('GitHub review group synchronization', () => {
  it('uses current provider state instead of a delayed webhook snapshot', async () => {
    const { storage, card } = await setup(latestGroup);
    const fetchState = vi.fn(async () => state(latestGroup));
    await syncGithubReviewGroup({ storage, card, hint: firstGroup, fetchState });
    expect(await storage.get({ orgId: card.orgId, id: card.id })).toMatchObject({
      revision: card.revision,
      metadata: { reviewGroup: latestGroup, labels: ['keep'] },
    });
    expect(fetchState).toHaveBeenCalledOnce();
  });

  it('does not fetch or write for an unchanged webhook hint', async () => {
    const { storage, card } = await setup(firstGroup);
    const fetchState = vi.fn(async () => state(firstGroup));
    await syncGithubReviewGroup({ storage, card, hint: firstGroup, fetchState });
    expect(fetchState).not.toHaveBeenCalled();
    expect((await storage.get({ orgId: card.orgId, id: card.id }))?.revision).toBe(card.revision);
  });

  it('refetches after a reconcile snapshot loses a race with a newer webhook', async () => {
    const { storage, card } = await setup();
    await syncGithubReviewGroup({ storage, card, fetchState: async () => state(latestGroup) });
    const fetchState = vi.fn(async () => state(latestGroup));
    await syncGithubReviewGroup({ storage, card, initialState: state(firstGroup), fetchState });
    expect(fetchState).toHaveBeenCalledOnce();
    expect((await storage.get({ orgId: card.orgId, id: card.id }))?.metadata?.reviewGroup).toEqual(latestGroup);
  });

  it('retries a conflict without dropping concurrent user edits', async () => {
    const { storage, card } = await setup();
    await storage.update({ orgId: card.orgId, id: card.id, userId: 'user-1', patch: { title: 'User edit' } });
    const fetchState = vi.fn(async () => state(latestGroup));
    await syncGithubReviewGroup({ storage, card, initialState: state(firstGroup), fetchState });
    expect(await storage.get({ orgId: card.orgId, id: card.id })).toMatchObject({
      title: 'User edit',
      stages: ['review'],
      metadata: { reviewGroup: latestGroup, labels: ['keep'] },
    });
  });

  it('surfaces persistent conflicts so the event worker can retry', async () => {
    const { storage, card } = await setup();
    const fetchState = vi.fn(async () => {
      await storage.update({ orgId: card.orgId, id: card.id, userId: 'user-1', patch: { title: 'Concurrent edit' } });
      return state(firstGroup);
    });
    await expect(syncGithubReviewGroup({ storage, card, fetchState })).rejects.toBeInstanceOf(
      WorkItemUpdateConflictError,
    );
    expect(fetchState).toHaveBeenCalledTimes(3);
    expect((await storage.get({ orgId: card.orgId, id: card.id }))?.metadata?.reviewGroup).toBeUndefined();
  });

  it('retains membership for an unavailable field and clears it only for authoritative null', async () => {
    const { storage, card } = await setup(firstGroup);
    await syncGithubReviewGroup({ storage, card, fetchState: async () => state(undefined) });
    expect((await storage.get({ orgId: card.orgId, id: card.id }))?.metadata?.reviewGroup).toEqual(firstGroup);
    await syncGithubReviewGroup({ storage, card, fetchState: async () => state(null) });
    expect((await storage.get({ orgId: card.orgId, id: card.id }))?.metadata?.reviewGroup).toBeNull();
  });

  it('looks up the indexed source without scanning unrelated cards or accepting another repository', async () => {
    const { storage, card, project } = await setup();
    const list = vi.spyOn(storage, 'list');
    expect(await findGithubPullRequestCard(storage, project, 10, 'acme/repo', 17)).toEqual(card);
    expect(await findGithubPullRequestCard(storage, project, 11, 'acme/other', 17)).toBeUndefined();
    expect(list).not.toHaveBeenCalled();
    const { item: legacy } = await storage.upsert({
      orgId: card.orgId,
      factoryProjectId: project.factoryProjectId,
      userId: 'user-1',
      input: {
        title: 'Legacy card',
        stages: ['review'],
        sessions: {},
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github:11:pull-request:17' },
      },
    });
    expect(await findGithubPullRequestCard(storage, project, 11, 'acme/other', 17)).toEqual(legacy);
  });
});
