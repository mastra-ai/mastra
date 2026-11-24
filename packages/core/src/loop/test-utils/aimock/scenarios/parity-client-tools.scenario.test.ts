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
 * The client answering the call on a later turn is covered too: the outcome must complete
 * the stored call rather than be saved as a second copy of it.
 *
 * Harness exclusion: recovery while a client call is outstanding (the run has ended).
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

  // The continuations @mastra/client-js sends once the browser has run the tool: the thread
  // subscription answers with an assistant message, the stream route with a tool message. Neither
  // carries the id of the stored message that holds the pending call.
  const continuations = {
    'an assistant message': (call: { toolCallId: string; toolName: string; args: unknown }) => ({
      role: 'assistant' as const,
      content: [
        { type: 'tool-call' as const, toolCallId: call.toolCallId, toolName: call.toolName, input: call.args },
        {
          type: 'tool-result' as const,
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          output: { type: 'json' as const, value: { colour: 'teal' } },
        },
      ],
    }),
    'a tool message': (call: { toolCallId: string; toolName: string; args: unknown }) => ({
      role: 'tool' as const,
      content: [
        {
          type: 'tool-result' as const,
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          output: { type: 'json' as const, value: { colour: 'teal' } },
        },
      ],
    }),
  };

  for (const [shape, continuation] of Object.entries(continuations)) {
    it(`a client answering the call with ${shape} completes the stored call instead of saving a second copy`, async () => {
      const memories = new Map<ParityEngine, MockMemory>();
      await expectParity(target, {
        model: { respond },
        buildAgent: ({ engine, model }) => {
          const memory = new MockMemory();
          memories.set(engine, memory);
          return new Agent({ id: 't33-agent', name: 'T33 Agent', instructions: 'Follow the script.', model, memory });
        },
        run: async handle => {
          const first = await handle.turn('Go.', { ...TURN_OPTIONS, clientTools: CLIENT_TOOLS });
          await handle.turn([continuation(first.toolCalls[0]!)], { ...TURN_OPTIONS, clientTools: CLIENT_TOOLS });
        },
      });

      for (const engine of ['plain', target] as const) {
        const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
        const invocations = toolParts(messages).map(part => part.toolInvocation as Record<string, unknown>);
        expect(invocations.map(({ state, toolCallId, result }) => ({ state, toolCallId, result }))).toEqual([
          { state: 'result', toolCallId: 'parity-call-1', result: { colour: 'teal' } },
        ]);
        expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
      }
    });
  }

  // The model calls a server tool and a client tool in the same step: the server call is stored
  // completed next to the pending client call, and the client sends both back once it has run.
  // Technical: the stored id was only reused when every tool part advanced a stored call, and the
  // already completed server call never does, so the client call was saved a second time.
  it('a client answering its call next to a completed server call completes the stored call instead of saving a second copy', async () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'runs on the server',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ temperature: 21 }),
    });
    const serverCall = { toolCallId: 'parity-call-server', toolName: 'lookup', args: { city: 'Paris' } };
    const memories = new Map<ParityEngine, MockMemory>();
    await expectParity(target, {
      model: {
        respond: request => {
          const prompt = request.prompt as Array<{ content?: unknown }>;
          const answered = prompt.some(
            message =>
              Array.isArray(message.content) &&
              message.content.some(
                part =>
                  (part as { type?: string; toolCallId?: string }).type === 'tool-result' &&
                  (part as { toolCallId?: string }).toolCallId === 'parity-call-1',
              ),
          );
          if (answered) return textOnlyTape('client answered');
          return [
            ...toolCallTape(serverCall.toolName, serverCall.args, serverCall.toolCallId).slice(0, 3),
            ...toolCallTape('askClient', { question: 'colour?' }).slice(2),
          ];
        },
      },
      buildAgent: ({ engine, model }) => {
        const memory = new MockMemory();
        memories.set(engine, memory);
        return new Agent({
          id: 't33-agent',
          name: 'T33 Agent',
          instructions: 'Follow the script.',
          model,
          memory,
          tools: { lookup },
        });
      },
      run: async handle => {
        const first = await handle.turn('Go.', { ...TURN_OPTIONS, clientTools: CLIENT_TOOLS });
        const clientCall = first.toolCalls.find(call => call.toolName === 'askClient')!;
        await handle.turn(
          [
            {
              role: 'assistant' as const,
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: serverCall.toolCallId,
                  toolName: serverCall.toolName,
                  input: serverCall.args,
                },
                {
                  type: 'tool-result' as const,
                  toolCallId: serverCall.toolCallId,
                  toolName: serverCall.toolName,
                  output: { type: 'json' as const, value: { temperature: 21 } },
                },
                ...continuations['an assistant message'](clientCall).content,
              ],
            },
          ],
          { ...TURN_OPTIONS, clientTools: CLIENT_TOOLS },
        );
      },
    });

    for (const engine of ['plain', target] as const) {
      const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
      const invocations = toolParts(messages).map(part => part.toolInvocation as Record<string, unknown>);
      expect(invocations.map(({ state, toolCallId, result }) => ({ state, toolCallId, result }))).toEqual([
        { state: 'result', toolCallId: 'parity-call-server', result: { temperature: 21 } },
        { state: 'result', toolCallId: 'parity-call-1', result: { colour: 'teal' } },
      ]);
      expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
    }
  });

  // Observational memory can observe the message holding the pending call before the client
  // answers it, and seals it so nothing more is merged into what was observed. The answer then
  // belongs in a new message, but it must still reach the model and be saved.
  // Technical: the incoming message took the sealed message's id, so the stored copy replaced it
  // and the client's result was dropped.
  it('a client answering a call whose stored message was sealed by observation keeps its result', async () => {
    const memories = new Map<ParityEngine, MockMemory>();
    const results = await expectParity(target, {
      model: { respond },
      buildAgent: ({ engine, model }) => {
        const memory = new MockMemory();
        memories.set(engine, memory);
        return new Agent({ id: 't33-agent', name: 'T33 Agent', instructions: 'Follow the script.', model, memory });
      },
      run: async handle => {
        const first = await handle.turn('Go.', { ...TURN_OPTIONS, clientTools: CLIENT_TOOLS });

        const memory = memories.get(handle.engine)!;
        const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
        const pending = messages.find(message => message.role === 'assistant')!;
        const lastPart = pending.content.parts.at(-1)! as { metadata?: Record<string, unknown> };
        lastPart.metadata = { ...lastPart.metadata, mastra: { sealedAt: Date.now() } };
        pending.content.metadata = { ...pending.content.metadata, mastra: { sealed: true } };
        await memory.saveMessages({ messages: [pending] });

        await handle.turn([continuations['an assistant message'](first.toolCalls[0]!)], {
          ...TURN_OPTIONS,
          clientTools: CLIENT_TOOLS,
        });
      },
    });

    for (const engine of ['plain', target] as const) {
      expect(results[engine]!.turns[1]!.streamedText).toBe('client answered');

      const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
      const invocations = toolParts(messages).map(part => part.toolInvocation as Record<string, unknown>);
      expect(invocations.filter(invocation => invocation.state === 'result')).toEqual([
        expect.objectContaining({ toolCallId: 'parity-call-1', result: { colour: 'teal' } }),
      ]);
    }
  });

  // The user sends something else while the client tool is still pending, and the client answers
  // afterwards. Only the latest stored message is matched against the client's answer, so the
  // answer is saved as a new message: it must still reach the model and be kept, and the message
  // stored in between is left as it was.
  // Technical: answeringStoredCalls only compares against the newest stored row, so this locks in
  // the fallback (outcomes keep their own id) rather than a re-key onto an unrelated message.
  it('a client answering a call that is no longer the latest stored message keeps its result', async () => {
    const memories = new Map<ParityEngine, MockMemory>();
    const results = await expectParity(target, {
      model: { respond },
      buildAgent: ({ engine, model }) => {
        const memory = new MockMemory();
        memories.set(engine, memory);
        return new Agent({ id: 't33-agent', name: 'T33 Agent', instructions: 'Follow the script.', model, memory });
      },
      run: async handle => {
        const first = await handle.turn('Go.', { ...TURN_OPTIONS, clientTools: CLIENT_TOOLS });

        await memories.get(handle.engine)!.saveMessages({
          messages: [
            {
              id: 'later-note',
              role: 'user',
              createdAt: new Date(Date.now() + 1_000),
              threadId: THREAD,
              resourceId: RESOURCE,
              content: { format: 2, parts: [{ type: 'text', text: 'Make it quick.' }] },
            },
          ],
        });

        await handle.turn([continuations['an assistant message'](first.toolCalls[0]!)], {
          ...TURN_OPTIONS,
          clientTools: CLIENT_TOOLS,
        });
      },
    });

    for (const engine of ['plain', target] as const) {
      expect(results[engine]!.turns[1]!.streamedText).toBe('client answered');

      const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
      const invocations = toolParts(messages).map(part => part.toolInvocation as Record<string, unknown>);
      expect(invocations.map(({ state, toolCallId }) => ({ state, toolCallId }))).toEqual([
        { state: 'call', toolCallId: 'parity-call-1' },
        { state: 'result', toolCallId: 'parity-call-1' },
      ]);
      expect(invocations.at(-1)).toMatchObject({ result: { colour: 'teal' } });
      const note = messages.find(message => message.id === 'later-note');
      expect(note?.content.parts).toEqual([{ type: 'text', text: 'Make it quick.' }]);
    }
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
          providerExecuted: false,
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
