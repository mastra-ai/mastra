/**
 * One process of the resume-spans topology. Every role builds the same evented agent over the
 * shared LibSQL file and the shared socket, and writes its span events to the shared events file.
 *
 * - `worker`: boots the event workers and executes whatever run reaches it. With `exitAfterFinalStep`
 *   it exits the moment the run's final step is saved, before the run's status is, as a worker that
 *   dies between two writes does.
 * - `resumer`: a fresh API replica approving a parked tool call.
 */
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createStepAgent } from '../step-agent';
import { createSpanEventsObservability } from './span-events';

export interface ResumeSpansPeerArgs {
  agentId: string;
  eventsPath: string;
  mode: 'worker' | 'resumer';
  runId?: string;
  toolCallId?: string;
  exitAfterFinalStep?: boolean;
}

export interface ResumeSpansPeerResult {
  chunkTypes: string[];
  error: string | null;
}

runPeer<ResumeSpansPeerArgs>(async (peer): Promise<ResumeSpansPeerResult> => {
  const { agentId, eventsPath, mode, runId, toolCallId, exitAfterFinalStep } = peer.args;
  const { agent } = createStepAgent({ id: agentId, steps: 1 });
  const runner = createEventedAgent({ agent });
  const storage = new LibSQLStore({ id: `resume-spans-${peer.config.role}`, url: peer.dbUrl });
  const mastra = new Mastra({
    agents: { [agentId]: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: peer.workers ? undefined : false,
    observability: createSpanEventsObservability(eventsPath, peer.config.role),
  });
  if (exitAfterFinalStep) {
    const workflows = (await storage.getStore('workflows'))!;
    const write = workflows.updateWorkflowResults.bind(workflows);
    workflows.updateWorkflowResults = async args => {
      const written = await write(args);
      if (args.stepId === 'map-final-output') {
        await mastra.observability?.flush?.();
        process.exit(0);
      }
      return written;
    };
  }
  const result: ResumeSpansPeerResult = { chunkTypes: [], error: null };
  try {
    await bootWorkers(mastra, peer.workers);
    if (mode === 'worker') {
      await peer.signal('worker-ready');
      await peer.waitFor('finish', { timeoutMs: 120_000 });
      return result;
    }
    const stream = await runner.approveToolCall({ runId: runId!, toolCallId: toolCallId! });
    try {
      for await (const chunk of stream.fullStream as AsyncIterable<any>) {
        result.chunkTypes.push(chunk.type);
        if (chunk.type === 'error') result.error = String(chunk.payload?.error?.message ?? chunk.payload?.error);
        if (chunk.type === 'finish' || chunk.type === 'error') break;
      }
    } finally {
      stream.cleanup?.();
    }
    await mastra.observability?.flush?.();
    return result;
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
