// Replica A: suspends on approval, approves, and parks at the crash point so
// the test can SIGKILL it mid-resume.
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createCrashAgent } from './resume-crash-agent';
import type { CrashAt } from './resume-crash-agent';

export interface CrashPeerArgs {
  engine: 'durable' | 'evented';
  crashAt: CrashAt;
  policy: 'off' | 'auto';
  logPath: string;
}

runPeer<CrashPeerArgs>(async peer => {
  const { engine, crashAt, policy, logPath } = peer.args;
  let ids: { runId: string; toolCallId: string } | undefined;
  const { agent } = createCrashAgent({
    logPath,
    crashAt,
    onCrashPoint: where => void peer.signal('crash-point', { ...ids, where }),
  });
  const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const mastra = new Mastra({
    agents: { crash: runner },
    storage: new LibSQLStore({ id: `crash-peer-${process.pid}`, url: peer.dbUrl }),
    pubsub: peer.pubsub(),
    logger: false,
    workers: peer.workers ? undefined : false,
    recovery: { durableAgents: policy },
  });
  await bootWorkers(mastra, peer.workers);

  const out = await runner.stream('do it', { requireToolApproval: true, maxSteps: 5 });
  for await (const chunk of out.fullStream as any) {
    if (chunk.type === 'tool-call-approval') {
      ids = { runId: out.runId, toolCallId: chunk.payload?.toolCallId ?? 'call-1' };
      break;
    }
  }
  if (!ids) throw new Error('no approval chunk');
  await peer.signal('suspended', ids);
  const resumed = await runner.approveToolCall(ids);
  for await (const _ of resumed.fullStream as any) {
    // drain until killed
  }
  return { finishedWithoutCrash: true };
});
