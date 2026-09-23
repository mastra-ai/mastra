import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { listObservedCommentAuthors, mergeCandidates } from './observed-comment-authors.js';

async function seedComment(
  seed: Awaited<ReturnType<typeof createFactoryStorageForTests>>,
  overrides: {
    orgId: string;
    platform: string;
    userId: string;
    userName?: string;
    fullName?: string;
    workItemId?: string;
    occurredAt?: Date;
  },
) {
  await seed.comments.create({
    orgId: overrides.orgId,
    factoryProjectId: 'project-1',
    workItemId: overrides.workItemId ?? 'work-1',
    body: 'observed comment body',
    author: {
      kind: 'user',
      id: `${overrides.platform}:${overrides.userId}`,
      external: {
        platform: overrides.platform,
        userId: overrides.userId,
        ...(overrides.userName ? { userName: overrides.userName } : {}),
        ...(overrides.fullName ? { fullName: overrides.fullName } : {}),
      },
    },
    ...(overrides.occurredAt ? { occurredAt: overrides.occurredAt } : {}),
  });
}

describe('listObservedCommentAuthors', () => {
  it('returns distinct external authors for the requested platform, scoped by org', async () => {
    const seed = await createFactoryStorageForTests();
    await seedComment(seed, { orgId: 'org-1', platform: 'github', userId: 'octocat', fullName: 'The Octocat' });
    await seedComment(seed, { orgId: 'org-1', platform: 'github', userId: 'octocat', workItemId: 'work-2' });
    await seedComment(seed, { orgId: 'org-1', platform: 'github', userId: 'ada', userName: 'ada' });
    await seedComment(seed, { orgId: 'org-1', platform: 'linear', userId: 'lin-1', userName: 'Bea' });
    await seedComment(seed, { orgId: 'org-2', platform: 'github', userId: 'other-org', userName: 'nope' });

    const candidates = await listObservedCommentAuthors(seed.comments, { orgId: 'org-1', platform: 'github' });
    expect(candidates.map(c => c.externalUserId).sort()).toEqual(['ada', 'octocat']);
    const octocat = candidates.find(c => c.externalUserId === 'octocat');
    expect(octocat?.label).toBe('The Octocat');
    expect(octocat?.sources).toEqual(['observed']);
  });

  it('falls back to userName, then externalUserId, when fullName is absent', async () => {
    const seed = await createFactoryStorageForTests();
    await seedComment(seed, { orgId: 'org-1', platform: 'github', userId: 'user-a', userName: 'user-a-handle' });
    await seedComment(seed, { orgId: 'org-1', platform: 'github', userId: 'user-b' });
    const candidates = await listObservedCommentAuthors(seed.comments, { orgId: 'org-1', platform: 'github' });
    const byId = Object.fromEntries(candidates.map(c => [c.externalUserId, c.label]));
    expect(byId['user-a']).toBe('user-a-handle');
    expect(byId['user-b']).toBe('user-b'); // fell all the way back
  });

  it('filters by case-insensitive query on label or externalUserId', async () => {
    const seed = await createFactoryStorageForTests();
    await seedComment(seed, { orgId: 'org-1', platform: 'github', userId: 'octocat', fullName: 'The Octocat' });
    await seedComment(seed, { orgId: 'org-1', platform: 'github', userId: 'ada', fullName: 'Ada Lovelace' });
    await seedComment(seed, { orgId: 'org-1', platform: 'github', userId: 'zoe', fullName: 'Zoe' });

    const byLabel = await listObservedCommentAuthors(seed.comments, {
      orgId: 'org-1',
      platform: 'github',
      query: 'lovelace',
    });
    expect(byLabel.map(c => c.externalUserId)).toEqual(['ada']);

    const byUpperId = await listObservedCommentAuthors(seed.comments, {
      orgId: 'org-1',
      platform: 'github',
      query: 'OCTO',
    });
    expect(byUpperId.map(c => c.externalUserId)).toEqual(['octocat']);
  });

  it('returns an empty list when no comments match the platform', async () => {
    const seed = await createFactoryStorageForTests();
    await seedComment(seed, { orgId: 'org-1', platform: 'linear', userId: 'lin-1', userName: 'Bea' });
    const candidates = await listObservedCommentAuthors(seed.comments, { orgId: 'org-1', platform: 'github' });
    expect(candidates).toEqual([]);
  });
});

describe('mergeCandidates', () => {
  it('unions two lists de-duplicated on externalUserId and marks combined sources', async () => {
    const merged = mergeCandidates(
      [
        { externalUserId: 'octocat', label: 'Octocat (observed)', sources: ['observed'] },
        { externalUserId: 'commented-only', label: 'Bea', sources: ['observed'] },
      ],
      [
        { externalUserId: 'octocat', label: 'The Octocat', email: 'octo@example.com', sources: ['api-listed'] },
        { externalUserId: 'api-only', label: 'Ada', sources: ['api-listed'] },
      ],
    );

    const byId = new Map(merged.map(c => [c.externalUserId, c]));
    expect(byId.get('octocat')?.sources.sort()).toEqual(['api-listed', 'observed']);
    expect(byId.get('octocat')?.label).toBe('Octocat (observed)'); // observed label wins
    expect(byId.get('octocat')?.email).toBe('octo@example.com'); // filled from api-listed
    expect(byId.get('commented-only')?.sources).toEqual(['observed']);
    expect(byId.get('api-only')?.sources).toEqual(['api-listed']);
    expect(merged).toHaveLength(3);
  });
});
