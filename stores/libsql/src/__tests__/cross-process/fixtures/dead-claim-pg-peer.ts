// Process B: resumes the suspended run on the shared Postgres schema, then parks inside the
// resumed tool so the test can SIGKILL it while it holds the resume claim.
import { runPeer } from '../peer-runtime';
import { createDeadClaimPgAgent } from './dead-claim-pg-agent';
import type { KillPoint } from './dead-claim-pg-agent';

export interface DeadClaimPgPeerArgs {
  modelUrl: string;
  connectionString: string;
  schema: string;
  logPath: string;
  runId: string;
  killPoint: KillPoint;
}

runPeer<DeadClaimPgPeerArgs>(async peer => {
  const { modelUrl, connectionString, schema, logPath, runId, killPoint } = peer.args;
  const { agent } = await createDeadClaimPgAgent({
    modelUrl,
    connectionString,
    schema,
    logPath,
    killPoint,
    onKillPoint: () => void peer.signal('kill-point'),
  });
  await agent.resumeGenerate({ name: 'Ada' }, { runId });
  return { finishedWithoutKill: true };
});
