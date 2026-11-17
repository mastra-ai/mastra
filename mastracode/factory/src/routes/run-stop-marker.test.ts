import { ABORT_AGENT_CONTROLLER_SESSION_ROUTE } from '@mastra/server/handlers/agent-controller';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createRunStopMarker } from './run-stop-marker.js';

const ORG_ID = 'org-1';
const ABORT_ROUTE = `/api${ABORT_AGENT_CONTROLLER_SESSION_ROUTE.path}`;

async function setup() {
  const { workItems } = await createFactoryStorageForTests();
  const { binding } = await workItems.prepareRunStart({
    orgId: ORG_ID,
    userId: 'user-1',
    factoryProjectId: 'project-1',
    workItem: { input: { title: 'Fix login', stages: ['execute'], sessions: {}, metadata: {} } },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: 'project-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: 'Start.',
  });
  const aborted: string[] = [];
  const app = new Hono();
  app.use(
    '*',
    createRunStopMarker(() => workItems),
  );
  app.post(ABORT_ROUTE, c => {
    aborted.push(c.req.param('sessionId'));
    return c.json({ success: true });
  });
  app.get(ABORT_ROUTE, c => c.json({}));
  const stopRequested = () => workItems.runBindingStopRequested({ orgId: ORG_ID, bindingId: binding.id });
  const startRun = () => workItems.clearRunBindingStopRequest({ orgId: ORG_ID, bindingId: binding.id });
  return { app, aborted, stopRequested, startRun };
}

describe('createRunStopMarker', () => {
  it('marks the session run as stopped before the abort runs, until the next run starts', async () => {
    const { app, aborted, stopRequested, startRun } = await setup();

    const response = await app.request('/api/agent-controller/code/sessions/session-1/abort', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(aborted).toEqual(['session-1']);
    expect(await stopRequested()).toBe(true);
    await startRun();
    expect(await stopRequested()).toBe(false);
  });

  it('leaves the run unmarked for other requests and other sessions', async () => {
    const { app, stopRequested } = await setup();

    await app.request('/api/agent-controller/code/sessions/session-1/abort');
    await app.request('/api/agent-controller/code/sessions/session-2/abort', { method: 'POST' });

    expect(await stopRequested()).toBe(false);
  });

  it('still aborts when the stop cannot be recorded', async () => {
    const aborted: string[] = [];
    const app = new Hono();
    app.use(
      '*',
      createRunStopMarker(() => ({
        requestRunBindingStop: async () => {
          throw new Error('storage down');
        },
      })),
    );
    app.post(ABORT_ROUTE, c => {
      aborted.push(c.req.param('sessionId'));
      return c.json({ success: true });
    });

    const response = await app.request('/api/agent-controller/code/sessions/session-1/abort', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(aborted).toEqual(['session-1']);
  });
});
