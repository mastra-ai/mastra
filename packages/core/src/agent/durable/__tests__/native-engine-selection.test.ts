import { describe, expect, it } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

const config = { name: 'Engine Agent', instructions: 'Help the user.', model: 'openai/gpt-4o' } as const;

function registerNativeEvented(id: string) {
  // Its own replay cache, distinct from the shared log, as for an agent in another process.
  const agent = new Agent({ ...config, id, durable: { executionEngine: 'evented', cache: new InMemoryServerCache() } });
  new Mastra({ agents: { [id]: agent }, storage: new InMemoryStore(), logger: false });
  return agent;
}

describe('native agent engine selection', () => {
  // A process that serves reconnects (the server, with workers elsewhere) may never run the agent itself.
  it('finds a run that workers recorded on the shared log before this process runs the agent', async () => {
    const agent = registerNativeEvented('evented-observer');
    const runId = crypto.randomUUID();
    // Evented workers record ownership on Mastra's shared run log.
    await agent
      .__getStreamBus(true)!
      .getRunRecordCache(true)
      .set(`agent.durable.replay-owner.evented-observer.${runId}`, {
        agentId: 'evented-observer',
        runId,
        resourceId: 'user-a',
      });

    await expect(agent.__getReplayOwner(runId)).resolves.toEqual({ resourceId: 'user-a', threadId: undefined });
  });

  it('selects the engine through the durable policy for wrapper classes', () => {
    const durable = createDurableAgent({ agent: new Agent({ ...config, id: 'wrapped-default' }) });
    const evented = createEventedAgent({ agent: new Agent({ ...config, id: 'wrapped-evented' }) });

    expect(durable.__getExecutionEnginePolicy()).toBe('default');
    expect(evented.__getExecutionEnginePolicy()).toBe('evented');
    expect(durable.__hasDurableExecution()).toBe(true);
    expect(evented.__hasDurableExecution()).toBe(true);
  });
});
