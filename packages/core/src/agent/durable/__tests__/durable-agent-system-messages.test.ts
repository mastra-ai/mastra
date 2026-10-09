/**
 * Ported from validation harness case T38 (system-messages).
 *
 * Where system text comes from and where it ends up: `instructions` as a string
 * or an array, per-call `system` / `instructions` overrides, and system-role
 * entries inside `messages`. The scripted model records the prompt it received,
 * so the case pins the ordered system text of the first request, the prompt
 * roles, and which parts reach memory. Model-free.
 */
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import type { CapturedRequest, EngineParityResults, EngineParityScenario, ParityEngine } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape } from './parity-harness';

const INSTR = 'T38 base instructions.';
const EXTRA = 'T38 extra system line.';
const SECOND_INSTR = 'T38 second instruction.';
const OVERRIDDEN = 'T38 overridden instructions.';
const VARIANTS = ['string', 'array', 'per-call', 'in-messages'] as const;
type Variant = (typeof VARIANTS)[number];
const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

/** The harness's `systemText`: every system message in the prompt, in order. */
function systemText(request: CapturedRequest): string {
  return request.prompt
    .filter(message => message.role === 'system')
    .map(message => (typeof message.content === 'string' ? message.content : JSON.stringify(message.content)))
    .join('\n');
}

interface T38State {
  system: string;
  /** The harness's `systemLines`: the ordered system text, one entry per line. */
  systemLines: string[];
  roles: string[];
  persistedRoles: string[];
}

/**
 * The contract fields this case records, pinned literally for every engine.
 * The harness compares these fields across cells (`done({ systemLines, roles,
 * persistedRoles })`), so pinning the values here is what keeps a change that
 * moves all three engines together from keeping them "in parity".
 */
const CONTRACT: Record<Variant, { systemLines: string[]; roles: string[]; persistedRoles: string[] }> = {
  string: { systemLines: [INSTR], roles: ['system', 'user'], persistedRoles: ['user', 'assistant'] },
  array: {
    systemLines: [INSTR, SECOND_INSTR],
    roles: ['system', 'system', 'user'],
    persistedRoles: ['user', 'assistant'],
  },
  'per-call': {
    systemLines: [OVERRIDDEN, EXTRA],
    roles: ['system', 'system', 'user'],
    persistedRoles: ['user', 'assistant'],
  },
  'in-messages': {
    systemLines: [INSTR, EXTRA],
    roles: ['system', 'system', 'user'],
    persistedRoles: ['user', 'assistant'],
  },
};

async function runT38(
  variant: Variant,
): Promise<{ results: EngineParityResults; states: Map<ParityEngine, T38State> }> {
  const memories = new Map<ParityEngine, MockMemory>();
  const thread = `t38-thread-${variant}`;
  const resource = `t38-resource-${variant}`;
  const instructions = variant === 'array' ? [INSTR, SECOND_INSTR] : INSTR;
  const scenario: EngineParityScenario = {
    model: { tapes: [textOnlyTape('ok')] },
    buildAgent: ({ engine, model }) => {
      const memory = new MockMemory();
      memories.set(engine, memory);
      return new Agent({ id: 't38-agent', name: 'T38 Agent', instructions, model, memory });
    },
    input:
      variant === 'in-messages'
        ? [
            { role: 'system', content: EXTRA },
            { role: 'user', content: 'hi' },
          ]
        : 'hi',
    options: {
      maxSteps: 2,
      runId: `t38-run-${variant}`,
      memory: { thread, resource },
      ...(variant === 'per-call' ? { system: EXTRA, instructions: OVERRIDDEN } : {}),
    },
  };

  const results = await expectEngineParity(scenario);
  const states = new Map<ParityEngine, T38State>();
  for (const engine of ENGINES) {
    const { messages } = await memories.get(engine)!.recall({ threadId: thread, resourceId: resource });
    const system = systemText(results[engine]!.requests[0]!);
    states.set(engine, {
      system,
      systemLines: system.split('\n').filter(Boolean),
      roles: results[engine]!.requests[0]!.prompt.map(message => message.role),
      persistedRoles: messages.map(message => message.role),
    });
  }
  return { results, states };
}

describe('T38 system messages (plain, durable, evented)', () => {
  for (const variant of VARIANTS) {
    it(`reaches the model the same way and is never persisted (${variant})`, async () => {
      const { results, states } = await runT38(variant);

      for (const engine of ENGINES) {
        const turn = results[engine]!.turns[0]!;
        const state = states.get(engine)!;

        expect(chunksOfType(turn, 'finish'), `${engine}: one finish`).toBe(1);
        expect(turn.streamedText, `${engine}: text`).toBe('ok');
        expect(results[engine]!.requests, `${engine}: one model call`).toHaveLength(1);

        if (variant === 'string') {
          expect(state.system, `${engine}: instructions reached the model`).toContain(INSTR);
        }
        if (variant === 'array') {
          expect(state.system.indexOf(INSTR), `${engine}: first entry reached the model`).toBeGreaterThanOrEqual(0);
          expect(
            state.system.indexOf(SECOND_INSTR),
            `${engine}: both entries reached the model in order`,
          ).toBeGreaterThan(state.system.indexOf(INSTR));
        }
        if (variant === 'per-call') {
          expect(state.system, `${engine}: per-call instructions replaced the agent instructions`).toContain(
            OVERRIDDEN,
          );
          expect(state.system, `${engine}: agent instructions were replaced`).not.toContain(INSTR);
          expect(state.system, `${engine}: per-call system was added`).toContain(EXTRA);
        }
        if (variant === 'in-messages') {
          expect(state.system, `${engine}: system entry from messages reached the model`).toContain(EXTRA);
        }

        expect(state.roles, `${engine}: prompt roles`).toContain('system');
        expect(state.persistedRoles, `${engine}: system text was not persisted as a message`).not.toContain('system');
        expect(state.persistedRoles, `${engine}: persisted roles`).toEqual(['user', 'assistant']);
        expect(state.systemLines, `${engine}: recorded system lines`).toEqual(CONTRACT[variant].systemLines);
        expect(state.roles, `${engine}: recorded prompt roles`).toEqual(CONTRACT[variant].roles);
      }
    });
  }
});
