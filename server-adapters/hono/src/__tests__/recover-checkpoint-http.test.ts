import { Agent } from '@mastra/core/agent';
import { createDurableAgent, DurableStepIds } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { expect, it, onTestFinished } from 'vitest';
import { MastraServer } from '../index';

it('returns HTTP 500, not a successful recovery, when the pending loop row has no checkpoint', async () => {
  const storage = new InMemoryStore();
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'checkpoint-agent',
      name: 'checkpoint-agent',
      instructions: 'Report the amount.',
      model: 'openai/gpt-4o',
    }),
  });
  const mastra = new Mastra({
    logger: false,
    agents: { 'checkpoint-agent': agent },
    storage,
    recovery: { durableAgents: 'off', workflows: 'off' },
  });
  onTestFinished(() => mastra.shutdown());
  const workflows = (await storage.getStore('workflows'))!;
  const runId = crypto.randomUUID();
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
    snapshot: {
      runId,
      status: 'pending',
      context: {},
      value: {},
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      waitingPaths: {},
      timestamp: Date.now(),
    },
  });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();

  const response = await app.request('/api/agents/checkpoint-agent/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId }),
  });

  expect(response.status).toBe(500);
  expect(response.ok).toBe(false);
  expect(await response.json()).toMatchObject({
    error: expect.stringContaining('no restartable checkpoint has been persisted yet'),
  });
  expect(await workflows.getRunOwnership({ runId })).toBeNull();
});
