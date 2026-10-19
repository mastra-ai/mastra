import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { createBoardRegistry } from '../boards/registry.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { PhaseSkillRoutes } from './phase-skills.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const orgUser = { workosId: 'u1', organizationId: 'org1' };

let seed: FactoryStorageTestSeed;
let base = '';

function call(method: string, path: string, body?: unknown) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, orgUser as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new PhaseSkillRoutes({
      auth: fakeRouteAuth(),
      phaseSkills: seed.phaseSkills,
      skillLibrary: seed.skillLibrary,
      projects: seed.projects,
      boards: createBoardRegistry(),
    }).routes(),
  );
  return app.request(`${base}${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  });
}

const skill = { name: 'my-build', description: 'Builds the card.', content: 'Build it.' };

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'project' } });
  base = `/web/factory/projects/${project.id}`;
});

describe('PhaseSkillRoutes', () => {
  it('creates, edits, lists, and deletes library skills', async () => {
    expect((await call('POST', '/skill-library', skill)).status).toBe(201);
    expect((await call('POST', '/skill-library', skill)).status).toBe(409);
    expect((await call('POST', '/skill-library', { ...skill, name: 'Bad Name' })).status).toBe(400);
    expect(
      (await call('PUT', '/skill-library/my-build', { description: 'New.', content: 'Build it well.' })).status,
    ).toBe(200);

    const listed = await (await call('GET', '/skill-library')).json();
    expect(listed.skills).toMatchObject([{ name: 'my-build', description: 'New.', content: 'Build it well.' }]);

    expect((await call('DELETE', '/skill-library/my-build')).status).toBe(204);
    expect((await call('DELETE', '/skill-library/my-build')).status).toBe(404);
  });

  it('sets a phase to a library skill or a prompt, and clears it when the skill is deleted', async () => {
    expect((await call('PUT', '/phase-skills/work/execute', { skillName: 'my-build' })).status).toBe(400);
    await call('POST', '/skill-library', skill);
    expect((await call('PUT', '/phase-skills/work/execute', { skillName: 'my-build' })).status).toBe(200);
    expect((await call('PUT', '/phase-skills/work/planning', { prompt: '  Plan it.  ' })).status).toBe(200);
    expect((await call('PUT', '/phase-skills/work/planning', { prompt: 'x', skillName: 'my-build' })).status).toBe(400);
    expect((await call('PUT', '/phase-skills/work/done', { prompt: 'x' })).status).toBe(400);

    const before = await (await call('GET', '/phase-skills')).json();
    expect(before.phaseSkills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phaseId: 'execute', skillName: 'my-build', prompt: null }),
        expect.objectContaining({ phaseId: 'planning', skillName: null, prompt: 'Plan it.' }),
      ]),
    );

    await call('DELETE', '/skill-library/my-build');
    const after = await (await call('GET', '/phase-skills')).json();
    expect(after.phaseSkills).toMatchObject([{ phaseId: 'planning', prompt: 'Plan it.' }]);
  });
});
