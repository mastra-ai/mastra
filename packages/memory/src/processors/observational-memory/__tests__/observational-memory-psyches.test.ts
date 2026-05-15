import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Extractor } from '../extractor';
import { ObservationalMemory } from '../observational-memory';
import { Subconscious } from '../subconscious';

function createInMemoryStorage(): InMemoryMemory {
  return new InMemoryMemory({ db: new InMemoryDB() });
}

function createModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text: 'ok' }],
      warnings: [],
    }),
  });
}

describe('ObservationalMemory psyches', () => {
  it('appends observation psyche extractors while preserving existing extractors', () => {
    const custom = new Extractor({
      name: 'custom-topic',
      instructions: 'Extract the topic.',
      schema: z.object({ topic: z.string() }),
    });
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      model: createModel(),
      subconscious: new Subconscious({ model: createModel() }),
      observation: { extract: [custom], psyches: ['critic', 'learner'] },
    });

    expect(om.getObserverExtractors().map(extractor => extractor.slug)).toEqual(
      expect.arrayContaining(['current-task', 'suggested-response', 'custom-topic', 'subconscious']),
    );
  });

  it('reflection psyches appear only in reflector extractors', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      model: createModel(),
      subconscious: new Subconscious({ model: createModel() }),
      reflection: { psyches: ['dreamer', 'modeler'] },
    });

    expect(om.getReflectorExtractors().map(extractor => extractor.slug)).toEqual(['subconscious']);
    expect(om.getObserverExtractors().map(extractor => extractor.slug)).not.toContain('subconscious');
  });

  it('observation psyches appear alongside built-ins', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      model: createModel(),
      subconscious: new Subconscious({ model: createModel() }),
      observation: { psyches: ['critic'] },
    });

    expect(om.getObserverExtractors().map(extractor => extractor.slug)).toEqual(
      expect.arrayContaining(['current-task', 'suggested-response', 'subconscious']),
    );
  });
});
