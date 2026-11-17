import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createProjectSessionsReader, createSessionOwnerProfileResolver } from './project-sessions.js';

const ORG = 'org1';

describe('createProjectSessionsReader', () => {
  it('keeps the sessions it built for each project without a repository while the sidebar polls several', async () => {
    const seed = await createFactoryStorageForTests();
    seed.sourceControl.projectSessions.trustAnnouncements();
    seed.workItems.projectSubscriptions.trustAnnouncements();
    const read = createProjectSessionsReader({
      sourceControls: [seed.sourceControl.forIntegration('github')],
      workItems: seed.workItems,
    });
    const [first, second] = await Promise.all(
      ['First', 'Second'].map(name => seed.projects.create({ orgId: ORG, userId: 'u1', input: { name } })),
    );
    const scope = (project: { id: string }) => ({ orgId: ORG, factoryProjectId: project.id });

    const firstBuilt = await read(scope(first!));
    const secondBuilt = await read(scope(second!));

    expect(await read(scope(first!))).toBe(firstBuilt);
    expect(await read(scope(second!))).toBe(secondBuilt);
  });
});

describe('createSessionOwnerProfileResolver', () => {
  it('asks the user provider once for owners several reads need at the same moment', async () => {
    const asked: string[][] = [];
    const resolve = createSessionOwnerProfileResolver({
      getUser: async () => null,
      getUsers: async userIds => {
        asked.push(userIds);
        return userIds.map(id => ({ id, name: `Person ${id}` }));
      },
    });

    const answers = await Promise.all([resolve(['u1', 'u2']), resolve(['u1', 'u2']), resolve(['u2'])]);

    expect(asked).toEqual([['u1', 'u2']]);
    expect(answers.map(owners => owners.get('u2')?.name)).toEqual(['Person u2', 'Person u2', 'Person u2']);
  });
});
