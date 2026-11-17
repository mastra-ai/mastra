import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createRunStopMarker } from './run-stop-marker.js';

const ORG_ID = 'org-1';

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
  app.post('/api/agent-controller/:controllerId/sessions/:sessionId/abort', c => {
    aborted.push(c.req.param('sessionId'));
    return c.json({ success: true });
  });
  app.get('/api/agent-controller/:controllerId/sessions/:sessionId/abort', c => c.json({}));
  const stoppedSince = (since: Date) =>
    workItems.runBindingStoppedSince({ orgId: ORG_ID, bindingId: binding.id, since });
  return { app, aborted, stoppedSince };
}

describe('createRunStopMarker', () => {
  it('marks the session run as stopped before the abort runs', async () => {
    const { app, aborted, stoppedSince } = await setup();
    const runStart = new Date(Date.now() - 1_000);

    const response = await app.request('/api/agent-controller/code/sessions/session-1/abort', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(aborted).toEqual(['session-1']);
    expect(await stoppedSince(runStart)).toBe(true);
    // A run that starts after the stop is not covered by it.
    expect(await stoppedSince(new Date(Date.now() + 1_000))).toBe(false);
  });

  it('leaves the run unmarked for other requests and other sessions', async () => {
    const { app, stoppedSince } = await setup();
    const runStart = new Date(Date.now() - 1_000);

    await app.request('/api/agent-controller/code/sessions/session-1/abort');
    await app.request('/api/agent-controller/code/sessions/session-2/abort', { method: 'POST' });

    expect(await stoppedSince(runStart)).toBe(false);
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
    app.post('/api/agent-controller/:controllerId/sessions/:sessionId/abort', c => {
      aborted.push(c.req.param('sessionId'));
      return c.json({ success: true });
    });

    const response = await app.request('/api/agent-controller/code/sessions/session-1/abort', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(aborted).toEqual(['session-1']);
  });
});
