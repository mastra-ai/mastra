import { coreFeatures } from '@mastra/core/features';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

import { Extractor } from '../extractor';
import { ObservationStrategy } from '../observation-strategies/base';
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

  it('passes Memory observationalMemory extractors into the OM engine', async () => {
    const observerExtractor = new Extractor({ name: 'observer-only', instructions: 'Return observer value.' });
    const reflectorExtractor = new Extractor({ name: 'reflector-only', instructions: 'Return reflector value.' });
    const memory = new Memory({
      storage: {
        init: async () => {},
        getStore: async () => ({ supportsObservationalMemory: true }),
      } as any,
      options: {
        observationalMemory: {
          observation: {
            extract: [observerExtractor],
            bufferTokens: false,
          },
          reflection: {
            extract: [reflectorExtractor],
          },
        },
      },
    });

    const engine = await memory.omEngine;

    expect(engine?.getObserverAdditionalExtractors().map(extractor => extractor.slug)).toEqual(['observer-only']);
    expect(engine?.getReflectorExtractors().map(extractor => extractor.slug)).toEqual(['reflector-only']);
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

  it('normalizes observer extracted values before persistence', async () => {
    class TestStrategy extends ObservationStrategy {
      get needsLock() {
        return false;
      }
      get needsReflection() {
        return false;
      }
      get rethrowOnFailure() {
        return false;
      }
      prepare = vi.fn();
      observe = vi.fn();
      process = vi.fn();
      persist = vi.fn();
      emitStartMarkers = vi.fn();
      emitEndMarkers = vi.fn();
      emitFailedMarkers = vi.fn();
      apply(processed: any) {
        return this.applyExtractorHooks(processed);
      }
    }

    const onExtracted = vi.fn(({ extracted }) => ({ ...extracted.previous, ...extracted.current, visits: 2 }));
    const extractor = new Extractor({
      name: 'active-topic',
      instructions: 'Return JSON like {"topic":"billing"}.',
      schema: z.object({ topic: z.string(), visits: z.number() }),
      onExtracted,
    });
    const strategy = new TestStrategy(
      {
        storage: {
          getThreadById: vi.fn().mockResolvedValue({
            metadata: { mastra: { om: { extracted: { 'active-topic': { topic: 'prior', visits: 1 } } } } },
          }),
        },
        messageHistory: {},
        tokenCounter: {},
        observationConfig: {},
        reflectionConfig: {},
        scope: 'thread',
        retrieval: false,
        observer: {},
        reflector: {},
        observedMessageIds: new Set(),
        obscureThreadIds: false,
        extractors: [extractor],
        additionalExtractors: [extractor],
        emitDebugEvent: vi.fn(),
      } as any,
      {
        record: { id: 'record-1', threadId: 'thread-1', resourceId: 'resource-1' },
        threadId: 'thread-1',
        resourceId: 'resource-1',
        messages: [
          {
            id: 'message-1',
            threadId: 'thread-1',
            resourceId: 'resource-1',
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'billing question' }] },
          },
        ],
        agent: { id: 'agent-1', name: 'Agent' },
        requestContext: new RequestContext(),
      } as any,
    );
    const processed = {
      observations: 'Date: today\n* User asked about billing.',
      observedMessages: [
        {
          id: 'message-1',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'billing question' }] },
        },
      ],
      activeObservations: 'Date: yesterday\n* Prior billing context.',
      newObservations: 'Date: today\n* User asked about billing.',
      extractedValues: { 'active-topic': { topic: 'billing', visits: 1 } },
    } as any;

    await strategy.apply(processed);

    expect(processed.extractedValues).toEqual({ 'active-topic': { topic: 'billing', visits: 2 } });
    expect(onExtracted).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'observer',
        observations: expect.objectContaining({
          observedMessages: processed.observedMessages,
          activeObservations: 'Date: yesterday\n* Prior billing context.',
          newObservations: 'Date: today\n* User asked about billing.',
        }),
      }),
    );
    expect(onExtracted.mock.calls[0]![0]!.observations.observedMessages[0]).toMatchObject({
      id: 'message-1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: { format: 2 },
    });
  });
});
