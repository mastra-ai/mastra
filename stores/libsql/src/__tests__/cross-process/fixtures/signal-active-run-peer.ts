/**
 * Worker for xproc-signal-active-run.test.ts and xproc-signal-failed-run.test.ts:
 * executes the evented agent's steps for runs another process starts. The step
 * tool parks until the test sends `release`, and every model call's prompt is
 * reported to the test.
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
  /**
   * Fail this run here after its second model call: that call answers only once
   * the test sends `answer`, and every write of a step result that holds its
   * answer fails, as with a workflows store that lost its database for good.
   */
  failRunId?: string;
}

export interface ModelCallReport {
  pid: number;
  call: number;
  prompt: unknown;
}

const FINAL_TEXT = 'worker answered';

/** Fails the workflows store's step result writes of `runId` that hold `text`. Other writes go through. */
async function failStepResultWrites(storage: LibSQLStore, runId: string, text: string) {
  const workflows = (await storage.getStore('workflows'))!;
  const fails = (args: { runId: string }) => args.runId === runId && JSON.stringify(args).includes(text);
  const updateWorkflowResults = workflows.updateWorkflowResults.bind(workflows);
  workflows.updateWorkflowResults = async args => {
    if (fails(args)) throw new Error(`The workflows store refused a step result of run ${runId}`);
    return updateWorkflowResults(args);
  };
  const appendWorkflowRunEntries = workflows.appendWorkflowRunEntries.bind(workflows);
  workflows.appendWorkflowRunEntries = async args => {
    if (fails(args)) throw new Error(`The workflows store refused a step result of run ${runId}`);
    return appendWorkflowRunEntries(args);
  };
}

runPeer<SignalActiveRunPeerArgs>(async peer => {
  const { agentId, failRunId } = peer.args;
  const storage = new LibSQLStore({ id: `signal-active-run-worker-${process.pid}`, url: peer.dbUrl });
  if (failRunId) await failStepResultWrites(storage, failRunId, FINAL_TEXT);
  const release = gate();
  const answer = gate();
  // Installed before the tool can report that it parked: the test may release at once.
  // A release that never comes leaves the tool parked; the test's own hang guard reports it.
  void peer.waitFor('release').then(
    () => release.resolve(),
    () => {},
  );
  if (failRunId) {
    void peer.waitFor('answer').then(
      () => answer.resolve(),
      () => {},
    );
  }
  const memory = new MockMemory();
  memory.setStorage(storage);
  const { agent } = createStepAgent({
    id: agentId,
    steps: 1,
    blockAt: 1,
    release: release.promise,
    finalText: FINAL_TEXT,
    memory,
    onToolEvent: event => {
      if (event.event === 'reached') void peer.signal('tool-reached', { pid: process.pid });
    },
    onModelPrompt: (call, prompt) => {
      void peer.signal(`model-call-${call}`, { pid: process.pid, call, prompt } satisfies ModelCallReport);
    },
    holdModelCall: call => (failRunId && call === 2 ? answer.promise : undefined),
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
