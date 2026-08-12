import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { SUBCONSCIOUS_PINS_STATE_ID } from '../subconscious';

const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function createMemory(subconscious: Subconscious) {
  return new Memory({
    storage: new InMemoryStore(),
    ...semanticInfrastructure,
    options: { observationalMemory: { model: 'openai/gpt-5', subconscious } },
  });
}

describe('PinnedStateProcessor registration', () => {
  it('is included by getInputProcessors when the pins gate is on', async () => {
    const memory = createMemory(new Subconscious({ pins: true }));
    const processors = await memory.getInputProcessors();
    expect(processors.some(p => p.id === SUBCONSCIOUS_PINS_STATE_ID)).toBe(true);
  });

  it('is excluded when pins are off', async () => {
    const memory = createMemory(new Subconscious());
    const processors = await memory.getInputProcessors();
    expect(processors.some(p => p.id === SUBCONSCIOUS_PINS_STATE_ID)).toBe(false);
  });

  it('is not double-added when the user already configured one with the same id', async () => {
    const memory = createMemory(new Subconscious({ pins: true }));
    const userProcessor = { id: SUBCONSCIOUS_PINS_STATE_ID, processInput: (args: any) => args } as any;
    const processors = await memory.getInputProcessors([userProcessor]);
    expect(processors.filter(p => p.id === SUBCONSCIOUS_PINS_STATE_ID)).toHaveLength(0);
  });
});
