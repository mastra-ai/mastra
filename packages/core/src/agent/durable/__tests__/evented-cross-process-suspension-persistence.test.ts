/**
 * Evented agent, step-guarded store, workers on more than one process (#30123).
 *
 * With a store that supports workflow step guards, step events travel over the
 * shared PubSub, so the LLM step and the tool-call step of one run can execute
 * in different processes. The tool-call step used to read the run's
 * MessageList only from this process's run registry:
 *
 * - no registry entry (the worker never started the stream): the pre-suspension
 *   flush saved nothing and the suspension metadata was dropped silently;
 * - a stale registry entry (the process that started the stream, whose list
 *   only holds the user message): `addToolMetadata could not find an assistant
 *   message` and, again, nothing was saved.
 *
 * Either way the thread kept only the user message, so a reloading client and
 * `autoResumeSuspendedTools` could not find the pending tool call.
 *
 * Processes are modelled as two Mastra instances (A: the caller, B: a worker)
 * sharing one store and one PubSub. The run registry is scoped to a Mastra
 * instance, which is the only per-process state involved. Step placement is
 * controlled by which instance has workers running when a step event is
 * published: the model's `doStream` (inside the LLM step) hands the workers
 * from one instance to the other, so the next step event is claimed there.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { ConsoleLogger } from '../../../logger';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { assertWorkflowStepGuard } from '../../../storage/workflow-step-guard';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

const AGENT_ID = 'cross-process-suspension-agent';

type ToolCall = { toolCallId: string; toolName: string; input: Record<string, unknown> };

function createModel(firstTurn: ToolCall[], onFirstTurn?: () => Promise<void>): LanguageModelV2 {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const head = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `id-${calls}`, modelId: 'mock-model-id', timestamp: new Date(0) },
      ];
      if (calls === 1) {
        await onFirstTurn?.();
        return {
          stream: convertArrayToReadableStream([
            ...head,
            ...firstTurn.map(call => ({
              type: 'tool-call',
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              input: JSON.stringify(call.input),
              providerExecuted: false,
            })),
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          ...head,
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Blue it is' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  }) as unknown as LanguageModelV2;
}

function createTools({ requireApproval = false }: { requireApproval?: boolean } = {}) {
  const askColour = createTool({
    id: 'askColour',
    description: 'Ask the user for their favourite colour',
    inputSchema: z.object({ question: z.string() }),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ colour: z.string() }),
    requireApproval,
    execute: async (input: any, context: any) => {
      if (requireApproval) return { colour: 'approved' };
      const agentCtx = context?.agent ?? {};
      if (agentCtx.resumeData != null) return { colour: agentCtx.resumeData.colour };
      await agentCtx.suspend?.({ question: input.question });
      return { colour: 'unknown' };
    },
  });
  const checkStock = createTool({
    id: 'checkStock',
    description: 'Check which colours are in stock',
    inputSchema: z.object({ item: z.string() }),
    execute: async () => ({ colours: ['blue', 'red'] }),
  });
  return { askColour, checkStock };
}

/** Enforce step guards on the shared in-memory store the way guard-capable adapters (pg) do. */
async function enableStepGuards(storage: InMemoryStore) {
  const workflows = (await storage.getStore('workflows'))!;
  const update = workflows.updateWorkflowResults.bind(workflows);
  let lock: Promise<unknown> = Promise.resolve();
  workflows.supportsWorkflowStepGuards = () => true;
  workflows.updateWorkflowResults = args => {
    const write = lock.then(async () => {
      const { startGuard, completionGuard, ...rest } = args;
      const { workflowName, runId, stepId, result } = rest;
      const snapshot = await workflows.loadWorkflowSnapshot({ workflowName, runId });
      assertWorkflowStepGuard({ snapshot, stepId, startGuard, completionGuard });
      const stored = snapshot?.context[stepId];
      const written = completionGuard?.pruneOnly
        ? { ...result, metadata: { ...stored?.metadata, ...result.metadata, __continuationStarted: true } }
        : result;
      const context = await update({ ...rest, result: written });
      const previous = startGuard?.previousStep;
      const previousResult = previous && context[previous.stepId];
      if (
        previous &&
        previous.stepId !== stepId &&
        previousResult?.status === 'success' &&
        previousResult.metadata?.startedBy === previous.eventId
      ) {
        return update({
          workflowName,
          runId,
          stepId: previous.stepId,
          result: {
            ...previous.result,
            metadata: { ...previousResult.metadata, ...previous.result.metadata, __continuationStarted: true },
          },
          requestContext: rest.requestContext,
        });
      }
      return context;
    });
    lock = write.catch(() => {});
    return write;
  };
}

class RecordingLogger extends ConsoleLogger {
  warnings: string[] = [];
  constructor() {
    super({ level: 'silent' });
  }
  warn(message: string, ...args: any[]) {
    this.warnings.push(message);
    super.warn(message, ...args);
  }
}

const instances: Mastra[] = [];

afterEach(async () => {
  await Promise.all(instances.splice(0).map(m => m.stopWorkers().catch(() => {})));
});

interface Setup {
  storage: InMemoryStore;
  /** Which instance executed each askColour call. */
  toolRuns: string[];
  a: { mastra: Mastra; agent: any; logger: RecordingLogger };
  b: { mastra: Mastra; agent: any; logger: RecordingLogger };
}

async function setup({
  firstTurn,
  requireApproval,
  handoff,
}: {
  firstTurn: ToolCall[];
  requireApproval?: boolean;
  /** Called from the first LLM turn, before the tool-call step event is published. */
  handoff?: (s: Setup) => Promise<void>;
}): Promise<Setup> {
  const storage = new InMemoryStore();
  await enableStepGuards(storage);
  const pubsub = new EventEmitterPubSub();
  const s = {} as Setup;
  s.storage = storage;
  s.toolRuns = [];

  const makeInstance = (name: 'a' | 'b') => {
    const logger = new RecordingLogger();
    const model = createModel(firstTurn, handoff ? () => handoff(s) : undefined);
    const tools = createTools({ requireApproval });
    const execute = tools.askColour.execute!;
    tools.askColour.execute = (...args) => {
      s.toolRuns.push(name);
      return execute(...args);
    };
    const agent = createEventedAgent({
      agent: new Agent({
        id: AGENT_ID,
        name: AGENT_ID,
        instructions: 'Ask the user.',
        model,
        tools: firstTurn.length > 1 ? tools : { askColour: tools.askColour },
        memory: new MockMemory({ storage }),
      }),
    });
    const mastra = new Mastra({
      logger,
      storage,
      pubsub,
      agents: { [AGENT_ID]: agent as any },
      // Workers start explicitly. The caller only gets workers when a test hands
      // the tool-call step to it; otherwise it runs like a producer-only replica.
      ...(name === 'a' && !handoff ? { workers: false as const } : {}),
    });
    instances.push(mastra);
    return { mastra, agent: mastra.getAgentById(AGENT_ID) as any, logger };
  };

  s.a = makeInstance('a');
  s.b = makeInstance('b');
  if (handoff) {
    // The caller would lazily start its own workers when it dispatches the run;
    // keep them off so the first LLM step lands on B, and let the handoff start them.
    s.a.mastra.__ensureExecutionWorkersStarted = async () => {};
  }
  return s;
}

async function readUntil(stream: ReadableStream<any>, type: string) {
  const reader = stream.getReader();
  const seen: string[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return seen;
      seen.push(value.type);
      if (value.type === type) return seen;
    }
  } finally {
    reader.releaseLock();
  }
}

async function threadMessages(storage: InMemoryStore, threadId: string) {
  const memory = (await storage.getStore('memory'))!;
  const { messages } = await memory.listMessages({ threadId } as never);
  return messages as any[];
}

async function waitForMessages(storage: InMemoryStore, threadId: string, predicate: (messages: any[]) => boolean) {
  let messages: any[] = [];
  for (let i = 0; i < 100; i++) {
    messages = await threadMessages(storage, threadId);
    if (predicate(messages)) return messages;
    await new Promise(r => setTimeout(r, 50));
  }
  return messages;
}

function invocationIds(message: any): string[] {
  return (message?.content?.parts ?? [])
    .filter((p: any) => p.type === 'tool-invocation')
    .map((p: any) => p.toolInvocation.toolCallId);
}

const askColourCall: ToolCall = {
  toolCallId: 'call-1',
  toolName: 'askColour',
  input: { question: 'What is your favourite colour?' },
};

describe('evented agent: cross-process tool suspension persistence (#30123)', () => {
  it('saves the assistant message and suspendedTools when the worker never started the stream', async () => {
    const threadId = 'thread-no-registry';
    const s = await setup({ firstTurn: [askColourCall] });
    await s.b.mastra.startWorkers();

    const { fullStream, runId } = await s.a.agent.stream('Pick a colour for me', {
      memory: { thread: threadId, resource: 'user-1' },
    });
    const seen = await readUntil(fullStream, 'tool-call-suspended');
    expect(seen).toContain('tool-call-suspended');

    const messages = await waitForMessages(s.storage, threadId, ms =>
      ms.some(m => m.content?.metadata?.suspendedTools),
    );
    expect(s.toolRuns).toEqual(['b']);
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    const assistant = messages[1];
    expect(invocationIds(assistant)).toEqual(['call-1']);
    expect(assistant.content.metadata.suspendedTools['call-1']).toMatchObject({
      toolName: 'askColour',
      toolCallId: 'call-1',
      runId,
      suspendPayload: { question: 'What is your favourite colour?' },
    });
    for (const logger of [s.a.logger, s.b.logger]) {
      expect(logger.warnings.filter(w => w.includes('addToolMetadata could not find'))).toEqual([]);
    }
  }, 30_000);

  it('saves the assistant message and suspendedTools when the tool step runs where the stream started', async () => {
    const threadId = 'thread-stale-registry';
    const s = await setup({
      firstTurn: [askColourCall],
      // The LLM step runs on B; hand the workers to A so A (holding the stale
      // registry list with only the user message) claims the tool-call step.
      handoff: async s => {
        await s.a.mastra.startWorkers();
        // Not awaited: B's stop drains the LLM step that is running this handoff.
        void s.b.mastra.stopWorkers();
      },
    });
    await s.b.mastra.startWorkers();

    const { fullStream, runId } = await s.a.agent.stream('Pick a colour for me', {
      memory: { thread: threadId, resource: 'user-1' },
    });
    // Assert on storage only: in this in-process harness the suspended chunk for a
    // hand-off run is not relayed to the caller's stream, so the stream is not awaited.
    void readUntil(fullStream, 'tool-call-suspended');

    const messages = await waitForMessages(s.storage, threadId, ms =>
      ms.some(m => m.content?.metadata?.suspendedTools),
    );
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(s.toolRuns).toEqual(['a']);
    expect(messages[1].content.metadata.suspendedTools['call-1']).toMatchObject({ toolName: 'askColour', runId });
    for (const logger of [s.a.logger, s.b.logger]) {
      expect(logger.warnings.filter(w => w.includes('addToolMetadata could not find'))).toEqual([]);
    }
  }, 30_000);

  it('keeps every tool call of the turn when a later call in the same turn suspends', async () => {
    const threadId = 'thread-sibling';
    const s = await setup({
      firstTurn: [{ toolCallId: 'call-0', toolName: 'checkStock', input: { item: 'shirt' } }, askColourCall],
    });
    await s.b.mastra.startWorkers();

    const { fullStream } = await s.a.agent.stream('Pick a colour and a size', {
      memory: { thread: threadId, resource: 'user-1' },
    });
    await readUntil(fullStream, 'tool-call-suspended');

    const messages = await waitForMessages(s.storage, threadId, ms =>
      ms.some(m => m.content?.metadata?.suspendedTools),
    );
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(invocationIds(messages[1]).sort()).toEqual(['call-0', 'call-1']);
    expect(Object.keys(messages[1].content.metadata.suspendedTools)).toEqual(['call-1']);
  }, 30_000);

  it('saves pendingToolApprovals when an approval-gated tool call runs on another worker', async () => {
    const threadId = 'thread-approval';
    const s = await setup({ firstTurn: [askColourCall], requireApproval: true });
    await s.b.mastra.startWorkers();

    const { fullStream } = await s.a.agent.stream('Pick a colour for me', {
      memory: { thread: threadId, resource: 'user-1' },
    });
    await readUntil(fullStream, 'tool-call-approval');

    const messages = await waitForMessages(s.storage, threadId, ms =>
      ms.some(m => m.content?.metadata?.pendingToolApprovals),
    );
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1].content.metadata.pendingToolApprovals['call-1']).toMatchObject({ toolName: 'askColour' });
  }, 30_000);

  it('resumes the suspended run and clears suspendedTools', async () => {
    const threadId = 'thread-resume';
    const s = await setup({ firstTurn: [askColourCall] });
    await s.b.mastra.startWorkers();

    const { fullStream, runId } = await s.a.agent.stream('Pick a colour for me', {
      memory: { thread: threadId, resource: 'user-1' },
    });
    await readUntil(fullStream, 'tool-call-suspended');
    await waitForMessages(s.storage, threadId, ms => ms.some(m => m.content?.metadata?.suspendedTools));

    // Resume in-process on the caller, whose registry list is stale (user message
    // only), so the tool step must pick the persisted assistant message up from
    // memory. Guarded cross-process resume is tracked separately (#28932, #29034).
    (await s.storage.getStore('workflows'))!.supportsWorkflowStepGuards = () => false;
    const resumed = await s.a.agent.resume(runId, { colour: 'blue' }, { toolCallId: 'call-1' });
    await readUntil(resumed.fullStream, 'finish');

    const messages = await waitForMessages(s.storage, threadId, ms =>
      ms.some(m => (m.content?.parts ?? []).some((p: any) => p.type === 'text' && p.text?.includes('Blue it is'))),
    );
    expect(messages[0].role).toBe('user');
    expect(messages.filter(m => m.role === 'user')).toHaveLength(1);
    const withResult = messages.find(m =>
      (m.content?.parts ?? []).some((p: any) => p.type === 'tool-invocation' && p.toolInvocation.state === 'result'),
    );
    expect(withResult).toBeDefined();
    expect(messages.some(m => Object.keys(m.content?.metadata?.suspendedTools ?? {}).length > 0)).toBe(false);
  }, 30_000);
});
