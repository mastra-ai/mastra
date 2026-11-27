import { GET_WORKFLOW_RUN_BY_ID_ROUTE, LIST_WORKFLOW_RUNS_ROUTE } from '@mastra/server/handlers/workflows';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { FACTORY_BOARD_WORKFLOW_ID } from '../board-engine/board-workflow.js';
import { createBoardRunGuard } from './board-run-guard.js';

function setup(workflowIds: string[] = [FACTORY_BOARD_WORKFLOW_ID]) {
  const served: string[] = [];
  const app = new Hono();
  app.use(
    '*',
    createBoardRunGuard(() => workflowIds),
  );
  app.all('/api/*', c => {
    served.push(c.req.path);
    return c.json({ runs: [{ runId: 'factory-board:card-of-another-org' }] });
  });
  return { app, served };
}

const path = (route: { path: string }, workflowId: string, runId = 'factory-board:card-of-another-org') =>
  `/api${route.path.replace(':workflowId', encodeURIComponent(workflowId)).replace(':runId', encodeURIComponent(runId))}`;

describe('createBoardRunGuard', () => {
  it("answers 404 for the list of board runs and for one card's run, whoever asks", async () => {
    const { app, served } = setup();

    const list = await app.request(path(LIST_WORKFLOW_RUNS_ROUTE, FACTORY_BOARD_WORKFLOW_ID));
    const one = await app.request(path(GET_WORKFLOW_RUN_BY_ID_ROUTE, FACTORY_BOARD_WORKFLOW_ID));

    expect([list.status, one.status]).toEqual([404, 404]);
    expect(await one.json()).toEqual({ error: 'Not found' });
    expect(served).toEqual([]);
  });

  it('answers 404 for every route under the board workflow, resumes included', async () => {
    const { app, served } = setup();

    const answers = await Promise.all([
      app.request(`/api/workflows/${FACTORY_BOARD_WORKFLOW_ID}`),
      app.request(`/api/workflows/${FACTORY_BOARD_WORKFLOW_ID}/resume?runId=factory-board:card-1`, { method: 'POST' }),
      app.request(`/api/workflows/${FACTORY_BOARD_WORKFLOW_ID}/runs/factory-board:card-1/cancel`, { method: 'POST' }),
      app.request(`/api/workflows/${encodeURIComponent(FACTORY_BOARD_WORKFLOW_ID).replace('-', '%2D')}/runs`),
    ]);

    expect(answers.map(answer => answer.status)).toEqual([404, 404, 404, 404]);
    expect(served).toEqual([]);
  });

  it("leaves the host's other workflows, and a host whose engine runs none, alone", async () => {
    const { app, served } = setup();
    const other = await app.request(path(LIST_WORKFLOW_RUNS_ROUTE, 'factory-environment-build'));
    const all = await app.request('/api/workflows');
    expect([other.status, all.status]).toEqual([200, 200]);
    expect(served).toEqual(['/api/workflows/factory-environment-build/runs', '/api/workflows']);

    const plain = setup([]);
    expect((await plain.app.request(path(LIST_WORKFLOW_RUNS_ROUTE, FACTORY_BOARD_WORKFLOW_ID))).status).toBe(200);
  });
});
