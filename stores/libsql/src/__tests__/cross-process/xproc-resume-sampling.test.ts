import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createEventedAgent, DurableStepIds } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { it, expect } from 'vitest';
import { LibSQLStore } from '../../storage';
import { allSignals, scoredAgent } from './fixtures/resume-sampling-agent';
import { createXprocEnv } from './peer-helper';
import type { PeerHandle } from './peer-helper';
const PEER = new URL('./fixtures/resume-sampling-peer.ts', import.meta.url);
for (const sampled of [false, true])
  it(`remote resumed scoring ${sampled ? 'sampled control' : 'declined stays empty'}`, async () => {
    const env = await createXprocEnv({ workers: false });
    const file = path.join(env.dir, 'all-signals.jsonl');
    const id = `resume-sampling-${randomUUID()}`;
    const storage = new LibSQLStore({ id: 'resume-sampling-api', url: env.dbUrl });
    const configured = await scoredAgent(id);
    const runner = createEventedAgent({ agent: configured.agent });
    const mastra = new Mastra({
      agents: { runner },
      scorers: { s: configured.scorer },
      storage,
      pubsub: env.pubsub(),
      workers: false,
      logger: false,
      observability: allSignals(file, 'api', !sampled),
    });
    const peers: PeerHandle[] = [];
    const rows = () =>
      existsSync(file)
        ? readFileSync(file, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map(l => JSON.parse(l))
        : [];
    try {
      const worker = await env.spawnPeer(PEER, { id, file, mode: 'worker' }, { role: 'worker', workers: true });
      peers.push(worker);
      await worker.waitFor('ready');
      const stream = await runner.stream('Perform the step', { requireToolApproval: true, maxSteps: 3 });
      let call: string | undefined;
      for await (const c of stream.fullStream) {
        if (c.type === 'tool-call-approval') {
          call = c.payload.toolCallId;
          break;
        }
      }
      stream.cleanup();
      expect(call).toBeDefined();
      const workflows = (await storage.getStore('workflows'))!;
      await expect
        .poll(
          async () =>
            (await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: stream.runId }))
              ?.status,
        )
        .toBe('suspended');
      const resumer = await env.spawnPeer(
        PEER,
        { id, file, mode: 'resume', runId: stream.runId, toolCallId: call },
        { role: 'resumer', workers: false },
      );
      peers.push(resumer);
      const result = await resumer.result<{ types: string[] }>();
      expect(result.types).toContain('finish');
      if (sampled)
        await expect
          .poll(() => rows().filter(r => r.signal === 'score').length, { timeout: 3000 })
          .toBe(1)
          .catch(error => {
            console.log(
              'Sampled scoring diagnostics',
              JSON.stringify(rows().filter(r => r.type?.startsWith('scorer') || r.signal === 'score')),
            );
            throw error;
          });
      else await new Promise(r => setTimeout(r, 500));
      worker.send('finish');
      await worker.result();
      await mastra.observability?.flush();
      const events = rows();
      const counts: Record<string, number> = {};
      for (const row of events.filter(r => r.signal !== 'hook'))
        counts[row.signal === 'score' ? 'score' : row.type] =
          (counts[row.signal === 'score' ? 'score' : row.type] ?? 0) + 1;
      console.log(
        'Remote resumed scoring',
        JSON.stringify({ sampled, counts, hooks: events.filter(r => r.signal === 'hook') }),
      );
      if (sampled) {
        expect(counts.agent_run).toBe(4);
        expect(counts.model_generation).toBe(4);
        expect(counts.score).toBe(1);
      } else expect(counts).toEqual({});
    } finally {
      for (const peer of peers) await peer.kill().catch(() => {});
      await mastra.shutdown();
      await storage.close();
      await env.cleanup();
    }
  }, 90000);
