import { ConsoleLogger, noopLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { Memory } from '../../../index';

const MODEL = 'openai/gpt-4o-mini';

function createMemory() {
  return new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        model: MODEL,
        observation: { messageTokens: 100_000 },
        reflection: { observationTokens: 100_000 },
      },
    },
  });
}

describe('ObservationalMemory — agent logger propagation', () => {
  it('gives the Observer and Reflector agents the configured logger instead of a ConsoleLogger', async () => {
    const memory = createMemory();
    const mastra = new Mastra({ logger: noopLogger });
    memory.__registerMastra(mastra);

    const om = await memory.omEngine;
    expect(om).not.toBeNull();

    const observerAgent = (om!.observer as any).createAgent(MODEL);
    const reflectorAgent = (om!.reflector as any).createAgent(MODEL);

    // Registering the Mastra instance after construction wired the instance
    // but never a logger, so both agents kept the ConsoleLogger every
    // MastraBase starts with and their failures bypassed the configured one.
    expect((observerAgent as any).logger).not.toBeInstanceOf(ConsoleLogger);
    expect((reflectorAgent as any).logger).not.toBeInstanceOf(ConsoleLogger);
  });

  it('still wires the Mastra instance onto both agents', async () => {
    const memory = createMemory();
    const mastra = new Mastra({ logger: noopLogger });
    memory.__registerMastra(mastra);

    const om = await memory.omEngine;

    expect((om!.observer as any).createAgent(MODEL).getMastraInstance()).toBe(mastra);
    expect((om!.reflector as any).createAgent(MODEL).getMastraInstance()).toBe(mastra);
  });

  it('leaves the default ConsoleLogger in place when there is no Mastra instance', async () => {
    const memory = createMemory();

    const om = await memory.omEngine;
    expect(om).not.toBeNull();

    const observerAgent = (om!.observer as any).createAgent(MODEL);
    expect((observerAgent as any).logger).toBeInstanceOf(ConsoleLogger);
    expect(observerAgent.getMastraInstance()).toBeUndefined();
  });
});
