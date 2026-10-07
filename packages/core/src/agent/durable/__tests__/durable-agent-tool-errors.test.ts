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
 *
 * Held variants, pending a difference ticket (not asserted here):
 *
 *   undefined  execute returns undefined
 *   throws     execute throws
 *   unknown    the model calls a tool that does not exist
 *
 * On durable and evented the `tool-error` chunk carries the raw serialised
 * error (`{ toolCallId, toolName, args, error: { name, message, stack } }`)
 * where plain carries the MastraError envelope, and for `undefined` the
 * durable/evented engines additionally emit a `tool-result` chunk (and a
 * toolResults entry) that plain omits.
 *
 * Error-message wording is excluded: only the shape is compared. The harness's
 * engine comparison (chunk sequence, finish payload, usage, getFullOutput and
 * the requests the model saw) is covered by `expectEngineParity`; the contract
 * the harness read off that comparison is asserted on every engine, with plain's
 * values pinned literally.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, EngineParityResults, ParityEngine, ParitySnapshot } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const THREAD = 'thread-t32';
const RESOURCE = 'resource-t32';
const TURN_OPTIONS = { maxSteps: 3, memory: { thread: THREAD, resource: RESOURCE } };

const VARIANTS = ['non-json', 'bad-args'] as const;
type Variant = (typeof VARIANTS)[number];

/**
 * The call each variant's model makes. `bad-args` violates the tool's input
 * schema; the held `unknown` variant named a tool the agent does not have.
 */
const CALLS: Record<Variant, { name: string; args: Record<string, unknown> }> = {
  'non-json': { name: 'misbehave', args: { n: 1 } },
  'bad-args': { name: 'misbehave', args: { n: 'not-a-number' } },
};

/** The harness's contract, identical on all three engines for both variants. */
const EXPECTED_CONTRACT = {
  modelCalls: 2,
  notableTypes: ['tool-call', 'tool-result', 'finish'],
  toModel: [{ tool: 'misbehave', kind: 'json' }],
  finishReason: 'stop',
  errors: 0,
  text: 'results: 1',
};

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
  }[variant];
  return createTool({ id: 'misbehave', description: 'T32 tool', inputSchema: z.object({ n: z.number() }), execute });
}

/** The harness's contract fields, read off the parity snapshot and requests. */
function contractOf(turn: ParitySnapshot, requests: readonly CapturedRequest[]) {
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

async function runT32(variant: Variant): Promise<EngineParityResults> {
  const call = CALLS[variant];
  return expectEngineParity({
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
  for (const variant of VARIANTS) {
    it(`${variant}: the tool call is surfaced, the run settles and the model is told`, async () => {
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
});
