import { randomUUID } from 'node:crypto';
import { createDurableAgent, DurableStepIds } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { expect, it } from 'vitest';
import { LibSQLStore } from '../../storage';
import type { T81PeerArgs } from './fixtures/t81-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import { bootWorkers } from './process-workers';
import { createStepAgent } from './step-agent';

// COR-1493: a genuine running checkpoint survives process death mid-tool;
// another wrapper in the same process cannot prove this recovery path.
it(
  'recovers an enabled mid-tool checkpoint after SIGKILL without fabricating input from the execution row',
  async () => {
    const env = await createXprocEnv({ workers: true });
    const storage = new LibSQLStore({ id: 'mid-step-checkpoint', url: env.dbUrl });
    let mastra: Mastra | undefined;
    try {
      const id = randomUUID();
      const args: T81PeerArgs = {
        engine: 'durable',
        agentId: `checkpoint-${id}`,
        runId: `run-${id}`,
        threadId: `thread-${id}`,
        resourceId: `resource-${id}`,
        releaseTimeoutMs: PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS,
      };
      const original = await env.spawnPeer<T81PeerArgs>(new URL('./fixtures/t81-peer.ts', import.meta.url), args, {
        role: 'original-mid-step',
        workers: true,
      });
      await original.waitFor('blocked');
      const workflows = (await storage.getStore('workflows'))!;
      const snapshot = () =>
        workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: args.runId });
      expect(await snapshot()).toMatchObject({
        status: 'running',
        context: { input: { __workflowKind: 'durable-agent', agentId: args.agentId } },
      });
      const first = await workflows.getRunOwnership({ runId: args.runId });
      expect(first?.live).toBe(true);
      await original.kill();
      expect(await original.exit()).toMatchObject({ signal: 'SIGKILL' });

      const memory = new MockMemory();
      memory.setStorage(storage);
      const { agent, modelCalls } = createStepAgent({
        id: args.agentId,
        steps: 3,
        finalText: 'recovered after process death',
        memory,
      });
      const runner = createDurableAgent({ agent });
      mastra = new Mastra({
        agents: { runner },
        storage,
        pubsub: env.pubsub(),
        logger: false,
        recovery: { durableAgents: 'auto' },
      });
      await bootWorkers(mastra, env.workers);
      const recovered = await runner.recover(args.runId, { force: true });
      try {
        const types: string[] = [];
        const drained = (async () => {
          for await (const chunk of recovered.fullStream) types.push(chunk.type);
        })();
        const [output] = await Promise.all([recovered.output.getFullOutput(), drained]);
        expect(output.text).toBe('recovered after process death');
        expect(output.finishReason).toBe('stop');
        expect(types).not.toContain('error');
        expect(types.filter(type => type === 'finish')).toHaveLength(1);
        expect(modelCalls()).toBeGreaterThan(0);
        await expect.poll(snapshot, { timeout: DEFAULT_HANG_GUARD_MS }).toBeNull();
        expect((await workflows.getRunOwnership({ runId: args.runId }))?.generation).toBeGreaterThan(first!.generation);
        const messages = (
          await (await storage.getStore('memory'))!.listMessages({ threadId: args.threadId, perPage: false })
        ).messages;
        expect(
          messages.filter(message => message.role === 'assistant' && message.content.content === output.text),
        ).toHaveLength(1);
      } finally {
        recovered.cleanup();
      }
    } finally {
      try {
        await mastra?.shutdown();
      } finally {
        try {
          await storage.close();
        } finally {
          await env.cleanup();
        }
      }
    }
  },
  PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS + 10_000,
);
