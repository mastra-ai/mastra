/**
 * COR-1362 — port of harness case T68 (`delegated-suspend-answer`).
 *
 * A delegated sub-agent can suspend one of its own tools. The delegation wrapper
 * surfaces that suspension under the *wrapper's* tool call id, the user answers it
 * under that id, and the wrapper then finishes on the same id. Before #25491 the
 * client had no explicit signal for that ownership handover, so the wrapper's final
 * `tool-result` could be mistaken for the suspended tool's answer (COR-1341).
 *
 * These tests assert the consumer-visible contract instead of the mechanism:
 *  - the resume handover for the delegation id is visible on the AI SDK UI-message
 *    stream, ahead of the wrapper result (the `tool-call-resumed` chunk #25491 added
 *    is what produces it);
 *  - the user's answer stays the native tool's answer exactly once, nested in the
 *    delegation result, while the wrapper's own text/result stays separately available;
 *  - the live AI SDK reducer and a persisted-thread reload converge on those facts;
 *  - plain, durable and evented agents agree.
 *
 * Not covered here (see harness T51 / core durable suites): crash recovery while
 * suspended, and the decline path.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { readUIMessageStream } from '@internal/ai-v6';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toAISdkMessages } from '../convert-messages.js';
import { toAISdkStream } from '../convert-streams.js';

const USAGE = { inputTokens: 5, outputTokens: 5, totalTokens: 10 };
const SECRET = 'pay-42-secret';
const DELEGATION_TOOL_CALL_ID = 'sup-tc';
const INNER_TOOL_CALL_ID = 'inner-tc';

type Engine = 'plain' | 'durable' | 'evented';

function makeModel(getChunks: (call: number) => any[]) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const chunks = getChunks(calls);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `mock-${calls}`, modelId: 'mock-model', timestamp: new Date(0) },
          ...chunks,
          {
            type: 'finish',
            finishReason: chunks.some(chunk => chunk.type === 'tool-call') ? 'tool-calls' : 'stop',
            usage: USAGE,
          },
        ]),
      };
    },
  });
}

const textChunks = (id: string, text: string) => [
  { type: 'text-start', id },
  { type: 'text-delta', id, delta: text },
  { type: 'text-end', id },
];

const toolCallChunks = (toolCallId: string, toolName: string, input: unknown) => [
  {
    type: 'tool-call',
    toolCallId,
    toolName,
    input: JSON.stringify(input),
    providerExecuted: false,
  },
];

function makeDelegationModels({ suspendInnerTool = true } = {}) {
  return {
    workerModel: makeModel(call =>
      suspendInnerTool && call === 1
        ? toolCallChunks(INNER_TOOL_CALL_ID, 'confirm', { amount: 42 })
        : textChunks('worker-text', 'WORKER DONE'),
    ),
    supervisorModel: makeModel(call =>
      call === 1
        ? toolCallChunks(DELEGATION_TOOL_CALL_ID, 'agent-worker', { prompt: 'Pay 42.' })
        : textChunks('supervisor-text', 'DELEGATED DONE'),
    ),
  };
}

function buildConfirmTool({ secret = false }: { secret?: boolean } = {}) {
  const state = { confirmations: 0 };
  const tool = createTool({
    id: 'confirm',
    description: 'Asks the user to confirm a payment before committing it.',
    inputSchema: z.object({ amount: z.number() }),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ confirmed: z.boolean() }),
    execute: async ({ amount }, context) => {
      const resumeData = context?.agent?.resumeData;
      if (!resumeData) {
        return await context?.agent?.suspend({
          question: secret ? `Pay ${amount}? ${SECRET}` : `Pay ${amount}?`,
        });
      }
      state.confirmations += 1;
      return { confirmed: resumeData.confirmed, amount };
    },
  });
  return { tool, state };
}

async function createScenario(
  engine: Engine,
  {
    suspendInnerTool = true,
    transform,
    secret = false,
  }: {
    suspendInnerTool?: boolean;
    transform?: any;
    secret?: boolean;
  } = {},
) {
  const { tool: confirm, state } = buildConfirmTool({ secret });
  const { workerModel, supervisorModel } = makeDelegationModels({ suspendInnerTool });

  const worker = new Agent({
    id: 'worker',
    name: 'worker',
    description: 'Processes payments on behalf of the supervisor.',
    instructions: 'Process the payment you are asked to process.',
    model: workerModel,
    tools: { confirm },
  });

  const memory = new Memory({ storage: new InMemoryStore() });
  const supervisor = new Agent({
    id: 'supervisor',
    name: 'supervisor',
    instructions: 'Delegate payments to the worker.',
    model: supervisorModel,
    agents: { worker },
    memory,
    ...(transform ? { transform } : {}),
  });

  const pubsub = engine === 'evented' ? new EventEmitterPubSub() : undefined;
  const runner =
    engine === 'durable'
      ? createDurableAgent({ agent: supervisor })
      : engine === 'evented'
        ? createEventedAgent({ agent: supervisor, pubsub: pubsub! })
        : supervisor;

  const mastra = new Mastra({
    agents: { supervisor: runner, worker },
    storage: new InMemoryStore(),
    logger: false,
    ...(pubsub ? { pubsub } : {}),
  });

  return {
    engine,
    agent: mastra.getAgent('supervisor') as any,
    memory,
    pubsub,
    confirmations: state,
    memoryOptions: { thread: `thread-${engine}`, resource: `resource-${engine}` },
    runId: `run-${engine}`,
  };
}

async function collectAISdkChunks(stream: any, version: 'v5' | 'v6' = 'v6') {
  const chunks: any[] = [];
  for await (const chunk of toAISdkStream(stream, { from: 'agent', version } as any)) {
    chunks.push(chunk);
  }
  return chunks;
}

function chunkStream(chunks: any[]) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function reduceToUIMessages(chunks: any[]) {
  const messages: any[] = [];
  for await (const message of readUIMessageStream({ stream: chunkStream(chunks) as any })) {
    messages.push(message);
  }
  return messages;
}

function countMatching(value: unknown, predicate: (candidate: any) => boolean): number {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) return value.reduce<number>((total, item) => total + countMatching(item, predicate), 0);
  if (typeof value === 'object') {
    return (
      (predicate(value) ? 1 : 0) +
      Object.values(value as Record<string, unknown>).reduce<number>(
        (total, item) => total + countMatching(item, predicate),
        0,
      )
    );
  }
  return 0;
}

const isNativeAnswer = (candidate: any) =>
  Object.keys(candidate).length === 2 && candidate.confirmed === true && candidate.amount === 42;

function uiParts(messages: any[]) {
  // readUIMessageStream yields a cumulative snapshot per chunk; the last message is
  // the fully reduced conversation tail.
  return messages.at(-1)?.parts ?? [];
}

function allUiParts(messages: any[]) {
  // Reloaded conversations are plain message lists: parts live per message.
  return messages.flatMap(message => message.parts ?? []);
}

function textPart(parts: any[]) {
  return parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('');
}

async function recallThread(scenario: Awaited<ReturnType<typeof createScenario>>) {
  return scenario.memory.recall({
    threadId: scenario.memoryOptions.thread,
    resourceId: scenario.memoryOptions.resource,
    perPage: false,
  });
}

async function startDelegation(scenario: Awaited<ReturnType<typeof createScenario>>) {
  const streamOptions: Record<string, unknown> = {
    memory: scenario.memoryOptions,
    runId: scenario.runId,
    maxSteps: 6,
  };
  if (scenario.engine !== 'plain') streamOptions.closeOnSuspend = true;

  const result = await scenario.agent.stream('Pay 42.', streamOptions);
  const chunks = await collectAISdkChunks(result.fullStream);
  return { result, chunks };
}

async function resumeDelegation(
  scenario: Awaited<ReturnType<typeof createScenario>>,
  result: { runId: string },
  toolCallId: string,
) {
  const resumeOptions = {
    toolCallId,
    memory: scenario.memoryOptions,
    maxSteps: 6,
  };
  const resumed =
    scenario.engine === 'plain'
      ? await scenario.agent.resumeStream({ confirmed: true }, { runId: result.runId, ...resumeOptions })
      : await scenario.agent.resume(result.runId, { confirmed: true }, resumeOptions);
  return collectAISdkChunks(resumed.fullStream);
}

const activePubsubs: EventEmitterPubSub[] = [];

afterEach(async () => {
  while (activePubsubs.length) {
    const pubsub = activePubsubs.pop()!;
    await pubsub.close();
  }
});

describe.each<Engine>(['plain', 'durable', 'evented'])('delegated suspend answer (%s)', engine => {
  it('keeps the answer on the native tool and the wrapper result separate, live and after reload', async () => {
    const scenario = await createScenario(engine);
    if (scenario.pubsub) activePubsubs.push(scenario.pubsub);

    const { result, chunks: initialChunks } = await startDelegation(scenario);

    // The inner tool's suspension is surfaced on the delegation id, on the UI stream.
    const initialSuspensions = initialChunks.filter(chunk => chunk.type === 'data-tool-call-suspended');
    expect(initialSuspensions).toHaveLength(1);
    expect(initialSuspensions[0].data).toMatchObject({
      toolCallId: DELEGATION_TOOL_CALL_ID,
      toolName: 'agent-worker',
      suspendPayload: { question: 'Pay 42?' },
    });
    expect(initialChunks.some(chunk => chunk.type === 'tool-output-available')).toBe(false);

    const resumeChunks = await resumeDelegation(scenario, result, DELEGATION_TOOL_CALL_ID);

    // The resume handover is announced for the delegation id *before* the wrapper result
    // lands on that same id (#25491). Without it the client cannot tell the two apart.
    const resumeSuspensions = resumeChunks.filter(chunk => chunk.type === 'data-tool-call-suspended');
    expect(resumeSuspensions).toHaveLength(1);
    expect(resumeSuspensions[0].data).toMatchObject({
      toolCallId: DELEGATION_TOOL_CALL_ID,
      resumed: true,
    });
    const wrapperOutputs = resumeChunks.filter(
      chunk => chunk.type === 'tool-output-available' && chunk.toolCallId === DELEGATION_TOOL_CALL_ID,
    );
    expect(wrapperOutputs).toHaveLength(1);
    expect(resumeChunks.indexOf(resumeSuspensions[0])).toBeLessThan(resumeChunks.indexOf(wrapperOutputs[0]));

    // The answer is applied to the native tool exactly once, never as a second result.
    expect(scenario.confirmations.confirmations).toBe(1);
    expect(
      resumeChunks.some(chunk => chunk.type === 'tool-output-available' && chunk.toolCallId === INNER_TOOL_CALL_ID),
    ).toBe(false);

    // Live client reduction: one delegation part carrying the wrapper result, one resumed
    // suspension marker, no separate inner tool part, and the answer exactly once.
    const liveMessages = await reduceToUIMessages([...initialChunks, ...resumeChunks]);
    const liveParts = uiParts(liveMessages);

    const liveDelegationParts = liveParts.filter(part => part.type === 'tool-agent-worker');
    expect(liveDelegationParts).toHaveLength(1);
    expect(liveDelegationParts[0]).toMatchObject({
      state: 'output-available',
      toolCallId: DELEGATION_TOOL_CALL_ID,
      input: { prompt: 'Pay 42.' },
    });
    expect(liveDelegationParts[0].output.text).toBe('WORKER DONE');
    expect(countMatching(liveDelegationParts[0].output, isNativeAnswer)).toBe(1);
    expect(countMatching(liveParts, isNativeAnswer)).toBe(1);
    expect(liveParts.some(part => part.type === 'tool-confirm')).toBe(false);

    const liveSuspensionParts = liveParts.filter(part => part.type === 'data-tool-call-suspended');
    expect(liveSuspensionParts).toHaveLength(1);
    expect(liveSuspensionParts[0].data.resumed).toBe(true);
    expect(textPart(liveParts)).toContain('DELEGATED DONE');

    // Persisted-thread reload converges on the same ownership facts.
    const recalled = await recallThread(scenario);
    const reloaded = toAISdkMessages(recalled.messages, { version: 'v6' });
    const reloadedParts = allUiParts(reloaded);
    const reloadedDelegationParts = reloadedParts.filter(
      part => part.type === 'tool-agent-worker' && part.toolCallId === DELEGATION_TOOL_CALL_ID,
    );

    expect(reloadedDelegationParts).toHaveLength(1);
    expect(reloadedDelegationParts[0]).toMatchObject({ state: 'output-available' });
    expect(reloadedDelegationParts[0].output.text).toBe('WORKER DONE');
    expect(countMatching(reloadedParts, isNativeAnswer)).toBe(1);
    expect(reloadedParts.some(part => part.type === 'tool-confirm')).toBe(false);
    // A reload is not still waiting for an answer.
    expect(reloadedParts.some(part => part.type === 'data-tool-call-suspended')).toBe(false);
    expect(JSON.stringify(recalled.messages)).not.toMatch(/pendingToolApprovals|suspendedTools/);
    expect(textPart(reloadedParts)).toContain('DELEGATED DONE');

    // Live state and reload agree on where the answer lives.
    expect(reloadedDelegationParts[0].output.subAgentToolResults).toEqual(
      liveDelegationParts[0].output.subAgentToolResults,
    );
  }, 90_000);

  it('leaves a delegation without an inner suspension untouched', async () => {
    const scenario = await createScenario(engine, { suspendInnerTool: false });
    if (scenario.pubsub) activePubsubs.push(scenario.pubsub);

    const { chunks } = await startDelegation(scenario);

    expect(chunks.some(chunk => chunk.type === 'data-tool-call-suspended')).toBe(false);
    expect(scenario.confirmations.confirmations).toBe(0);

    const messages = await reduceToUIMessages(chunks);
    const parts = uiParts(messages);
    const delegationParts = parts.filter(part => part.type === 'tool-agent-worker');
    expect(delegationParts).toHaveLength(1);
    expect(delegationParts[0]).toMatchObject({ state: 'output-available' });
    expect(delegationParts[0].output.text).toBe('WORKER DONE');
    expect(textPart(parts)).toContain('DELEGATED DONE');

    const recalled = await recallThread(scenario);
    const reloadedParts = allUiParts(toAISdkMessages(recalled.messages, { version: 'v6' }));
    expect(reloadedParts.filter(part => part.type === 'tool-agent-worker')).toHaveLength(1);
    expect(reloadedParts.some(part => part.type === 'data-tool-call-suspended')).toBe(false);
    expect(textPart(reloadedParts)).toContain('DELEGATED DONE');
  }, 90_000);
});

describe('delegated suspend answer with a display transform (plain)', () => {
  it('never exposes the pre-transform suspension payload on the resume path', async () => {
    const redact = (value: unknown): unknown => {
      if (typeof value === 'string') return value.split(SECRET).join('[redacted]');
      if (Array.isArray(value)) return value.map(redact);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redact(item)]),
        );
      }
      return value;
    };

    const transform = {
      targets: ['display'] as const,
      transformToolPayload: (context: any) => {
        switch (context.phase) {
          case 'input-available':
            return redact(context.input);
          case 'output-available':
            return redact(context.output);
          case 'suspend':
            return redact(context.suspendPayload);
          case 'resume':
            return redact(context.resumeData);
          default:
            return undefined;
        }
      },
    };

    const scenario = await createScenario('plain', { secret: true, transform });
    const { result, chunks: initialChunks } = await startDelegation(scenario);

    expect(initialChunks.find(chunk => chunk.type === 'data-tool-call-suspended')?.data.suspendPayload).toEqual({
      question: 'Pay 42? [redacted]',
    });

    const resumeChunks = await resumeDelegation(scenario, result, DELEGATION_TOOL_CALL_ID);
    const resumedSuspension = resumeChunks.find(chunk => chunk.type === 'data-tool-call-suspended');
    expect(resumedSuspension?.data.suspendPayload).toEqual({ question: 'Pay 42? [redacted]' });

    const liveParts = uiParts(await reduceToUIMessages([...initialChunks, ...resumeChunks]));
    const recalled = await recallThread(scenario);
    const reloadedParts = allUiParts(toAISdkMessages(recalled.messages, { version: 'v6' }));

    for (const serialized of [
      JSON.stringify(initialChunks),
      JSON.stringify(resumeChunks),
      JSON.stringify(liveParts),
      JSON.stringify(reloadedParts),
      JSON.stringify(recalled.messages),
    ]) {
      expect(serialized).not.toContain(SECRET);
    }

    // Redaction must not cost the answer or the wrapper result. The transformed display
    // projection is stored next to the tool result, so only assert the result itself here.
    expect(countMatching(liveParts, isNativeAnswer)).toBe(1);
    const reloadedDelegation = reloadedParts.find(part => part.type === 'tool-agent-worker');
    expect(reloadedDelegation?.output.text).toBe('WORKER DONE');
    expect(countMatching(reloadedDelegation?.output, isNativeAnswer)).toBe(1);
  }, 90_000);
});
