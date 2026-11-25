/**
 * Worker for xproc-signal-active-run.test.ts: executes the evented agent's steps
 * for runs another process starts. The step tool parks until the test sends
 * `release`, and every model call's prompt is reported to the test.
 */
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createStepAgent, gate } from '../step-agent';

export interface SignalActiveRunPeerArgs {
  agentId: string;
}

export interface ModelCallReport {
  pid: number;
  call: number;
  prompt: unknown;
}

runPeer<SignalActiveRunPeerArgs>(async peer => {
  const { agentId } = peer.args;
  const storage = new LibSQLStore({ id: `signal-active-run-worker-${process.pid}`, url: peer.dbUrl });
  const release = gate();
  // Installed before the tool can report that it parked: the test may release at once.
  // A release that never comes leaves the tool parked; the test's own hang guard reports it.
  void peer.waitFor('release').then(
    () => release.resolve(),
    () => {},
  );
  const memory = new MockMemory();
  memory.setStorage(storage);
  const { agent } = createStepAgent({
    id: agentId,
    steps: 1,
    blockAt: 1,
    release: release.promise,
    finalText: 'worker answered',
    memory,
    onToolEvent: event => {
      if (event.event === 'reached') void peer.signal('tool-reached', { pid: process.pid });
    },
    onModelPrompt: (call, prompt) => {
      void peer.signal(`model-call-${call}`, { pid: process.pid, call, prompt } satisfies ModelCallReport);
    },
  });
  const runner = createEventedAgent({ agent });
  const mastra = new Mastra({
    agents: { [agentId]: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: peer.workers ? undefined : false,
  });
  try {
    await bootWorkers(mastra, peer.workers);
    await peer.signal('worker-ready');
    await peer.waitFor('finish', { timeoutMs: 120_000 });
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
