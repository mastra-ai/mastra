/**
 * One process of the resume-segment topology. Every role builds the same evented agent over the
 * shared LibSQL file and the shared socket, and writes its span events to the shared events file.
 *
 * - `worker`: boots the event workers and executes whatever run reaches it. With `blockAt` the tool
 *   parks at that step until the test sends `release`, so the test can pause or kill the process
 *   mid-tool.
 * - `resumer`: a fresh API replica approving a parked tool call. With `failDispatch` the engine
 *   fails before the resume reaches a worker.
 * - `recoverer`: a fresh API replica taking the run over from a worker that stopped mid-tool.
 */
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createStepAgent, gate } from '../step-agent';
import { createSegmentObservability } from './segment-events';

export interface ResumeSegmentPeerArgs {
  agentId: string;
  steps: number;
  eventsPath: string;
  mode: 'worker' | 'resumer' | 'recoverer';
  runId?: string;
  toolCallId?: string;
  blockAt?: number;
  failDispatch?: boolean;
}

export interface ResumeSegmentPeerResult {
  pid: number;
  chunkTypes: string[];
  approvals: string[];
  error: string | null;
}

runPeer<ResumeSegmentPeerArgs>(async (peer): Promise<ResumeSegmentPeerResult> => {
  const { agentId, steps, eventsPath, mode, runId, toolCallId, blockAt, failDispatch } = peer.args;
  const release = gate();
  if (blockAt) void peer.waitFor('release', { timeoutMs: 120_000 }).then(() => release.resolve());
  const { agent } = createStepAgent({
    id: agentId,
    steps,
    perRun: true,
    blockAt,
    release: release.promise,
    onToolEvent: event => {
      if (event.event === 'reached') void peer.signal('blocked', { pid: process.pid, n: event.n });
    },
  });
  const runner = createEventedAgent({ agent });
  const storage = new LibSQLStore({ id: `resume-segment-${peer.config.role}`, url: peer.dbUrl });
  const mastra = new Mastra({
    agents: { [agentId]: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: peer.workers ? undefined : false,
    observability: createSegmentObservability(eventsPath, peer.config.role),
  });
  const result: ResumeSegmentPeerResult = { pid: process.pid, chunkTypes: [], approvals: [], error: null };
  try {
    await bootWorkers(mastra, peer.workers);
    if (mode === 'worker') {
      await peer.signal('worker-ready');
      await peer.waitFor('finish', { timeoutMs: 120_000 });
      return result;
    }
    if (failDispatch) {
      (mastra as unknown as { __ensureExecutionWorkersStarted: () => Promise<void> }).__ensureExecutionWorkersStarted =
        async () => {
          throw new Error('dispatch failed on purpose');
        };
    }
    const stream =
      mode === 'resumer'
        ? await runner.approveToolCall({ runId: runId!, toolCallId: toolCallId! })
        : await runner.recover(runId!, { force: true });
    try {
      for await (const chunk of stream.fullStream as AsyncIterable<any>) {
        result.chunkTypes.push(chunk.type);
        if (chunk.type === 'tool-call-approval') result.approvals.push(chunk.payload?.toolCallId);
        if (chunk.type === 'error') result.error = String(chunk.payload?.error?.message ?? chunk.payload?.error);
        if (chunk.type === 'tool-call-approval' || chunk.type === 'finish' || chunk.type === 'error') break;
      }
    } finally {
      stream.cleanup?.();
    }
    // Let this process's exporter write the ends it owns before the result is reported.
    await mastra.observability?.flush?.();
    return result;
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
