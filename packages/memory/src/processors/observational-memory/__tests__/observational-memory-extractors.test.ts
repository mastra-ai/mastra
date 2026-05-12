import { coreFeatures } from '@mastra/core/features';
import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';

import { Extractor } from '../extractor';
import { ObservationalMemory } from '../observational-memory';

describe('ObservationalMemory extractor configuration', () => {
  beforeEach(() => {
    coreFeatures.add('request-response-id-rotation');
  });

  it('constructs observer and reflector extractors from their own config fields', () => {
    const observerExtractor = new Extractor({
      name: 'follows-policy',
      instructions: 'Return ok or violation.',
      schema: z.string(),
    });
    const reflectorExtractor = new Extractor({
      name: 'active-topic',
      instructions: 'Return JSON like {"topic":"billing"}.',
      schema: z.object({ topic: z.string() }),
    });

    const om = new ObservationalMemory({
      storage: {} as any,
      model: 'test-model',
      observation: {
        threadTitle: true,
        extract: [observerExtractor],
        bufferTokens: false,
      },
      reflection: {
        extract: [reflectorExtractor],
      },
    });

    expect(om.getObserverExtractors().map(extractor => extractor.slug)).toEqual([
      'current-task',
      'suggested-response',
      'thread-title',
      'follows-policy',
    ]);
    expect(om.getObserverAdditionalExtractors().map(extractor => extractor.slug)).toEqual(['follows-policy']);
    expect(om.getReflectorExtractors().map(extractor => extractor.slug)).toEqual(['active-topic']);
  });

  it('returns defensive copies from extractor getters', () => {
    const observerExtractor = new Extractor({ name: 'follows-policy', instructions: 'Return ok or violation.' });
    const reflectorExtractor = new Extractor({ name: 'active-topic', instructions: 'Return the active topic.' });
    const om = new ObservationalMemory({
      storage: {} as any,
      model: 'test-model',
      observation: {
        extract: [observerExtractor],
        bufferTokens: false,
      },
      reflection: {
        extract: [reflectorExtractor],
      },
    });

    const observerExtractors = om.getObserverExtractors() as Extractor<any>[];
    const observerAdditionalExtractors = om.getObserverAdditionalExtractors() as Extractor<any>[];
    const reflectorExtractors = om.getReflectorExtractors() as Extractor<any>[];

    observerExtractors.pop();
    observerAdditionalExtractors.pop();
    reflectorExtractors.pop();

    expect(om.getObserverExtractors().map(extractor => extractor.slug)).toEqual([
      'current-task',
      'suggested-response',
      'follows-policy',
    ]);
    expect(om.getObserverAdditionalExtractors().map(extractor => extractor.slug)).toEqual(['follows-policy']);
    expect(om.getReflectorExtractors().map(extractor => extractor.slug)).toEqual(['active-topic']);
  });

  it('does not expose reflection.extract through observer prompt extractors', () => {
    const observerExtractor = new Extractor({ name: 'observer-only', instructions: 'Return observer value.' });
    const reflectorExtractor = new Extractor({ name: 'reflector-only', instructions: 'Return reflector value.' });
    const om = new ObservationalMemory({
      storage: {} as any,
      model: 'test-model',
      observation: {
        extract: [observerExtractor],
        bufferTokens: false,
      },
      reflection: {
        extract: [reflectorExtractor],
      },
    });

    expect(om.getObserverExtractors().map(extractor => extractor.slug)).toContain('observer-only');
    expect(om.getObserverExtractors().map(extractor => extractor.slug)).not.toContain('reflector-only');
    expect(om.getReflectorExtractors().map(extractor => extractor.slug)).toEqual(['reflector-only']);
  });
});
