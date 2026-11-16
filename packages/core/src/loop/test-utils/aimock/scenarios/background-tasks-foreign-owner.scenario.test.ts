import { expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Background-task rows owned by something other than an agent (for example an
 * MCP server storing its tasks with `agentId: 'mcp-server:<id>'`) share the
 * agent's manager, storage, thread and resource. They must never reach the
 * agent: no `background-task-*` chunks on its stream, no tool result in the
 * model's context, and no wait on them before the stream goes idle.
 */
const BG_CONFIG = { enabled: true, globalConcurrency: 5, perAgentConcurrency: 3 };
const FOREIGN_OWNER = 'mcp-server:x';
const FOREIGN_TOOL = 'mcp-server:x:lookup';
const FOREIGN_RESULT = 'FOREIGN-OWNER-RESULT-7f3a';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

/** A chunk refers to a task by `taskId`, or by `taskIds` on wait-progress chunks. */
function mentions(chunk: any, taskId: string): boolean {
  return chunk.payload?.taskId === taskId || (chunk.payload?.taskIds ?? []).includes(taskId);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} did not finish within ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describeForAllEngines(
  'AIMock loop scenario: background tasks owned by a non-agent owner',
  engine => {
    const getMock = useLoopScenarioAimock();

    for (const withMemory of [true, false]) {
      const label = withMemory ? 'on the same thread and resource' : 'for an agent without memory';

      async function setup() {
        const llm = getMock();
        const researchStarted = deferred();
        const researchGate = deferred();
        const research = createTool({
          id: 'research',
          description: 'Research in the background',
          inputSchema: z.object({}),
          background: { enabled: true },
          execute: async () => {
            researchStarted.resolve();
            await researchGate.promise;
            return { summary: 'Own research complete.' };
          },
        });
        const { agent, mastra } = await createSharedAgent(llm, {
          engine,
          memory: withMemory ? new MockMemory() : undefined,
          tools: { research },
          agentBackgroundTasks: { tools: { research: true } },
          backgroundTasks: BG_CONFIG,
        });
        const thread = withMemory ? { thread: `foreign-${engine}`, resource: 'foreign-user' } : undefined;

        const foreignGate = deferred();
        const manager = mastra.backgroundTaskManager;
        manager.registerStaticExecutor(FOREIGN_TOOL, {
          execute: async () => {
            await foreignGate.promise;
            return { secret: FOREIGN_RESULT };
          },
        });
        const { task: foreign } = await manager.enqueue({
          toolName: FOREIGN_TOOL,
          toolCallId: `foreign-call-${engine}-${withMemory}`,
          args: {},
          agentId: FOREIGN_OWNER,
          runId: `foreign-run-${engine}-${withMemory}`,
          threadId: thread?.thread,
          resourceId: thread?.resource,
        });
        await expect.poll(async () => (await manager.getTask(foreign.id))?.status).toBe('running');

        return { llm, agent, manager, thread, foreign, foreignGate, researchStarted, researchGate };
      }

      it(`does not wait on a running foreign-owner task ${label}`, async () => {
        const { llm, agent, manager, thread, foreign, foreignGate } = await setup();
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Nothing to do in the background.' });

        try {
          const output = await agent.stream('Hello', {
            ...(thread ? { memory: thread } : {}),
            untilIdle: { maxIdleMs: 30_000 },
          });
          const chunks: any[] = [];
          await withTimeout(
            (async () => {
              for await (const chunk of output.fullStream) chunks.push(chunk);
            })(),
            5_000,
            'untilIdle stream',
          );

          expect(chunks.filter(c => mentions(c, foreign.id))).toEqual([]);
          expect((await manager.getTask(foreign.id))?.status).toBe('running');
        } finally {
          foreignGate.resolve();
        }
      });

      it(`keeps a foreign-owner result out of the stream and model context ${label}`, async () => {
        const { llm, agent, manager, thread, foreign, foreignGate, researchStarted, researchGate } = await setup();
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'research-1', name: 'research', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Research dispatched.' });
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Final research answer.' });

        const output = await agent.stream('Start', {
          ...(thread ? { memory: thread } : {}),
          untilIdle: { maxIdleMs: 30_000 },
        });
        const chunks: any[] = [];
        const reading = (async () => {
          for await (const chunk of output.fullStream) chunks.push(chunk);
        })();

        // The foreign task settles while the agent's stream is still open and
        // listening for its own background task.
        await researchStarted.promise;
        foreignGate.resolve();
        await expect.poll(async () => (await manager.getTask(foreign.id))?.status).toBe('completed');
        researchGate.resolve();
        await withTimeout(reading, 10_000, 'untilIdle stream');

        expect(chunks.filter(c => mentions(c, foreign.id))).toEqual([]);
        const sentToModel = JSON.stringify(llm.getRequests().map(r => r.body));
        if (withMemory) {
          // Without memory, untilIdle is a plain stream and never continues on
          // the agent's own task, so only the memory case sees its result.
          expect(chunks.some(c => c.type === 'background-task-completed' && c.payload?.taskId !== foreign.id)).toBe(
            true,
          );
          expect(sentToModel).toContain('Own research complete.');
        }
        expect(sentToModel).not.toContain(FOREIGN_RESULT);
      });
    }
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
