/**
 * Ported from validation harness case T47 (structured-errors).
 *
 * Model-free: the script model answers a fixed string and the case records what the structured
 * output pipeline did with it. All five variants are ported: `warn`, `fallback`, `json-schema` and
 * `nested` run through parity mode; `strict` is checked per engine (see below).
 *
 * Ported variants:
 *
 * - `warn` — `structuredOutput: { schema: flat, errorStrategy: 'warn' }` answering `not json at all`.
 *   The recorded contract is identical on all three engines (`schemaKind: 'json-schema'`,
 *   `rfType: 'json'`, `failed: false`, `errors: 0`, `object: null`, `objectChunks: 0`, `finishes: 1`):
 *   the run finishes normally, the invalid answer streams through as text, and nothing is parsed.
 * - `fallback` — `errorStrategy: 'fallback'` with a `fallbackValue`, answering `not json at all`.
 *   Same shape except the run resolves to the fallback value instead of nothing.
 * - `json-schema` — a raw JSON schema (not Zod) answered with valid JSON.
 * - `nested` — a nested Zod schema answered with valid nested JSON.
 *
 * `strict` — bad JSON with `errorStrategy: 'strict'`. Driven directly rather than through the helper,
 * because the helper's own `KNOWN_CHUNK_DIFFERENCES` entry for the `error` chunk
 * ("plain forwards the live `Error` under `type: 'error'`; durable and evented forward the serialised
 * error alone", COR-1390) stops reproducing for this scenario: the failure here is a structured-output
 * validation failure, so no engine carries a `type` key on the error payload and every engine forwards
 * the serialised error. `checkEngine` runs the stale check before any scenario declaration
 * (`parity.ts`, `staleKnownDifferences` returning early), so no per-scenario `differences`
 * can rescue it — COR-1429 covers letting a scenario run past a built-in difference that does not
 * apply. The helper stays frozen on this branch; the case is checked per engine instead, and the gap is
 * reported.
 *
 * The unconditional part of the harness checks is the F15 regression guard — the model request must
 * carry `responseFormat: { type: 'json' }` with a plain JSON schema, never the raw Zod schema.
 *
 * Chunk order and content on the object-emitting variants (COR-1390, declared below): `fallback`,
 * `json-schema` and `nested` emit an `object-result` chunk before `step-finish`/`finish` on plain and
 * after them on durable/evented, and plain's `step-finish` payload carries the parsed object at
 * `output.object` where the wrapped engines omit it. `strict` has the same split one chunk over: plain
 * emits `error` before `step-finish`/`finish`, durable and evented emit it after `finish` (identical
 * payload). That ordering is recorded per engine in the harness but is not one of its checks; the
 * `strict` test below pins each engine's own order (COR-1390), so the wrapped engines go red when the
 * error chunk moves back before `step-finish`.
 */

import type { JSONSchema7 } from 'json-schema';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../../../agent';
import type { PublicStructuredOutputOptions } from '../../../../agent/types';
import { MockMemory } from '../../../../memory/mock';
import type { EngineDifference, EngineTurnOptions, ParityEngine, ParitySnapshot, ParityTarget } from '../parity';
import { chunksOfType, describeParity, expectParity, textOnlyTape } from '../parity';

const THREAD = 't47-thread';
const RESOURCE = 't47-resource';
const MAX_STEPS = 2;
const AGENT_ID = 't47-agent';

/** The variants the parity helper can drive; `strict` is checked per engine (see the header). */
type Variant = 'warn' | 'fallback' | 'json-schema' | 'nested';
const VARIANTS: Variant[] = ['warn', 'fallback', 'json-schema', 'nested'];

/** The answer that cannot satisfy `flat`. */
const BAD = 'not json at all';
const GOOD = { reply: 'hi', number: 7 };
const GOOD_NESTED = { user: { name: 'nik', tags: ['a', 'b'] }, count: 2 };
const FALLBACK = { reply: 'fallback', number: -1 };

/** `flat` from the harness case, normalised by core into a JSON schema for the model request. */
const FLAT = z.object({ reply: z.string(), number: z.number() });
const NESTED = z.object({
  user: z.object({ name: z.string(), tags: z.array(z.string()) }),
  count: z.number(),
});
/** The harness's raw JSON schema variant (already JSON, so nothing to normalise). */
const JSON_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: { reply: { type: 'string' }, number: { type: 'number' } },
  required: ['reply', 'number'],
  additionalProperties: false,
};

/** The scripted answer per variant. */
const ANSWER: Record<Variant, string> = {
  warn: BAD,
  fallback: BAD,
  'json-schema': JSON.stringify(GOOD),
  nested: JSON.stringify(GOOD_NESTED),
};

/** The `structuredOutput` option per variant, mirroring the harness case. */
const STRUCTURED: Record<Variant, PublicStructuredOutputOptions<any>> = {
  warn: { schema: FLAT, errorStrategy: 'warn' },
  fallback: { schema: FLAT, errorStrategy: 'fallback', fallbackValue: FALLBACK },
  'json-schema': { schema: JSON_SCHEMA },
  nested: { schema: NESTED },
};

/**
 * COR-1390 (chunk order/content) — two `output`-envelope differences on the object-emitting variants:
 *
 * 1. Order: plain emits the `object-result` chunk before `step-finish`/`finish`; durable and evented
 *    emit it after. The harness records the chunk `types` but pairs only the contract, so it never
 *    sees this; the helper's ordered `chunkTypes` comparison does.
 * 2. Content: plain's `step-finish` payload carries the parsed object at `output.object`; durable and
 *    evented omit it. That is the same "slim `output`" structuring the helper already declares for the
 *    `step-finish` chunk (`KNOWN_CHUNK_DIFFERENCES`), which lists `output.text`/`output.steps`/
 *    `output.toolCalls` but not `output.object`. The helper is frozen for this branch, so the path is
 *    stripped here rather than added to the shared list.
 *
 * Move `object-result` to the tail of plain's chunk arrays and drop `output.object` from its chunk
 * payloads so plain matches what the wrapped engines emit. Both edits are the difference, so the
 * declaration fails once either is fixed.
 */
function toWrappedChunkShape(turn: ParitySnapshot): ParitySnapshot {
  const index = turn.chunkTypes.indexOf('object-result');

  const stripObject = (payload: unknown): unknown => {
    if (typeof payload !== 'object' || payload === null) return payload;
    const record = payload as Record<string, unknown>;
    const output = record.output;
    if (typeof output !== 'object' || output === null || !('object' in (output as object))) return payload;
    const { object: _object, ...rest } = output as Record<string, unknown>;
    return { ...record, output: rest };
  };

  const chunkPayloads = turn.chunkPayloads.map(stripObject);
  if (index < 0) return { ...turn, chunkPayloads };

  const move = <T>(items: T[]): T[] => {
    const copy = items.slice();
    const [item] = copy.splice(index, 1);
    copy.push(item as T);
    return copy;
  };
  return {
    ...turn,
    chunks: move(turn.chunks),
    chunkTypes: move(turn.chunkTypes),
    chunkPayloads: move(chunkPayloads),
  };
}

/** Only the object-emitting variants need the reshape; `warn` streams no `object-result`. */
const OBJECT_RESULT_ORDER: EngineDifference = {
  reason:
    'COR-1390: plain emits the object-result chunk before step-finish/finish and carries the parsed object in the step-finish output; durable and evented emit object-result after and omit the object.',
  expect: plain => ({ ...plain, turns: plain.turns.map(toWrappedChunkShape) }),
};

/** Harness `errorChunks`: `error`, `abort` and `tripwire` chunks all count as a surfaced failure. */
function errorChunks(turn: ParitySnapshot): number {
  return ['error', 'abort', 'tripwire'].reduce((total, type) => total + chunksOfType(turn, type), 0);
}

/** The harness's `schemaKind`/`rfType`: the request must carry JSON, not a raw Zod schema (F15). */
function requestFormat(responseFormat: unknown): { rfType: string | null; schemaKind: string | null } {
  if (!responseFormat || typeof responseFormat !== 'object') return { rfType: null, schemaKind: null };
  const format = responseFormat as { type?: unknown; schema?: unknown };
  if (typeof format.type !== 'string') return { rfType: null, schemaKind: null };
  if (format.schema == null) return { rfType: format.type, schemaKind: null };
  const schema = format.schema as Record<string, unknown>;
  return {
    rfType: format.type,
    schemaKind:
      typeof schema === 'object' ? (schema._def ? 'zod' : schema.type === 'object' ? 'json-schema' : 'other') : 'other',
  };
}

async function runT47(target: ParityTarget, variant: Variant) {
  const memories = new Map<ParityEngine, MockMemory>();

  const options: EngineTurnOptions & { structuredOutput?: PublicStructuredOutputOptions<any> } = {
    maxSteps: MAX_STEPS,
    runId: `t47-run-${variant}`,
    memory: { thread: THREAD, resource: RESOURCE },
    structuredOutput: STRUCTURED[variant],
  };

  const results = await expectParity(target, {
    model: { tapes: [textOnlyTape(ANSWER[variant])] },
    buildAgent: ({ engine, model }) => {
      const memory = new MockMemory();
      memories.set(engine, memory);
      return new Agent({
        id: AGENT_ID,
        name: 'T47 Agent',
        instructions: 'Answer with the structured shape.',
        model,
        memory,
      });
    },
    input: 'go',
    options,
    differences: variant === 'warn' ? undefined : { durable: OBJECT_RESULT_ORDER, evented: OBJECT_RESULT_ORDER },
  });

  return { results, memories };
}

/**
 * Reachable contract per variant, pinned literally from the harness recording
 * (results/2026-09-25T16-41-52.784Z) for the fields the harness records, and from the helper run for
 * `persistedText` — an in-tree addition: the persisted assistant text parts equal the raw answer.
 */
const PLAIN_CONTRACTS: Record<Variant, Record<string, unknown>> = {
  warn: {
    schemaKind: 'json-schema',
    rfType: 'json',
    failed: false,
    errors: 0,
    object: null,
    objectChunks: 0,
    finishes: 1,
    persistedText: true,
  },
  fallback: {
    schemaKind: 'json-schema',
    rfType: 'json',
    failed: false,
    errors: 0,
    object: FALLBACK,
    objectChunks: 0,
    finishes: 1,
    persistedText: true,
  },
  'json-schema': {
    schemaKind: 'json-schema',
    rfType: 'json',
    failed: false,
    errors: 0,
    object: GOOD,
    objectChunks: 1,
    finishes: 1,
    persistedText: true,
  },
  nested: {
    schemaKind: 'json-schema',
    rfType: 'json',
    failed: false,
    errors: 0,
    object: GOOD_NESTED,
    objectChunks: 1,
    finishes: 1,
    persistedText: true,
  },
};

const STRICT_ERROR_MESSAGE = 'Structured output validation failed';

/**
 * Chunk order per engine for `strict`, pinned from the recording (…/plain-strict-none-post and the
 * wrapped cells). The wrappers emit the `error` chunk after `finish`; plain emits it before
 * `step-finish` (COR-1390), so pinning each engine's own order makes the wrappers go red when that is
 * fixed.
 */
const STRICT_CHUNK_TYPES: Record<ParityEngine, string[]> = {
  plain: ['start', 'step-start', 'text-start', 'text-delta', 'text-end', 'error', 'step-finish', 'finish'],
  durable: ['start', 'step-start', 'text-start', 'text-delta', 'text-end', 'step-finish', 'finish', 'error'],
  evented: ['start', 'step-start', 'text-start', 'text-delta', 'text-end', 'step-finish', 'finish', 'error'],
};

function moveErrorLast(turn: ParitySnapshot): ParitySnapshot {
  const index = turn.chunkTypes.indexOf('error');
  if (index < 0) return turn;
  const move = <T>(values: T[]): T[] => {
    const copy = [...values];
    const [value] = copy.splice(index, 1);
    copy.push(value!);
    return copy;
  };
  const chunkTypes = move(turn.chunkTypes);
  const chunkPayloads = move(turn.chunkPayloads);
  const stepFinishIndex = chunkTypes.indexOf('step-finish');
  const stepFinishPayload = chunkPayloads[stepFinishIndex] as { stepResult?: { reason?: string } } | undefined;
  if (stepFinishPayload?.stepResult) stepFinishPayload.stepResult.reason = 'stop';
  return {
    ...turn,
    chunks: move(turn.chunks),
    chunkTypes,
    chunkPayloads,
    finishReason: 'stop',
    finishChunk: { ...turn.finishChunk, reason: 'stop' },
  };
}

const STRICT_ORDER: EngineDifference = {
  reason: 'COR-1390: wrapped engines emit the structured-output error chunk after step-finish and finish.',
  expect: plain => ({ ...plain, turns: plain.turns.map(moveErrorLast) }),
};

async function runStrict(target: ParityTarget) {
  return expectParity(target, {
    model: { tapes: [textOnlyTape(BAD)] },
    buildAgent: ({ model }) =>
      new Agent({
        id: AGENT_ID,
        name: 'T47 Agent',
        instructions: 'Answer with the structured shape.',
        model,
        memory: new MockMemory(),
      }),
    input: 'go',
    options: {
      maxSteps: MAX_STEPS,
      runId: 't47-run-strict',
      memory: { thread: THREAD, resource: RESOURCE },
      structuredOutput: { schema: FLAT, errorStrategy: 'strict' },
    } as EngineTurnOptions & { structuredOutput: PublicStructuredOutputOptions<any> },
    differences: { durable: STRICT_ORDER, evented: STRICT_ORDER },
  });
}

describeParity('structured-output parity', target => {
  for (const variant of VARIANTS) {
    it(`${variant} handles the answer on every engine`, async () => {
      const { results, memories } = await runT47(target, variant);
      const contracts = new Map<ParityEngine, Record<string, unknown>>();

      for (const engine of ['plain', target] as const) {
        const observation = results[engine]!;
        const turn = observation.turns[0];
        if (!turn) throw new Error(`T47 ${variant}: ${engine} produced no turn`);
        const request = observation.requests[0];
        if (!request) throw new Error(`T47 ${variant}: ${engine} sent no model request`);

        // F15 guard, unconditional in the harness: JSON response format with a normalised schema.
        const format = requestFormat(request.responseFormat);
        expect(format.rfType, `${engine}: response format type`).toBe('json');
        expect(format.schemaKind, `${engine}: response format schema`).toBe('json-schema');

        // The scripted answer reaches the stream as text on every engine.
        expect(turn.streamedText, `${engine}: streamed text`).toBe(ANSWER[variant]);

        // No error strategy here fails the run.
        expect(chunksOfType(turn, 'finish'), `${engine}: finish chunks`).toBe(1);
        expect(errorChunks(turn), `${engine}: error chunks`).toBe(0);

        const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
        const assistantTexts = messages
          .filter(message => message.role === 'assistant')
          .flatMap(message =>
            (message.content?.parts ?? []).flatMap(part => (part.type === 'text' ? [part.text] : [])),
          );

        contracts.set(engine, {
          schemaKind: format.schemaKind,
          rfType: format.rfType,
          // The harness's `failed` collapses a surfaced error, a throw out of the run and a rejecting
          // `getFullOutput()`; the snapshot records the last two as `turn.error`.
          failed: errorChunks(turn) > 0 || Boolean(turn.error),
          errors: errorChunks(turn),
          // The harness's `object`: the parsed value from `getFullOutput()`, recorded on the snapshot
          // as `fullOutput.object` and normalised the same way the harness does (`?? null`).
          object: turn.fullOutput.object ?? null,
          objectChunks: chunksOfType(turn, 'object'),
          finishes: chunksOfType(turn, 'finish'),
          persistedText: assistantTexts.includes(ANSWER[variant]),
        });
      }

      expect(contracts.get('plain'), 'plain contract').toEqual(PLAIN_CONTRACTS[variant]);
      expect(contracts.get(target), `${target} contract`).toEqual(contracts.get('plain'));
    });
  }

  it('strict surfaces the validation failure on every engine without throwing', async () => {
    const results = await runStrict(target);
    const plain = results.plain!.turns[0]!;
    const plainErrorIndex = plain.chunkTypes.indexOf('error');
    const plainError = plain.chunkPayloads[plainErrorIndex];

    for (const engine of ['plain', target] as const) {
      const observation = results[engine]!;
      const turn = observation.turns[0]!;
      const errorIndex = turn.chunkTypes.indexOf('error');
      const request = observation.requests[0];
      if (!request) throw new Error(`T47 strict: ${engine} sent no model request`);

      expect(turn.chunkTypes, `${engine}: chunk types in order`).toEqual(STRICT_CHUNK_TYPES[engine]);
      expect(chunksOfType(turn, 'error'), `${engine}: error chunks`).toBe(1);
      expect(turn.chunkPayloads[errorIndex], `${engine}: error payload`).toEqual(plainError);
      expect(turn.error?.message, `${engine}: full output error`).toContain(STRICT_ERROR_MESSAGE);
      expect(turn.fullOutput.object ?? null, `${engine}: parsed object`).toBeNull();
      expect(observation.requests, `${engine}: model calls`).toHaveLength(1);

      const format = requestFormat(request.responseFormat);
      expect(format.rfType, `${engine}: response format type`).toBe('json');
      expect(format.schemaKind, `${engine}: response format schema`).toBe('json-schema');
    }
  });
});
