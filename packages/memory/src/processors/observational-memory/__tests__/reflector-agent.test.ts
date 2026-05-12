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

  it('includes configured extractor output sections in the system prompt', () => {
    const prompt = buildReflectorSystemPrompt(undefined, extractors);

    expect(prompt).toContain('<active-topic>');
    expect(prompt).toContain('Output JSON like {"topic":"billing"}.');
  });

  it('still asks for extractor sections when continuation hints are skipped', () => {
    const prompt = buildReflectorPrompt('Date: today\n* fact', undefined, undefined, true, extractors);

    expect(prompt).toContain('Only output <observations> and <active-topic>');
    expect(prompt).not.toContain('Only output <observations>.');
  });

  it('parses typed extracted values and strips extractor sections from observations', () => {
    const output = [
      '<observations>',
      'Date: today',
      '* User discussed billing.',
      '<active-topic>',
      '{"topic":"billing"}',
      '</active-topic>',
      '</observations>',
      '<active-topic>',
      '{"topic":"billing"}',
      '</active-topic>',
    ].join('\n');

    const result = parseReflectorOutput(output, undefined, extractors);

    expect(result.extractedValues).toEqual({ 'active-topic': { topic: 'billing' } });
    expect(result.observations).toContain('* User discussed billing.');
    expect(result.observations).not.toContain('<active-topic>');
  });

  it('skips invalid extracted values without failing reflection parsing', () => {
    const onParseError = vi.fn();
    const output = [
      '<observations>',
      'Date: today',
      '* User discussed billing.',
      '</observations>',
      '<active-topic>',
      '{"topic":123}',
      '</active-topic>',
    ].join('\n');

    const result = parseReflectorOutput(output, undefined, extractors, onParseError);

    expect(result.extractedValues).toBeUndefined();
    expect(result.observations).toContain('* User discussed billing.');
    expect(onParseError).toHaveBeenCalledTimes(1);
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
