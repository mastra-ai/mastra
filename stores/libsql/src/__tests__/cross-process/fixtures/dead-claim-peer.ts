// Process B: resumes the suspended run, then parks inside the resumed tool so the
// test can SIGKILL it while it holds the resume claim.
import { runPeer } from '../peer-runtime';
import { createDeadClaimAgent } from './dead-claim-agent';
import type { KillPoint } from './dead-claim-agent';

export interface DeadClaimPeerArgs {
  modelUrl: string;
  logPath: string;
  runId: string;
  fencing: boolean;
  killPoint: KillPoint;
}

runPeer<DeadClaimPeerArgs>(async peer => {
  const { modelUrl, logPath, runId, fencing, killPoint } = peer.args;
  const { agent } = await createDeadClaimAgent({
    modelUrl,
    dbUrl: peer.dbUrl,
    logPath,
    fencing,
    killPoint,
    onKillPoint: () => void peer.signal('kill-point'),
  });
  await agent.resumeGenerate({ name: 'Ada' }, { runId });
  return { finishedWithoutKill: true };
});
