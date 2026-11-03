import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { scoredAgent, allSignals } from './resume-sampling-agent';
runPeer<{ id: string; file: string; mode: 'worker' | 'resume'; runId?: string; toolCallId?: string }>(async peer => {
  const { id, file, mode, runId, toolCallId } = peer.args;
  const configured = await scoredAgent(id);
  const runner = createEventedAgent({ agent: configured.agent });
  const storage = new LibSQLStore({ id: peer.config.role, url: peer.dbUrl });
  const mastra = new Mastra({
    agents: { runner },
    scorers: { s: configured.scorer },
    storage,
    pubsub: peer.pubsub(),
    workers: peer.workers ? undefined : false,
    logger: false,
    observability: allSignals(file, peer.config.role),
  });
  try {
    await bootWorkers(mastra, peer.workers);
    if (mode === 'worker') {
      await peer.signal('ready');
      await peer.waitFor('finish', { timeoutMs: 120000 });
      return { worker: true };
    }
    const stream = await runner.approveToolCall({ runId: runId!, toolCallId: toolCallId! });
    const types: string[] = [];
    for await (const chunk of stream.fullStream) {
      types.push(chunk.type);
      if (chunk.type === 'finish' || chunk.type === 'error') break;
    }
    stream.cleanup?.();
    return { types };
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
