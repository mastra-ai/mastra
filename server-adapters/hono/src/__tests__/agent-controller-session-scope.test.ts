import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

async function setup() {
  const storage = new InMemoryStore();
  const controller = new AgentController({
    id: 'code',
    storage,
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        agent: new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any }),
      },
    ],
  });
  const mastra = new Mastra({ logger: false, storage, agentControllers: { code: controller } });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return { app, controller };
}

const json = { 'Content-Type': 'application/json' };

describe('agent controller sessions over HTTP', () => {
  it('rejects the removed sessionScope query param, naming sessionId', async () => {
    const { app, controller } = await setup();

    const response = await app.request('http://localhost/api/agent-controller/code/sessions/repo-1?sessionScope=run-a');

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('address the session by sessionId');
    expect(await controller.getSession('repo-1')).toBeUndefined();
  });

  it('rejects the removed sessionScope in the create body, naming sessionId', async () => {
    const { app, controller } = await setup();

    const response = await app.request('http://localhost/api/agent-controller/code/sessions', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ resourceId: 'repo-1', sessionScope: 'run-a' }),
    });

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('address the session by sessionId');
    expect(await controller.getSession('repo-1')).toBeUndefined();
  });

  it('creates and reads a session addressed by sessionId', async () => {
    const { app } = await setup();

    const created = await app.request('http://localhost/api/agent-controller/code/sessions', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ resourceId: 'repo-1', sessionId: 'run-a' }),
    });
    expect(created.status).toBe(200);

    const state = await app.request('http://localhost/api/agent-controller/code/sessions/run-a');
    expect(state.status).toBe(200);
    expect(await state.json()).toMatchObject({ sessionId: 'run-a', resourceId: 'repo-1' });
  });
});
