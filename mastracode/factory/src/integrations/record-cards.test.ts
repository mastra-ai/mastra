import { describe, expect, it } from 'vitest';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { cardsByExternalId } from './record-cards.js';

describe('cardsByExternalId', () => {
  it("groups only the integration's cards filed from a record, never cards without one or another integration's", async () => {
    const { projects, workItems } = await createFactoryStorageForTests();
    const project = await projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme' } });
    const file = async (title: string, externalId?: string, integrationId = 'linear') =>
      (
        await workItems.upsert({
          orgId: 'org-1',
          userId: 'user-1',
          factoryProjectId: project.id,
          input: {
            title,
            stages: ['intake'],
            sessions: {},
            metadata: {},
            ...(externalId ? { externalSource: { integrationId, type: 'issue', externalId } } : {}),
          },
        })
      ).item;
    const filed = await file('Fix intake sync', 'linear:ENG-1');
    await file('Manual card');
    await file('Another manual card');
    await file('A Jira issue', 'linear:ENG-1', 'jira');

    const grouped = cardsByExternalId(await workItems.listShared({ orgId: 'org-1', factoryProjectId: project.id }), {
      integrationId: 'linear',
      type: 'issue',
    });

    expect([...grouped.keys()]).toEqual(['linear:ENG-1']);
    expect(grouped.get('linear:ENG-1')!.map(card => card.id)).toEqual([filed.id]);
    expect(grouped.get(undefined)).toBeUndefined();
  });
});
