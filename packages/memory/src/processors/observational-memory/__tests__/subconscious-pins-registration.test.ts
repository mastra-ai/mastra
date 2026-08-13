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

  it('attaches exactly one pinned processor, skipping auto-attach only on a matching user-supplied id', async () => {
    // Different user id: the gate must still attach its own pinned processor.
    const withOther = createMemory(new Subconscious({ pins: true }));
    const otherProcessor = { id: 'user-custom-processor', processInput: (args: any) => args } as any;
    const attached = await withOther.getInputProcessors([otherProcessor]);
    expect(attached.filter(p => p.id === SUBCONSCIOUS_PINS_STATE_ID)).toHaveLength(1);

    // Same id: the gate must skip its own so the user's wins.
    const withSame = createMemory(new Subconscious({ pins: true }));
    const sameId = { id: SUBCONSCIOUS_PINS_STATE_ID, processInput: (args: any) => args } as any;
    const skipped = await withSame.getInputProcessors([sameId]);
    expect(skipped.filter(p => p.id === SUBCONSCIOUS_PINS_STATE_ID)).toHaveLength(0);
  });
});
