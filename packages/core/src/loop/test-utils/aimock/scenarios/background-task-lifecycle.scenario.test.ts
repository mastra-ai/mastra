import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect, onTestFinished, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../../../agent';
import { agentThreadStreamRuntime } from '../../../../agent/thread-stream-runtime';
import { MockMemory } from '../../../../memory/mock';
import { RequestContext } from '../../../../request-context';
import { createTool } from '../../../../tools';
import type { ToolPayloadTransform } from '../../../../tools/types';
import {
  createSharedAgent,
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
  isDurableEngineVariant,
} from '../aimock-scenario';
import { ExecutionFence, executionLeaseKey, resolveLeaseProvider } from '../../../../agent/durable/execution-fence';
import { BackgroundTaskManager } from '../../../../background-tasks/manager';
import type { PubSub } from '../../../../events/pubsub';
import { UnixSocketPubSub } from '../../../../events/unix-socket-pubsub';
import type { Mastra } from '../../../../mastra';
import type { MemoryStorage } from '../../../../storage/domains/memory/base';
import { WorkflowsInMemory } from '../../../../storage/domains/workflows/inmemory';
import { RUN_FENCE_CONFLICT_ERROR_ID } from '../../../../storage/run-fencing';
import { SCENARIO_MODEL_ID } from '../types';

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

    // The task turns `completed` before its onResult hook has written the result into the
    // transcript, here held up by a slow toModelOutput. Durable engines wait for that hook before
    // the follow-up model call; the main loop never waits in-loop.
    it.runIf(isDurableEngineVariant(engine))(
      'shows the follow-up model call a result whose toModelOutput is still running when the task finishes',
      async () => {
        const toModelOutput = vi.fn(async (output: { summary?: string }) => {
          // The placeholder passes through here too, with no summary.
          if (output.summary === undefined) return { type: 'text', value: 'Research running.' };
          await new Promise(resolve => setTimeout(resolve, 300));
          return { type: 'text', value: `Model view: ${output.summary}` };
        });
        const research = createTool({
          id: 'research',
          description: 'Research a topic in the background',
          inputSchema: z.object({ topic: z.string() }),
          outputSchema: z.object({ summary: z.string() }),
          background: { enabled: true },
          execute: async ({ topic }) => ({ summary: `Research complete on "${topic}"` }),
          toModelOutput,
        });

        await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Research slow model output',
          tools: { research },
          agentBackgroundTasks: { tools: { research: true } },
          backgroundTasks: BG_CONFIG,
          stopWhen: stepCountIs(3),
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              { toolCalls: [{ id: 'call-bg-slow', name: 'research', arguments: { topic: 'slow output' } }] },
            );
            llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Research reported.' });
          },
        });

        expect(JSON.stringify(getMock().getRequests()[1]!.body!.messages)).toContain(
          'Model view: Research complete on \\"slow output\\"',
        );
        // Steps that write the result into their own transcript reuse the hook's output.
        expect(toModelOutput.mock.calls.filter(([output]) => output.summary !== undefined)).toHaveLength(1);
      },
      30_000,
    );

    // Waiting for a finished task's result reads the task again. A failing read only skips that
    // wait: the follow-up model call still runs, with the placeholder if the result isn't in yet.
    it.runIf(isDurableEngineVariant(engine))(
      'keeps the run going when reading a task fails while waiting for its result',
      async () => {
        const getTask = vi
          .spyOn(BackgroundTaskManager.prototype, 'getTask')
          .mockRejectedValue(new Error('storage unavailable'));
        try {
          const research = createTool({
            id: 'research',
            description: 'Research a topic in the background',
            inputSchema: z.object({ topic: z.string() }),
            outputSchema: z.object({ summary: z.string() }),
            background: { enabled: true },
            execute: async ({ topic }) => ({ summary: `Research complete on "${topic}"` }),
            // Holds the result hook up, so the check reads the finished task.
            toModelOutput: async (output: { summary?: string }) => {
              if (output.summary !== undefined) await new Promise(resolve => setTimeout(resolve, 300));
              return { type: 'text', value: output.summary ?? 'Research running.' };
            },
          });

          const { output } = await runLoopScenario({
            engine,
            llm: getMock(),
            prompt: 'Research a flaky store',
            tools: { research },
            agentBackgroundTasks: { tools: { research: true } },
            backgroundTasks: BG_CONFIG,
            stopWhen: stepCountIs(3),
            fixtures: llm => {
              llm.on(
                { endpoint: 'chat', sequenceIndex: 0 },
                { toolCalls: [{ id: 'call-bg-flaky', name: 'research', arguments: { topic: 'flaky store' } }] },
              );
              llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Research reported.' });
            },
          });

          expect(getTask).toHaveBeenCalled();
          expect(await output.text).toBe('Research reported.');
          expect(getMock().getRequests()).toHaveLength(2);
        } finally {
          getTask.mockRestore();
        }
      },
      30_000,
    );

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
      expect(JSON.stringify(llm.getRequests().map(r => r.body))).not.toContain('It ran as a background task');
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
    function makeSuspendingResearchTool(
      seenOnResume: unknown[],
      transform?: ToolPayloadTransform,
      gate?: Promise<void>,
    ) {
      return createTool({
        id: 'research-with-approval',
        description: 'Research a topic after analyst approval',
        inputSchema: z.object({ topic: z.string() }),
        outputSchema: z.object({ summary: z.string() }),
        background: { enabled: true },
        transform,
        execute: async ({ topic }, options) => {
          const resumeData = options?.agent?.resumeData as { notes?: string } | undefined;
          if (!resumeData) {
            await gate;
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

    async function startSuspendingResearch(
      seenOnResume: unknown[],
      threadId: string,
      transform?: ToolPayloadTransform,
    ) {
      const memory = new MockMemory();
      const thread = { threadId, resourceId: `${threadId}-user` };
      const { chunks, mastra } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research solana',
        tools: { researchWithApproval: makeSuspendingResearchTool(seenOnResume, transform) },
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

    it("stores a suspended deferred tool call's request through the tool's transcript transform (#28986)", async () => {
      const seenOnResume: unknown[] = [];
      const { memory, thread, manager, taskId } = await startSuspendingResearch(
        seenOnResume,
        'bg-suspend-transform-thread',
        {
          transcript: {
            input: () => ({ topic: '[redacted]' }),
            suspend: context => ({ awaiting: (context.suspendPayload as { awaiting: string }).awaiting }),
          },
        },
      );

      const open = await waitFor(
        () => storedToolCall(memory, thread),
        s => s.suspended?.taskId !== undefined,
      );
      expect(open.suspended.suspendPayload).toEqual({ awaiting: 'analyst-approval' });
      expect(open.suspended.args).toEqual({ topic: '[redacted]' });
      expect(JSON.stringify(open.suspended)).not.toContain('solana');

      // The tool itself still resumes with its own, unredacted payload.
      await manager.resume(taskId, { notes: 'ok' });
      await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      expect(seenOnResume).toEqual([{ awaiting: 'analyst-approval', topic: 'solana' }]);
    }, 30_000);

    // Durable engines release the run's claim once it finishes. Tests that need the run fully
    // over before a background task acts wait for storage to show that. Runs without a claim
    // have no record.
    async function waitForRunToRelease(mastra: Mastra, runId: string) {
      const workflows = await mastra.getStorage()!.getStore('workflows');
      await waitFor(
        async () => (await workflows?.getRunOwnership?.({ runId }))?.live ?? false,
        live => !live,
      );
    }

    // Technical: the background executor runs the origin run's suspend bookkeeping before the
    // task's own suspend. Its memory save required the finished run to still own its claim,
    // which can't be verified once the claim is released, so the task failed with
    // DURABLE_AGENT_EXECUTION_UNVERIFIED instead of suspending. (#30182)
    it('parks a deferred tool that asks for input after the reply was sent, and resumes it (#30182)', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const seenOnResume: unknown[] = [];
      const memory = new MockMemory();
      const thread = { threadId: 'bg-suspend-after-finish-thread', resourceId: 'bg-suspend-after-finish-user' };
      const { chunks, mastra, output } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research near',
        tools: { researchWithApproval: makeSuspendingResearchTool(seenOnResume, undefined, gate) },
        agentBackgroundTasks: { tools: { researchWithApproval: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: llm =>
          onReportTurns(llm, 'Research near', {
            dispatch: {
              toolCalls: [{ id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'near' } }],
            },
            ack: 'Waiting for the analyst.',
            report: 'The analyst answered.',
          }),
      });
      // The run has replied and ended before the tool asks for input.
      expect(await output.text).toBe('Waiting for the analyst.');
      const manager = mastra.backgroundTaskManager!;
      const started = chunks!.find(c => c.type === 'background-task-started') as Chunk & { runId: string };
      const taskId = started.payload.taskId as string;
      await waitForRunToRelease(mastra, started.runId);
      release();

      const parked = (await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status !== 'pending' && t?.status !== 'running',
      )) as any;
      expect({ status: parked.status, error: parked.error?.message }).toEqual({
        status: 'suspended',
        error: undefined,
      });
      expect(parked.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'near' });
      const open = await waitFor(
        () => storedToolCall(memory, thread),
        s => s.suspended?.taskId !== undefined,
      );
      expect(open.suspended).toMatchObject({ taskId, suspendPayload: { awaiting: 'analyst-approval', topic: 'near' } });

      await manager.resume(taskId, { notes: 'looks promising' });
      const done = (await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status === 'completed',
      )) as any;
      expect(done.result).toEqual({ summary: 'Research on "near": looks promising' });
      expect(seenOnResume).toEqual([{ awaiting: 'analyst-approval', topic: 'near' }]);
    }, 30_000);

    // Technical: two deferred tools from one turn share the finished run's claim. Answering the
    // first finishes it and wakes the agent to report it, which runs on the thread again. The
    // second tool's late suspend still carries the first run's claim and must still park. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      'parks the second of two deferred tools after the first was answered and reported (#30182)',
      async () => {
        let releaseAlpha!: () => void;
        let releaseBeta!: () => void;
        const gates: Record<string, Promise<void>> = {
          alpha: new Promise<void>(resolve => (releaseAlpha = resolve)),
          beta: new Promise<void>(resolve => (releaseBeta = resolve)),
        };
        const memory = new MockMemory();
        const thread = { threadId: 'bg-suspend-sibling-thread', resourceId: 'bg-suspend-sibling-user' };
        const prompt = 'Research alpha and beta';
        const tool = createTool({
          id: 'research-with-approval',
          description: 'Research a topic after analyst approval',
          inputSchema: z.object({ topic: z.string() }),
          outputSchema: z.object({ summary: z.string() }),
          background: { enabled: true },
          execute: async ({ topic }, options) => {
            const resumeData = options?.agent?.resumeData as { notes?: string } | undefined;
            if (!resumeData) {
              await gates[topic];
              return options?.agent?.suspend?.({ awaiting: 'analyst-approval', topic }) as any;
            }
            return { summary: `Research on "${topic}": ${resumeData.notes}` };
          },
        });
        const { chunks, mastra, output } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt,
          tools: { researchWithApproval: tool },
          agentBackgroundTasks: { tools: { researchWithApproval: true } },
          backgroundTasks: BG_CONFIG,
          memory,
          ...thread,
          stopWhen: stepCountIs(3),
          collectChunks: true,
          fixtures: llm =>
            onReportTurns(llm, prompt, {
              dispatch: {
                toolCalls: [
                  { id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'alpha' } },
                  { id: 'call-bg-2', name: 'researchWithApproval', arguments: { topic: 'beta' } },
                ],
              },
              ack: 'Waiting for the analyst.',
              report: 'Alpha answered.',
            }),
        });
        expect(await output.text).toBe('Waiting for the analyst.');
        const manager = mastra.backgroundTaskManager!;
        const started = chunks!.filter(c => c.type === 'background-task-started') as Array<Chunk & { runId: string }>;
        expect(started).toHaveLength(2);
        const tasks = await Promise.all(started.map(c => manager.getTask(c.payload.taskId as string)));
        const taskFor = (topic: string) => tasks.find(t => (t?.args as { topic?: string })?.topic === topic)!.id;
        const alpha = taskFor('alpha');
        const beta = taskFor('beta');
        await waitForRunToRelease(mastra, started[0].runId);

        releaseAlpha();
        await waitFor(
          () => manager.getTask(alpha),
          (t: any) => t?.status === 'suspended',
        );
        await manager.resume(alpha, { notes: 'looks promising' });
        await waitFor(
          () => manager.getTask(alpha),
          (t: any) => t?.status === 'completed',
        );
        // The wake run reported the first tool and ended.
        await waitFor(storedText(memory, thread), s => s.includes('Alpha answered.'));
        await waitForRunToRelease(mastra, started[0].runId);

        releaseBeta();
        const parked = (await waitFor(
          () => manager.getTask(beta),
          (t: any) => t?.status !== 'pending' && t?.status !== 'running',
        )) as any;
        expect({ status: parked.status, error: parked.error?.message }).toEqual({
          status: 'suspended',
          error: undefined,
        });
        expect(parked.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'beta' });
      },
      30_000,
    );

    // Technical: one turn dispatches a deferred tool and also calls a tool that needs approval.
    // Approving it resumes the same run under a new claim generation, and only then does the
    // deferred tool call suspend(). The durable engine parks it. Known limit: the evented engine
    // counts the resume's claim as another execution's, so the task fails with "lost its
    // execution lease", as it does on main. Telling this resume from a real takeover would widen
    // this fix, so the evented result is pinned. Inngest isn't covered here. (#30182)
    it.runIf(engine === 'durable' || engine === 'evented')(
      'parks a deferred tool that asks for input after an approval in the same turn resumed the run (#30182)',
      async () => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => (release = resolve));
        const memory = new MockMemory();
        const llm = getMock();
        const thread = { threadId: 'bg-suspend-after-resume-thread', resourceId: 'bg-suspend-after-resume-user' };
        const lookup = createTool({
          id: 'lookup',
          description: 'Look up a user record',
          inputSchema: z.object({ name: z.string() }),
          outputSchema: z.object({ id: z.string() }),
          requireApproval: true,
          execute: async ({ name }) => ({ id: `user-${name}` }),
        });
        const shared = await createSharedAgent(llm, {
          tools: { researchWithApproval: makeSuspendingResearchTool([], undefined, gate), lookup },
          agentBackgroundTasks: { tools: { researchWithApproval: true } },
          backgroundTasks: BG_CONFIG,
          memory,
          engine,
        });
        const prompt = 'Research near and look up dero';
        // The mock server is shared by the suite. The previous test's agent still reports its parked
        // task to the model as that test ends, and a request landing here would take this turn's
        // tool calls. Answer only this thread's requests; aimock counts the sequence per predicate.
        const ownRequest = (req: unknown) => JSON.stringify(req).includes(prompt);
        llm.on(
          { endpoint: 'chat', predicate: ownRequest, sequenceIndex: 0 },
          {
            toolCalls: [
              { id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'near' } },
              { id: 'call-lookup-1', name: 'lookup', arguments: { name: 'dero' } },
            ],
          },
        );
        for (let i = 1; i < 8; i++) {
          llm.on({ endpoint: 'chat', predicate: ownRequest, sequenceIndex: i }, { content: `Reply ${i}.` });
        }

        const first = await runLoopScenario({
          engine,
          llm,
          prompt,
          sharedAgent: shared,
          fixtures: () => {},
          memory,
          ...thread,
          streamUntilIdle: true,
          manualStreamConsumption: true,
        });
        const firstChunks = await collectUntil(
          first.output.fullStream as ReadableStream<unknown>,
          'tool-call-approval',
        );
        const started = firstChunks.find(c => c.type === 'background-task-started');
        expect(firstChunks.find(c => c.type === 'tool-call-approval')?.payload.toolCallId).toBe('call-lookup-1');
        const taskId = started!.payload.taskId as string;
        const workflows = (await shared.mastra.getStorage()!.getStore('workflows'))!;
        const before = await workflows.getRunOwnership({ runId: first.output.runId });

        const resumed = await shared.agent.resumeStreamUntilIdle(
          { approved: true },
          {
            runId: first.output.runId,
            toolCallId: 'call-lookup-1',
            memory: { thread: thread.threadId, resource: thread.resourceId },
          },
        );
        // The resume claimed the same run again before the deferred tool suspends.
        await waitFor(
          () => workflows.getRunOwnership({ runId: first.output.runId }),
          o => o !== null && o.generation !== before?.generation,
        );
        release();
        const resumedChunks = collect(resumed.fullStream as AsyncIterable<unknown>);

        const parked = (await waitFor(
          () => shared.mastra.backgroundTaskManager!.getTask(taskId),
          (t: any) => t?.status !== 'pending' && t?.status !== 'running',
        )) as any;
        if (engine === 'durable') {
          expect({ status: parked.status, error: parked.error?.message }).toEqual({
            status: 'suspended',
            error: undefined,
          });
          expect(parked.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'near' });
        } else {
          expect(parked.status).toBe('failed');
          expect(parked.error?.message).toContain('lost its execution lease');
        }
        const lookupResult = (await resumedChunks).find(
          c => c.type === 'tool-result' && c.payload?.toolName === 'lookup',
        );
        expect(lookupResult?.payload.result).toEqual({ id: 'user-dero' });
      },
      60_000,
    );

    // Technical: the late suspend above is only allowed while no other execution has claimed the
    // run. Once a successor claims it, the old execution's suspension must not reach memory or
    // park the task, and the successor's claim must stay as it was. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "doesn't park a deferred tool that asks for input after another execution took over the run (#30182)",
      async () => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => (release = resolve));
        const memory = new MockMemory();
        const thread = { threadId: 'bg-suspend-after-takeover-thread', resourceId: 'bg-suspend-after-takeover-user' };
        const { chunks, mastra, output } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Research near',
          tools: { researchWithApproval: makeSuspendingResearchTool([], undefined, gate) },
          agentBackgroundTasks: { tools: { researchWithApproval: true } },
          backgroundTasks: BG_CONFIG,
          memory,
          ...thread,
          stopWhen: stepCountIs(3),
          collectChunks: true,
          fixtures: llm =>
            onReportTurns(llm, 'Research near', {
              dispatch: {
                toolCalls: [{ id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'near' } }],
              },
              ack: 'Waiting for the analyst.',
              report: 'The analyst answered.',
            }),
        });
        expect(await output.text).toBe('Waiting for the analyst.');
        const manager = mastra.backgroundTaskManager!;
        const started = chunks!.find(c => c.type === 'background-task-started') as Chunk & { runId: string };
        const taskId = started.payload.taskId as string;
        await waitForRunToRelease(mastra, started.runId);

        // Another execution claims the run, as a recovery or a new turn would.
        const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
        const released = await workflows.getRunOwnership({ runId: started.runId });
        const successor = await workflows.claimRunOwnership({
          runId: started.runId,
          ownerId: 'successor-execution',
          leaseMs: 60_000,
          expectedGeneration: released!.generation,
        });
        expect(successor.acquired).toBe(true);
        release();

        const settled = (await waitFor(
          () => manager.getTask(taskId),
          (t: any) => t?.status !== 'pending' && t?.status !== 'running',
        )) as any;
        expect({ status: settled.status, error: settled.error?.message }).toEqual({
          status: 'failed',
          // DURABLE_AGENT_EXECUTION_SUPERSEDED
          error: expect.stringContaining(`Durable run ${started.runId} lost its execution lease`),
        });
        expect(settled.suspendPayload).toBeUndefined();
        expect((await storedToolCall(memory, thread)).suspended).toBeUndefined();
        const after = await workflows.getRunOwnership({ runId: started.runId });
        expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
          ownerId: 'successor-execution',
          generation: successor.record.generation,
          live: true,
        });
      },
      30_000,
    );

    // Technical: with ownership only in a pubsub lease (storage without run fencing), a released
    // lease keeps no record, so it can't show whether another execution claimed and finished the
    // run since, and no storage fence stands behind the write. The late suspend keeps the strict
    // check: the task fails as before rather than write over a run a recovery finished. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "doesn't park a deferred tool that asks for input after its run finished when ownership is only a lease (#30182)",
      async () => {
        vi.spyOn(WorkflowsInMemory.prototype, 'supportsRunFencing').mockReturnValue(false);
        onTestFinished(() => vi.restoreAllMocks());
        let release!: () => void;
        const gate = new Promise<void>(resolve => (release = resolve));
        const memory = new MockMemory();
        const thread = { threadId: 'bg-suspend-lease-only-thread', resourceId: 'bg-suspend-lease-only-user' };
        const { chunks, mastra, agent, output } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Research near',
          tools: { researchWithApproval: makeSuspendingResearchTool([], undefined, gate) },
          agentBackgroundTasks: { tools: { researchWithApproval: true } },
          backgroundTasks: BG_CONFIG,
          memory,
          ...thread,
          stopWhen: stepCountIs(3),
          collectChunks: true,
          fixtures: llm =>
            onReportTurns(llm, 'Research near', {
              dispatch: {
                toolCalls: [{ id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'near' } }],
              },
              ack: 'Waiting for the analyst.',
              report: 'The analyst answered.',
            }),
        });
        expect(await output.text).toBe('Waiting for the analyst.');
        const manager = mastra.backgroundTaskManager!;
        const started = chunks!.find(c => c.type === 'background-task-started') as Chunk & { runId: string };
        const taskId = started.payload.taskId as string;
        const agentPubsub = (mastra.getAgentById(agent.id) as { pubsub?: PubSub }).pubsub ?? mastra.pubsub;
        const leases = resolveLeaseProvider(agentPubsub);
        const key = executionLeaseKey(agent.id, started.runId);
        // The run finished: its fence is gone and its lease released.
        await waitFor(
          async () => ({ fence: ExecutionFence.getLocalActive(started.runId), owner: await leases.getLeaseOwner(key) }),
          ({ fence, owner }) => fence === undefined && owner === undefined,
        );

        // Another process recovers the run, finishes it and releases the lease.
        expect((await leases.acquireLease(key, 'recovery-execution', 60_000)).acquired).toBe(true);
        await leases.releaseLease(key, 'recovery-execution');
        release();

        const settled = (await waitFor(
          () => manager.getTask(taskId),
          (t: any) => t?.status !== 'pending' && t?.status !== 'running',
        )) as any;
        const unverified = `Durable run ${started.runId}: could not verify that this execution still owns the run`;
        expect({ status: settled.status, error: settled.error?.message }).toEqual({
          status: 'failed',
          // DURABLE_AGENT_EXECUTION_UNVERIFIED
          error: expect.stringContaining(unverified),
        });
        expect(settled.suspendPayload).toBeUndefined();
        // Memory records the tool call as failed. The refused suspension's `suspendedTools` entry
        // still reaches memory next to that error, as it does on main (not yet investigated).
        const stored = await waitFor(
          () => storedToolCall(memory, thread),
          s => s.invocation?.state === 'output-error',
        );
        expect(stored.invocation.errorText).toContain(unverified);
      },
      30_000,
    );

    // Starts the deferred research tool, lets the run finish and release its claim, and holds
    // one cleanup step open, as slow storage would, until `finishCleanup`: retiring the run's
    // memory fence, releasing the thread's lease (evented, with a shared `pubsub`), or the claim
    // release itself, which storage has applied but not yet returned to the run. `cleanedUp`
    // resolves once the held step has finished. With `releaseAckFails`, the claim release is
    // applied in storage but its response fails, as a dropped connection would. With
    // `outcome: 'result'`, the tool returns a result once let go instead of asking for input.
    async function startResearchDuringCleanup(
      threadId: string,
      {
        hold = 'memory-fence',
        pubsub,
        releaseAckFails = false,
        outcome = 'suspend',
      }: {
        hold?: 'memory-fence' | 'thread-lease' | 'claim-release';
        pubsub?: PubSub;
        releaseAckFails?: boolean;
        outcome?: 'suspend' | 'result';
      } = {},
    ) {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      let finishCleanup!: () => void;
      const cleanupGate = new Promise<void>(resolve => (finishCleanup = resolve));
      let signalCleanedUp!: () => void;
      const cleanedUp = new Promise<void>(resolve => (signalCleanedUp = resolve));
      const memory = new MockMemory();
      const memoryStore = (await memory.storage.getStore('memory'))!;
      let retiring = false;
      const holdOpen = async <T>(step: () => Promise<T>): Promise<T> => {
        retiring = true;
        await cleanupGate;
        try {
          return await step();
        } finally {
          signalCleanedUp();
        }
      };
      if (releaseAckFails) {
        const releaseRunOwnership = WorkflowsInMemory.prototype.releaseRunOwnership;
        const spy = vi
          .spyOn(WorkflowsInMemory.prototype, 'releaseRunOwnership')
          .mockImplementationOnce(async function (this: WorkflowsInMemory, fence) {
            await releaseRunOwnership.call(this, fence);
            throw new Error('connection lost after the release was applied');
          });
        onTestFinished(() => spy.mockRestore());
      }
      if (hold === 'memory-fence') {
        const retireRunFence = memoryStore.retireRunFence.bind(memoryStore);
        vi.spyOn(memoryStore, 'retireRunFence').mockImplementation(fence => holdOpen(() => retireRunFence(fence)));
      } else if (hold === 'claim-release') {
        // The scenario builds its own store, so the hold goes on the in-memory workflows domain.
        const releaseRunOwnership = WorkflowsInMemory.prototype.releaseRunOwnership;
        const spy = vi
          .spyOn(WorkflowsInMemory.prototype, 'releaseRunOwnership')
          .mockImplementation(async function (this: WorkflowsInMemory, fence) {
            const released = await releaseRunOwnership.call(this, fence);
            return holdOpen(async () => released);
          });
        onTestFinished(() => spy.mockRestore());
      } else {
        const releaseLease = agentThreadStreamRuntime.releaseDurableThreadLease.bind(agentThreadStreamRuntime);
        const spy = vi
          .spyOn(agentThreadStreamRuntime, 'releaseDurableThreadLease')
          .mockImplementation((...args) => holdOpen(() => releaseLease(...args)));
        onTestFinished(() => spy.mockRestore());
      }
      const thread = { threadId, resourceId: `${threadId}-user` };
      const researchTool =
        outcome === 'result'
          ? createTool({
              id: 'research-with-approval',
              description: 'Research a topic',
              inputSchema: z.object({ topic: z.string() }),
              outputSchema: z.object({ summary: z.string() }),
              background: { enabled: true },
              execute: async ({ topic }) => {
                await gate;
                return { summary: `Research on "${topic}"` };
              },
            })
          : makeSuspendingResearchTool([], undefined, gate);
      const { chunks, mastra, output } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research near',
        tools: { researchWithApproval: researchTool },
        agentBackgroundTasks: { tools: { researchWithApproval: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        ...thread,
        ...(pubsub ? { pubsub } : {}),
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: llm =>
          onReportTurns(llm, 'Research near', {
            dispatch: {
              toolCalls: [{ id: 'call-bg-1', name: 'researchWithApproval', arguments: { topic: 'near' } }],
            },
            ack: 'Waiting for the analyst.',
            report: 'The analyst answered.',
          }),
      });
      expect(await output.text).toBe('Waiting for the analyst.');
      const started = chunks!.find(c => c.type === 'background-task-started') as Chunk & { runId: string };
      await waitForRunToRelease(mastra, started.runId);
      await waitFor(
        async () => retiring,
        isRetiring => isRetiring,
      );
      const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
      const settledTask = async () =>
        (await waitFor(
          () => mastra.backgroundTaskManager!.getTask(started.payload.taskId as string),
          (t: any) => t?.status !== 'pending' && t?.status !== 'running',
        )) as any;
      return {
        memory,
        memoryStore,
        thread,
        workflows,
        runId: started.runId,
        release,
        finishCleanup,
        cleanedUp,
        settledTask,
      };
    }

    // Waits until a held memory save is on its way to storage. A regression that fails the task
    // before it saves would otherwise leave the test waiting until its 30 s timeout.
    async function untilSaveHeld(saveStarted: Promise<void>): Promise<void> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('save never reached storage')), 2_000);
      });
      try {
        await Promise.race([saveStarted, timedOut]);
      } finally {
        clearTimeout(timer);
      }
    }

    // Technical: a finished run releases its claim, then retires its memory fence. Until that
    // retirement resolves, the execution stays registered in this process, and the late suspend's
    // check asked it to prove it still held the claim it had just released, so the task failed
    // with DURABLE_AGENT_EXECUTION_SUPERSEDED though no other execution had claimed the run. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      'parks a deferred tool that asks for input while the finished run is still cleaning up (#30182)',
      async () => {
        const run = await startResearchDuringCleanup('bg-suspend-during-cleanup-thread');
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        run.release();
        try {
          const parked = await run.settledTask();
          expect({ status: parked.status, error: parked.error?.message }).toEqual({
            status: 'suspended',
            error: undefined,
          });
          expect(parked.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'near' });
          const open = await waitFor(
            () => storedToolCall(run.memory, run.thread),
            s => s.suspended?.taskId !== undefined,
          );
          expect(open.suspended).toMatchObject({ taskId: parked.id });
          // Accepting the late suspend left the released claim as it was.
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: released?.ownerId,
            generation: released?.generation,
            live: false,
          });
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: the cleanup window above must not let a superseded execution through: once a
    // successor claims the run, the late suspend still fails without writing. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "doesn't park a deferred tool that asks for input after another execution took over a run still cleaning up (#30182)",
      async () => {
        const run = await startResearchDuringCleanup('bg-suspend-cleanup-takeover-thread');
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        const successor = await run.workflows.claimRunOwnership({
          runId: run.runId,
          ownerId: 'successor-execution',
          leaseMs: 60_000,
          expectedGeneration: released!.generation,
        });
        expect(successor.acquired).toBe(true);
        run.release();
        try {
          const settled = await run.settledTask();
          expect({ status: settled.status, error: settled.error?.message }).toEqual({
            status: 'failed',
            // DURABLE_AGENT_EXECUTION_SUPERSEDED
            error: expect.stringContaining(`Durable run ${run.runId} lost its execution lease`),
          });
          expect(settled.suspendPayload).toBeUndefined();
          expect((await storedToolCall(run.memory, run.thread)).suspended).toBeUndefined();
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: 'successor-execution',
            generation: successor.record.generation,
            live: true,
          });
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: the late suspend's ownership check passes while no successor exists, but its
    // memory save can reach storage later. A finished run stops fencing its own writes once it
    // settles, so the save went through unfenced: a successor that claimed the run and raised the
    // memory fence in between found the old execution's suspension in memory and the task parked.
    // The save now carries the finished run's claim, and storage rejects it. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "doesn't park a deferred tool whose suspension reaches storage after another execution took over (#30182)",
      async () => {
        const run = await startResearchDuringCleanup('bg-suspend-slow-save-takeover-thread');
        let signalSaveStarted!: () => void;
        const saveStarted = new Promise<void>(resolve => (signalSaveStarted = resolve));
        let finishSave!: () => void;
        const saveGate = new Promise<void>(resolve => (finishSave = resolve));
        const saveMessages = run.memoryStore.saveMessages.bind(run.memoryStore);
        vi.spyOn(run.memoryStore, 'saveMessages').mockImplementation(async args => {
          signalSaveStarted();
          await saveGate;
          return saveMessages(args);
        });
        try {
          run.release();
          // The suspension passed its ownership check; its save is on the way to storage.
          await untilSaveHeld(saveStarted);
          // The finished run completes its cleanup. Then a successor claims the run and raises
          // the memory fence, as recovery or a new turn does before it touches memory.
          run.finishCleanup();
          await run.cleanedUp;
          const released = await run.workflows.getRunOwnership({ runId: run.runId });
          const successor = await run.workflows.claimRunOwnership({
            runId: run.runId,
            ownerId: 'successor-execution',
            leaseMs: 60_000,
            expectedGeneration: released!.generation,
          });
          expect(successor.acquired).toBe(true);
          const successorFence = {
            runId: run.runId,
            generation: successor.record!.generation,
            ownerId: successor.record!.ownerId,
          };
          expect(await run.memoryStore.raiseRunFence(successorFence)).toBe(true);
          finishSave();

          const settled = await run.settledTask();
          expect({ status: settled.status, error: settled.error?.message }).toEqual({
            status: 'failed',
            // STORAGE_RUN_FENCE_CONFLICT
            error: expect.stringContaining("is no longer the run's current claim"),
          });
          expect(settled.suspendPayload).toBeUndefined();
          expect((await storedToolCall(run.memory, run.thread)).suspended).toBeUndefined();
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: 'successor-execution',
            generation: successor.record!.generation,
            live: true,
          });
        } finally {
          finishSave();
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: settlement releases the claim, and only once storage's release call returns
    // did the run count as released. The late suspend checked ownership in between: storage
    // already showed the claim released, so the strict check failed and marked the execution
    // lost though nobody had taken over. Waiting for the release's reply instead left the task
    // running for as long as that reply took, forever on a stalled connection. Here the reply is
    // held until the task has settled. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "parks a deferred tool that asks for input while the finished run's claim release has not returned (#30182)",
      async () => {
        const run = await startResearchDuringCleanup('bg-suspend-during-claim-release-thread', {
          hold: 'claim-release',
        });
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        expect(released?.live).toBe(false);
        run.release();
        try {
          // The release's reply is still held: the task settles without it.
          const parked = await run.settledTask();
          expect({ status: parked.status, error: parked.error?.message }).toEqual({
            status: 'suspended',
            error: undefined,
          });
          expect(parked.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'near' });
          const open = await waitFor(
            () => storedToolCall(run.memory, run.thread),
            s => s.suspended?.taskId !== undefined,
          );
          expect(open.suspended).toMatchObject({ taskId: parked.id });
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: released?.ownerId,
            generation: released?.generation,
            live: false,
          });
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: accepting a late suspend before the release's reply returns must not let a
    // superseded execution through: a successor that claimed the run during the release still
    // makes the late suspend fail without writing. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "doesn't park a deferred tool that asks for input after another execution took over a run whose claim release has not returned (#30182)",
      async () => {
        const run = await startResearchDuringCleanup('bg-suspend-claim-release-takeover-thread', {
          hold: 'claim-release',
        });
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        const successor = await run.workflows.claimRunOwnership({
          runId: run.runId,
          ownerId: 'successor-execution',
          leaseMs: 60_000,
          expectedGeneration: released!.generation,
        });
        expect(successor.acquired).toBe(true);
        run.release();
        try {
          const settled = await run.settledTask();
          expect({ status: settled.status, error: settled.error?.message }).toEqual({
            status: 'failed',
            // DURABLE_AGENT_EXECUTION_SUPERSEDED
            error: expect.stringContaining(`Durable run ${run.runId} lost its execution lease`),
          });
          expect(settled.suspendPayload).toBeUndefined();
          expect((await storedToolCall(run.memory, run.thread)).suspended).toBeUndefined();
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: 'successor-execution',
            generation: successor.record.generation,
            live: true,
          });
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: storage applied the finished run's claim release, but the response failed, as a
    // dropped connection would. The fence treated the release as never made and stayed strict, so
    // a late suspend during the remaining cleanup read the released claim, marked the execution
    // lost though nobody had taken over, and the task failed before it suspended. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      'parks a deferred tool that asks for input after the finished run lost the reply to its claim release (#30182)',
      async () => {
        const run = await startResearchDuringCleanup('bg-suspend-after-lost-release-ack-thread', {
          releaseAckFails: true,
        });
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        expect(released).toMatchObject({ leaseExpiresAt: null, live: false });
        run.release();
        try {
          const parked = await run.settledTask();
          expect({ status: parked.status, error: parked.error?.message }).toEqual({
            status: 'suspended',
            error: undefined,
          });
          expect(parked.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'near' });
          const open = await waitFor(
            () => storedToolCall(run.memory, run.thread),
            s => s.suspended?.taskId !== undefined,
          );
          expect(open.suspended).toMatchObject({ taskId: parked.id });
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: released?.ownerId,
            generation: released?.generation,
            live: false,
          });
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: counting a release whose reply was lost as made must not let a superseded
    // execution through: once a successor claims the run, the late suspend fails without
    // writing. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "doesn't park a deferred tool that asks for input after another execution took over a run that lost the reply to its claim release (#30182)",
      async () => {
        const run = await startResearchDuringCleanup('bg-suspend-lost-release-ack-takeover-thread', {
          releaseAckFails: true,
        });
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        const successor = await run.workflows.claimRunOwnership({
          runId: run.runId,
          ownerId: 'successor-execution',
          leaseMs: 60_000,
          expectedGeneration: released!.generation,
        });
        expect(successor.acquired).toBe(true);
        run.release();
        try {
          const settled = await run.settledTask();
          expect({ status: settled.status, error: settled.error?.message }).toEqual({
            status: 'failed',
            // DURABLE_AGENT_EXECUTION_SUPERSEDED
            error: expect.stringContaining(`Durable run ${run.runId} lost its execution lease`),
          });
          expect(settled.suspendPayload).toBeUndefined();
          expect((await storedToolCall(run.memory, run.thread)).suspended).toBeUndefined();
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: 'successor-execution',
            generation: successor.record.generation,
            live: true,
          });
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: a background task's result is written to memory through the same post-settlement
    // check as a late suspend. While the finished run is still cleaning up, that check now accepts
    // the write when nobody has taken over, so the result reaches memory. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "records a deferred tool's result that arrives while the finished run is still cleaning up (#30182)",
      async () => {
        const run = await startResearchDuringCleanup('bg-result-during-cleanup-thread', { outcome: 'result' });
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        run.release();
        try {
          const done = await run.settledTask();
          expect({ status: done.status, error: done.error?.message }).toEqual({
            status: 'completed',
            error: undefined,
          });
          expect(done.result).toEqual({ summary: 'Research on "near"' });
          // The dispatch left a placeholder result; the task's own result replaces it.
          const answered = await waitFor(
            () => storedToolCall(run.memory, run.thread),
            s => s.invocation?.result?.summary !== undefined,
          );
          expect(answered.invocation).toMatchObject({ state: 'result', result: { summary: 'Research on "near"' } });
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation }).toEqual({
            ownerId: released?.ownerId,
            generation: released?.generation,
          });
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Holds the `nth` memory save (counting from 1) until `finishSave`. `saveStarted` resolves once
    // it is held; `saveOutcome` resolves once it reached storage, to its error or `undefined`.
    function holdMemorySave(memoryStore: MemoryStorage, nth: number) {
      let signalSaveStarted!: () => void;
      const saveStarted = new Promise<void>(resolve => (signalSaveStarted = resolve));
      let finishSave!: () => void;
      const saveGate = new Promise<void>(resolve => (finishSave = resolve));
      let settleOutcome!: (error: unknown) => void;
      const saveOutcome = new Promise<unknown>(resolve => (settleOutcome = resolve));
      const saveMessages = memoryStore.saveMessages.bind(memoryStore);
      let saves = 0;
      const spy = vi.spyOn(memoryStore, 'saveMessages').mockImplementation(async args => {
        if (++saves !== nth) return saveMessages(args);
        signalSaveStarted();
        await saveGate;
        try {
          const saved = await saveMessages(args);
          settleOutcome(undefined);
          return saved;
        } catch (error) {
          settleOutcome(error);
          throw error;
        }
      });
      onTestFinished(() => {
        finishSave();
        spy.mockRestore();
      });
      return { saveStarted, finishSave, saveOutcome, saveMessages };
    }

    // The finished run completes its cleanup. Then a successor claims the run and raises the
    // memory fence, as recovery or a new turn does before it touches memory.
    async function takeOverAfterCleanup(run: Awaited<ReturnType<typeof startResearchDuringCleanup>>) {
      run.finishCleanup();
      await run.cleanedUp;
      const released = await run.workflows.getRunOwnership({ runId: run.runId });
      const successor = await run.workflows.claimRunOwnership({
        runId: run.runId,
        ownerId: 'successor-execution',
        leaseMs: 60_000,
        expectedGeneration: released!.generation,
      });
      expect(successor.acquired).toBe(true);
      expect(
        await run.memoryStore.raiseRunFence({
          runId: run.runId,
          generation: successor.record!.generation,
          ownerId: successor.record!.ownerId,
        }),
      ).toBe(true);
      return successor.record!;
    }

    async function expectSuccessorUnchanged(
      run: Awaited<ReturnType<typeof startResearchDuringCleanup>>,
      successor: { generation: number },
    ) {
      const after = await run.workflows.getRunOwnership({ runId: run.runId });
      expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
        ownerId: 'successor-execution',
        generation: successor.generation,
        live: true,
      });
    }

    // Technical: after a late suspend saves its open request, the background-task manager saves
    // the task's metadata again (`onExecution`). That save passed the post-settlement check but
    // reached storage only after the finished run's cleanup and a successor's claim, which raised
    // the memory fence and cleared the request. It carried no claim fence, so it restored the
    // superseded execution's open request. It now carries the finished run's claim. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "doesn't restore a deferred tool's open request when its task metadata reaches storage after another execution took over (#30182)",
      async () => {
        const run = await startResearchDuringCleanup('bg-suspend-slow-metadata-save-takeover-thread');
        // The first save is the suspension's own; the second is the manager's metadata save.
        const save = holdMemorySave(run.memoryStore, 2);
        try {
          run.release();
          await untilSaveHeld(save.saveStarted);
          const successor = await takeOverAfterCleanup(run);
          // The successor works on the thread: here it drops the open request.
          const { messages } = await run.memoryStore.listMessages({ ...run.thread, perPage: false });
          const cleared = structuredClone(messages);
          for (const message of cleared) delete message.content.metadata?.suspendedTools;
          await save.saveMessages({ messages: cleared });
          expect((await storedToolCall(run.memory, run.thread)).suspended).toBeUndefined();

          save.finishSave();
          expect(await save.saveOutcome).toMatchObject({ id: RUN_FENCE_CONFLICT_ERROR_ID });
          expect((await storedToolCall(run.memory, run.thread)).suspended).toBeUndefined();
          await expectSuccessorUnchanged(run, successor);
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: a background task's result reaches memory through the same post-settlement check
    // as a late suspend. A result save that passed it but reached storage after a successor
    // claimed the run and raised the memory fence went through, since it carried no claim fence,
    // so a superseded execution wrote the tool's result. It now carries the finished run's
    // claim. (#30182)
    it.runIf(isDurableEngineVariant(engine))(
      "doesn't record a deferred tool's result that reaches storage after another execution took over (#30182)",
      async () => {
        const run = await startResearchDuringCleanup('bg-result-slow-save-takeover-thread', { outcome: 'result' });
        const save = holdMemorySave(run.memoryStore, 1);
        try {
          run.release();
          await untilSaveHeld(save.saveStarted);
          const successor = await takeOverAfterCleanup(run);

          save.finishSave();
          expect(await save.saveOutcome).toMatchObject({ id: RUN_FENCE_CONFLICT_ERROR_ID });
          // Memory keeps the dispatch placeholder, not the superseded execution's result.
          expect((await storedToolCall(run.memory, run.thread)).invocation?.result?.summary).toBeUndefined();
          await expectSuccessorUnchanged(run, successor);
        } finally {
          run.finishCleanup();
        }
      },
      30_000,
    );

    // Technical: on a shared transport, an evented run's worker releases the run's claim, then
    // the thread's lease, and only then stops its participant fence. Until the lease release
    // returns, that fence stays registered, and the late suspend's check asked it to prove it
    // still held the claim it had just released, so the task failed with
    // DURABLE_AGENT_EXECUTION_SUPERSEDED though nobody took over. (#30182)
    it.runIf(engine === 'evented')(
      'parks a deferred tool that asks for input while a shared evented run is still releasing its thread (#30182)',
      async () => {
        const directory = await mkdtemp(join(tmpdir(), 'mastra-30182-'));
        const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
        const run = await startResearchDuringCleanup('bg-suspend-during-lease-release-thread', {
          hold: 'thread-lease',
          pubsub,
        });
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        run.release();
        try {
          const parked = await run.settledTask();
          expect({ status: parked.status, error: parked.error?.message }).toEqual({
            status: 'suspended',
            error: undefined,
          });
          expect(parked.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'near' });
          const open = await waitFor(
            () => storedToolCall(run.memory, run.thread),
            s => s.suspended?.taskId !== undefined,
          );
          expect(open.suspended).toMatchObject({ taskId: parked.id });
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: released?.ownerId,
            generation: released?.generation,
            live: false,
          });
        } finally {
          run.finishCleanup();
          await run.cleanedUp;
          await pubsub.close();
          await rm(directory, { recursive: true, force: true });
        }
      },
      30_000,
    );

    // Technical: the same in-flight release as above, on the worker's participant fence: an
    // evented worker on a shared transport releases the run's claim itself, and a late suspend
    // that read the released claim before that release returned marked the execution lost, or
    // waited on the release's reply. The reply is held until the task has settled. (#30182)
    it.runIf(engine === 'evented')(
      "parks a deferred tool that asks for input while a shared evented run's claim release has not returned (#30182)",
      async () => {
        const directory = await mkdtemp(join(tmpdir(), 'mastra-30182-'));
        const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
        const run = await startResearchDuringCleanup('bg-suspend-during-shared-claim-release-thread', {
          hold: 'claim-release',
          pubsub,
        });
        const released = await run.workflows.getRunOwnership({ runId: run.runId });
        run.release();
        try {
          const parked = await run.settledTask();
          expect({ status: parked.status, error: parked.error?.message }).toEqual({
            status: 'suspended',
            error: undefined,
          });
          expect(parked.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'near' });
          const open = await waitFor(
            () => storedToolCall(run.memory, run.thread),
            s => s.suspended?.taskId !== undefined,
          );
          expect(open.suspended).toMatchObject({ taskId: parked.id });
          const after = await run.workflows.getRunOwnership({ runId: run.runId });
          expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
            ownerId: released?.ownerId,
            generation: released?.generation,
            live: false,
          });
        } finally {
          run.finishCleanup();
          await run.cleanedUp;
          await pubsub.close();
          await rm(directory, { recursive: true, force: true });
        }
      },
      30_000,
    );

    // Technical: same path as above, reached through a deferred sub-agent: when its tool needs
    // approval, the delegation tool suspends the background task with that approval. (#30182)
    it('parks a deferred sub-agent whose tool needs approval after the reply was sent, and resumes it (#30182)', async () => {
      const mock = getMock();
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const published: string[] = [];
      const publishTool = createTool({
        id: 'publish',
        description: 'Publish a post',
        inputSchema: z.object({ title: z.string() }),
        requireApproval: true,
        execute: async ({ title }) => {
          published.push(title);
          return { published: title };
        },
      });
      const helper = new Agent({
        id: 'helper',
        name: 'Helper',
        description: 'Publishes posts',
        instructions: 'Publish posts with publishTool.',
        model: openai(SCENARIO_MODEL_ID),
        tools: { publishTool },
        // Holds the sub-agent until the supervisor's run is over.
        inputProcessors: [
          {
            id: 'wait-for-supervisor',
            processInput: async ({ messages }) => {
              await gate;
              return messages;
            },
          },
        ],
      });
      const toolNames = (req: any): string[] => (req?.tools ?? []).map((t: any) => t.function?.name);
      const isSupervisor = (req: unknown) => toolNames(req).includes('agent-helper');
      const isHelper = (req: unknown) => toolNames(req).includes('publishTool');
      const memory = new MockMemory();
      const thread = { threadId: 'bg-subagent-approval-thread', resourceId: 'bg-subagent-approval-user' };
      const { chunks, mastra, output } = await runLoopScenario({
        engine,
        llm: mock,
        prompt: 'Publish the launch post',
        agents: { helper },
        agentBackgroundTasks: { tools: { helper: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', predicate: (req: unknown) => isSupervisor(req) && !hasToolResult(req) },
            { toolCalls: [{ id: 'call-bg-1', name: 'agent-helper', arguments: { prompt: 'Publish "Launch"' } }] },
          );
          llm.on(
            { endpoint: 'chat', predicate: (req: unknown) => isSupervisor(req) && hasToolResult(req) },
            { content: 'Handed to the helper.' },
          );
          llm.on(
            { endpoint: 'chat', predicate: (req: unknown) => isHelper(req) && !hasToolResult(req) },
            { toolCalls: [{ id: 'call-publish-1', name: 'publishTool', arguments: { title: 'Launch' } }] },
          );
          llm.on(
            { endpoint: 'chat', predicate: (req: unknown) => isHelper(req) && hasToolResult(req) },
            { content: 'Published Launch.' },
          );
        },
      });
      expect(await output.text).toBe('Handed to the helper.');
      const manager = mastra.backgroundTaskManager!;
      const started = chunks!.find(c => c.type === 'background-task-started') as Chunk & { runId: string };
      const taskId = started.payload.taskId as string;
      await waitForRunToRelease(mastra, started.runId);
      release();

      const parked = (await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status !== 'pending' && t?.status !== 'running',
      )) as any;
      expect({ status: parked.status, error: parked.error?.message }).toEqual({
        status: 'suspended',
        error: undefined,
      });
      expect(published).toEqual([]);

      await manager.resume(taskId, { approved: true });
      const done = (await waitFor(
        () => manager.getTask(taskId),
        (t: any) => t?.status !== 'suspended' && t?.status !== 'running' && t?.status !== 'pending',
      )) as any;
      expect({ status: done.status, error: done.error?.message }).toEqual({ status: 'completed', error: undefined });
      expect(published).toEqual(['Launch']);
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

    // Technical: the finish signal woke the thread with no request context, so a model
    // resolved from it could not be picked and the user got no report. (#29032)
    it('reports a deferred task with the model the request picked when it finishes after the stream ended (#29032)', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const thread = { threadId: 'bg-wake-context-thread', resourceId: 'bg-wake-context-user' };
      const prompt = 'Research superconductors for my workspace';
      const llm = getMock();
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const requestContext = new RequestContext();
      requestContext.set('workspace-model', 'workspace-model-1');
      const { chunks, mastra } = await runLoopScenario({
        engine,
        llm,
        prompt,
        model: ({ requestContext }: { requestContext: RequestContext }) => {
          const modelId = requestContext.get('workspace-model') as string | undefined;
          if (!modelId) throw new Error('No model configured for this request');
          return openai(modelId);
        },
        requestContext,
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: mock =>
          onReportTurns(mock, prompt, {
            dispatch: { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'superconductors' } }] },
            ack: 'Working on it.',
            report: 'The superconductor research is finished.',
          }),
      });
      const taskId = (chunks!.find(c => c.type === 'background-task-started') as Chunk).payload.taskId as string;
      expect(requestsFor(llm, prompt)).toHaveLength(2);

      release();
      await waitFor(
        () => mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );

      await waitFor(storedText(memory, thread), s => s.includes('The superconductor research is finished.'));
      const requests = requestsFor(llm, prompt);
      expect(requests).toHaveLength(3);
      expect((requests[2]!.body as any).model).toBe('workspace-model-1');
    }, 30_000);

    it("doesn't signal a finished deferred task when the app delivers its own notification (#28986)", async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const finished: string[] = [];
      const { chunks, mastra, llm } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Research optics on its own',
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: {
          ...BG_CONFIG,
          notifyAgentOnFinish: false,
          onTaskComplete: task => void finished.push(task.id),
        },
        memory: new MockMemory(),
        threadId: 'bg-no-notify-thread',
        resourceId: 'bg-no-notify-user',
        stopWhen: stepCountIs(3),
        collectChunks: true,
        fixtures: mock =>
          onReportTurns(mock, 'Research optics on its own', {
            dispatch: { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'optics' } }] },
            ack: 'Working on it.',
            report: 'The optics research is finished.',
          }),
      });
      const taskId = (chunks!.find(c => c.type === 'background-task-started') as Chunk).payload.taskId as string;

      release();
      await waitFor(
        () => mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      await waitFor(
        () => finished,
        ids => ids.includes(taskId),
      );
      // A wake would reach the model within this window (the waking test sees it in well under it).
      await new Promise(resolve => setTimeout(resolve, 1_000));

      expect(requestsFor(llm, 'Research optics on its own')).toHaveLength(2);
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

    // Technical: another agent's run suspended on the thread (awaiting approval), so the finish
    // signal resolved `blocked` and was dropped instead of queued behind that run. (#29032)
    it("reports a deferred task that finishes while another agent's run waits for approval on the thread, once that run ends (#29032)", async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const llm = getMock();
      const thread = { threadId: 'bg-blocked-thread', resourceId: 'bg-blocked-user' };
      const prompt = 'Research glaciers for the report';
      const reviewerModel = 'reviewer-model';
      const shared = await createSharedAgent(llm, {
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        engine,
      });

      // A second agent on the same thread, whose run waits for approval while the research finishes.
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const reviewer = new Agent({
        id: 'bg-blocked-reviewer',
        name: 'Reviewer',
        instructions: 'You review the thread.',
        model: openai(reviewerModel),
        memory,
        tools: {
          publishReview: createTool({
            id: 'publish-review',
            description: 'Publish the review',
            inputSchema: z.object({}),
            outputSchema: z.object({ ok: z.boolean() }),
            requireApproval: true,
            execute: async () => ({ ok: true }),
          }),
        },
      });
      shared.mastra.addAgent(reviewer, 'bg-blocked-reviewer');

      const isReviewer = (req: unknown) => (req as any)?.model === reviewerModel;
      const mentions = (req: unknown, text: string) => JSON.stringify(req).includes(text);
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => isReviewer(req) && !mentions(req, 'call-fg-1') },
        { toolCalls: [{ id: 'call-fg-1', name: 'publishReview', arguments: {} }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => isReviewer(req) && mentions(req, 'call-fg-1') },
        { content: 'Review published.' },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isReviewer(req) && mentions(req, FINISH_SIGNAL) },
        { content: 'The glacier research is finished.' },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isReviewer(req) && !hasToolResult(req) },
        { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'glaciers' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isReviewer(req) && hasToolResult(req) },
        { content: 'Working on it.' },
      );

      const first = await runLoopScenario({
        engine,
        llm,
        prompt,
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        collectChunks: true,
      });
      const taskId = (first.chunks!.find(c => c.type === 'background-task-started') as Chunk).payload.taskId as string;

      const registeredReviewer = shared.mastra.getAgent('bg-blocked-reviewer');
      const review = await registeredReviewer.stream('Review the thread', {
        memory: { thread: thread.threadId, resource: thread.resourceId },
        maxSteps: 3,
      });
      const reviewChunks = await collect(review.fullStream as AsyncIterable<unknown>);
      expect(reviewChunks.some(c => c.type === 'tool-call-approval')).toBe(true);

      release();
      await waitFor(
        () => shared.mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      // The finish notice is sent while the reviewer's run still holds the thread.
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(await storedText(memory, thread)()).not.toContain('The glacier research is finished.');

      const resumed = await registeredReviewer.approveToolCall({ runId: review.runId, toolCallId: 'call-fg-1' });
      expect(await resumed.text).toBe('Review published.');

      await waitFor(storedText(memory, thread), s => s.includes('The glacier research is finished.'));
      const report = requestsFor(llm, prompt).find(r => !isReviewer(r.body) && mentions(r.body, FINISH_SIGNAL));
      expect(JSON.stringify((report!.body as any).messages)).toContain(
        `Background task ${taskId} for tool call call-bg-1 (research) has completed`,
      );
    }, 30_000);

    // Technical: a newer untilIdle stream on the thread closed the waiting one as `replaced`, which
    // marked its running task as caller-stopped; when the newer stream couldn't adopt the task,
    // the task's finish never woke the agent. (#29032)
    it('reports a deferred task when the newer untilIdle stream that replaced the one waiting for it stops waiting first (#29032)', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const llm = getMock();
      const thread = { threadId: 'bg-replaced-thread', resourceId: 'bg-replaced-user' };
      const prompt = 'Research coral reefs';
      const laterPrompt = 'Say hello meanwhile';
      const shared = await createSharedAgent(llm, {
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        // Short enough that the newer stream gives up waiting before the task finishes.
        backgroundTasks: { ...BG_CONFIG, untilIdleMaxIdleMs: 2_000 },
        memory,
        engine,
      });

      const mentions = (req: unknown, text: string) => JSON.stringify(req).includes(text);
      const lastUserMessage = (req: unknown) =>
        ((req as any)?.messages ?? []).filter((m: any) => m.role === 'user').at(-1)?.content;
      const isLater = (req: unknown) => lastUserMessage(req) === laterPrompt;
      llm.on({ endpoint: 'chat', predicate: (req: unknown) => isLater(req) }, { content: 'Hello.' });
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isLater(req) && mentions(req, FINISH_SIGNAL) },
        { content: 'The coral research is finished.' },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isLater(req) && !hasToolResult(req) },
        { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'coral reefs' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isLater(req) && hasToolResult(req) },
        { content: 'Working on it.' },
      );

      const first = await runLoopScenario({
        engine,
        llm,
        prompt,
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        streamUntilIdle: true,
        manualStreamConsumption: true,
      });
      const firstChunks: Chunk[] = [];
      const firstDone = (async () => {
        for await (const chunk of first.output.fullStream as AsyncIterable<unknown>) firstChunks.push(chunk as Chunk);
      })();
      await vi.waitFor(() => expect(firstChunks.some(c => c.type === 'background-task-started')).toBe(true), {
        timeout: 10_000,
      });
      await waitFor(storedText(memory, thread), s => s.includes('Working on it.'));
      const taskId = firstChunks.find(c => c.type === 'background-task-started')!.payload.taskId as string;

      const later = await runLoopScenario({
        engine,
        llm,
        prompt: laterPrompt,
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        streamUntilIdle: true,
        manualStreamConsumption: true,
      });
      expect(textOf(await collect(later.output.fullStream as AsyncIterable<unknown>))).toContain('Hello.');
      await firstDone;

      release();
      await waitFor(
        () => shared.mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      await waitFor(storedText(memory, thread), s => s.includes('The coral research is finished.'));
    }, 30_000);

    it("doesn't wake the agent for a deferred task when the caller stops the newer untilIdle stream that replaced the one waiting for it", async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const llm = getMock();
      const thread = { threadId: 'bg-replaced-stop-thread', resourceId: 'bg-replaced-stop-user' };
      const prompt = 'Research coral reefs';
      const laterPrompt = 'Say hello meanwhile';
      const shared = await createSharedAgent(llm, {
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory,
        engine,
      });

      const lastUserMessage = (req: unknown) =>
        ((req as any)?.messages ?? []).filter((m: any) => m.role === 'user').at(-1)?.content;
      const isLater = (req: unknown) => lastUserMessage(req) === laterPrompt;
      llm.on({ endpoint: 'chat', predicate: (req: unknown) => isLater(req) }, { content: 'Hello.' });
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isLater(req) && JSON.stringify(req).includes(FINISH_SIGNAL) },
        { content: 'The coral research is finished.' },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isLater(req) && !hasToolResult(req) },
        { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'coral reefs' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => !isLater(req) && hasToolResult(req) },
        { content: 'Working on it.' },
      );

      const first = await runLoopScenario({
        engine,
        llm,
        prompt,
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        streamUntilIdle: true,
        manualStreamConsumption: true,
      });
      const firstChunks: Chunk[] = [];
      const firstDone = (async () => {
        for await (const chunk of first.output.fullStream as AsyncIterable<unknown>) firstChunks.push(chunk as Chunk);
      })();
      await vi.waitFor(() => expect(firstChunks.some(c => c.type === 'background-task-started')).toBe(true), {
        timeout: 10_000,
      });
      await waitFor(storedText(memory, thread), s => s.includes('Working on it.'));
      const taskId = firstChunks.find(c => c.type === 'background-task-started')!.payload.taskId as string;

      // The newer stream's lookup of the thread's running tasks hasn't answered when its caller stops it.
      vi.spyOn(shared.mastra.backgroundTaskManager!, 'listTasks').mockReturnValueOnce(new Promise(() => {}));
      const later = await runLoopScenario({
        engine,
        llm,
        prompt: laterPrompt,
        sharedAgent: shared,
        fixtures: () => {},
        memory,
        ...thread,
        stopWhen: stepCountIs(3),
        streamUntilIdle: true,
        manualStreamConsumption: true,
      });
      for await (const chunk of later.output.fullStream as AsyncIterable<unknown>) {
        if ((chunk as Chunk).type === 'finish') break;
      }
      await firstDone;

      release();
      await waitFor(
        () => shared.mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(JSON.stringify(llm.getRequests().map(r => r.body))).not.toContain(FINISH_SIGNAL);
    }, 30_000);

    it("doesn't wake the agent for a deferred task when the caller stops the untilIdle stream waiting for it", async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const llm = getMock();
      const prompt = 'Research volcanoes';
      const { output, mastra } = await runLoopScenario({
        engine,
        llm,
        prompt,
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: BG_CONFIG,
        memory: new MockMemory(),
        threadId: 'bg-stopped-thread',
        resourceId: 'bg-stopped-user',
        stopWhen: stepCountIs(3),
        streamUntilIdle: true,
        manualStreamConsumption: true,
        fixtures: mock =>
          onReportTurns(mock, prompt, {
            dispatch: { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: 'volcanoes' } }] },
            ack: 'Working on it.',
            report: 'The volcano research is finished.',
          }),
      });
      let taskId = '';
      for await (const chunk of output.fullStream as AsyncIterable<unknown>) {
        if ((chunk as Chunk).type === 'background-task-started') {
          taskId = (chunk as Chunk).payload.taskId as string;
          break;
        }
      }

      release();
      await waitFor(
        () => mastra.backgroundTaskManager!.getTask(taskId),
        (t: any) => t?.status === 'completed',
      );
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(JSON.stringify(requestsFor(llm, prompt).map(r => r.body))).not.toContain(FINISH_SIGNAL);
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

    async function wakeWithDeferredResearch(opts: {
      key: string;
      topic: string;
      wokenRunsEndAfterTurn?: boolean;
      untilIdle?: boolean;
    }) {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const memory = new MockMemory();
      const llm = getMock();
      const thread = { threadId: `bg-signal-${opts.key}-thread`, resourceId: `bg-signal-${opts.key}-user` };
      const prompt = `Research ${opts.topic} over a signal`;
      const shared = await createSharedAgent(llm, {
        tools: { research: makeResearchTool(gate) },
        agentBackgroundTasks: { tools: { research: true } },
        backgroundTasks: { ...BG_CONFIG, wokenRunsEndAfterTurn: opts.wokenRunsEndAfterTurn },
        memory,
        engine,
      });
      const report = `The ${opts.topic} research is finished.`;
      // The report turn is keyed on the task's real result reaching the model, which happens either
      // inside the woken run (untilIdle) or in the turn the finish signal wakes.
      const mentions = (req: unknown, text: string) => JSON.stringify(req).includes(text);
      const result = 'Research complete on';
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => mentions(req, prompt) && !hasToolResult(req) },
        { toolCalls: [{ id: 'call-bg-1', name: 'research', arguments: { topic: opts.topic } }] },
      );
      llm.on(
        {
          endpoint: 'chat',
          predicate: (req: unknown) => mentions(req, prompt) && hasToolResult(req) && !mentions(req, result),
        },
        { content: `Started the ${opts.topic} research.` },
      );
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => mentions(req, prompt) && mentions(req, result) },
        {
          content: report,
        },
      );

      const streamOptions = {
        stopWhen: stepCountIs(3),
        ...(opts.untilIdle !== undefined && { untilIdle: opts.untilIdle }),
      };
      const accepted = await shared.agent.sendSignal(
        { type: 'user-message', contents: prompt },
        { ...thread, ifIdle: { behavior: 'wake', streamOptions: streamOptions as any } },
      ).accepted;
      expect(accepted.action).toBe('wake');
      // Drain the full stream: an `untilIdle` run's stream spans its background tasks' follow-up turns.
      const consumed = (async () => {
        for await (const _ of (accepted as any).output.fullStream) {
          // drain
        }
      })();
      const taskId = async () =>
        (await shared.mastra.backgroundTaskManager!.listTasks({ threadId: thread.threadId })).tasks[0]?.id;
      const requests = () => requestsMentioning(llm, prompt);
      const finished = () => waitFor(storedText(memory, thread), s => s.includes(report));
      return { release, consumed, taskId, requests, finished, topic: opts.topic };
    }

    type WokenRun = Awaited<ReturnType<typeof wakeWithDeferredResearch>>;

    async function expectWokenRunWaitsAndReports(run: WokenRun) {
      // The woken run stays open while its deferred task runs.
      expect(await settlesWithin(run.consumed, 1_000)).toBe(false);
      expect(run.requests()).toHaveLength(2);

      run.release();
      expect(await settlesWithin(run.consumed, 10_000)).toBe(true);
      await run.finished();
      const requests = run.requests();
      expect(requests).toHaveLength(3);
      expect(toolResultSentToModel(requests[2])).toEqual({ summary: `Research complete on "${run.topic}"` });
      // Reported inside the woken run, so no finish signal is sent.
      expect(JSON.stringify((requests[2]!.body as any).messages)).not.toContain(
        `Background task ${await run.taskId()}`,
      );
    }

    async function expectWokenRunEndsThenSignalReports(run: WokenRun) {
      // The woken run ends after its own turn; the task keeps running in the background.
      expect(await settlesWithin(run.consumed, 5_000)).toBe(true);
      expect(run.requests()).toHaveLength(2);

      run.release();
      await run.finished();
      const requests = run.requests();
      expect(requests).toHaveLength(3);
      expect(toolResultSentToModel(requests[2])).toEqual({ summary: `Research complete on "${run.topic}"` });
      // Reported by the finish signal, not by the woken run waiting for the task.
      expect(JSON.stringify((requests[2]!.body as any).messages)).toContain(
        `Background task ${await run.taskId()} for tool call call-bg-1 (research) has completed`,
      );
    }

    it('keeps a signal-woken run open until its deferred task finishes, and reports it in that run', async () => {
      await expectWokenRunWaitsAndReports(await wakeWithDeferredResearch({ key: 'default', topic: 'fusion' }));
    }, 30_000);

    it('ends a signal-woken run after its turn when the app opts in, then wakes the thread when the task finishes (#28986)', async () => {
      await expectWokenRunEndsThenSignalReports(
        await wakeWithDeferredResearch({ key: 'opt-in', topic: 'fission', wokenRunsEndAfterTurn: true }),
      );
    }, 30_000);

    it("lets a signal's untilIdle: false end its woken run after its turn (#28986)", async () => {
      await expectWokenRunEndsThenSignalReports(
        await wakeWithDeferredResearch({ key: 'signal-opt-in', topic: 'plasma', untilIdle: false }),
      );
    }, 30_000);

    it("lets a signal's untilIdle: true keep its woken run open when the app opts in (#28986)", async () => {
      await expectWokenRunWaitsAndReports(
        await wakeWithDeferredResearch({
          key: 'signal-opt-out',
          topic: 'lasers',
          wokenRunsEndAfterTurn: true,
          untilIdle: true,
        }),
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

      const toolCallIds = chunks!
        .filter(c => c.type === 'background-task-started')
        .map(c => c.payload.toolCallId as string);
      expect(new Set(toolCallIds)).toEqual(new Set(['call-bg-1', 'call-bg-2']));
      const completedEntries = taskIds.map((id, index) => `${toolCallIds[index]} (research), background task ${id}`);
      const completionDirectives = [[0], [1], [0, 1], [1, 0]].map(indices => ({
        indices,
        content:
          'IMPORTANT: These tool calls ran as background tasks. Their authoritative results may now look like ordinary tool results after reconciliation; do not reinterpret them as foreground calls. ' +
          `IMPORTANT: The following tool-call IDs completed successfully: ${indices.map(index => completedEntries[index]).join(', ')}. ` +
          'Their results are now in the conversation. Do not call the same tool again — the result is already available.',
      }));
      // A completion can wake a new run or continue one still finishing. Both must
      // identify the completed task and tool call, not merely include its result.
      const reportsFor = (request: { body: unknown }, index: number): Array<{ isSystem: boolean; content: string }> =>
        ((request.body as any).messages ?? []).flatMap((message: any) => {
          if (
            message.role === 'user' &&
            typeof message.content === 'string' &&
            message.content.startsWith(
              `<background-task status="completed" taskId="${taskIds[index]}" toolCallId="${toolCallIds[index]}" toolName="research">Background task ${taskIds[index]} for tool call ${toolCallIds[index]} (research) has completed.`,
            )
          ) {
            return [{ isSystem: false, content: message.content }];
          }
          return message.role === 'system' &&
            completionDirectives.some(
              directive => directive.indices.includes(index) && directive.content === message.content,
            )
            ? [{ isSystem: true, content: message.content }]
            : [];
        });
      const followUps = await waitFor(
        async () => requestsFor(llm, prompt).slice(2),
        rs => taskIds.every((_, index) => rs.some(request => reportsFor(request, index).length > 0)),
      );
      for (const [index] of taskIds.entries()) {
        const reports = followUps.flatMap(request => reportsFor(request, index));
        // Only persisted user notices may recur in later request histories.
        const userNotices = new Set(reports.filter(report => !report.isSystem).map(report => report.content));
        const directives = reports.filter(report => report.isSystem);
        expect(userNotices.size + directives.length).toBe(1);
        for (const request of followUps) expect(reportsFor(request, index).length).toBeLessThanOrEqual(1);
      }
      expect(followUps.length).toBeGreaterThanOrEqual(1);
      expect(followUps.length).toBeLessThanOrEqual(2);
      const lastToolResults = ((followUps.at(-1)!.body as any).messages as any[])
        .filter(m => m.role === 'tool')
        .map(m => m.content)
        .join('\n');
      expect(lastToolResults).toContain('tides');
      expect(lastToolResults).toContain('winds');
    }, 30_000);
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
