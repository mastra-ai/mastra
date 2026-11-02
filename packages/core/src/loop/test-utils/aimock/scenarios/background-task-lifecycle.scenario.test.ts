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
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
