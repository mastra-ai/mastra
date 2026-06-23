import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { encode } from '../../../events/codec';
import { createRunScope } from '../../../mastra/run-scope';
import { MessageList } from '../../message-list';
import {
  CONVERTED_TOOLS_KEY,
  INITIAL_SIGNAL_ECHOES_KEY,
  LOOP_OPTIONS_KEY,
  MESSAGE_LIST_KEY,
  PROCESSOR_STATES_KEY,
} from './run-scope-keys';
import { prepareMemoryStepOutputSchema, prepareToolsStepOutputSchema } from './schema';

/**
 * Serialization invariants for the prepare-stream workflow.
 *
 * The evented engine routes step outputs through `JSON.stringify` (storage
 * snapshots, `UnixSocketPubSub` frames). Anything described by a step's
 * `outputSchema` MUST be JSON-safe — class instances, `Map`s, closures, and
 * non-cloneable state must live on the per-run {@link RunScope} instead.
 *
 * These tests guard the boundary in both directions:
 *  1. The advertised output schemas only describe JSON-safe shapes.
 *  2. The runScope keys do carry non-serializable values, and those values are
 *     never visible to the codec at the wire boundary.
 */
describe('prepare-stream serialization invariants', () => {
  describe('step outputSchemas only describe JSON-safe shapes', () => {
    it('prepare-tools-step output schema is the empty object marker', () => {
      // The step parks tool records on runScope; its public output carries no
      // payload. Adding any field here would re-introduce a serialization risk.
      expect(prepareToolsStepOutputSchema).toBeInstanceOf(z.ZodObject);
      const shape = (prepareToolsStepOutputSchema as z.ZodObject<any>).shape;
      expect(Object.keys(shape)).toEqual([]);
    });

    it('prepare-memory-step output schema is JSON-safe and round-trips through JSON', () => {
      const sample = prepareMemoryStepOutputSchema.parse({
        threadExists: true,
        thread: {
          id: 't1',
          resourceId: 'r1',
          createdAt: new Date(0),
          updatedAt: new Date(1_000),
        },
        tripwire: {
          reason: 'limit',
          retry: false,
          metadata: { count: 1 },
          processorId: 'token-limit',
        },
      });

      // The schema uses `z.date()`, which is intentionally non-JSON-safe at the
      // Zod level — Dates serialize to ISO strings in storage and rehydrate via
      // the codec. The remaining fields must be plain JSON values so the codec
      // never has to tag a class instance or function here.
      const { thread: _thread, ...rest } = sample;
      expect(JSON.parse(JSON.stringify(rest))).toEqual(rest);

      // Tripwire metadata is `z.unknown()` — verify the test fixture stays
      // JSON-safe so a future schema tightening does not silently regress.
      expect(JSON.parse(JSON.stringify(sample.tripwire))).toEqual(sample.tripwire);
    });
  });

  describe('runScope carries the values that must stay off the wire', () => {
    it('MessageList lives only on runScope, never on a step output schema', () => {
      const scope = createRunScope();
      const messageList = new MessageList();
      scope.set(MESSAGE_LIST_KEY, messageList);

      // The scoped value is the live class instance with its methods intact.
      const stored = scope.getOrThrow(MESSAGE_LIST_KEY);
      expect(stored).toBe(messageList);
      expect(typeof stored.add).toBe('function');

      // The output schemas never even mention messageList — there is no slot
      // for it on the wire.
      const memoryShape = (prepareMemoryStepOutputSchema as z.ZodObject<any>).shape;
      const toolsShape = (prepareToolsStepOutputSchema as z.ZodObject<any>).shape;
      expect(memoryShape).not.toHaveProperty('messageList');
      expect(toolsShape).not.toHaveProperty('messageList');
    });

    it('processorStates Map is preserved as a Map on runScope (would be lost via JSON)', () => {
      const scope = createRunScope();
      const states = new Map([['p1', { count: 7 } as any]]);
      scope.set(PROCESSOR_STATES_KEY, states);

      const stored = scope.getOrThrow(PROCESSOR_STATES_KEY);
      expect(stored).toBe(states);
      expect(stored).toBeInstanceOf(Map);
      expect(stored.get('p1')).toEqual({ count: 7 });
    });

    it('convertedTools record (carries `execute` closures) round-trips by reference', () => {
      const scope = createRunScope();
      const tool = { execute: () => 'ok' };
      const tools = { search: tool };
      scope.set(CONVERTED_TOOLS_KEY, tools);

      const stored = scope.get(CONVERTED_TOOLS_KEY)!;
      // Same reference — no clone, no serialization stripped the closure.
      expect(stored.search).toBe(tool);
      expect(stored.search.execute()).toBe('ok');
    });

    it('loopOptions and initialSignalEchoes are typed slots on runScope', () => {
      const scope = createRunScope();
      const signals = [{ id: 'sig-1' } as any];
      scope.set(INITIAL_SIGNAL_ECHOES_KEY, signals);
      scope.set(LOOP_OPTIONS_KEY, { fake: 'loop-options' } as any);

      expect(scope.get(INITIAL_SIGNAL_ECHOES_KEY)).toBe(signals);
      expect(scope.get(LOOP_OPTIONS_KEY)).toEqual({ fake: 'loop-options' });
    });
  });

  describe('codec at the wire boundary does not see runScope values', () => {
    it('encoding a step output never tags a class instance or function', () => {
      const stepOutput = {
        threadExists: false,
        thread: {
          id: 't1',
          resourceId: 'r1',
          createdAt: new Date(0),
          updatedAt: new Date(1_000),
        },
      };

      // Sanity-check the encoded form. Dates are tagged by the codec (expected),
      // but no `Class` envelope should appear — that would mean a non-safe
      // value escaped onto the wire.
      const encoded = JSON.stringify(encode(stepOutput));
      expect(encoded).not.toContain('"__m_codec__":"Class"');
      expect(encoded).not.toContain('"__m_codec__":"Function"');
    });
  });
});
