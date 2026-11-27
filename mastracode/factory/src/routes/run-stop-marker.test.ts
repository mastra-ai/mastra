import { ABORT_AGENT_CONTROLLER_SESSION_ROUTE } from '@mastra/server/handlers/agent-controller';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createRunStopMarker } from './run-stop-marker.js';

const ORG_ID = 'org-1';
const ABORT_ROUTE = `/api${ABORT_AGENT_CONTROLLER_SESSION_ROUTE.path}`;

const signedInToOrg1 = {
  enabled: () => true,
  ensureUser: async () => undefined,
  tenant: () => ({ orgId: ORG_ID, userId: 'user-1' }),
};

async function bindSession(workItems: WorkItemsStorage, orgId: string) {
  const { binding } = await workItems.prepareRunStart({
    orgId,
    userId: 'user-1',
    factoryProjectId: 'project-1',
    workItem: { input: { title: 'Fix login', stages: ['execute'], sessions: {}, metadata: {} } },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: 'project-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: 'Start.',
  });
  return binding;
}

async function setupWithBinding() {
  const { workItems } = await createFactoryStorageForTests();
  return { workItems, binding: await bindSession(workItems, ORG_ID) };
}

async function setup() {
  const { workItems, binding } = await setupWithBinding();
  const aborted: string[] = [];
  const app = new Hono();
  app.use('*', createRunStopMarker({ auth: signedInToOrg1, workItems: () => workItems }));
  app.post(ABORT_ROUTE, c => {
    aborted.push(c.req.param('sessionId'));
    return c.json({ success: true });
  });
  app.get(ABORT_ROUTE, c => c.json({}));
  const stopRequested = () => workItems.runBindingStopRequested({ orgId: ORG_ID, bindingId: binding.id });
  const startRun = () => workItems.clearRunBindingStopRequest({ orgId: ORG_ID, bindingId: binding.id });
  return { app, aborted, workItems, stopRequested, startRun };
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

  it('leaves the run unmarked for other requests, other sessions, and paths the guard reads as another session', async () => {
    const { app, stopRequested } = await setup();

    await app.request('/api/agent-controller/code/sessions/session-1/abort');
    await app.request('/api/agent-controller/code/sessions/session-2/abort', { method: 'POST' });
    await app.request('/api/agent-controller/code/sessions/session-1/abort/', { method: 'POST' });
    await app.request(
      '/api/agent-controller/code/sessions/session-2/x/agent-controller/code/sessions/session-1/abort',
      {
        method: 'POST',
      },
    );

    expect(await stopRequested()).toBe(false);
  });

  it("leaves another organization's run with the same session id unmarked", async () => {
    const { app, workItems } = await setup();
    const otherOrgBinding = await bindSession(workItems, 'org-2');

    await app.request('/api/agent-controller/code/sessions/session-1/abort', { method: 'POST' });

    expect(await workItems.runBindingStopRequested({ orgId: 'org-2', bindingId: otherOrgBinding.id })).toBe(false);
  });

  it('still aborts when the stop cannot be recorded', async () => {
    const aborted: string[] = [];
    const app = new Hono();
    app.use(
      '*',
      createRunStopMarker({
        auth: signedInToOrg1,
        workItems: () => ({
          requestRunBindingStop: async () => {
            throw new Error('storage down');
          },
          listRunBindingsForSession: async () => [],
        }),
      }),
    );
    app.post(ABORT_ROUTE, c => {
      aborted.push(c.req.param('sessionId'));
      return c.json({ success: true });
    });

    const response = await app.request('/api/agent-controller/code/sessions/session-1/abort', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(aborted).toEqual(['session-1']);
  });

  it('tells the board engine of the stop once the abort succeeded, for each card the session was running, and who stopped it', async () => {
    const { workItems, binding } = await setupWithBinding();
    const heard: unknown[] = [];
    let running = false;
    const app = new Hono();
    app.use(
      '*',
      createRunStopMarker({
        auth: signedInToOrg1,
        workItems: () => workItems,
        boardEngine: () => ({ runStopped: async (seat, by) => void heard.push({ seat, by }) }),
        runInFlight: async sessionId => running && sessionId === 'session-1',
      }),
    );
    let fails = false;
    app.post(ABORT_ROUTE, c => (fails ? c.json({ error: 'no such session' }, 404) : c.json({ success: true })));

    // Nothing going on the session (a run waiting out its retry): the Stop stops nothing.
    await app.request('/api/agent-controller/code/sessions/session-1/abort', { method: 'POST' });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(heard).toEqual([]);

    running = true;
    await app.request('/api/agent-controller/code/sessions/session-1/abort', {
      method: 'POST',
      headers: { 'user-agent': 'test-browser' },
    });
    await vi.waitFor(() =>
      expect(heard).toEqual([
        {
          seat: { orgId: ORG_ID, factoryProjectId: 'project-1', workItemId: binding.workItemId, role: 'work' },
          by: { userId: 'user-1', actorProfile: undefined, context: { userAgent: 'test-browser' } },
        },
      ]),
    );

    fails = true;
    await app.request('/api/agent-controller/code/sessions/session-1/abort', { method: 'POST' });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(heard).toHaveLength(1);
  });
});
