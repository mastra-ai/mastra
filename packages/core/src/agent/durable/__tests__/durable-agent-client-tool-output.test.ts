/**
 * T74 client-tool-output (plain, durable, evented).
 *
 * Ported from validation harness case T74 (client-tool-output).
 *
 * The case guards the second of the two client-output unwrap boundaries:
 * `unwrapToolOutput` treats ANY exact 2-key `{ type, value }` object as if it
 * were the AI SDK v5 tool-output envelope, so a client answer that happens to
 * be shaped `{ type: 'celsius', value: 20 }` was collapsed to `20` before the
 * server-side `onOutput` callback ever saw it. The assertion is on what
 * `onOutput` received, not on how the model later reads it.
 *
 * Excluded, as in the harness: boundary 1 (the `'value' in output` unwrap in
 * `AIV5Adapter#updateMatchingCallInvocationResult`, exercised by T1's `value`
 * variant), `toModelOutput` on client tools, and the error-text / error-json
 * envelopes (deliberately skipped there).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import {
  PARITY_ENGINES,
  chunksOfType,
  expectEngineParity,
  textOnlyTape,
  toolCallTape,
  type ParityEngine,
} from './parity-harness';

const ENGINES = PARITY_ENGINES;
const THREAD = 'thread-t74';
const RESOURCE = 'resource-t74';
const TURN_OPTIONS = { maxSteps: 2, memory: { thread: THREAD, resource: RESOURCE } };

/** A client answer that also looks like the v5 tool-output envelope shape. */
const CLIENT_ANSWER = { type: 'celsius', value: 20 };

/** Mirrors the harness script model: one client call, then text. */
function respond(request: { prompt: readonly unknown[] }) {
  const prompt = request.prompt as Array<{ role?: string; content?: unknown }>;
  const hasToolResult = prompt.some(
    message =>
      message.role === 'tool' ||
      (Array.isArray(message.content) &&
        message.content.some(part => (part as { type?: string })?.type === 'tool-result')),
  );
  return hasToolResult ? textOnlyTape('ok') : toolCallTape('askClient', { question: 'temperature?' });
}

/** The harness declares this tool server-side but only the client executes it. */
function askClientTool(onOutput: (output: unknown) => void) {
  return createTool({
    id: 'askClient',
    description: 'runs in the browser',
    inputSchema: z.object({ question: z.string() }),
    onOutput: async ({ output }) => {
      onOutput(output);
    },
  });
}

async function runT74() {
  const outputs = new Map<ParityEngine, unknown[]>();

  const results = await expectEngineParity({
    model: { respond },
    buildAgent: ({ engine, model }) => {
      outputs.set(engine, []);
      return new Agent({
        id: 't74-agent',
        name: 'T74 Agent',
        instructions: 'Follow the script.',
        model,
        memory: new MockMemory(),
      });
    },
    run: async handle => {
      const seen = outputs.get(handle.engine)!;
      const clientTools = { askClient: askClientTool(output => seen.push(output)) };

      const asked = await handle.turn('Go.', { ...TURN_OPTIONS, clientTools });
      const call = asked.toolCalls[0]!;

      // The client answers on the next turn, replaying the call it was handed.
      await handle.turn(
        [
          {
            role: 'assistant',
            content: [{ type: 'tool-call', toolCallId: call.toolCallId, toolName: 'askClient', args: call.args }],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: call.toolCallId,
                toolName: 'askClient',
                result: CLIENT_ANSWER,
              },
            ],
          },
        ],
        { ...TURN_OPTIONS, clientTools },
      );
    },
  });

  return { results, outputs };
}

describe('T74 client-tool-output (plain, durable, evented)', () => {
  it('the client answer reaches onOutput unwrapped', async () => {
    const { results, outputs } = await runT74();

    for (const engine of ENGINES) {
      const turns = results[engine]!.turns;

      // The call was issued and persisted on the asking turn.
      expect(turns[0]!.toolCalls).toHaveLength(1);
      expect(chunksOfType(turns[0]!, 'error')).toBe(0);

      // The answering turn raised no error and still produced output.
      expect(chunksOfType(turns[1]!, 'error')).toBe(0);
      expect(chunksOfType(turns[1]!, 'finish')).toBe(1);

      // onOutput fired exactly once, with the client answer intact.
      const seen = outputs.get(engine)!;
      expect(seen).toHaveLength(1);
      expect(JSON.stringify(seen[0])).toBe(JSON.stringify(CLIENT_ANSWER));
    }

    // Pin the plain reference so it cannot drift unnoticed.
    const plain = results.plain!;
    expect(plain.turns[0]!.toolCalls).toEqual([
      { toolCallId: 'parity-call-1', toolName: 'askClient', args: { question: 'temperature?' } },
    ]);
    expect(outputs.get('plain')).toEqual([CLIENT_ANSWER]);
  });
});
