import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import {
  buildGlobalOmPartsByCycleId,
  convertOmPartsInMastraMessage,
  injectBufferingEnds,
  markOmMarkersAsDisconnected,
  scanOmInitialState,
} from '../om-parts-converter';

/**
 * Build a `data-om-*` part. `data-${string}` parts are first-class
 * `MastraMessagePart` union members, so no cast is needed.
 */
const omPart = (name: string, data: Record<string, unknown>): MastraMessagePart => ({
  type: `data-${name}`,
  data,
});

const assistantMessage = (parts: MastraMessagePart[], id = 'msg-1'): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date('2026-05-29T00:00:00.000Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts, metadata: {} },
});

const partsOf = (message: MastraDBMessage) => message.content.parts as Array<{ type: string; data?: any }>;

const convertedOmData = (message: MastraDBMessage) => {
  const part = message.content.parts[0] as any;
  return part.output?.omData;
};

describe('OM part conversion', () => {
  it('retains terminal extraction fields across a post-stream reset with a poorer snapshot', () => {
    const cache = new Map();
    const streamedMessages = [
      assistantMessage([
        omPart('om-buffering-start', { cycleId: 'cycle-reset', operationType: 'observation' }),
        omPart('om-buffering-end', {
          cycleId: 'cycle-reset',
          operationType: 'observation',
          tokensBuffered: 20,
          observations: ['observed'],
          extractedValues: { priority: 'high' },
          extractionFailures: [{ slug: 'status', error: 'missing value' }],
        }),
      ]),
    ];

    const streamedGlobalParts = buildGlobalOmPartsByCycleId(streamedMessages, cache);
    const streamedMessage = convertOmPartsInMastraMessage(streamedMessages[0], streamedGlobalParts);
    expect(convertedOmData(streamedMessage)?.extractedValues).toEqual({ priority: 'high' });

    const resetMessages = [
      assistantMessage([
        omPart('om-buffering-start', { cycleId: 'cycle-reset', operationType: 'observation' }),
        omPart('om-buffering-end', {
          cycleId: 'cycle-reset',
          operationType: 'observation',
          tokensBuffered: 20,
          observations: ['observed'],
        }),
      ]),
    ];

    const resetGlobalParts = buildGlobalOmPartsByCycleId(resetMessages, cache);
    const resetMessage = convertOmPartsInMastraMessage(resetMessages[0], resetGlobalParts);
    expect(convertedOmData(resetMessage)?.extractedValues).toEqual({ priority: 'high' });
    expect(convertedOmData(resetMessage)?.extractionFailures).toEqual([{ slug: 'status', error: 'missing value' }]);
  });
});

describe('markOmMarkersAsDisconnected', () => {
  it('marks an in-progress observation-start marker as disconnected (reads content.parts)', () => {
    const [message] = markOmMarkersAsDisconnected([
      assistantMessage([omPart('om-observation-start', { cycleId: 'cycle-1' })]),
    ]);

    const part = partsOf(message)[0];
    expect(part.type).toBe('data-om-observation-start');
    expect(part.data?._state).toBe('disconnected');
    expect(typeof part.data?.disconnectedAt).toBe('string');
  });

  it('leaves user messages untouched', () => {
    const userMessage: MastraDBMessage = {
      ...assistantMessage([omPart('om-observation-start', { cycleId: 'cycle-1' })], 'user-1'),
      role: 'user',
    };
    const [message] = markOmMarkersAsDisconnected([userMessage]);
    expect(partsOf(message)[0].data?._state).toBeUndefined();
  });

  it('does not mark completed observation cycles as disconnected', () => {
    const [message] = markOmMarkersAsDisconnected([
      assistantMessage([
        omPart('om-observation-start', { cycleId: 'cycle-done' }),
        omPart('om-observation-end', { cycleId: 'cycle-done', completedAt: '2026-05-29T00:00:01.000Z' }),
      ]),
    ]);

    expect(partsOf(message)[0].data?.disconnectedAt).toBeUndefined();
    expect(partsOf(message)[0].data?._state).toBeUndefined();
  });

  it('does not mark buffering cycles with a later activation as disconnected', () => {
    const [startMessage] = markOmMarkersAsDisconnected([
      assistantMessage([omPart('om-buffering-start', { cycleId: 'cycle-activated' })], 'msg-start'),
      assistantMessage([omPart('om-activation', { cycleId: 'cycle-activated' })], 'msg-activation'),
    ]);

    expect(partsOf(startMessage)[0].data?.disconnectedAt).toBeUndefined();
    expect(partsOf(startMessage)[0].data?._state).toBeUndefined();
  });
});

describe('injectBufferingEnds', () => {
  it('injects a synthetic buffering-end for an in-progress buffering-start (reads content.parts)', () => {
    const [message] = injectBufferingEnds(
      [assistantMessage([omPart('om-buffering-start', { cycleId: 'cycle-2', operationType: 'observation' })])],
      {
        bufferedObservationChunks: [
          {
            cycleId: 'cycle-2',
            messageTokens: 120,
            tokenCount: 40,
            observations: ['x'],
            extractedValues: { priority: 'high' },
            extractionFailures: [{ slug: 'status', error: 'missing value' }],
          },
        ],
      },
    );

    const parts = partsOf(message);
    expect(parts).toHaveLength(2);
    expect(parts[1].type).toBe('data-om-buffering-end');
    expect(parts[1].data?.cycleId).toBe('cycle-2');
    expect(parts[1].data?.tokensBuffered).toBe(120);
    expect(parts[1].data?.observations).toEqual(['x']);
    expect(parts[1].data?.extractedValues).toEqual({ priority: 'high' });
    expect(parts[1].data?.extractionFailures).toEqual([{ slug: 'status', error: 'missing value' }]);
  });

  it('does not inject an end for an already-disconnected buffering-start', () => {
    const [message] = injectBufferingEnds([
      assistantMessage([omPart('om-buffering-start', { cycleId: 'cycle-3', disconnectedAt: 'yes' })]),
    ]);
    expect(partsOf(message)).toHaveLength(1);
  });

  it('does not duplicate synthetic buffering-end parts when called repeatedly', () => {
    const messages = [
      assistantMessage([omPart('om-buffering-start', { cycleId: 'cycle-repeat', operationType: 'observation' })]),
    ];

    const once = injectBufferingEnds(messages);
    const twice = injectBufferingEnds(once);

    expect(partsOf(twice[0]).filter(part => part.type === 'data-om-buffering-end')).toHaveLength(1);
  });

  it('does not inject an end when the cycle already has a terminal marker later', () => {
    const [message] = injectBufferingEnds([
      assistantMessage([
        omPart('om-buffering-start', { cycleId: 'cycle-complete', operationType: 'observation' }),
        omPart('om-buffering-end', { cycleId: 'cycle-complete', completedAt: '2026-05-29T00:00:01.000Z' }),
      ]),
    ]);

    expect(partsOf(message).filter(part => part.type === 'data-om-buffering-end')).toHaveLength(1);
  });
});

describe('scanOmInitialState', () => {
  it('collects activation cycle ids and the last progress part from content.parts', () => {
    const { activatedCycleIds, lastProgress } = scanOmInitialState([
      assistantMessage([
        omPart('om-activation', { cycleId: 'cycle-a' }),
        omPart('om-status', { tokensObserved: 100 }),
        omPart('om-status', { tokensObserved: 250 }),
      ]),
    ]);

    expect(activatedCycleIds).toEqual(['cycle-a']);
    expect(lastProgress).toEqual({ tokensObserved: 250 });
  });
});
