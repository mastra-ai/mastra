import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { isDurableEngineVariant } from '../types';

/**
 * Regression class: where system text comes from and where it ends up.
 *
 * Instructions can be a string or an array, can be overridden per call with
 * `system` / `instructions`, and can arrive as system-role entries inside the
 * input messages. Each must reach the model's first request in order, and none
 * may be saved to memory as a thread message.
 */
const INSTR = 'BASE_INSTRUCTIONS';
const SECOND_INSTR = 'SECOND_INSTRUCTION';
const EXTRA = 'EXTRA_SYSTEM_LINE';
const OVERRIDDEN = 'OVERRIDDEN_INSTRUCTIONS';

type Case = {
  name: string;
  instructions: string | string[];
  input: string | Array<{ role: 'system' | 'user'; content: string }>;
  options?: Record<string, unknown>;
  expected: string[];
};

const CASES: Case[] = [
  { name: 'string instructions', instructions: INSTR, input: 'hi', expected: [INSTR] },
  { name: 'array instructions', instructions: [INSTR, SECOND_INSTR], input: 'hi', expected: [INSTR, SECOND_INSTR] },
  {
    name: 'per-call system and instructions overrides',
    instructions: INSTR,
    input: 'hi',
    options: { system: EXTRA, instructions: OVERRIDDEN },
    expected: [OVERRIDDEN, EXTRA],
  },
  {
    name: 'system messages inside the input',
    instructions: INSTR,
    input: [
      { role: 'system', content: EXTRA },
      { role: 'user', content: 'hi' },
    ],
    expected: [INSTR, EXTRA],
  },
];

describeForAllEngines('AIMock loop scenario: system messages', engine => {
  const getMock = useLoopScenarioAimock();

  for (const c of CASES) {
    it(`sends ${c.name} to the model in order and never saves them`, async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: 'ok' });
      const memory = new MockMemory();
      const threadId = `system-messages-${engine}`;
      const resourceId = `system-messages-resource-${engine}`;
      const { agent } = await createSharedAgent(llm, { engine, instructions: c.instructions, memory });

      const result: any = await agent.stream(c.input, {
        memory: { thread: threadId, resource: resourceId },
        ...c.options,
      });
      const output = isDurableEngineVariant(engine) ? result.output : result;
      const fullStream = result.fullStream;
      for await (const _ of fullStream) {
        // drain
      }
      expect(await output.text).toBe('ok');

      const requests = llm.getRequests();
      expect(requests).toHaveLength(1);
      const messages = (requests[0]!.body as any).messages as Array<{ role: string; content: unknown }>;
      const userIndex = messages.findIndex(m => m.role === 'user');
      const system = messages
        .slice(0, userIndex)
        .filter(m => m.role === 'system' || m.role === 'developer')
        .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
        .join('\n');

      expect(system.split('\n').filter(Boolean)).toEqual(c.expected);

      const { messages: saved } = await memory.recall({ threadId, resourceId });
      expect(saved.map(m => m.role)).toEqual(['user', 'assistant']);
      expect(JSON.stringify(saved)).not.toMatch(new RegExp([INSTR, SECOND_INSTR, EXTRA, OVERRIDDEN].join('|')));
    });
  }
});
