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
import { TOOL_ABORT_NOTICE } from '../../../shared/tool-abort-grace';
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

type Probe = { hook: string; finishReason?: string; text?: string };

function createProbes(memory: MastraMemory) {
  const calls: Probe[] = [];
  const saves: string[][] = [];
  const probe: Processor = {
    id: 'terminal-save-probe',
    processOutputResult: async ({ messageList, result }) => {
      calls.push({ hook: 'probe.processOutputResult', finishReason: result?.finishReason, text: result?.text });
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
  const deadlineSavePending: EngineVariant[] = ['inngest'];
  const itDeadline = deadlineSavePending.includes(engine) ? it.fails : it;
  // Inngest already keeps the user message when the deadline lands during the input save.
  const itInFlightSave = deadlineSavePending.includes(engine) && engine !== 'inngest' ? it.fails : it;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createObservationalMemory() {
    return new Memory({
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
  }

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

  // The deadline cuts the model off mid-reply, before its step finished. The completed step is saved,
  // followed by the text already streamed in its own message, as a cancel keeps it.
  itDeadline(
    'total-timeout during a slow model reply saves the completed step and the streamed text',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-midreply-${engine}`;
      const result = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Echo first, then answer.',
        memory,
        threadId,
        resourceId: RESOURCE,
        stopWhen: stepCountIs(5),
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
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
            { content: 'PARTIAL '.repeat(200) },
            { chunkSize: 8, latency: 50 },
          );
        },
      });
      expect(result.chunks!.some(chunk => chunk.type === 'text-delta')).toBe(true);
      expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
      // Absence can't be polled for; give a late write time to land.
      await new Promise(resolve => setTimeout(resolve, 300));

      const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
      expect(toolResultIds(messages)).toEqual(['call_echo']);
      // The unfinished step keeps its streamed text but not the boundary it opened.
      expect(messages.map(message => message.content.parts.map(part => part.type))).toEqual([
        ['text'],
        ['tool-invocation'],
        ['text'],
      ]);
      const streamed = messages.at(-1)!.content.parts.find(part => part.type === 'text');
      expect(streamed?.type === 'text' && streamed.text).toMatch(/^(PARTIAL )+/);
    },
    TEST_TIMEOUT_MS,
  );

  // The deadline cuts off text no step processor has seen. It must go through them before it is saved,
  // so a redaction processor redacts it as it would have at the end of the step.
  itDeadline(
    'total-timeout runs the step processors over the streamed text before saving it',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-step-redact-${engine}`;
      const redact: Processor = {
        id: 'redact',
        processOutputStep: async ({ messages }) => {
          // Like PIIDetector, rewrite the parts and the content string that mirrors them.
          for (const message of messages) {
            for (const part of message.content.parts) {
              if (part.type === 'text') part.text = part.text.replaceAll('SECRET', '[R]');
            }
            if (typeof message.content.content === 'string') {
              message.content.content = message.content.content.replaceAll('SECRET', '[R]');
            }
          }
          return messages;
        },
      };
      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Echo first, then answer.',
        memory,
        threadId,
        resourceId: RESOURCE,
        stopWhen: stepCountIs(5),
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
        expectStreamError: true,
        tools: { echoTool },
        outputProcessors: [redact],
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }] },
          );
          llm.on(
            { endpoint: 'chat', sequenceIndex: 1 },
            { content: 'SECRET '.repeat(200) },
            { chunkSize: 7, latency: 50 },
          );
        },
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
      expect(toolResultIds(messages)).toEqual(['call_echo']);
      expect(JSON.stringify(messages)).not.toContain('SECRET');
      const streamed = messages.at(-1)!.content.parts.find(part => part.type === 'text');
      expect(streamed?.type === 'text' && streamed.text).toMatch(/^(\[R\] )+/);
    },
    TEST_TIMEOUT_MS,
  );

  // Only the cut-off text goes through the step processors at the deadline: the completed step
  // already did, and running them over it again would apply its changes twice.
  itDeadline(
    'total-timeout applies the step processors to the streamed text once, and not again to the completed step',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-step-marker-${engine}`;
      const marker: Processor = {
        id: 'marker',
        processOutputStep: async ({ messages }) => {
          for (const message of messages.filter(message => message.role === 'assistant')) {
            for (const part of message.content.parts) if (part.type === 'text') part.text += '+';
          }
          return messages;
        },
      };
      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Echo first, then answer.',
        memory,
        threadId,
        resourceId: RESOURCE,
        stopWhen: stepCountIs(5),
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
        expectStreamError: true,
        tools: { echoTool },
        outputProcessors: [marker],
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            {
              content: 'Checking. ',
              toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }],
            },
          );
          llm.on(
            { endpoint: 'chat', sequenceIndex: 1 },
            { content: 'PARTIAL '.repeat(200) },
            { chunkSize: 8, latency: 50 },
          );
        },
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
      expect(toolResultIds(messages)).toEqual(['call_echo']);
      const texts = messages
        .filter(message => message.role === 'assistant')
        .flatMap(message => message.content.parts)
        .flatMap(part => (part.type === 'text' ? [part.text] : []));
      expect(texts).toHaveLength(2);
      expect(texts[0]).toBe('Checking. +');
      expect(texts[1]).toMatch(/^(PARTIAL )+\+$/);
    },
    TEST_TIMEOUT_MS,
  );

  // A step processor that writes a data part while it handles the cut-off text must see it saved,
  // even when it returns its own copy of the message, which replaces the one the part merged into,
  // and whether or not it names that message.
  for (const targeting of ['implicit', 'explicit'] as const) {
    itDeadline(
      `total-timeout saves the data part a step processor writes for the streamed text (${targeting} target)`,
      async () => {
        const memory = new MockMemory();
        const threadId = `${THREAD}-timeout-step-data-${targeting}-${engine}`;
        const note: Processor = {
          id: 'note',
          processOutputStep: async ({ messages, finishReason, writer }) => {
            const copies = messages.map(message => ({
              ...message,
              content: { ...message.content, parts: [...message.content.parts] },
            }));
            if (finishReason === 'error') {
              const data = { type: 'data-step-note', data: { cut: true } } as const;
              if (targeting === 'explicit') await writer?.custom(data, { messageId: messages.at(-1)!.id });
              else await writer?.custom(data);
            }
            return copies;
          },
        };
        await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Answer slowly.',
          memory,
          threadId,
          resourceId: RESOURCE,
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          outputProcessors: [note],
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              { content: 'PARTIAL '.repeat(200) },
              { chunkSize: 8, latency: 50 },
            );
          },
        });
        await new Promise(resolve => setTimeout(resolve, 300));

        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        const parts = messages
          .filter(message => message.role === 'assistant')
          .flatMap(message => message.content.parts);
        expect(parts.some(part => part.type === 'text' && part.text.startsWith('PARTIAL'))).toBe(true);
        expect(parts.filter(part => part.type === 'data-step-note')).toHaveLength(1);
      },
      TEST_TIMEOUT_MS,
    );
  }

  // A step processor that fails on the cut-off text must not cost the rest of the turn: the save
  // drops that text and keeps the completed step, rather than saving text no processor approved.
  for (const failure of ['throws', 'trips'] as const) {
    itDeadline(
      `total-timeout keeps the completed step without the streamed text when a step processor ${failure}`,
      async () => {
        const memory = new MockMemory();
        const threadId = `${THREAD}-timeout-step-${failure}-${engine}`;
        const resultTexts: string[] = [];
        const guard: Processor = {
          id: 'guard',
          processOutputResult: async ({ messages, result }) => {
            resultTexts.push(result.text);
            return messages;
          },
          processOutputStep: async ({ messages, finishReason, abort }) => {
            if (finishReason === 'error') {
              if (failure === 'trips') abort('Blocked the cut-off text');
              throw new Error('guard failed');
            }
            return messages;
          },
        };
        await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Echo first, then answer.',
          memory,
          threadId,
          resourceId: RESOURCE,
          stopWhen: stepCountIs(5),
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          tools: { echoTool },
          outputProcessors: [guard],
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }] },
            );
            llm.on(
              { endpoint: 'chat', sequenceIndex: 1 },
              { content: 'PARTIAL '.repeat(200) },
              { chunkSize: 8, latency: 50 },
            );
          },
        });

        await vi.waitFor(async () => {
          const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
          expect(toolResultIds(messages)).toEqual(['call_echo']);
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
        expect(JSON.stringify(messages)).not.toContain('PARTIAL');
        // The result processors must not see the text the step processor blocked either.
        expect(resultTexts).toHaveLength(1);
        expect(resultTexts[0]).not.toContain('PARTIAL');
      },
      TEST_TIMEOUT_MS,
    );
  }

  // A processor that writes a data part when the turn ends must see it saved at the deadline too,
  // as it is on a normal finish, so the UI can re-render it from history.
  itDeadline(
    'total-timeout saves the data part an output processor writes at the end of the turn',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-data-part-${engine}`;
      const summary: Processor = {
        id: 'turn-summary',
        processOutputResult: async ({ messages, writer }) => {
          await writer?.custom({ type: 'data-turn-summary', data: { status: 'timed-out' } });
          return messages;
        },
      };
      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Echo first, then answer.',
        memory,
        threadId,
        resourceId: RESOURCE,
        stopWhen: stepCountIs(5),
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
        expectStreamError: true,
        tools: { echoTool },
        outputProcessors: [summary],
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }] },
          );
          llm.on(
            { endpoint: 'chat', sequenceIndex: 1 },
            { content: 'PARTIAL '.repeat(200) },
            { chunkSize: 8, latency: 50 },
          );
        },
      });

      const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
      const dataParts = messages
        .flatMap(message => message.content.parts)
        .filter(part => part.type === 'data-turn-summary');
      expect(dataParts).toEqual([expect.objectContaining({ data: { status: 'timed-out' } })]);
    },
    TEST_TIMEOUT_MS,
  );

  // A failed completion check moves the answer to a new message. The deadline save must put the
  // processor's data part on the answer still streaming, not on the rejected one, as a finish does.
  itDeadline(
    'total-timeout saves the data part with the answer after a failed completion check',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-data-part-check-${engine}`;
      const summary: Processor = {
        id: 'turn-summary',
        processOutputResult: async ({ messages, writer }) => {
          await writer?.custom({ type: 'data-turn-summary', data: { status: 'timed-out' } });
          return messages;
        },
      };
      const answerCheck = { id: 'answer-check', name: 'Answer Check', run: async () => ({ score: 0, reason: 'No' }) };
      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'When does my order ship?',
        memory,
        threadId,
        resourceId: RESOURCE,
        maxSteps: 4,
        isTaskComplete: { scorers: [answerCheck as any] },
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
        expectStreamError: true,
        outputProcessors: [summary],
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Let me check.' });
          llm.on(
            { endpoint: 'chat', sequenceIndex: 1 },
            { content: 'PARTIAL '.repeat(200) },
            { chunkSize: 8, latency: 50 },
          );
        },
      });

      const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
      const withPart = messages.filter(message => message.content.parts.some(p => p.type === 'data-turn-summary'));
      expect(withPart).toHaveLength(1);
      expect(JSON.stringify(withPart[0]!.content.parts)).toContain('PARTIAL');
      expect(JSON.stringify(withPart[0]!.content.parts)).not.toContain('Let me check.');
    },
    TEST_TIMEOUT_MS,
  );

  // No step finishes in time. History is append-only, so the failed turn is still kept: the user
  // message and the text the model streamed before the deadline.
  it(
    'total-timeout before any step finishes keeps the user message and the streamed text',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-input-only-${engine}`;
      const result = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Answer slowly.',
        memory,
        threadId,
        resourceId: RESOURCE,
        stopWhen: stepCountIs(5),
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
        expectStreamError: true,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { content: 'PARTIAL '.repeat(200) },
            { chunkSize: 8, latency: 50 },
          );
        },
      });
      expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
      // Absence can't be polled for; give a late write time to land.
      await new Promise(resolve => setTimeout(resolve, 300));

      const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
      // Inngest saves the input up front but has no deadline pass yet.
      if (deadlineSavePending.includes(engine)) {
        expect(messages.map(message => message.role)).toEqual(['user']);
        return;
      }
      expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
      expect(messages[1]!.content.content).toMatch(/^(PARTIAL )+/);
    },
    TEST_TIMEOUT_MS,
  );

  // The step streamed text, then its only call was cut off: the step is kept whole, text and all,
  // so its text must not be added a second time as streamed text of an unfinished step.
  itDeadline(
    'total-timeout saves the text of a step whose call was cut off once',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-text-then-call-${engine}`;
      const hang = Promise.withResolvers<unknown>();
      try {
        await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Check, then answer.',
          memory,
          threadId,
          resourceId: RESOURCE,
          stopWhen: stepCountIs(5),
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          tools: {
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
              { content: 'Let me check. ', toolCalls: [{ id: 'call_hang', name: 'hanging', arguments: {} }] },
            );
          },
        });

        await vi.waitFor(async () => {
          const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
          expect(JSON.stringify(messages)).toContain(TOOL_ABORT_NOTICE);
        });
        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        const texts = messages
          .filter(message => message.role === 'assistant')
          .flatMap(message => message.content.parts)
          .flatMap(part => (part.type === 'text' ? [part.text] : []));
        expect(texts).toEqual(['Let me check. ']);
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS,
  );

  // A step whose calls all settled, one in time and one with the abort notice, is saved whole.
  itDeadline.each([
    ['failed', 'lookup failed'],
    ['succeeded', 'order shipped'],
  ] as const)(
    'total-timeout saves a step whose tool call %s alongside one cut off at the deadline',
    async (outcome, expected) => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-${outcome}-call-${engine}`;
      const hang = Promise.withResolvers<unknown>();
      try {
        const result = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Run both tools.',
          memory,
          threadId,
          resourceId: RESOURCE,
          stopWhen: stepCountIs(5),
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          collectChunks: true,
          tools: {
            failing: createTool({
              id: 'failing',
              description: 'Looks up the order.',
              inputSchema: z.object({}),
              execute: async () => {
                if (outcome === 'failed') throw new Error('lookup failed');
                return { status: 'order shipped' };
              },
            }),
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
              {
                toolCalls: [
                  { id: 'call_fail', name: 'failing', arguments: {} },
                  { id: 'call_hang', name: 'hanging', arguments: {} },
                ],
              },
            );
          },
        });
        expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);

        await vi.waitFor(async () => {
          const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
          const saved = JSON.stringify(messages);
          expect(saved).toContain(expected);
          // Only the hanging call carries the abort notice.
          expect(saved.split(TOOL_ABORT_NOTICE)).toHaveLength(2);
        });
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS,
  );

  // A tool's transcript transform applies to its saved result, also when the deadline save writes it.
  itDeadline.each(['in time', 'just after the deadline'] as const)(
    'total-timeout saves the transcript-transformed result of a call that finished %s alongside one cut off',
    async when => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-transcript-${when.length}-${engine}`;
      const hang = Promise.withResolvers<unknown>();
      try {
        const result = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Run both tools.',
          memory,
          threadId,
          resourceId: RESOURCE,
          stopWhen: stepCountIs(5),
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          collectChunks: true,
          tools: {
            secretive: createTool({
              id: 'secretive',
              description: 'Reads the vault.',
              inputSchema: z.object({}),
              execute: async () => {
                if (when !== 'in time') await new Promise(resolve => setTimeout(resolve, DEADLINE_MS + 150));
                return { secret: 'RAW-VAULT-SECRET' };
              },
              transform: { transcript: { output: () => ({ secret: 'REDACTED-FOR-TRANSCRIPT' }) } },
            }),
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
              {
                toolCalls: [
                  { id: 'call_secret', name: 'secretive', arguments: {} },
                  { id: 'call_hang', name: 'hanging', arguments: {} },
                ],
              },
            );
          },
        });
        expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);

        await vi.waitFor(async () => {
          const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
          const saved = JSON.stringify(messages);
          expect(saved).toContain('REDACTED-FOR-TRANSCRIPT');
          // Only the hanging call carries the abort notice.
          expect(saved.split(TOOL_ABORT_NOTICE)).toHaveLength(2);
        });
        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        expect(JSON.stringify(messages)).not.toContain('RAW-VAULT-SECRET');
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS,
  );

  // The saved result keeps what toModelOutput returns, also when the deadline save writes it.
  itDeadline.each(['in time', 'just after the deadline'] as const)(
    'total-timeout saves the model output of a call that finished %s alongside one cut off',
    async when => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-model-output-${when.length}-${engine}`;
      const hang = Promise.withResolvers<unknown>();
      try {
        const result = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Run both tools.',
          memory,
          threadId,
          resourceId: RESOURCE,
          stopWhen: stepCountIs(5),
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          expectStreamError: true,
          collectChunks: true,
          tools: {
            mapped: createTool({
              id: 'mapped',
              description: 'Reads a large file.',
              inputSchema: z.object({}),
              execute: async () => {
                if (when !== 'in time') await new Promise(resolve => setTimeout(resolve, DEADLINE_MS + 150));
                return { contents: 'RAW-FILE-CONTENTS' };
              },
              toModelOutput: () => ({ type: 'text', value: 'MAPPED-FOR-MODEL' }),
            }),
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
              {
                toolCalls: [
                  { id: 'call_mapped', name: 'mapped', arguments: {} },
                  { id: 'call_hang', name: 'hanging', arguments: {} },
                ],
              },
            );
          },
        });
        expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);

        await vi.waitFor(async () => {
          const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
          const saved = JSON.stringify(messages);
          expect(saved).toContain('RAW-FILE-CONTENTS');
          expect(saved).toContain('MAPPED-FOR-MODEL');
        });
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

  // Observational memory and user processOutputResult processors see the failed turn and keep its input.
  itDeadline(
    'total-timeout before any step finishes keeps the user message, observational memory',
    async () => {
      const memory = createObservationalMemory();
      const threadId = `${THREAD}-timeout-input-only-om-${engine}`;
      const { probe, calls } = createProbes(memory);
      const result = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Answer slowly.',
        memory,
        memoryOptions: { observationalMemory: true },
        threadId,
        resourceId: RESOURCE,
        agentOutputProcessors: [probe],
        stopWhen: stepCountIs(5),
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
        expectStreamError: true,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { content: 'PARTIAL '.repeat(200) },
            { chunkSize: 8, latency: 50 },
          );
        },
      });
      expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
      expect(messages.filter(message => message.role === 'user').map(message => message.content.content)).toEqual([
        'Answer slowly.',
      ]);
      expect(calls.find(call => call.hook === 'probe.processOutputResult')?.finishReason).toBe('error');
      // Processors see the streamed text that is saved with the turn.
      expect(calls.find(call => call.hook === 'probe.processOutputResult')?.text).toMatch(/^(PARTIAL )+/);
    },
    TEST_TIMEOUT_MS,
  );

  // A client that retries a failed turn by resending the same message (same id) does not duplicate it:
  // memory upserts by message id. Resending only the text creates a new message, so it is saved again.
  it(
    'client retry after a provider error saves the user message once when it reuses the message id',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-client-retry-${engine}`;
      const userMessage = { id: `retry-user-${engine}`, role: 'user' as const, content: 'Please answer.' };
      const failed = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: [userMessage],
        memory,
        threadId,
        resourceId: RESOURCE,
        maxRetries: 0,
        errorProcessors: [],
        expectStreamError: true,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { error: { message: 'provider exploded', type: 'invalid_request_error' }, status: 400 },
          );
        },
      });
      expect(failed.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
      await vi.waitFor(async () => {
        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        expect(messages.map(message => message.id)).toContain(userMessage.id);
      });

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: [userMessage],
        memory,
        threadId,
        resourceId: RESOURCE,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', userMessage: 'Please answer.' }, { content: 'Here is the answer.' });
        },
      });

      await vi.waitFor(async () => {
        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        const users = messages.filter(message => message.role === 'user');
        expect(users.map(message => message.id)).toEqual([userMessage.id]);
        // The failed attempt stays in history next to the successful answer.
        const saved = JSON.stringify(messages);
        expect(saved).toContain('provider exploded');
        expect(saved).toContain('Here is the answer.');
      });
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
      const memory = createObservationalMemory();
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

  // A tool can point the run's memory context at another thread, which MessageHistory then writes to.
  // The deadline save checks write access to that thread too.
  it.skipIf(engine === 'inngest')(
    'total-timeout does not save the turn when a tool points memory at a thread the caller cannot write',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-fga-redirect-${engine}`;
      const otherThreadId = `${threadId}-other`;
      await memory.createThread({ threadId, resourceId: RESOURCE });
      await memory.createThread({ threadId: otherThreadId, resourceId: RESOURCE });
      let toolStarted = false;
      const denies = (permission: unknown, id: string) =>
        String(permission) === 'memory:write' && toolStarted && id === otherThreadId;
      const denied: string[] = [];
      const fga: IFGAProvider = {
        check: async (_user, { resource, permission }) => !denies(permission, resource.id),
        require: async (user, { resource, permission }) => {
          if (denies(permission, resource.id)) {
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
          prompt: 'Wait for the courier.',
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
            hanging: createTool({
              id: 'hanging',
              description: 'Never returns.',
              inputSchema: z.object({}),
              execute: async (_input, context) => {
                toolStarted = true;
                const memoryContext = context?.requestContext?.get('MastraMemory') as Record<string, any>;
                context?.requestContext?.set('MastraMemory', {
                  ...memoryContext,
                  thread: { ...memoryContext.thread, id: otherThreadId },
                });
                return hang.promise;
              },
            }),
          },
          fixtures: llm => {
            llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_hang', name: 'hanging', arguments: {} }] });
          },
        });
        expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
        // Absence can't be polled for; give the deadline save time to land.
        await new Promise(resolve => setTimeout(resolve, 1_500));

        // Evented tools run with a copy of the request context, so there the change never reaches the save,
        // which writes the run's own thread.
        const redirected = engine !== 'evented';
        expect(denied.includes(otherThreadId)).toBe(redirected);
        const saved = async (id: string) =>
          (await memory.recall({ threadId: id, resourceId: RESOURCE })).messages.some(
            message => message.role === 'assistant',
          );
        expect(await saved(otherThreadId)).toBe(false);
        expect(await saved(threadId)).toBe(!redirected);
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS,
  );

  // The finish path undoes per-step saves when an output processor trips, so the deadline pass must too.
  itDeadline(
    'total-timeout removes per-step saves when an output processor trips',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-tripwire-${engine}`;
      const tripper: Processor = {
        id: 'deadline-tripper',
        processOutputResult: ({ abort }) => abort('blocked'),
      };
      const hang = Promise.withResolvers<unknown>();
      try {
        const result = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Echo first, then wait.',
          memory,
          threadId,
          resourceId: RESOURCE,
          savePerStep: true,
          agentOutputProcessors: [tripper],
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
        expect(result.chunks!.some(chunk => chunk.type === 'tool-result')).toBe(true);
        expect(result.chunks!.some(chunk => chunk.type === 'error')).toBe(true);
        // Absence can't be polled for; give a late write time to land.
        await new Promise(resolve => setTimeout(resolve, 1_000));

        const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
        expect(messages.map(message => message.role)).toEqual(['user']);
      } finally {
        hang.resolve({});
      }
    },
    TEST_TIMEOUT_MS,
  );

  // MessageHistory placed before the tripping processor saves the deadline turn, including the
  // streamed text that exists only in that turn. The undo must remove it too. Engines that do not
  // run the deadline pass yet save nothing of the turn, so this holds on every engine.
  it(
    'total-timeout removes the streamed text MessageHistory saved before an output processor trips',
    async () => {
      const memory = new MockMemory();
      const threadId = `${THREAD}-timeout-tripwire-history-first-${engine}`;
      const tripper: Processor = {
        id: 'deadline-tripper',
        processOutputResult: ({ abort }) => abort('blocked'),
      };
      const store = (await memory.storage.getStore('memory'))!;
      const saveMessages = store.saveMessages.bind(store);
      const savedText: string[] = [];
      vi.spyOn(store, 'saveMessages').mockImplementation(args => {
        for (const message of args.messages) {
          for (const part of message.content.parts ?? []) if (part.type === 'text') savedText.push(part.text);
        }
        return saveMessages(args);
      });
      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Echo first, then answer.',
        memory,
        threadId,
        resourceId: RESOURCE,
        agentOutputProcessors: [new MessageHistory({ storage: store }), tripper],
        stopWhen: stepCountIs(5),
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
        expectStreamError: true,
        tools: { echoTool },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'first' } }] },
          );
          llm.on(
            { endpoint: 'chat', sequenceIndex: 1 },
            { content: 'PARTIAL '.repeat(200) },
            { chunkSize: 8, latency: 50 },
          );
        },
      });
      // Absence can't be polled for; give a late write time to land.
      await new Promise(resolve => setTimeout(resolve, 1_000));

      // The streamed text did reach storage before the trip, so the empty result below is the undo's doing.
      if (!deadlineSavePending.includes(engine)) {
        expect(savedText.some(text => text.includes('PARTIAL'))).toBe(true);
      }
      const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
      expect(messages.map(message => message.role)).toEqual(['user']);
    },
    TEST_TIMEOUT_MS,
  );
});
