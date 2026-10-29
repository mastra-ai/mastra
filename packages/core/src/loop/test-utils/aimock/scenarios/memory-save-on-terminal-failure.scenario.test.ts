import { stepCountIs } from '@internal/ai-sdk-v5';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { assertNoDuplicateParts } from '../../../../agent/test-utils';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { MessageHistory } from '../../../../processors/memory/message-history';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

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

function createProbes(memory: MockMemory) {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function expectTurnSavedAndRecalled(memory: MockMemory, label: string, threadId: string) {
    const { messages } = await memory.recall({ threadId, resourceId: RESOURCE });
    const users = messages.filter(message => message.role === 'user');
    expect(users, `${label}: saved user messages`).toHaveLength(1);
    for (const message of messages) assertNoDuplicateParts(message.content.parts);
    expect(toolResultIds(messages), `${label}: saved tool results`).toEqual(['call_echo']);

    const followUp = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What did the tool return?',
      memory,
      threadId,
      resourceId: RESOURCE,
      tools: { echoTool },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', userMessage: 'What did the tool return?' }, { content: 'It returned "first".' });
      },
    });
    const sent = JSON.stringify(followUp.requests.at(-1)!.body.messages);
    expect(sent, `${label}: follow-up sees the first prompt`).toContain('Echo first, then wait.');
    expect(sent, `${label}: follow-up sees the tool result`).toContain('call_echo');
  }

  it(
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
        console.info(`[terminal-save probe] engine=${engine} case=total-timeout`, JSON.stringify({ calls, saves }));

        await expectTurnSavedAndRecalled(memory, 'total-timeout', threadId);
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
      console.info(`[terminal-save probe] engine=${engine} case=provider-error`, JSON.stringify({ calls, saves }));

      await expectTurnSavedAndRecalled(memory, 'provider-error', threadId);
      expect(calls.map(call => call.hook)).toContain('MessageHistory.processOutputResult');
      expect(calls.find(call => call.hook === 'probe.processOutputResult')?.finishReason).toBe('error');
    },
    TEST_TIMEOUT_MS,
  );
});
