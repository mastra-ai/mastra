import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { BufferingCoordinator } from '../buffering-coordinator';
import { Extractor } from '../extractor';
import { buildReflectorPrompt, buildReflectorSystemPrompt, parseReflectorOutput } from '../reflector-agent';
import { ReflectorRunner } from '../reflector-runner';

describe('reflector extractor support', () => {
  const extractors = [
    new Extractor({
      name: 'active-topic',
      instructions: 'Output JSON like {"topic":"billing"}.',
      schema: z.object({ topic: z.string() }),
    }),
  ];

  it('does not include extractor output sections in the reflector system prompt', () => {
    const prompt = buildReflectorSystemPrompt(undefined, extractors);

    expect(prompt).not.toContain('<active-topic>');
    expect(prompt).not.toContain('Output JSON like {"topic":"billing"}.');
  });

  it('does not ask for extractor sections when continuation hints are skipped', () => {
    const prompt = buildReflectorPrompt('Date: today\n* fact', undefined, undefined, true, extractors);

    expect(prompt).toContain('Only output <observations>.');
    expect(prompt).not.toContain('<active-topic>');
  });

  it('ignores extractor sections when parsing reflection output', () => {
    const output = [
      '<observations>',
      'Date: today',
      '* User discussed billing.',
      '</observations>',
      '<active-topic>',
      '{"topic":"billing"}',
      '</active-topic>',
    ].join('\n');

    const result = parseReflectorOutput(output, undefined, extractors, vi.fn());

    expect(result.extractedValues).toBeUndefined();
    expect(result.observations).toContain('* User discussed billing.');
  });

  it('persists normalized reflected extracted values to thread metadata and invokes hooks', async () => {
    const onExtracted = vi.fn(({ extracted }) => ({
      ...extracted.previous,
      ...extracted.current,
      normalized: true,
    }));
    const extractor = new Extractor({
      name: 'active-topic',
      instructions: 'Output JSON like {"topic":"billing"}.',
      schema: z.object({ topic: z.string(), normalized: z.boolean().optional(), source: z.string().optional() }),
      onExtracted,
    });
    const updateThread = vi.fn().mockResolvedValue(undefined);
    const storage = {
      getThreadById: vi.fn().mockResolvedValue({
        id: 'thread-1',
        title: 'Existing title',
        metadata: {
          mastra: { om: { extracted: { retained: 'prior', 'active-topic': { topic: 'prior', source: 'previous' } } } },
        },
      }),
      updateThread,
    };

    const runner = new ReflectorRunner({
      reflectionConfig: { observationTokens: 100, model: 'test-model' },
      observationConfig: { messageTokens: 100, model: 'test-model' },
      tokenCounter: { countObservations: vi.fn() },
      storage: storage as any,
      scope: 'thread',
      buffering: new BufferingCoordinator({
        observationConfig: {} as any,
        reflectionConfig: {} as any,
        scope: 'thread',
      }),
      emitDebugEvent: vi.fn(),
      persistMarkerToStorage: vi.fn(),
      persistMarkerToMessage: vi.fn(),
      getCompressionStartLevel: vi.fn().mockResolvedValue('none'),
      resolveModel: vi.fn(),
      extractors: [extractor],
    } as any);

    await (runner as any).persistExtractedValues(
      'thread-1',
      'resource-1',
      {
        'active-topic': { topic: 'billing' },
      },
      {
        activeObservations: 'Date: yesterday\n* User had a prior billing issue.',
        newObservations: 'Date: today\n* User billing context was condensed.',
      },
    );

    expect(updateThread).toHaveBeenCalledWith({
      id: 'thread-1',
      title: 'Existing title',
      metadata: {
        mastra: {
          om: {
            extracted: {
              retained: 'prior',
              'active-topic': { topic: 'billing', source: 'previous', normalized: true },
            },
          },
        },
      },
    });
    expect(onExtracted).toHaveBeenCalledWith(
      expect.objectContaining({
        extracted: {
          previous: { topic: 'prior', source: 'previous' },
          current: { topic: 'billing' },
        },
        threadId: 'thread-1',
        resourceId: 'resource-1',
        source: 'reflector',
        observations: {
          activeObservations: 'Date: yesterday\n* User had a prior billing issue.',
          newObservations: 'Date: today\n* User billing context was condensed.',
        },
      }),
    );
    expect(onExtracted.mock.calls[0]![0]!.observations).not.toHaveProperty('observedMessages');
  });
});
