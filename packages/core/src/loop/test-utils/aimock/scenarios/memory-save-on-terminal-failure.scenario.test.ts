import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../../../memory/src';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { assertNoDuplicateParts } from '../../../../agent/test-utils';
import { MockMemory } from '../../../../memory/mock';
import type { MastraMemory } from '../../../../memory';
import type { Processor } from '../../../../processors';
import { FGADeniedError } from '../../../../auth/ee/fga-check';
import type { IFGAProvider } from '../../../../auth/ee/interfaces/fga';
import { MessageHistory } from '../../../../processors/memory/message-history';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import type { EngineVariant } from '../types';

/**
 * A run that ends without a finish chunk must still save the turn.
 *
 * Two terminal failures, both after one completed tool step:
 * - total-timeout: the next tool never returns and `modelSettings.timeout.totalMs` closes the run.
 * - provider-error: the model call after the tool step fails.
 *
 * Memory must hold the user message and the completed tool step (one result, no duplicate
 * parts), and the next turn on the thread must send that history to the model.
 *
 * The probes record which memory hooks ran, so a failure shows whether the output-processor
 * pass ran at all, which is where saving belongs.
 */

const THREAD = 'thread-terminal-save';
const RESOURCE = 'resource-terminal-save';

const echoTool = createTool({
  id: 'echoTool',
  description: 'Echoes the input string.',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  execute: async ({ input }) => ({ output: input }),
});

function toolResultIds(messages: MastraDBMessage[]) {
  return messages
    .filter(message => message.role === 'assistant')
    .flatMap(message => message.content.parts)
    .filter(part => part.type === 'tool-invocation' && part.toolInvocation.state === 'result')
    .map(part => (part as Extract<typeof part, { type: 'tool-invocation' }>).toolInvocation.toolCallId);
}

type Probe = { hook: string; finishReason?: string };

function createProbes(memory: MastraMemory) {
  const calls: Probe[] = [];
  const saves: string[][] = [];
  const probe: Processor = {
    id: 'terminal-save-probe',
    processOutputResult: async ({ messageList, result }) => {
      calls.push({ hook: 'probe.processOutputResult', finishReason: result?.finishReason });
      return messageList;
    },
  };
  const original = MessageHistory.prototype.processOutputResult;
  vi.spyOn(MessageHistory.prototype, 'processOutputResult').mockImplementation(
    async function (this: MessageHistory, args) {
      calls.push({ hook: 'MessageHistory.processOutputResult', finishReason: args.result?.finishReason });
      return original.call(this, args);
    },
  );
  const saveMessages = memory.saveMessages.bind(memory);
  vi.spyOn(memory, 'saveMessages').mockImplementation(async args => {
    saves.push(args.messages.map(message => message.role));
    return saveMessages(args);
  });
  return { probe, calls, saves };
}

describeForAllEngines('memory saves the turn when a run ends without finishing', engine => {
  const getMock = useLoopScenarioAimock();
  // Every Inngest step is a round trip through the dev server.
  const DEADLINE_MS = engine === 'inngest' ? 4_000 : 800;
  const TEST_TIMEOUT_MS = engine === 'inngest' ? 30_000 : 10_000;
  // Engines that do not yet save the turn when the total deadline fires. Each engine's fix removes it here.
  // Inngest needs a caller-side deadline save that has not landed yet.
  const deadlineSavePending: EngineVariant[] = ['normal', 'fs', 'inngest'];
  const itDeadline = deadlineSavePending.includes(engine) ? it.fails : it;
  // Inngest already keeps the user message when the deadline lands during the input save.
  const itInFlightSave = deadlineSavePending.includes(engine) && engine !== 'inngest' ? it.fails : it;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function expectTurnSavedAndRecalled(
    memory: MastraMemory,
    label: string,
    threadId: string,
    memoryOptions?: { observationalMemory: boolean },
    savedToolResults = ['call_echo'],
  ) {
    const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
    const users = messages.filter(message => message.role === 'user');
    expect(users, `${label}: saved user messages`).toHaveLength(1);
    for (const message of messages) assertNoDuplicateParts(message.content.parts);
    expect(toolResultIds(messages), `${label}: saved tool results`).toEqual(savedToolResults);

    const followUp = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What did the tool return?',
      memory,
      threadId,
      resourceId: RESOURCE,
      memoryOptions,
      tools: { echoTool },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', userMessage: 'What did the tool return?' }, { content: 'It returned "first".' });
      },
    });
    const sent = JSON.stringify(followUp.requests.at(-1)!.body.messages);
    expect(sent, `${label}: follow-up sees the first prompt`).toContain('Echo first, then wait.');
    expect(sent, `${label}: follow-up sees the tool result`).toContain('call_echo');
  }

  itDeadline(
    'total-timeout after a completed tool step',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-${engine}`;
      const { probe, calls, saves } = createProbes(memory);
      const hang = Promise.withResolvers<unknown>();
      try {
        const result = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Echo first, then wait.',
          memory,
          threadId,
          resourceId: RESOURCE,
          agentOutputProcessors: [probe],
          stopWhen: stepCountIs(5),
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          collectChunks: true,
          tools: {
            echoTool,
            hanging: createTool({
              id: 'hanging',
              description: 'Never returns.',
              inputSchema: z.object({}),
              execute: async () => hang.promise,
            }),
          },
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }] },
            );
            llm.on(
              { endpoint: 'chat', sequenceIndex: 1 },
              { toolCalls: [{ id: 'call_hang', name: 'hanging', arguments: {} }] },
            );
          },
        });
        expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
        // Let any late, fire-and-forget save land before reading memory.
        await new Promise(resolve => setTimeout(resolve, 300));

        // The deadline aborts the hanging call; its step is saved with the abort notice, like a tool that returns late.
        await expectTurnSavedAndRecalled(memory, 'total-timeout', threadId, undefined, ['call_echo', 'call_hang']);
        expect(calls.map(call => call.hook)).toContain('MessageHistory.processOutputResult');
        expect(calls.find(call => call.hook === 'probe.processOutputResult')?.finishReason).toBe('error');
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'provider-error after a completed tool step',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-error-${engine}`;
      const { probe, calls, saves } = createProbes(memory);
      const result = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Echo first, then wait.',
        memory,
        threadId,
        resourceId: RESOURCE,
        agentOutputProcessors: [probe],
        stopWhen: stepCountIs(5),
        maxRetries: 0,
        errorProcessors: [],
        expectStreamError: true,
        collectChunks: true,
        tools: { echoTool },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }] },
          );
          llm.on(
            { endpoint: 'chat', sequenceIndex: 1 },
            { error: { message: 'provider exploded', type: 'invalid_request_error' }, status: 400 },
          );
        },
      });
      expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      await expectTurnSavedAndRecalled(memory, 'provider-error', threadId);
      expect(calls.map(call => call.hook)).toContain('MessageHistory.processOutputResult');
      expect(calls.find(call => call.hook === 'probe.processOutputResult')?.finishReason).toBe('error');
    },
    TEST_TIMEOUT_MS,
  );

  // Durable engines save the input before the run starts; a deadline during that save must not lose it.
  // On normal/fs the held save is the deadline pass's own write.
  itInFlightSave(
    'total-timeout while the input save is still in flight keeps the user message once',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-held-input-${engine}`;
      const store = (await memory.storage.getStore('memory'))!;
      const saveMessages = store.saveMessages.bind(store);
      const heldSaves: Promise<unknown>[] = [];
      vi.spyOn(store, 'saveMessages').mockImplementation(args => {
        if (!args.messages.some(message => message.role === 'user')) return saveMessages(args);
        const held = new Promise(resolve => setTimeout(resolve, DEADLINE_MS + 500)).then(() => saveMessages(args));
        heldSaves.push(held.catch(() => {}));
        return held;
      });
      const hang = Promise.withResolvers<unknown>();
      try {
        const result = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Save me slowly.',
          memory,
          threadId,
          resourceId: RESOURCE,
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          collectChunks: true,
          tools: {
            hanging: createTool({
              id: 'hanging',
              description: 'Never returns.',
              inputSchema: z.object({}),
              execute: async () => hang.promise,
            }),
          },
          fixtures: llm => {
            llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_hang', name: 'hanging', arguments: {} }] });
          },
        });
        const errors = result.chunks!.filter(chunk => chunk.type === 'error');
        expect(errors).toHaveLength(1);
        expect(errors[0]!.payload.error).toMatchObject({ name: 'MastraTimeoutError' });
        // A save queued behind a held one is held in turn, so wait until no new save starts.
        for (let drained = 0; drained < heldSaves.length;) {
          const held = heldSaves.slice(drained);
          drained = heldSaves.length;
          await Promise.all(held);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        expect(heldSaves.length, 'a user-message save was attempted').toBeGreaterThan(0);
        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        // Durable engines wait for the input save before calling the model; normal/fs reach the hanging call,
        // whose aborted step is saved too.
        const reachedModel = result.requests.length > 0;
        expect(messages.map(message => message.role)).toEqual(reachedModel ? ['user', 'assistant'] : ['user']);
        expect(messages.filter(message => message.role === 'user')).toHaveLength(1);
        for (const message of messages) assertNoDuplicateParts(message.content.parts);
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS + 5_000,
  );

  // With observational memory on, its processor owns history writes instead of MessageHistory.
  itDeadline(
    'total-timeout after a completed tool step, observational memory',
    async () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          generateTitle: false,
          semanticRecall: false,
          observationalMemory: {
            enabled: true,
            scope: 'thread',
            observation: {
              model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` }).chat('gpt-4o-mini'),
              messageTokens: 100_000,
              bufferTokens: false,
            },
            reflection: { observationTokens: 100_000 },
          },
        },
      });
      const threadId = `${THREAD}-timeout-om-${engine}`;
      const { probe, calls } = createProbes(memory);
      const hang = Promise.withResolvers<unknown>();
      try {
        const result = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Echo first, then wait.',
          memory,
          memoryOptions: { observationalMemory: true },
          threadId,
          resourceId: RESOURCE,
          agentOutputProcessors: [probe],
          stopWhen: stepCountIs(5),
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          collectChunks: true,
          tools: {
            echoTool,
            hanging: createTool({
              id: 'hanging',
              description: 'Never returns.',
              inputSchema: z.object({}),
              execute: async () => hang.promise,
            }),
          },
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }] },
            );
            llm.on(
              { endpoint: 'chat', sequenceIndex: 1 },
              { toolCalls: [{ id: 'call_hang', name: 'hanging', arguments: {} }] },
            );
          },
        });
        expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
        await new Promise(resolve => setTimeout(resolve, 300));

        await expectTurnSavedAndRecalled(memory, 'total-timeout-om', threadId, { observationalMemory: true }, [
          'call_echo',
          'call_hang',
        ]);
        expect(calls.find(call => call.hook === 'probe.processOutputResult')?.finishReason).toBe('error');
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS,
  );

  // The deadline save writes memory outside the finish path, so it must check write access too.
  it.skipIf(engine === 'inngest')(
    'total-timeout does not save the turn for a caller without memory write access',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-readonly-fga-${engine}`;
      await memory.createThread({ threadId, resourceId: RESOURCE });
      const denied: string[] = [];
      // Grants everything except writing memory.
      const fga: IFGAProvider = {
        check: async (_user, { permission }) => String(permission) !== 'memory:write',
        require: async (user, { resource, permission }) => {
          if (String(permission) === 'memory:write') {
            denied.push(resource.id);
            throw new FGADeniedError(user, resource, permission);
          }
        },
        filterAccessible: async (_user, resources) => resources,
      };
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'reader' });
      const hang = Promise.withResolvers<unknown>();
      try {
        const result = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Echo first, then wait.',
          memory,
          threadId,
          resourceId: RESOURCE,
          server: { fga },
          requestContext,
          stopWhen: stepCountIs(5),
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          collectChunks: true,
          tools: {
            echoTool,
            hanging: createTool({
              id: 'hanging',
              description: 'Never returns.',
              inputSchema: z.object({}),
              execute: async () => hang.promise,
            }),
          },
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }] },
            );
            llm.on(
              { endpoint: 'chat', sequenceIndex: 1 },
              { toolCalls: [{ id: 'call_hang', name: 'hanging', arguments: {} }] },
            );
          },
        });
        expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
        await new Promise(resolve => setTimeout(resolve, 1_000));

        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        expect(messages.map(message => message.role)).toEqual([]);
        expect(denied).toContain(threadId);
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS,
  );
});
