/**
 * Ported from validation harness case T33 (client-tools).
 *
 * A client-side tool is declared through the `clientTools` call option and has no
 * `execute`. The model calls it, the server has nothing to run, so the turn must end
 * with the call surfaced, no tool result, finish reason `tool-calls`, exactly one
 * model call, and the call persisted so a client can answer it on a later turn.
 *
 * Both harness variants are covered: `stream` (through `expectParity`) and
 * `generate`. The parity helper only drives streaming turns, so the `generate`
 * variant is driven per engine directly.
 *
 * Harness exclusions: the client answering the call on a later turn, and recovery
 * while a client call is outstanding (the run has ended).
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { it, expect } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../../../agent';
import { createDurableAgent } from '../../../../agent/durable/create-durable-agent';
import { createEventedAgent } from '../../../../agent/durable/create-evented-agent';
import type { DurableAgent } from '../../../../agent/durable/durable-agent';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import {
  type EngineParityResults,
  type ParityEngine,
  type ParityTarget,
  chunksOfType,
  describeParity,
  expectParity,
  textOnlyTape,
  toolCallTape,
} from '../parity';

const THREAD = 'thread-t33';
const RESOURCE = 'resource-t33';
const TURN_OPTIONS = { maxSteps: 3, memory: { thread: THREAD, resource: RESOURCE } };

/** Executeless: this tool runs in the client, the server only surfaces the call. */
const CLIENT_TOOLS = {
  askClient: createTool({
    id: 'askClient',
    description: 'runs in the browser',
    inputSchema: z.object({ question: z.string() }),
  }),
};

/** Mirrors the harness script model: one tool call, then text if called again. */
function respond(request: {
  prompt: readonly unknown[];
}): ReturnType<typeof toolCallTape> | ReturnType<typeof textOnlyTape> {
  const prompt = request.prompt as Array<{ role?: string; content?: unknown }>;
  const hasToolResult = prompt.some(
    message =>
      message.role === 'tool' ||
      (Array.isArray(message.content) &&
        message.content.some(part => (part as { type?: string })?.type === 'tool-result')),
  );
  return hasToolResult ? textOnlyTape('client answered') : toolCallTape('askClient', { question: 'colour?' });
}

interface PersistedPart {
  type?: string;
  toolInvocation?: { toolCallId?: string; toolName?: string; args?: unknown; state?: string };
}

/** The harness reads tool invocations out of persisted message parts. */
function toolParts(messages: readonly { content?: { parts?: PersistedPart[] } }[]) {
  return messages.flatMap(message => message.content?.parts ?? []).filter(part => part.type === 'tool-invocation');
}

async function runT33(target: ParityTarget) {
  const memories = new Map<ParityEngine, MockMemory>();
  const results: EngineParityResults = await expectParity(target, {
    model: { respond },
    buildAgent: ({ engine, model }) => {
      const memory = new MockMemory();
      memories.set(engine, memory);
      return new Agent({ id: 't33-agent', name: 'T33 Agent', instructions: 'Follow the script.', model, memory });
    },
    run: async handle => {
      await handle.turn('Go.', { ...TURN_OPTIONS, clientTools: CLIENT_TOOLS });
    },
  });

  const persistedToolParts = async (engine: ParityEngine) => {
    const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
    return toolParts(messages).map(part => part.toolInvocation ?? {});
  };
  return { results, persistedToolParts };
}

describeParity('client-tools parity', target => {
  it('stream: the call is surfaced once, nothing runs server-side, and the call is persisted', async () => {
    const { results, persistedToolParts } = await runT33(target);

    for (const engine of ['plain', target] as const) {
      const { turns, requests } = results[engine]!;
      const turn = turns[0]!;

      expect(requests).toHaveLength(1);
      expect(chunksOfType(turn, 'error')).toBe(0);
      expect(chunksOfType(turn, 'tool-call')).toBe(1);
      expect(chunksOfType(turn, 'tool-result')).toBe(0);
      expect(turn.finishChunk.reason).toBe('tool-calls');

      const parts = await persistedToolParts(engine);
      // The whole call the client has to answer, not just the tool name: the
      // harness only matches the name, but a persisted invocation without the
      // call id or the arguments could not be answered by the client.
      expect(parts.map(({ state, toolCallId, toolName, args }) => ({ state, toolCallId, toolName, args }))).toEqual([
        { state: 'call', toolCallId: 'parity-call-1', toolName: 'askClient', args: { question: 'colour?' } },
      ]);
      // The persisted call is the one that was surfaced, not a second call.
      expect(parts.map(part => ({ toolCallId: part.toolCallId, toolName: part.toolName }))).toEqual(
        turn.toolCalls.map(call => ({ toolCallId: call.toolCallId, toolName: call.toolName })),
      );
    }

    // Pin the plain reference so it cannot drift unnoticed.
    const plain = results.plain!.turns[0]!;
    expect(plain.toolCalls).toEqual([
      { toolCallId: 'parity-call-1', toolName: 'askClient', args: { question: 'colour?' } },
    ]);
    expect(plain.toolResults).toEqual([]);
    expect(plain.streamedText).toBe('');
  });

  it('generate: each engine returns the client tool call with reason tool-calls', async () => {
    const records = [];
    for (const engine of ['plain', target] as const) records.push(await driveGenerate(engine));

    const [plain, ...rest] = records;
    for (const record of rest) expect({ ...record, engine: undefined }).toEqual({ ...plain!, engine: undefined });

    expect(plain!.finishReason).toBe('tool-calls');
    expect(plain!.toolCallNames).toEqual(['askClient']);
    expect(plain!.text).toBe('');
  });
});

/**
 * The generate variant needs a model that answers both entry points: plain
 * `generate()` calls `doGenerate`, while durable/evented aggregate a stream.
 */
function createClientToolModel() {
  const call = toolCallTape('askClient', { question: 'colour?' });
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream(call as any[]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doGenerate: async () => ({
      content: [
        {
          type: 'tool-call',
          toolCallId: 'parity-call-1',
          toolName: 'askClient',
          input: JSON.stringify({ question: 'colour?' }),
        },
      ],
      finishReason: 'tool-calls',
      usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
      warnings: [],
    }),
  });
}

/** The generate variant: the helper only streams, so drive it per engine. */
async function driveGenerate(engine: ParityEngine) {
  const model = createClientToolModel();
  // Typed wide so both wrappers stay assignable, as the parity helper does.
  const agent: Agent<any, any, any> = new Agent({
    id: 't33-agent',
    name: 'T33 Agent',
    instructions: 'Follow the script.',
    model,
    memory: new MockMemory(),
  });

  let wrapper: DurableAgent<string, any, any> | undefined;
  if (engine === 'durable') {
    wrapper = createDurableAgent({ agent });
  } else if (engine === 'evented') {
    wrapper = createEventedAgent({ agent });
  }

  new Mastra({ agents: { [agent.id]: wrapper ?? agent }, storage: new InMemoryStore(), logger: false });

  if (wrapper && engine === 'evented') {
    // Without atomic storage the evented agent silently runs on the default engine.
    expect((wrapper as unknown as { getWorkflow: () => { engineType?: string } }).getWorkflow().engineType).toBe(
      'evented',
    );
  }

  const output = await (wrapper ?? agent).generate('Go.', { ...TURN_OPTIONS, clientTools: CLIENT_TOOLS });
  return {
    engine,
    finishReason: output.finishReason ?? null,
    // Mirrors the harness: the name sits on the call or on its chunk payload.
    toolCallNames: (output.toolCalls ?? []).map(call => {
      const named = call as { toolName?: string; payload?: { toolName?: string } };
      return named.toolName ?? named.payload?.toolName;
    }),
    text: output.text ?? null,
  };
}
