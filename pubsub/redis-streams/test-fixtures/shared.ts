import { BackgroundTaskManager } from '@mastra/core/background-tasks';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index.js';

/**
 * Statically-registered tool that cross-process workers can resolve via
 * `BackgroundTaskManager`'s static executor registry. Tests dispatch
 * tasks for `echo-tool` and assert the remote worker actually executed
 * them (status=completed with the expected output).
 */
export const echoTool = createTool({
  id: 'echo-tool',
  description: 'Returns its input verbatim under an `echoed` key.',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
  execute: async (inputData: { text: string }) => {
    return { echoed: inputData.text };
  },
});

export const inputSchema = z.object({ name: z.string() });
export const outputSchema = z.object({ greeting: z.string() });

const greet = createStep({
  id: 'greet',
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    return { greeting: `hello, ${inputData.name}` };
  },
});

export function buildWorkflow() {
  const wf = createWorkflow({
    id: 'cross-process-greet',
    inputSchema,
    outputSchema,
  });
  wf.then(greet).commit();
  return wf;
}

const pipelineInput = z.object({ name: z.string() });
const pipelineOutput = z.object({ shouted: z.string() });

const normalize = createStep({
  id: 'normalize',
  inputSchema: pipelineInput,
  outputSchema: z.object({ name: z.string() }),
  execute: async ({ inputData }) => {
    return { name: inputData.name.trim().toLowerCase() };
  },
});

const greetPipeline = createStep({
  id: 'greet-pipeline',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  execute: async ({ inputData }) => {
    return { greeting: `hello, ${inputData.name}` };
  },
});

const shout = createStep({
  id: 'shout',
  inputSchema: z.object({ greeting: z.string() }),
  outputSchema: pipelineOutput,
  execute: async ({ inputData }) => {
    return { shouted: `${inputData.greeting.toUpperCase()}!` };
  },
});

export function buildPipelineWorkflow() {
  const wf = createWorkflow({
    id: 'cross-process-pipeline',
    inputSchema: pipelineInput,
    outputSchema: pipelineOutput,
  });
  wf.then(normalize).then(greetPipeline).then(shout).commit();
  return wf;
}

const scheduledInput = z.object({ name: z.string().default('scheduled') });
const scheduledOutput = z.object({ firedAt: z.number(), name: z.string() });

const scheduledStep = createStep({
  id: 'scheduled-step',
  inputSchema: scheduledInput,
  outputSchema: scheduledOutput,
  execute: async ({ inputData }) => {
    const firedAt = Date.now();
    // Marker for tests to grep on the orchestrator's stdout.
    console.info(`scheduled-step-ran name=${inputData.name} firedAt=${firedAt}`);
    return { firedAt, name: inputData.name };
  },
});

export function buildScheduledWorkflow() {
  const wf = createWorkflow({
    id: 'cross-process-scheduled',
    inputSchema: scheduledInput,
    outputSchema: scheduledOutput,
  });
  wf.then(scheduledStep).commit();
  return wf;
}

const fanoutInput = z.object({ name: z.string().default('fanout') });
const fanoutOutput = z.object({ name: z.string(), bgStatus: z.string() });

const fanoutKickoff = createStep({
  id: 'fanout-kickoff',
  inputSchema: fanoutInput,
  outputSchema: z.object({ name: z.string() }),
  execute: async ({ inputData }) => {
    console.info(`fanout-kickoff name=${inputData.name}`);
    return { name: inputData.name };
  },
});

// Producer-side BackgroundTaskManager used by the fanout workflow step to
// enqueue dispatch events when the host process started Mastra with
// workers: false (i.e. the HTTP server process in the all-workers-split
// test, which can't auto-create a manager). We unsubscribe its worker
// callback so it never competes with the standalone bg worker process.
//
// Cached per Mastra instance (rather than a module-global) so concurrent
// or sequential tests with their own Mastra don't share a stale manager
// holding onto a closed Redis client.
type ProducerBgManager = { enqueue: (p: any) => Promise<{ task: { id: string } }> };
const producerBgManagers = new WeakMap<object, ProducerBgManager>();
async function getProducerBgManager(mastra: any): Promise<ProducerBgManager | undefined> {
  if (mastra.backgroundTaskManager) return mastra.backgroundTaskManager;
  const cached = producerBgManagers.get(mastra);
  if (cached) return cached;
  const manager: any = new BackgroundTaskManager({ enabled: true });
  manager.__registerMastra(mastra);
  await manager.init(mastra.pubsub);
  if (manager.workerCallback) {
    await mastra.pubsub.unsubscribe('background-tasks', manager.workerCallback);
  }
  producerBgManagers.set(mastra, manager);
  return manager;
}

const fanoutEnqueueAndWait = createStep({
  id: 'fanout-bg-roundtrip',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: fanoutOutput,
  execute: async ({ inputData, mastra }) => {
    const manager = await getProducerBgManager(mastra);
    if (!manager) throw new Error('background task manager not available in workflow step');
    const { task } = await manager.enqueue({
      runId: `fanout-bg-${Date.now()}`,
      toolName: 'echo-tool',
      toolCallId: `fanout-call-${Date.now()}`,
      args: { text: inputData.name },
      agentId: 'fanout-agent',
    });
    console.info(`fanout-bg-enqueued id=${task.id}`);

    const storage = (mastra as any).getStorage();
    const bgStore = (await storage.getStore('backgroundTasks')) as
      | { getTask: (id: string) => Promise<{ status: string } | null> }
      | undefined;
    if (!bgStore) throw new Error('backgroundTasks store not available in workflow step');

    const deadline = Date.now() + 15_000;
    let status = 'pending';
    while (Date.now() < deadline) {
      const t = await bgStore.getTask(task.id);
      if (
        t &&
        (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled' || t.status === 'timed_out')
      ) {
        status = t.status;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    console.info(`fanout-bg-terminal id=${task.id} status=${status}`);
    return { name: inputData.name, bgStatus: status };
  },
});

export function buildFanoutWorkflow() {
  const wf = createWorkflow({
    id: 'cross-process-fanout',
    inputSchema: fanoutInput,
    outputSchema: fanoutOutput,
  });
  wf.then(fanoutKickoff).then(fanoutEnqueueAndWait).commit();
  return wf;
}

export function buildMastra(opts: { storageUrl: string; redisUrl: string }) {
  // Optional test auth provider: when TEST_AUTH_TOKEN is set, the server
  // accepts only that token via Authorization: Bearer ... and rejects
  // everything else. Used by auth-e2e.test.ts to verify that the
  // step-execution endpoint is gated by the framework's normal auth path.
  const expectedToken = process.env.TEST_AUTH_TOKEN;
  const auth = expectedToken
    ? {
        authenticateToken: async (token: string) => {
          if (token === expectedToken) return { id: 'worker' };
          return null;
        },
      }
    : undefined;

  return new Mastra({
    workflows: {
      'cross-process-greet': buildWorkflow(),
      'cross-process-pipeline': buildPipelineWorkflow(),
      'cross-process-scheduled': buildScheduledWorkflow(),
      'cross-process-fanout': buildFanoutWorkflow(),
    },
    storage: new LibSQLStore({ id: 'mastra-storage', url: opts.storageUrl }),
    pubsub: new RedisStreamsPubSub({ url: opts.redisUrl }),
    tools: { 'echo-tool': echoTool },
    backgroundTasks: { enabled: true },
    logger: false,
    server: {
      ...(auth ? { auth } : {}),
      middleware: [
        async (c, next) => {
          if (c.req.path.includes('/steps/execute')) {
            // Marker line for cross-process.test.ts to assert that the
            // standalone worker actually called back to the server.
            console.info(`step-execute-hit path=${c.req.path}`);
          }
          await next();
        },
      ],
    },
  });
}
