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
 * `undefined`, `throws` and `unknown` diverge from plain on the wrapped
 * engines, so each declares its difference against COR-1390 (durable and
 * evented re-serialise the failed tool call, and for `undefined` they also
 * surface a `tool-result` chunk plain never emits). On durable and evented the
 * `tool-error` chunk carries the raw serialised error
 * (`{ toolCallId, toolName, args, error: { name, message, stack } }`) where
 * plain carries the MastraError envelope
 * (`{ name, cause, domain, category, details }`).
 *
 * Error-message wording inside those payloads is excluded by the harness from
 * its engine comparison, but the `error` object's shape is what a stream
 * consumer sees, so it stays in the comparison here. The harness's engine
 * comparison (chunk sequence, finish payload, usage, getFullOutput and the
 * requests the model saw) is covered by `expectEngineParity`; the contract the
 * harness read off that comparison is asserted on every engine, with plain's
 * values pinned literally and the wrapped engines' own values pinned per
 * variant.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type {
  CapturedRequest,
  EngineDifference,
  EngineObservation,
  EngineParityResults,
  ParityEngine,
  ParitySnapshot,
} from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const THREAD = 'thread-t32';
const RESOURCE = 'resource-t32';
const TURN_OPTIONS = { maxSteps: 3, memory: { thread: THREAD, resource: RESOURCE } };
const TOOL_CALL_ID = 'parity-call-1';

const VARIANTS = ['non-json', 'bad-args', 'undefined', 'throws', 'unknown'] as const;
type Variant = (typeof VARIANTS)[number];

/** Variants whose difference from plain is declared against COR-1390. */
const HELD_VARIANTS = ['undefined', 'throws', 'unknown'] as const;
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

/** The harness's contract, identical on all three engines for both green variants. */
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

/**
 * The held variants' contracts, pinned from plain. Durable and evented add the
 * `tool-result` chunk for `undefined` (COR-1390) and are otherwise the same.
 */
const HELD_CONTRACTS: Record<HeldVariant, { plain: Contract; wrapped: Contract }> = {
  undefined: {
    plain: {
      modelCalls: 1,
      notableTypes: ['tool-call', 'finish'],
      toModel: [],
      finishReason: 'tool-calls',
      errors: 0,
      text: '',
    },
    wrapped: {
      modelCalls: 1,
      notableTypes: ['tool-call', 'tool-result', 'finish'],
      toModel: [],
      finishReason: 'tool-calls',
      errors: 0,
      text: '',
    },
  },
  throws: { plain: toolErrorContract('misbehave'), wrapped: toolErrorContract('misbehave') },
  unknown: { plain: toolErrorContract('nonexistent'), wrapped: toolErrorContract('nonexistent') },
};

/** What durable and evented report for a tool the agent does not have. */
const UNKNOWN_TOOL_MESSAGE =
  'Tool "nonexistent" not found. Available tools: misbehave. Call tools by their exact name only — never add prefixes, namespaces, or colons.';

/**
 * COR-1390: a tool that returns undefined makes durable and evented emit a
 * `tool-result` chunk (and a `toolResults` entry) for the call; plain emits
 * neither, so the wrapped streams are one chunk longer.
 */
const UNDEFINED_DIFFERENCE: EngineDifference = {
  reason:
    'COR-1390: durable and evented emit a `tool-result` chunk (and a toolResults entry) for a tool that ' +
    'returned undefined; plain emits neither.',
  expect: plain => ({
    ...plain,
    turns: plain.turns.map(turn => {
      const index = turn.chunkTypes.indexOf('tool-call') + 1;
      const chunkTypes = [...turn.chunkTypes];
      const chunks = [...turn.chunks];
      const chunkPayloads = [...turn.chunkPayloads];
      chunkTypes.splice(index, 0, 'tool-result');
      chunks.splice(index, 0, 'AGENT:tool-result:misbehave');
      chunkPayloads.splice(index, 0, {
        toolCallId: TOOL_CALL_ID,
        toolName: 'misbehave',
        args: { n: 1 },
        providerExecuted: false,
      });
      return {
        ...turn,
        chunkTypes,
        chunks,
        chunkPayloads,
        // The wrapped engines record the call without a result for it.
        toolResults: [{ toolCallId: TOOL_CALL_ID, toolName: 'misbehave', result: undefined }],
      };
    }),
  }),
};

/**
 * COR-1390: durable and evented re-emit the thrown error as the raw serialised
 * error (`{ name, message, stack }`) instead of plain's MastraError envelope
 * (`{ name, cause, domain, category, details }`). The serialised stack carries
 * absolute paths from this checkout, so the payload value cannot be pinned;
 * every other field of the turn stays compared, and the difference fails once
 * the two shapes converge. The shape itself is asserted below.
 */
const THROWS_DIFFERENCE: EngineDifference = {
  reason:
    "COR-1390: durable and evented re-emit a thrown tool error as the raw serialised error instead of plain's " +
    'MastraError envelope; the serialised stack embeds checkout-specific paths, so the payload cannot be pinned.',
  ignore: ['chunkPayloads'],
};

/**
 * COR-1390: durable and evented keep the failed lookup's `message` on the
 * `tool-error` payload, where plain's envelope carries the same text under
 * `details.errorMessage` and has no `message`.
 */
const UNKNOWN_DIFFERENCE: EngineDifference = {
  reason:
    'COR-1390: durable and evented re-emit a failed tool lookup as the raw serialised error, whose `message` ' +
    "plain's MastraError envelope does not have (plain keeps the same text under `details.errorMessage`).",
  expect: plain => withWrappedToolError(plain, { name: 'ToolNotFoundError', message: UNKNOWN_TOOL_MESSAGE }),
};

const HELD_DIFFERENCES: Record<HeldVariant, EngineDifference> = {
  undefined: UNDEFINED_DIFFERENCE,
  throws: THROWS_DIFFERENCE,
  unknown: UNKNOWN_DIFFERENCE,
};

/** The wrapped engines' `tool-error` payload, derived from plain's. */
function withWrappedToolError(plain: EngineObservation, error: Record<string, unknown>): EngineObservation {
  return {
    ...plain,
    turns: plain.turns.map(turn => {
      const index = turn.chunkTypes.indexOf('tool-error');
      if (index === -1) return turn;
      const chunkPayloads = [...turn.chunkPayloads];
      chunkPayloads[index] = { ...(chunkPayloads[index] as Record<string, unknown>), error };
      return { ...turn, chunkPayloads };
    }),
  };
}

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
  variant: Variant,
  differences?: Partial<Record<Exclude<ParityEngine, 'plain'>, EngineDifference>>,
): Promise<EngineParityResults> {
  const call = CALLS[variant];
  return expectEngineParity({
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

describe('T32 tool errors (plain, durable, evented)', () => {
  for (const variant of ['non-json', 'bad-args'] as const) {
    it(`${variant}: the tool call is surfaced, the loop continues and the model is told`, async () => {
      const results = await runT32(variant);

      for (const engine of ENGINES) {
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

  for (const variant of HELD_VARIANTS) {
    it(`${variant}: the tool call is surfaced, the run settles and the model is told`, async () => {
      const difference = HELD_DIFFERENCES[variant];
      const results = await runT32(variant, { durable: difference, evented: difference });
      const contracts = HELD_CONTRACTS[variant];

      for (const engine of ENGINES) {
        const { turns, requests } = results[engine]!;
        const turn = turns[0]!;
        // The harness's check: the tool call was surfaced publicly.
        expect(chunksOfType(turn, 'tool-call')).toBe(1);
        // The harness's check: the run settled with a finish chunk.
        expect(chunksOfType(turn, 'finish')).toBeGreaterThanOrEqual(1);
        // The harness's contract, pinned per engine.
        expect(contractOf(turn, requests)).toEqual(engine === 'plain' ? contracts.plain : contracts.wrapped);
        if (variant === 'throws') {
          // COR-1390's payload shapes, asserted here because the serialised
          // stack in the wrapped shape cannot be pinned.
          expect(Object.keys(toolErrorOf(turn)).sort()).toEqual(
            engine === 'plain' ? ['category', 'cause', 'details', 'domain', 'name'] : ['message', 'name', 'stack'],
          );
        }
      }
    });
  }
});
