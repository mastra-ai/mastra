/**
 * Runs core's aimock `describeForAllEngines` scenarios on the Inngest engine.
 *
 * Every scenario agent is wrapped with `createInngestAgent` and added to the shared Mastra that
 * the Inngest dev server calls back into, so each run goes through a real Inngest function.
 *
 * Each test worker starts its own dev server + app server once (on its own ports) and reuses
 * them for every file it runs. Workers can't share one dev server: every worker serves the same
 * agentic workflow, so the dev server would hand a run to whichever worker it picked.
 */
import type { Agent } from '@mastra/core/agent';
import { setScenarioEngineHost } from '@mastra/core/loop/test-utils/aimock/aimock-scenario';
import { beforeAll } from 'vitest';

// Start at 5100+ so worker ports stay clear of the default test ports (4100/4101) and `mastra dev` (4111).
const PORTS_PER_WORKER = 10;
process.env.INNGEST_TEST_PORT_OFFSET ??= String(1000 + PORTS_PER_WORKER * Number(process.env.VITEST_POOL_ID ?? 1));

// Imported after the port offset is set: the test utils read it at load time.
const { createInngestAgent } = await import('../../durable-agent');
const { getSharedInngest, getSharedMastra, setupSharedTestInfrastructure, teardownSharedTestInfrastructure } =
  await import('../durable-agent.test.utils');

setScenarioEngineHost({
  engine: 'inngest',
  getMastra: getSharedMastra,
  wrapAgent: (agent: Agent) => createInngestAgent({ agent, inngest: getSharedInngest() }),
});

const globalState = globalThis as { __inngestAimockReady?: Promise<void> };

beforeAll(async () => {
  if (!globalState.__inngestAimockReady) {
    globalState.__inngestAimockReady = setupSharedTestInfrastructure({
      backgroundTasks: { enabled: true, globalConcurrency: 5, perAgentConcurrency: 3 },
    });
    process.once('beforeExit', () => void teardownSharedTestInfrastructure());
  }
  await globalState.__inngestAimockReady;
}, 60_000);
