/**
 * Work-items domain over a real backend (libsql `:memory:`): sourceKey
 * dedup scoping and the atomic update path.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import { WorkItemsStorage } from './base';

const input = {
  source: 'github-issue' as const,
  sourceKey: 'github-issue:42',
  title: 'Fix login',
  url: null,
  stages: ['intake'],
  sessions: {},
  metadata: {},
};

async function makeStorage(): Promise<WorkItemsStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'work-items-test', url: ':memory:' });
  const domain = backend.registerDomain(new WorkItemsStorage());
  await backend.init();
  return domain;
}

describe('WorkItemsStorage', () => {
  it('deduplicates source keys within an org, not across orgs', async () => {
    const storage = await makeStorage();

    const first = await storage.upsert({ orgId: 'org1', userId: 'user1', githubProjectId: 'project1', input });
    const otherOrg = await storage.upsert({ orgId: 'org2', userId: 'user2', githubProjectId: 'project1', input });
    const reused = await storage.upsert({
      orgId: 'org1',
      userId: 'user3',
      githubProjectId: 'project1',
      input: { ...input, title: 'Updated title' },
    });

    expect(first.created).toBe(true);
    expect(otherOrg.created).toBe(true);
    expect(otherOrg.item.id).not.toBe(first.item.id);
    expect(reused.created).toBe(false);
    expect(reused.item.id).toBe(first.item.id);
  });

  it('lists newest-first within the org/project scope and updates atomically', async () => {
    const storage = await makeStorage();

    const a = await storage.upsert({ orgId: 'org1', userId: 'u', githubProjectId: 'p1', input });
    await storage.upsert({
      orgId: 'org1',
      userId: 'u',
      githubProjectId: 'p1',
      input: { ...input, sourceKey: 'github-issue:43', title: 'Second' },
    });

    const listed = await storage.list('org1', 'p1');
    expect(listed).toHaveLength(2);
    expect(await storage.list('org2', 'p1')).toHaveLength(0);

    const updated = await storage.update('org1', a.item.id, 'mover', { stages: ['build'] });
    expect(updated?.item.stages).toEqual(['build']);
    expect(updated?.previous.stages).toEqual(['intake']);

    const deleted = await storage.delete('org1', a.item.id);
    expect(deleted?.id).toBe(a.item.id);
    expect(await storage.delete('org1', a.item.id)).toBeNull();
  });
});
