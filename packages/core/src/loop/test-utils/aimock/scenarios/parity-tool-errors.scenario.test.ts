/**
 * Ported from validation harness case T32 (tool-errors).
 *
 * What the model and the public stream see when a tool misbehaves. Each
 * variant makes one tool call and the script then answers with the count of
 * tool results it received, so the contract shows whether the loop continued
 * and what the model was told:
 *
 *   non-json   execute returns a circular object
 *   bad-args   the model sends args that fail inputSchema
 *   undefined  execute returns undefined
 *   throws     execute throws
 *   unknown    the model calls a tool that does not exist
 *
 * `undefined` used to stop the loop as if the call were waiting on a client
 * result (#27370); an executed tool's `undefined` is now recorded as `null`,
 * so it continues like the other green variants on every engine.
 *
 * `throws` diverges from plain on the wrapped engines, so it declares its
 * difference against COR-1390 (durable and evented re-serialise the failed
 * tool call). On durable and evented the `tool-error` chunk
 * carries the raw serialised error
 * (`{ toolCallId, toolName, args, error: { name, message, stack } }`) where
 * plain carries the MastraError envelope
 * (`{ name, message, cause, domain, category, details }`).
 *
 * `unknown` used to diverge the same way and no longer does: the helper now
 * compares a live `Error` as its enumerable fields plus `{ name, message }`
 * (COR-1417), which is what a failed tool lookup serialises to on the wrapped
 * engines, so it is asserted as an undeclared plain-vs-wrapped match. `throws`
 * still differs — the wrapped `error` keeps its serialised `stack`, and the
 * helper only drops a `stack` from `error` chunks (COR-1429 strips it from
 * `tool-error` too, which is what retires this declaration) — so the payload
 * cannot be pinned and the declaration keeps a field-level `ignore`; the two
 * shapes are asserted directly below.
 *
 * The harness's engine comparison (chunk sequence, finish payload, usage,
 * getFullOutput and the requests the model saw) is covered by
 * `expectParity` (parity mode); the contract the harness read off that comparison is
 * asserted on every engine, with plain's values pinned literally and the
 * wrapped engines' own values pinned per variant.
 */
import { expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import type {
  CapturedRequest,
  EngineDifference,
  EngineParityResults,
  ParityEngine,
  ParitySnapshot,
  ParityTarget,
} from '../parity';
import { chunksOfType, describeParity, expectParity, textOnlyTape, toolCallTape } from '../parity';

const THREAD = 'thread-t32';
const RESOURCE = 'resource-t32';
const TURN_OPTIONS = { maxSteps: 3, memory: { thread: THREAD, resource: RESOURCE } };
const TOOL_CALL_ID = 'parity-call-1';

const VARIANTS = ['non-json', 'bad-args', 'undefined', 'throws', 'unknown'] as const;
type Variant = (typeof VARIANTS)[number];

/** Variants whose difference from plain is declared against COR-1390. */
const HELD_VARIANTS = ['throws'] as const;
type HeldVariant = (typeof HELD_VARIANTS)[number];

const CALLS: Record<Variant, { name: string; args: Record<string, unknown> }> = {
  'non-json': { name: 'misbehave', args: { n: 1 } },
  'bad-args': { name: 'misbehave', args: { n: 'not-a-number' } },
  undefined: { name: 'misbehave', args: { n: 1 } },
  throws: { name: 'misbehave', args: { n: 1 } },
  unknown: { name: 'nonexistent', args: { n: 1 } },
};

/** The harness's contract fields for one engine. */
interface Contract {
  modelCalls: number;
  notableTypes: string[];
  toModel: Array<{ tool: string | undefined; kind: string | undefined }>;
  finishReason: string | null;
  errors: number;
  text: string;
}

/** The harness's contract, identical on all three engines for the green variants. */
const EXPECTED_CONTRACT: Contract = {
  modelCalls: 2,
  notableTypes: ['tool-call', 'tool-result', 'finish'],
  toModel: [{ tool: 'misbehave', kind: 'json' }],
  finishReason: 'stop',
  errors: 0,
  text: 'results: 1',
};

/** `throws`/`unknown` continue the loop and hand the model the failure as text. */
function toolErrorContract(tool: string): Contract {
  return {
    modelCalls: 2,
    notableTypes: ['tool-call', 'tool-error', 'finish'],
    toModel: [{ tool, kind: 'error-text' }],
    finishReason: 'stop',
    errors: 0,
    text: 'results: 1',
  };
}

/** The held variants' contracts, pinned from plain; the wrapped engines match. */
const HELD_CONTRACTS: Record<HeldVariant, { plain: Contract; wrapped: Contract }> = {
  throws: { plain: toolErrorContract('misbehave'), wrapped: toolErrorContract('misbehave') },
};

/** The contract a failed tool lookup settles on, identical on every engine. */
const UNKNOWN_CONTRACT = toolErrorContract('nonexistent');

/**
 * COR-1390: durable and evented re-emit the thrown error as the raw serialised
 * error instead of plain's MastraError envelope. The helper removes the
 * checkout-specific stack, so the stable payload shape can be pinned exactly.
 */
const THROWS_DIFFERENCE: EngineDifference = {
  reason:
    "COR-1390: durable and evented re-emit a thrown tool error as the raw serialised error instead of plain's " +
    'MastraError envelope.',
  expect: plain => {
    const expected = structuredClone(plain);
    for (const turn of expected.turns) {
      const index = turn.chunkTypes.indexOf('tool-error');
      if (index < 0) continue;
      const payload = turn.chunkPayloads[index] as { error?: Record<string, unknown> };
      payload.error = { name: payload.error?.name, message: payload.error?.message };
    }
    return expected;
  },
};

const HELD_DIFFERENCES: Record<HeldVariant, EngineDifference> = {
  throws: THROWS_DIFFERENCE,
};

/** The `error` object inside a turn's `tool-error` chunk payload. */
function toolErrorOf(turn: ParitySnapshot): Record<string, unknown> {
  const index = turn.chunkTypes.indexOf('tool-error');
  const payload = turn.chunkPayloads[index] as { error?: Record<string, unknown> } | undefined;
  return payload?.error ?? {};
}

/** Tool message outputs the model saw on a captured request, like the harness's `toModel`. */
function toolOutputsSeenByModel(request: CapturedRequest | undefined) {
  if (!request) return [];
  return request.prompt
    .filter(message => message.role === 'tool')
    .flatMap(message => (Array.isArray(message.content) ? message.content : []))
    .filter(part => part.type === 'tool-result')
    .map(part => {
      const { toolName, output } = part as { toolName?: string; output?: { type?: string } };
      return { tool: toolName, kind: output?.type ?? typeof output };
    });
}

function toolResultCount(request: CapturedRequest): number {
  return request.prompt
    .filter(message => message.role === 'tool')
    .flatMap(message => (Array.isArray(message.content) ? message.content : []))
    .filter(part => part.type === 'tool-result').length;
}

/** A `misbehave` tool whose `execute` misbehaves the way the variant names. */
function misbehaveTool(variant: Variant) {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const execute = {
    'non-json': async () => circular,
    'bad-args': async ({ n }: { n: number }) => ({ n }),
    undefined: async () => undefined,
    throws: async () => {
      throw new Error('T32 tool failure');
    },
    // Never runs: the model calls a tool the agent does not have.
    unknown: async ({ n }: { n: number }) => ({ n }),
  }[variant];
  return createTool({ id: 'misbehave', description: 'T32 tool', inputSchema: z.object({ n: z.number() }), execute });
}

/** The harness's contract fields, read off the parity snapshot and requests. */
function contractOf(turn: ParitySnapshot, requests: readonly CapturedRequest[]): Contract {
  const lastFinish = turn.chunkTypes.lastIndexOf('finish');
  return {
    modelCalls: requests.length,
    notableTypes: turn.chunkTypes.filter(type => /^tool-|^error$|^finish$|^tripwire$/.test(type)),
    toModel: toolOutputsSeenByModel(requests[1]),
    finishReason:
      lastFinish === -1
        ? null
        : ((turn.chunkPayloads[lastFinish] as { stepResult?: { reason?: string } })?.stepResult?.reason ?? null),
    errors: chunksOfType(turn, 'error'),
    text: turn.streamedText,
  };
}

async function runT32(
  target: ParityTarget,
  variant: Variant,
  differences?: Partial<Record<Exclude<ParityEngine, 'plain'>, EngineDifference>>,
): Promise<EngineParityResults> {
  const call = CALLS[variant];
  return expectParity(target, {
    ...(differences ? { differences } : {}),
    model: {
      respond: request =>
        toolResultCount(request) === 0
          ? toolCallTape(call.name, call.args)
          : textOnlyTape(`results: ${toolResultCount(request)}`),
    },
    buildAgent: ({ model }) =>
      new Agent({
        id: 't32-agent',
        name: 'T32 Agent',
        instructions: 'Follow the script.',
        model,
        memory: new MockMemory(),
        tools: { misbehave: misbehaveTool(variant) },
      }),
    run: async handle => {
      await handle.turn('Go.', TURN_OPTIONS);
    },
  });
}

describeParity('tool-errors parity', target => {
  for (const variant of ['non-json', 'bad-args', 'undefined'] as const) {
    it(`${variant}: the tool call is surfaced, the loop continues and the model is told`, async () => {
      const results = await runT32(target, variant);

      for (const engine of ['plain', target] as const) {
        const { turns, requests } = results[engine]!;
        const turn = turns[0]!;
        // The harness's check: the tool call was surfaced publicly.
        expect(chunksOfType(turn, 'tool-call')).toBe(1);
        // The harness's check: the loop continued past the failure.
        expect(chunksOfType(turn, 'tool-result')).toBe(1);
        // The harness's contract, pinned from plain.
        expect(contractOf(turn, requests)).toEqual(EXPECTED_CONTRACT);
      }
    });
  }

  // `unknown` matched plain once the helper began comparing a live `Error` as
  // its enumerable fields plus `{ name, message }` (COR-1417): a failed tool
  // lookup serialises to exactly that on the wrapped engines.
  it('unknown: the tool call is surfaced, the run settles and the model is told', async () => {
    const results = await runT32(target, 'unknown');

    for (const engine of ['plain', target] as const) {
      const { turns, requests } = results[engine]!;
      const turn = turns[0]!;
      // The harness's check: the tool call was surfaced publicly.
      expect(chunksOfType(turn, 'tool-call')).toBe(1);
      // The harness's check: the failed lookup is reported as an error chunk.
      expect(chunksOfType(turn, 'tool-error')).toBe(1);
      // The harness's check: the run settled with a finish chunk.
      expect(chunksOfType(turn, 'finish')).toBeGreaterThanOrEqual(1);
      // The harness's contract, identical on all three engines.
      expect(contractOf(turn, requests)).toEqual(UNKNOWN_CONTRACT);
    }
  });

  for (const variant of HELD_VARIANTS) {
    it(`${variant}: the tool call is surfaced, the run settles and the model is told`, async () => {
      const difference = HELD_DIFFERENCES[variant];
      const results = await runT32(target, variant, { [target]: difference });
      const contracts = HELD_CONTRACTS[variant];

      for (const engine of ['plain', target] as const) {
        const { turns, requests } = results[engine]!;
        const turn = turns[0]!;
        // The harness's check: the tool call was surfaced publicly.
        expect(chunksOfType(turn, 'tool-call')).toBe(1);
        // The harness's check: the run settled with a finish chunk.
        expect(chunksOfType(turn, 'finish')).toBeGreaterThanOrEqual(1);
        // The harness's contract, pinned per engine.
        expect(contractOf(turn, requests)).toEqual(engine === 'plain' ? contracts.plain : contracts.wrapped);
        if (variant === 'throws') {
          // A wrapped engine reporting a different failure or call still fails
          // the precise scenario-level payload expectation above.
          const payload = turn.chunkPayloads[turn.chunkTypes.indexOf('tool-error')] as {
            toolCallId?: string;
            toolName?: string;
            args?: unknown;
          };
          expect({ toolCallId: payload?.toolCallId, toolName: payload?.toolName, args: payload?.args }).toEqual({
            toolCallId: TOOL_CALL_ID,
            toolName: 'misbehave',
            args: { n: 1 },
          });
          // COR-1390's payload shapes. The two engines differ by the
          // classification fields, not by the failure's name or message:
          // plain forwards the live `Error`, the wrappers serialise it.
          const error = toolErrorOf(turn);
          expect(Object.keys(error).sort()).toEqual(
            engine === 'plain' ? ['category', 'cause', 'details', 'domain', 'message', 'name'] : ['message', 'name'],
          );
          expect(error.name).toBe('Error');
          expect(error.message).toBe('T32 tool failure');
        }
      }
    });
  }
});
