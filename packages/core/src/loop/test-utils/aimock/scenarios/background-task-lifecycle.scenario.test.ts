import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
  isDurableEngineVariant,
} from '../aimock-scenario';

/**
 * Regression classes: the end-to-end background-task lifecycle driven by real
 * tool execution (no synthetic lifecycle events).
 *
 *  - a background-eligible tool is dispatched (`background-task-started`), the
 *    task runs to completion and its real result is persisted on the manager,
 *  - a foreground tool on the same thread runs inline while a background task
 *    is still running, and memory keeps both turns plus the late result,
 *  - `streamUntilIdle` forwards the real `background-task-completed` chunk and
 *    re-invokes the model with the task's result in the prompt,
 *  - `streamUntilIdle` closes after one turn when nothing was dispatched,
 *  - `resumeStreamUntilIdle` resumes a run suspended by `suspend()` (custom
 *    resumeData) or by tool approval, and the thread still dispatches and
 *    awaits background tasks afterwards,
 *  - a background task that calls `suspend()` parks as `suspended` and
 *    `manager.resume()` completes it with the provided resumeData.
 */

const BG_CONFIG = { enabled: true, globalConcurrency: 5, perAgentConcurrency: 3 };

type Chunk = { type: string; payload?: any };

async function collect(stream: AsyncIterable<unknown>): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  for await (const chunk of stream) chunks.push(chunk as Chunk);
  return chunks;
}

// Durable streams stay open after a suspension (same convention as
// `runLoopScenario`). Read up to the pause chunk and release the reader
// without cancelling, so the suspended run stays resumable.
async function collectUntil(stream: ReadableStream<unknown>, stopAt: string): Promise<Chunk[]> {
  const reader = stream.getReader();
  const chunks: Chunk[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as Chunk);
      if ((value as Chunk).type === stopAt) break;
    }
  } finally {
    reader.releaseLock();
  }
  return chunks;
}

function textOf(chunks: Chunk[]) {
  return chunks
    .filter(c => c.type === 'text-delta')
    .map(c => c.payload?.text ?? '')
    .join('');
}

// Polls public state until the background worker reports the expected status.
function waitFor<T>(read: () => Promise<T>, ok: (value: T) => boolean): Promise<T> {
  return vi.waitFor(
    async () => {
      const value = await read();
      expect(ok(value), JSON.stringify(value)).toBe(true);
      return value;
    },
    { timeout: 10_000, interval: 20 },
  );
}

function makeResearchTool(gate?: Promise<void>) {
  return createTool({
    id: 'research',
    description: 'Research a topic in the background',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
    background: { enabled: true },
    execute: async ({ topic }) => {
      await gate;
      return { summary: `Research complete on "${topic}"` };
    },
  });
}

// The aimock instance is shared across a describe block, and a background task or wake run left
// over from an earlier test can still reach it. Match turns on this test's prompt instead of
// on request order so a stray request can't shift them.
const FINISH_SIGNAL = 'Tell the user the outcome.';
function hasToolResult(req: unknown) {
  return ((req as any)?.messages ?? []).some((m: any) => m.role === 'tool');
}
function onReportTurns(
  mock: { on: (match: any, response: any) => unknown },
  prompt: string,
  turns: { dispatch: { toolCalls: unknown[] }; ack: string; report: string },
) {
  const mentions = (req: unknown, text: string) => JSON.stringify(req).includes(text);
  mock.on(
    { endpoint: 'chat', predicate: (req: unknown) => mentions(req, prompt) && !hasToolResult(req) },
    turns.dispatch,
  );
  mock.on(
    {
      endpoint: 'chat',
      predicate: (req: unknown) => mentions(req, prompt) && hasToolResult(req) && !mentions(req, FINISH_SIGNAL),
    },
    { content: turns.ack },
  );
  mock.on(
    { endpoint: 'chat', predicate: (req: unknown) => mentions(req, prompt) && mentions(req, FINISH_SIGNAL) },
    { content: turns.report },
  );
}

const greetTool = createTool({
  id: 'greet',
  description: 'Greet a person by name',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  execute: async ({ name }) => ({ greeting: `Hello, ${name}!` }),
});

describeForAllEngines(
  'AIMock loop scenario: background task lifecycle',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('dispatches a background tool and persists its real result on the manager', async () => {
      const { chunks, mastra } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research quantum computing',
        tools: { research: makeResearchTool(), greet: greetTool },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'quantum computing' } }] },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Research started.' });
        },
      });

      const started = chunks!.find(c => c.type === 'background-task-started') as Chunk | undefined;
      expect(started?.payload).toMatchObject({ toolName: 'research' });
      const taskId = started!.payload.taskId as string;

      const task = await waitFor(
        () => mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      expect((task as any).result).toEqual({ summary: 'Research complete on "quantum computing"' });
    }, 30_000);

    it('runs a foreground tool on the same thread while a background task is still running', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const llm = getMock();
      const thread = { threadId: 'bg-fg-thread', resourceId: 'bg-fg-user' };

      const shared = await createSharedAgent(llm, {
        tools: { research: makeResearchTool(gate), greet: greetTool },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        engine,
      });

      llm.on(
        { endpoint: 'chat', sequenceIndex: 0 },
        { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'neural networks' } }] },
      );
      llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Researching neural networks.' });
      llm.on(
        { endpoint: 'chat', sequenceIndex: 2 },
        { toolCalls: [{ id: 'call-fg-1', name: 'greet', arguments: { name: 'Bob' } }] },
      );
      llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'I greeted Bob.' });
      // The research finishes after both streams ended, so the agent wakes to report it.
      llm.on({ endpoint: 'chat', sequenceIndex: 4 }, { content: 'The neural network research is done.' });

      const first = await runLoopScenario({
        engine,
        llm,
        prompt: 'Research neural networks',
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
      });
      const started = first.chunks!.find(c => c.type === 'background-task-started') as Chunk | undefined;
      expect(started?.payload).toMatchObject({ toolName: 'research' });
      const taskId = started!.payload.taskId as string;

      const second = await runLoopScenario({
        engine,
        llm,
        prompt: 'Now greet Bob',
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
      });
      expect(second.chunks!.find(c => c.type === 'background-task-started')).toBeUndefined();
      const greetResult = (second.chunks as Chunk[]).find(
        c => c.type === 'tool-result' && c.payload?.toolName === 'greet',
      );
      expect(greetResult?.payload?.result).toEqual({ greeting: 'Hello, Bob!' });
      expect(await shared.mastra.backgroundTaskManager!.getTask(taskId)).toMatchObject({ status: 'running' });

      release();
      await waitFor(
        () => shared.mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );

      const stored = await waitFor(
        async () => JSON.stringify((await memory.recall(thread)).messages),
        s => s.includes('Research complete on'),
      );
      expect(stored).toContain('Research neural networks');
      expect(stored).toContain('Now greet Bob');
      expect(stored).toContain('Hello, Bob!');
      expect(stored).toContain('I greeted Bob.');
      await waitFor(
        async () => JSON.stringify((await memory.recall(thread)).messages),
        s => s.includes('The neural network research is done.'),
      );
    }, 30_000);

    it('streamUntilIdle forwards the real completion and re-invokes the model with the result', async () => {
      const { output, llm, mastra } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research quantum computing',
        tools: { research: makeResearchTool(), greet: greetTool },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory: new MockMemory(),
        threadId: 'bg-idle-thread',
        resourceId: 'bg-idle-user',
        streamUntilIdle: true,
        manualStreamConsumption: true,
        fixtures: mock => {
          mock.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'quantum computing' } }] },
          );
          mock.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Working on it. ' });
          mock.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Quantum computing research is done.' });
        },
      });

      const chunks = await collect(output.fullStream as AsyncIterable<unknown>);
      const started = chunks.find(c => c.type === 'background-task-started');
      const completed = chunks.find(c => c.type === 'background-task-completed');
      expect(started?.payload.toolName).toBe('research');
      expect(completed?.payload.taskId).toBe(started?.payload.taskId);
      expect(chunks.filter(c => c.type === 'finish').length).toBeGreaterThanOrEqual(2);
      expect(textOf(chunks)).toContain('Quantum computing research is done.');

      const requests = llm.getRequests();
      expect(requests).toHaveLength(3);
      const toolMessage = (requests[2]!.body as any).messages.find((m: any) => m.role === 'tool');
      expect(JSON.parse(toolMessage.content)).toEqual({ summary: 'Research complete on "quantum computing"' });
      expect(await mastra.backgroundTaskManager!.getTask(started!.payload.taskId)).toMatchObject({
        status: 'completed',
      });
      // The open stream reported the result itself, so the agent is not also signalled or woken for it.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(llm.getRequests()).toHaveLength(3);
      expect(JSON.stringify(llm.getRequests().map(r => r.body))).not.toContain('Its result is now on that tool call');
    }, 30_000);

    it('streamUntilIdle closes after one turn when no background task is dispatched', async () => {
      const { output, llm } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Greet Carol',
        tools: { research: makeResearchTool(), greet: greetTool },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory: new MockMemory(),
        threadId: 'bg-idle-none-thread',
        resourceId: 'bg-idle-none-user',
        streamUntilIdle: true,
        manualStreamConsumption: true,
        fixtures: mock => {
          mock.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call-fg-1', name: 'greet', arguments: { name: 'Carol' } }] },
          );
          mock.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Hello Carol!' });
        },
      });

      const chunks = await collect(output.fullStream as AsyncIterable<unknown>);
      expect(chunks.find(c => c.type === 'background-task-started')).toBeUndefined();
      expect(chunks.find(c => c.type === 'tool-result' && c.payload?.toolName === 'greet')?.payload.result).toEqual({
        greeting: 'Hello, Carol!',
      });
      expect(chunks.filter(c => c.type === 'finish')).toHaveLength(1);
      expect(textOf(chunks)).toBe('Hello Carol!');
      expect(llm.getRequests()).toHaveLength(2);
    }, 30_000);

    for (const mode of ['suspend', 'approval'] as const) {
      it(`resumeStreamUntilIdle resumes a ${mode}-suspended run, then the thread still awaits background tasks`, async () => {
        const memory = new MockMemory();
        const llm = getMock();
        const thread = { threadId: `bg-resume-${mode}-thread`, resourceId: `bg-resume-${mode}-user` };
        const pauseChunkType = mode === 'approval' ? 'tool-call-approval' : 'tool-call-suspended';

        const lookup = createTool({
          id: 'lookup',
          description: 'Look up a user record',
          inputSchema: z.object({ name: z.string() }),
          outputSchema: z.object({ id: z.string(), email: z.string() }),
          ...(mode === 'approval' ? { requireApproval: true } : {}),
          suspendSchema: z.object({ ask: z.string(), name: z.string() }),
          resumeSchema: z.object({ domain: z.string() }),
          execute: async ({ name }, options) => {
            const domain = mode === 'approval' ? 'example.com' : options?.agent?.resumeData?.domain;
            if (!domain) {
              return options?.agent?.suspend?.({ ask: 'email-domain', name }) as any;
            }
            return { id: `user-${name.toLowerCase()}`, email: `${name.toLowerCase()}@${domain}` };
          },
        });

        const shared = await createSharedAgent(llm, {
          tools: { research: makeResearchTool(), lookup },
          agentBackgroundTasks: { tools: { research: true } },
          backgroundTasks: BG_CONFIG,
          memory,
          engine,
        });

        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call-lookup-1', name: 'lookup', arguments: { name: 'Dero' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Dero is dero@example.com.' });
        llm.on(
          { endpoint: 'chat', sequenceIndex: 2 },
          { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'machine learning' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'Researching. ' });
        llm.on({ endpoint: 'chat', sequenceIndex: 4 }, { content: 'Machine learning research is done.' });

        const first = await runLoopScenario({
          engine,
          llm,
          prompt: 'Look up Dero',
          sharedAgent: shared,
          fixtures: () => {},
          memory,
          ...thread,
          streamUntilIdle: true,
          manualStreamConsumption: true,
        });
        const firstChunks = isDurableEngineVariant(engine)
          ? await collectUntil(first.output.fullStream as ReadableStream<unknown>, pauseChunkType)
          : await collect(first.output.fullStream as AsyncIterable<unknown>);
        const pause = firstChunks.find(c => c.type === pauseChunkType);
        expect(pause?.payload.toolCallId).toBe('call-lookup-1');
        if (mode === 'suspend') {
          expect(pause?.payload.suspendPayload).toEqual({ ask: 'email-domain', name: 'Dero' });
        }

        const resumed = await shared.agent.resumeStreamUntilIdle(
          mode === 'approval' ? { approved: true } : { domain: 'example.com' },
          {
            runId: first.output.runId,
            toolCallId: 'call-lookup-1',
            memory: { thread: thread.threadId, resource: thread.resourceId },
          },
        );
        const resumedChunks = await collect(resumed.fullStream as AsyncIterable<unknown>);
        const lookupResult = resumedChunks.find(c => c.type === 'tool-result' && c.payload?.toolName === 'lookup');
        expect(lookupResult?.payload.result).toEqual({ id: 'user-dero', email: 'dero@example.com' });
        expect(textOf(resumedChunks)).toContain('dero@example.com');

        const followUp = await runLoopScenario({
          engine,
          llm,
          prompt: 'Now research machine learning',
          sharedAgent: shared,
          fixtures: () => {},
          memory,
          ...thread,
          streamUntilIdle: true,
          manualStreamConsumption: true,
        });
        const followChunks = await collect(followUp.output.fullStream as AsyncIterable<unknown>);
        const started = followChunks.find(c => c.type === 'background-task-started');
        const completed = followChunks.find(c => c.type === 'background-task-completed');
        expect(started?.payload.toolName).toBe('research');
        expect(completed?.payload.taskId).toBe(started?.payload.taskId);
        expect(textOf(followChunks)).toContain('Machine learning research is done.');
        expect(llm.getRequests()).toHaveLength(5);
      }, 60_000);
    }

    it('parks a background task that calls suspend() and completes it via manager.resume()', async () => {
      const researchWithApproval = createTool({
        id: 'research-with-approval',
        description: 'Research a topic after analyst approval',
        inputSchema: z.object({ topic: z.string() }),
        outputSchema: z.object({ summary: z.string() }),
        background: { enabled: true },
        execute: async ({ topic }, options) => {
          const resumeData = options?.agent?.resumeData as { approved?: boolean; notes?: string } | undefined;
          if (!resumeData) {
            return options?.agent?.suspend?.({ awaiting: 'analyst-approval', topic }) as any;
          }
          return { summary: `Research on "${topic}": ${resumeData.notes}` };
        },
      });

      const { chunks, mastra } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research solana',
        tools: { researchWithApproval },
        agentBackgroundTasks: { tools: { researchWithApproval: true } },
        backgroundTasks: BG_CONFIG,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            {
              toolCalls: [{ id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'solana' } }],
            },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Waiting for the analyst.' });
        },
      });

      const manager = mastra.backgroundTaskManager!;
      const started = chunks!.find(c => c.type === 'background-task-started') as Chunk | undefined;
      const taskId = started!.payload.taskId as string;
      const suspended = await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status === 'suspended',
      );
      expect((suspended as any).suspendPayload).toMatchObject({ awaiting: 'analyst-approval', topic: 'solana' });

      await manager.resume(taskId, { approved: true, notes: 'looks promising' });
      const done = await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      expect((done as any).result).toEqual({ summary: 'Research on "solana": looks promising' });
    }, 30_000);

    // A chat that reloads the thread while a deferred background tool waits for input must
    // still see the open request on the tool call, and the resumed tool must know which
    // request it is answering. (#28986)
    function makeSuspendingResearchTool(seenOnResume: unknown[]) {
      return createTool({
        id: 'research-with-approval',
        description: 'Research a topic after analyst approval',
        inputSchema: z.object({ topic: z.string() }),
        outputSchema: z.object({ summary: z.string() }),
        background: { enabled: true },
        execute: async ({ topic }, options) => {
          const resumeData = options?.agent?.resumeData as { notes?: string } | undefined;
          if (!resumeData) {
            return options?.agent?.suspend?.({ awaiting: 'analyst-approval', topic }) as any;
          }
          seenOnResume.push(options?.agent?.suspendPayload);
          return { summary: `Research on "${topic}": ${resumeData.notes}` };
        },
      });
    }

    async function storedToolCall(memory: MockMemory, thread: { threadId: string; resourceId: string }) {
      const { messages } = await memory.recall(thread);
      const message = messages.find(
        m =>
          m.role === 'assistant' &&
          m.content.parts?.some(p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'call-bg-1'),
      );
      const part = message?.content.parts?.find(
        p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'call-bg-1',
      ) as any;
      return {
        suspended: (message?.content.metadata as any)?.suspendedTools?.['call-bg-1'],
        invocation: part?.toolInvocation,
      };
    }

    async function startSuspendingResearch(seenOnResume: unknown[], threadId: string) {
      const memory = new MockMemory();
      const thread = { threadId, resourceId: `${threadId}-user` };
      const { chunks, mastra } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research solana',
        tools: { researchWithApproval: makeSuspendingResearchTool(seenOnResume) },
        agentBackgroundTasks: { tools: { researchWithApproval: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        // Answering the request finishes the task, which wakes the agent to report it.
        fixtures: llm =>
          onReportTurns(llm, 'Research solana', {
            dispatch: {
              toolCalls: [{ id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'solana' } }],
            },
            ack: 'Waiting for the analyst.',
            report: 'The analyst answered.',
          }),
      });
      const manager = mastra.backgroundTaskManager!;
      const started = chunks!.find(c => c.type === 'background-task-started') as Chunk | undefined;
      const taskId = started!.payload.taskId as string;
      const suspendedTask = (await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status === 'suspended',
      )) as any;
      return { memory, thread, manager, taskId, suspendedTask };
    }

    it('keeps a suspended deferred tool call answerable from memory, then clears it once answered (#28986)', async () => {
      const seenOnResume: unknown[] = [];
      const { memory, thread, manager, taskId, suspendedTask } = await startSuspendingResearch(
        seenOnResume,
        'bg-suspend-memory-thread',
      );

      const open = await waitFor(
        () => storedToolCall(memory, thread),
        s => s.suspended?.taskId !== undefined,
      );
      expect(open.suspended).toMatchObject({
        toolCallId: 'call-bg-1',
        toolName: 'researchWithApproval',
        args: { topic: 'solana' },
        suspendPayload: { awaiting: 'analyst-approval', topic: 'solana' },
        taskId,
        runId: suspendedTask.runId,
      });
      expect(new Date(open.suspended.suspendedAt).getTime()).toBe(new Date(suspendedTask.suspendedAt).getTime());

      await manager.resume(taskId, { notes: 'looks promising' });
      await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      expect(seenOnResume).toEqual([{ awaiting: 'analyst-approval', topic: 'solana' }]);

      const answered = await waitFor(
        () => storedToolCall(memory, thread),
        s => s.invocation?.state === 'result' && s.suspended === undefined,
      );
      expect(answered.invocation.result).toEqual({ summary: 'Research on "solana": looks promising' });
      await waitFor(
        async () => JSON.stringify((await memory.recall(thread)).messages),
        s => s.includes('The analyst answered.'),
      );
    }, 30_000);

    it('clears the open request from memory when a suspended deferred task is cancelled (#28986)', async () => {
      const { memory, thread, manager, taskId } = await startSuspendingResearch([], 'bg-suspend-cancel-thread');
      await waitFor(
        () => storedToolCall(memory, thread),
        s => s.suspended !== undefined,
      );

      await manager.cancel(taskId);
      expect(await manager.getTask(taskId)).toMatchObject({ status: 'cancelled' });
      await waitFor(
        () => storedToolCall(memory, thread),
        s => s.suspended === undefined,
      );
    }, 30_000);

    // A deferred task that finishes after the stream that started it has ended must still
    // reach the agent, so it can tell the user the outcome. (#28986)
    function storedText(memory: MockMemory, thread: { threadId: string; resourceId: string }) {
      return async () => JSON.stringify((await memory.recall(thread)).messages);
    }

    // The evented engine can still be finishing an earlier test's run on the shared mock, so
    // count only the requests made for this test's prompt.
    function requestsFor(llm: { getRequests: () => Array<{ body: unknown }> }, prompt: string) {
      return llm
        .getRequests()
        .filter(r => (r.body as any)?.messages?.some((m: any) => m.role === 'user' && m.content === prompt));
    }

    function toolResultSentToModel(request: { body: unknown } | undefined) {
      const toolMessage = (request?.body as any)?.messages?.find((m: any) => m.role === 'tool');
      return toolMessage ? JSON.parse(toolMessage.content) : undefined;
    }

    it('wakes the agent to report a deferred task that finishes after its stream ended (#28986)', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const thread = { threadId: 'bg-wake-thread', resourceId: 'bg-wake-user' };
      const { chunks, mastra, llm } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research quantum computing',
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: mock =>
          onReportTurns(mock, 'Research quantum computing', {
            dispatch: { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'quantum computing' } }] },
            ack: 'Working on it.',
            report: 'The quantum research is finished.',
          }),
      });
      const taskId = (chunks!.find(c => c.type === 'background-task-started') as Chunk).payload.taskId as string;
      expect(requestsFor(llm, 'Research quantum computing')).toHaveLength(2);

      release();
      await waitFor(
        () => mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );

      await waitFor(storedText(memory, thread), s => s.includes('The quantum research is finished.'));
      const requests = requestsFor(llm, 'Research quantum computing');
      expect(requests).toHaveLength(3);
      expect(toolResultSentToModel(requests[2])).toEqual({ summary: 'Research complete on "quantum computing"' });
    }, 30_000);

    it('tells a run already active on the thread about a finished deferred task instead of waking another (#28986)', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const llm = getMock();
      const thread = { threadId: 'bg-deliver-thread', resourceId: 'bg-deliver-user' };
      let manager!: NonNullable<Awaited<ReturnType<typeof createSharedAgent>>['mastra']['backgroundTaskManager']>;
      let taskId = '';
      // A foreground tool in the second run lets the research finish while that run is active.
      const finishResearch = createTool({
        id: 'finish-research',
        description: 'Let the research finish',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => {
          release();
          await waitFor(
            () => manager.getTask(taskId),
            (t: any) => t?.status === 'completed',
          );
          await waitFor(storedText(memory, thread), s => s.includes('Research complete on'));
          return { ok: true };
        },
      });
      const shared = await createSharedAgent(llm, {
        tools: { research: makeResearchTool(gate), finishResearch },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        engine,
      });
      manager = shared.mastra.backgroundTaskManager!;

      const mentions = (req: unknown, text: string) => JSON.stringify(req).includes(text);
      // The tool description shares this text, so look for it as a user message.
      const secondRun = (req: unknown) =>
        ((req as any)?.messages ?? []).some((m: any) => m.role === 'user' && m.content === 'Let the research finish');
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !secondRun(req) && !hasToolResult(req) },
        { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'quantum computing' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !secondRun(req) && hasToolResult(req) },
        { content: 'Working on it.' },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => secondRun(req) && !mentions(req, 'call-fg-1') },
        { toolCalls: [{ id: 'call-fg-1', name: 'finishResearch', arguments: {} }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => secondRun(req) && mentions(req, 'call-fg-1') },
        { content: 'The research finished while we talked.' },
      );

      const first = await runLoopScenario({
        engine,
        llm,
        prompt: 'Research quantum computing now',
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
      });
      taskId = (first.chunks!.find(c => c.type === 'background-task-started') as Chunk).payload.taskId as string;

      await runLoopScenario({
        engine,
        llm,
        prompt: 'Let the research finish',
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
      });

      const requests = requestsFor(llm, 'Research quantum computing now');
      expect(requests).toHaveLength(4);
      expect(JSON.stringify((requests[3]!.body as any).messages)).toContain(
        `Background task ${taskId} for tool call call-bg-1 (research) has completed`,
      );
      // Delivered to the active run, so no other run is woken for it.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(requestsFor(llm, 'Research quantum computing now')).toHaveLength(4);
    }, 30_000);

    it('wakes the agent to report a suspended deferred task once it is answered and finishes (#28986)', async () => {
      const memory = new MockMemory();
      const thread = { threadId: 'bg-wake-resume-thread', resourceId: 'bg-wake-resume-user' };
      const { chunks, mastra, llm } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research solana, then wait for the analyst',
        tools: { researchWithApproval: makeSuspendingResearchTool([]) },
        agentBackgroundTasks: { tools: { researchWithApproval: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: mock =>
          onReportTurns(mock, 'Research solana, then wait for the analyst', {
            dispatch: {
              toolCalls: [{ id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'solana' } }],
            },
            ack: 'Waiting for the analyst.',
            report: 'The analyst approved; solana looks promising.',
          }),
      });
      const manager = mastra.backgroundTaskManager!;
      const taskId = (chunks!.find(c => c.type === 'background-task-started') as Chunk).payload.taskId as string;
      await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status === 'suspended',
      );
      await waitFor(storedText(memory, thread), s => s.includes('Waiting for the analyst.'));
      // Suspending is not a finish: nothing wakes the agent while the request is open.
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(requestsFor(llm, 'Research solana, then wait for the analyst')).toHaveLength(2);

      await manager.resume(taskId, { notes: 'looks promising' });
      await waitFor(storedText(memory, thread), s => s.includes('The analyst approved; solana looks promising.'));
      const requests = requestsFor(llm, 'Research solana, then wait for the analyst');
      expect(requests).toHaveLength(3);
      expect(toolResultSentToModel(requests[2])).toEqual({ summary: 'Research on "solana": looks promising' });
    }, 30_000);

    function requestsMentioning(llm: { getRequests: () => Array<{ body: unknown }> }, text: string) {
      return llm.getRequests().filter(r => JSON.stringify((r.body as any)?.messages ?? []).includes(text));
    }

    function settlesWithin(promise: Promise<unknown>, ms: number) {
      return Promise.race([
        promise.then(() => true),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), ms)),
      ]);
    }

    it('ends a signal-woken run without waiting for its deferred task, then wakes the thread when it finishes (#28986)', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const llm = getMock();
      const thread = { threadId: 'bg-signal-thread', resourceId: 'bg-signal-user' };
      const prompt = 'Research fusion over a signal';
      const shared = await createSharedAgent(llm, {
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        engine,
      });
      onReportTurns(llm, prompt, {
        dispatch: { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'fusion' } }] },
        ack: 'Started the fusion research.',
        report: 'The fusion research is finished.',
      });

      const sent = shared.agent.sendSignal(
        { type: 'user-message', contents: prompt },
        { ...thread, ifIdle: { behavior: 'wake', streamOptions: { stopWhen: stepCountIs(3) } as any } },
      );
      const accepted = await sent.accepted;
      expect(accepted.action).toBe('wake');

      // The woken run ends after its own turn; the task keeps running in the background.
      expect(await settlesWithin((accepted as any).output.consumeStream(), 5_000)).toBe(true);
      const [task] = (await shared.mastra.backgroundTaskManager!.listTasks({ threadId: thread.threadId })).tasks;
      expect(task?.status).toBe('running');
      expect(requestsMentioning(llm, prompt)).toHaveLength(2);

      release();
      await waitFor(storedText(memory, thread), s => s.includes('The fusion research is finished.'));
      const requests = requestsMentioning(llm, prompt);
      expect(requests).toHaveLength(3);
      expect(toolResultSentToModel(requests[2])).toEqual({ summary: 'Research complete on "fusion"' });
      // Reported by the finish signal, not by the woken run waiting for the task.
      expect(JSON.stringify((requests[2]!.body as any).messages)).toContain(
        `Background task ${task!.id} for tool call call-bg-1 (research) has completed`,
      );
    }, 30_000);

    it('reports deferred tasks that finish together without a turn per duplicate (#28986)', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const thread = { threadId: 'bg-cluster-thread', resourceId: 'bg-cluster-user' };
      const prompt = 'Research tides and winds';
      const { chunks, mastra, llm } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt,
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: mock =>
          onReportTurns(mock, prompt, {
            dispatch: {
              toolCalls: [
                { id: 'call-bg-1', name: 'research', arguments: { topic: 'tides' } },
                { id: 'call-bg-2', name: 'research', arguments: { topic: 'winds' } },
              ],
            },
            ack: 'Started both.',
            report: 'Both research tasks are finished.',
          }),
      });
      const taskIds = chunks!.filter(c => c.type === 'background-task-started').map(c => c.payload.taskId as string);
      expect(taskIds).toHaveLength(2);

      release();
      for (const id of taskIds) {
        await waitFor(
          () => mastra.backgroundTaskManager!.getTask(id),
          (t: any) => t?.status === 'completed',
        );
      }
      await waitFor(storedText(memory, thread), s => s.includes('Both research tasks are finished.'));
      await new Promise(resolve => setTimeout(resolve, 500));

      // One signal per task: the first wakes the thread, the second joins that run or the one after it.
      const followUps = requestsFor(llm, prompt).slice(2);
      expect(followUps.length).toBeGreaterThanOrEqual(1);
      expect(followUps.length).toBeLessThanOrEqual(2);
      const lastToolResults = ((followUps.at(-1)!.body as any).messages as any[])
        .filter(m => m.role === 'tool')
        .map(m => m.content)
        .join('\n');
      expect(lastToolResults).toContain('tides');
      expect(lastToolResults).toContain('winds');
      for (const id of taskIds) {
        expect(
          followUps.filter(r => JSON.stringify((r.body as any).messages).includes(`Background task ${id} `)),
        ).not.toHaveLength(0);
      }
    }, 30_000);
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
