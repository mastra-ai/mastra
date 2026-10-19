/**
 * Boards built from Settings → Boards (stored boards) are first-class: cards reach them by hand,
 * from GitHub issues and from Linear issues, and every working phase starts its role for real.
 */
import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { ORG, handOff, startFactoryScenario } from './harness.js';
import type { FactoryScenario } from './harness.js';

const OPS_BOARD = {
  title: 'Ops',
  initialPhase: 'backlog',
  phases: [
    { id: 'backlog', title: 'Backlog', kind: 'resting', next: ['build'] },
    { id: 'build', title: 'Build', kind: 'working', role: 'builder', next: ['verify', 'backlog'] },
    { id: 'verify', title: 'Verify', kind: 'working', role: 'verifier', next: ['done', 'build'] },
    { id: 'done', title: 'Done', kind: 'terminal', next: [] },
  ],
};

/** Board whose first phase is a working phase, so arriving cards start straight away. */
const TRIAGE_BOARD = {
  title: 'Support',
  initialPhase: 'inbox',
  phases: [
    { id: 'inbox', title: 'Inbox', kind: 'resting', next: ['triage'] },
    { id: 'triage', title: 'Triage', kind: 'working', role: 'triager', next: ['done'] },
    { id: 'done', title: 'Done', kind: 'terminal', next: [] },
  ],
};

let scenario: FactoryScenario | undefined;
afterEach(async () => {
  await scenario?.close();
  scenario = undefined;
});

async function createBoard(s: FactoryScenario, factoryId: string, body: unknown): Promise<string> {
  const { board } = await s.json('POST', `/web/factory/projects/${factoryId}/boards`, body, 201);
  expect(board.id).toMatch(/^custom-/);
  return board.id;
}

async function move(
  s: FactoryScenario,
  factoryId: string,
  card: { id: string; revision: number; board: string | null },
  stage: string,
) {
  const { result } = await s.json('POST', `/web/factory/projects/${factoryId}/work-items/${card.id}/transition`, {
    board: card.board,
    stage,
    expectedRevision: card.revision,
    requestId: randomUUID(),
    cause: `move-to-${stage}`,
  });
  return result as { status: string; stage?: string };
}

describe('custom boards', () => {
  it.each([true, false])(
    'carry a manual card through both working roles to Done (default boards installed: %s)',
    async includeDefaultBoards => {
      const s = (scenario = await startFactoryScenario({ includeDefaultBoards }));
      const ops = await s.createProject('Ops');
      const other = await s.createProject('Other');
      await s.connectGithubRepository(ops.id, 'ops/service');
      const boardId = await createBoard(s, ops.id, OPS_BOARD);

      const catalog = async (factoryId: string) =>
        (await s.json('GET', `/web/factory/projects/${factoryId}/boards`)).boards as Array<{
          id: string;
          custom: boolean;
        }>;
      expect((await catalog(ops.id)).find(board => board.id === boardId)).toMatchObject({ custom: true });
      expect((await catalog(other.id)).some(board => board.id === boardId)).toBe(false);

      // Build runs a skill from the library; Verify runs a custom prompt.
      await s.json(
        'POST',
        `/web/factory/projects/${ops.id}/skill-library`,
        { name: 'ops-build', description: 'How Ops builds changes.', content: 'Ship behind a feature flag.' },
        201,
      );
      await s.json('PUT', `/web/factory/projects/${ops.id}/phase-skills/${boardId}/build`, { skillName: 'ops-build' });
      await s.json('PUT', `/web/factory/projects/${ops.id}/phase-skills/${boardId}/verify`, {
        prompt: 'Verify the change against the acceptance criteria.',
      });

      // Another Factory can't put cards on this board.
      const foreign = await s.api('POST', `/web/factory/projects/${other.id}/work-items`, {
        board: boardId,
        title: 'Sneaky card',
      });
      expect(foreign.status).toBe(422);
      expect(await foreign.json()).toMatchObject({ error: 'invalid_board' });

      const { workItem } = await s.json('POST', `/web/factory/projects/${ops.id}/work-items`, {
        board: boardId,
        title: 'Rotate the deploy keys',
      });
      expect(workItem).toMatchObject({ board: boardId, stages: ['backlog'] });

      // A board holding a card can't be deleted, nor edited away from the card's phase.
      await s.json('DELETE', `/web/factory/projects/${ops.id}/boards/${boardId}`, undefined, 409);
      await s.json(
        'PUT',
        `/web/factory/projects/${ops.id}/boards/${boardId}`,
        {
          title: 'Ops',
          initialPhase: 'todo',
          phases: [
            { id: 'todo', title: 'To do', kind: 'resting', next: ['build'] },
            { id: 'build', title: 'Build', kind: 'working', role: 'builder', next: ['done'] },
            { id: 'done', title: 'Done', kind: 'terminal', next: [] },
          ],
        },
        409,
      );

      // Only declared transitions are allowed.
      const skipAhead = await s.api('POST', `/web/factory/projects/${ops.id}/work-items/${workItem.id}/transition`, {
        board: boardId,
        stage: 'done',
        expectedRevision: workItem.revision,
        requestId: randomUUID(),
        cause: 'skip-ahead',
      });
      expect(skipAhead.status).toBe(422);
      expect((await skipAhead.json()).result).toMatchObject({ status: 'rejected', code: 'invalid_transition' });

      s.setModel(handOff('builder', 'verify'), handOff('verifier', 'done'));
      expect(await move(s, ops.id, workItem, 'build')).toMatchObject({ status: 'accepted', stage: 'build' });
      await s.waitForCard(workItem.id, { board: boardId, stages: ['done'] });

      expect(s.kickoff('builder', 'Rotate the deploy keys')).toBeDefined();
      expect(s.kickoff('builder', 'Rotate the deploy keys')).not.toContain('acceptance criteria');
      expect(s.kickoff('builder', 'Rotate the deploy keys')).toContain(
        JSON.stringify('<skill name="ops-build">').slice(1, -1),
      );
      expect(s.kickoff('builder', 'Rotate the deploy keys')).toContain('Ship behind a feature flag.');
      expect(s.kickoff('verifier', 'Rotate the deploy keys')).toContain(
        'Verify the change against the acceptance criteria.',
      );
      expect(await s.startedRoles(ops.id)).toEqual(['builder', 'verifier']);
    },
    40_000,
  );

  it('receives GitHub issues from a repository bound to it and runs them', async () => {
    const s = (scenario = await startFactoryScenario());
    const ops = await s.createProject('Ops');
    const repo = await s.connectGithubRepository(ops.id, 'ops/service');
    const boardId = await createBoard(s, ops.id, TRIAGE_BOARD);
    await s.json('PUT', '/web/intake/bindings', {
      integrationId: 'github',
      sourceId: repo.repositoryId,
      factoryProjectId: ops.id,
      board: boardId,
    });

    const delivered = await s.githubWebhook('issues', {
      action: 'opened',
      repository: { id: Number(repo.externalId), full_name: repo.slug },
      issue: {
        id: 9001,
        number: 12,
        title: 'Login page times out',
        html_url: `https://github.com/${repo.slug}/issues/12`,
        state: 'open',
        created_at: '2026-10-18T00:00:00Z',
        user: { login: 'ada' },
        labels: [],
        assignees: [],
      },
      sender: { login: 'ada' },
    });
    expect(delivered.status).toBe(202);

    const card = await waitForSourceCard(s, ops.id, 'Login page times out');
    expect(card).toMatchObject({ board: boardId, stages: ['inbox'] });

    s.setModel(handOff('triager', 'done'));
    expect(await move(s, ops.id, card, 'triage')).toMatchObject({ status: 'accepted' });
    await s.waitForCard(card.id, { board: boardId, stages: ['done'] });
    expect(s.kickoff('triager', 'Login page times out')).toContain(`https://github.com/${repo.slug}/issues/12`);
  }, 40_000);

  it('receives Linear issues from a team bound to it and runs them', async () => {
    const s = (scenario = await startFactoryScenario());
    const ops = await s.createProject('Ops');
    await s.connectGithubRepository(ops.id, 'ops/service');
    const boardId = await createBoard(s, ops.id, TRIAGE_BOARD);
    await s.connectLinear('linear-team:team-1');
    await s.json('PUT', '/web/intake/bindings', {
      integrationId: 'linear',
      sourceId: 'linear-team:team-1',
      factoryProjectId: ops.id,
      board: boardId,
    });
    s.linearIssues.push({
      id: 'lin-1',
      identifier: 'OPS-7',
      title: 'Rotate the pager schedule',
      url: 'https://linear.app/scenario/issue/OPS-7',
      teamId: 'team-1',
      teamKey: 'OPS',
    });

    // A board request is also an ingest for the sources routed to this Factory.
    await s.json('GET', `/web/linear/issues?factoryProjectId=${ops.id}`);
    const card = await waitForSourceCard(s, ops.id, 'OPS-7: Rotate the pager schedule');
    expect(card).toMatchObject({ board: boardId, stages: ['inbox'] });

    s.setModel(handOff('triager', 'done'));
    expect(await move(s, ops.id, card, 'triage')).toMatchObject({ status: 'accepted' });
    await s.waitForCard(card.id, { board: boardId, stages: ['done'] });
    expect(s.kickoff('triager', 'Rotate the pager schedule')).toContain('OPS-7');
  }, 40_000);
});

async function waitForSourceCard(s: FactoryScenario, factoryId: string, title: string) {
  let found: Awaited<ReturnType<FactoryScenario['workItems']['list']>>[number] | undefined;
  await expect
    .poll(
      async () => {
        found = (await s.workItems.list({ orgId: ORG, factoryProjectId: factoryId })).find(
          item => item.title === title,
        );
        return found;
      },
      { timeout: 10_000 },
    )
    .toBeDefined();
  return found!;
}
