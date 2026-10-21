import { createDurableAgent, createEventedAgent, getRunRegistryEntry } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createStepAgent, gate } from '../step-agent';
import type { StepToolEvent } from '../step-agent';

export interface T81PeerArgs {
  engine: 'durable' | 'evented';
  agentId: string;
  runId: string;
  threadId: string;
  resourceId: string;
}

export interface T81PeerResult {
  pid: number;
  toolEvents: StepToolEvent[];
  errors: unknown[];
}

runPeer<T81PeerArgs>(async peer => {
  const { engine, agentId, runId, threadId, resourceId } = peer.args;
  const storage = new LibSQLStore({ id: `t81-original-${process.pid}`, url: peer.dbUrl });
  const release = gate();
  const committed = gate();
  const toolEvents: StepToolEvent[] = [];
  // Install before reporting the gate: main may release immediately after the signal.
  const released = peer.waitFor('release').then(() => release.resolve());
  const memory = new MockMemory();
  memory.setStorage(storage);
  const { agent } = createStepAgent({
    id: agentId,
    steps: 3,
    blockAt: 1,
    release: release.promise,
    finalText: `finished 3 steps from pid ${process.pid}`,
    memory,
    onToolEvent: event => {
      toolEvents.push(event);
      if (event.event === 'reached') peer.signal('blocked', { pid: process.pid, runId, step: event.n });
      if (event.event === 'commit' && event.n === 1) committed.resolve();
    },
  });
  const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const mastra = new Mastra({
    agents: { t81: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    recovery: { durableAgents: 'auto' },
    workers: peer.workers ? undefined : false,
  });
  await bootWorkers(mastra, peer.workers);
  const stream = await runner.stream('Perform three steps', {
    runId,
    maxSteps: 5,
    memory: { thread: threadId, resource: resourceId },
  });
  const entry = getRunRegistryEntry(runId, mastra);
  if (!entry?.executionFence || !entry.workflowExecution) throw new Error('original execution was not registered');
  const errors: unknown[] = [];
  const drained = (async () => {
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'error') errors.push(chunk);
    }
  })();
  await released;
  await committed.promise;
  await drained;
  // A replacement FINISH can close this observer before the original tool/run
  // settles. Keep the process alive until the real execution has stopped too.
  await entry.workflowExecution;
  await entry.executionFence.whenSettled;
  await mastra.shutdown();
  await storage.close();
  return { pid: process.pid, toolEvents, errors } satisfies T81PeerResult;
});
