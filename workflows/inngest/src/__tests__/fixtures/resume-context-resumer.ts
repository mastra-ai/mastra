/**
 * A fresh API replica that approves a parked run — runs in a SEPARATE process from the one that
 * started the run, so its globalRunRegistry is empty and the resume works from the snapshot alone.
 * Drains the resumed stream until the run finishes or parks again, then prints one RESULT line.
 *
 * Usage: tsx resume-context-resumer.ts <dbUrl> <agentId> <inngestPort> <outDir> <runId> <threadId> <resourceId>
 */
import { buildResumeContextAgent } from './resume-context-agent';

const [dbUrl, agentId, inngestPort, outDir, runId, threadId, resourceId] = process.argv.slice(2);
if (!dbUrl || !agentId || !outDir || !runId) {
  console.error('[resumer] usage: resumer.ts <dbUrl> <agentId> <inngestPort> <outDir> <runId> <threadId> <resourceId>');
  process.exit(1);
}

const { durableAgent, mastra } = buildResumeContextAgent({
  dbUrl,
  agentId,
  inngestPort: Number(inngestPort),
  outDir,
  role: 'resumer',
});
const result: { chunkTypes: string[]; error: string | null } = { chunkTypes: [], error: null };
try {
  const resumed = await durableAgent.resume(runId, { approved: true }, { threadId, resourceId });
  try {
    for await (const chunk of resumed.output.fullStream as AsyncIterable<any>) {
      result.chunkTypes.push(chunk.type);
      if (chunk.type === 'error') result.error = String(chunk.payload?.error?.message ?? chunk.payload?.error);
      if (chunk.type === 'tool-call-suspended' || chunk.type === 'finish' || chunk.type === 'error') break;
    }
  } finally {
    resumed.cleanup?.();
  }
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
}
await mastra.observability?.flush?.();
console.log(`RESULT ${JSON.stringify(result)}`);
process.exit(0);
