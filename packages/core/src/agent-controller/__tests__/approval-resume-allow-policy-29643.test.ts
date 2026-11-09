/**
 * #29643: an `allow`-policy tool approval is answered as soon as the approval chunk is streamed,
 * but the run writes its `suspended` snapshot twice (end of the loop entry, then the run's terminal
 * write). On a store with real write latency (PostgreSQL) the second write can land while the
 * controller is already resuming:
 *
 * - between the resume's snapshot read and its claim, where a new timestamp made the claim look
 *   like it raced a newer suspension;
 * - after the claim, where it reset the claimed row to `suspended` and the claimed resume could not
 *   start.
 *
 * Either way the tool call was lost with `AGENT_RESUME_ALREADY_CLAIMED`. InMemoryStore writes too
 * fast to hit the window, so these tests hold the repeated write at each point to force it.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const getMock = useLoopScenarioAimock();

const toolResults = (req: ChatCompletionRequest) => req.messages.filter(message => message.role === 'tool').length;

/** read_data('a'), then read_data('b'), then answer. */
function scriptedModel() {
  const llm = getMock();
  llm.on(
    { endpoint: 'chat', predicate: req => toolResults(req) === 0 },
    { toolCalls: [{ id: 'call-a', name: 'read_data', arguments: { name: 'a' } }] },
  );
  llm.on(
    { endpoint: 'chat', predicate: req => toolResults(req) === 1 },
    { toolCalls: [{ id: 'call-b', name: 'read_data', arguments: { name: 'b' } }] },
  );
  llm.on({ endpoint: 'chat' }, { content: 'done' });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

type LateWrite = 'after-claim' | 'between-read-and-claim';

/** Never let a held write hang the test when the event it waits for does not come. */
const HOLD_TIMEOUT_MS = 3_000;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

const withTimeout = (promise: Promise<void>) =>
  Promise.race([promise, new Promise<void>(resolve => setTimeout(resolve, HOLD_TIMEOUT_MS))]);

/**
 * Holds every repeated `suspended` write of the agentic loop until the given point of the resume
 * that follows it, like a slow database would.
 */
async function delayRepeatedSuspendWrites(storage: InMemoryStore, lateWrite: LateWrite) {
  const workflows = (await storage.getStore('workflows'))!;
  const persist = workflows.persistWorkflowSnapshot.bind(workflows);
  const update = workflows.updateWorkflowState.bind(workflows);

  const lastStatus = new Map<string, string>();
  /** One per suspension, opened by its first `suspended` write. */
  const suspensions = new Map<
    string,
    {
      claiming: ReturnType<typeof deferred>;
      claimed: ReturnType<typeof deferred>;
      repeatDone: ReturnType<typeof deferred>;
    }
  >();
  let held = 0;

  workflows.persistWorkflowSnapshot = async args => {
    if (args.workflowName !== 'agentic-loop') return persist(args);
    const { runId } = args;
    const status = args.snapshot.status;
    const repeated = status === 'suspended' && lastStatus.get(runId) === 'suspended';
    lastStatus.set(runId, status);
    if (!repeated) {
      const written = await persist(args);
      if (status === 'suspended') {
        suspensions.set(runId, { claiming: deferred(), claimed: deferred(), repeatDone: deferred() });
        // Real write latency also keeps the repeated write out of the first write's millisecond.
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      return written;
    }

    const suspension = suspensions.get(runId)!;
    held++;
    try {
      await withTimeout(lateWrite === 'after-claim' ? suspension.claimed.promise : suspension.claiming.promise);
      return await persist(args);
    } finally {
      suspension.repeatDone.resolve();
    }
  };

  workflows.updateWorkflowState = async args => {
    const isClaim = args.workflowName === 'agentic-loop' && args.opts.status === 'pending';
    const suspension = isClaim ? suspensions.get(args.runId) : undefined;
    if (suspension && lateWrite === 'between-read-and-claim') {
      // The resume has read its snapshot; let the repeated write land before the claim.
      suspension.claiming.resolve();
      await withTimeout(suspension.repeatDone.promise);
    }
    const result = await update(args);
    suspension?.claimed.resolve();
    return result;
  };

  return { held: () => held };
}

async function setup({ registeredOnMastra, lateWrite }: { registeredOnMastra: boolean; lateWrite: LateWrite }) {
  const reads: string[] = [];
  const readData = createTool({
    id: 'read_data',
    description: 'Reads a value by name.',
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => {
      reads.push(name);
      return { name, value: `value-of-${name}` };
    },
  });
  const agent = new Agent({
    id: 'repro',
    name: 'Repro',
    instructions: 'Follow the request exactly.',
    model: scriptedModel(),
    tools: { read_data: readData },
  });
  const storage = new InMemoryStore();
  const delay = await delayRepeatedSuspendWrites(storage, lateWrite);
  const controller = new AgentController({
    id: 'repro-controller',
    workspace: createMockWorkspace(),
    agent,
    memory: new MockMemory({ storage: new InMemoryStore() }),
    modes: [{ id: 'only', name: 'Only', metadata: { default: true } }],
    toolCategoryResolver: () => 'read',
    ...(registeredOnMastra ? {} : { storage }),
  });
  if (registeredOnMastra) {
    controller.__registerMastra(new Mastra({ logger: false, storage, agents: { repro: agent } }));
  }
  await controller.init();
  const session = await controller.createSession({ resourceId: 'repro', threadId: `thread-${Date.now()}` });
  await session.permissions.setForCategory({ category: 'read', policy: 'allow' });

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));
  const errors = () => events.flatMap(event => (event.type === 'error' ? [event.error.message] : []));
  return { session, reads, errors, held: delay.held };
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('AgentController allow-policy approval with a late repeated suspend write (#29643)', () => {
  describe.each([
    { label: 'controller registered on a Mastra instance', registeredOnMastra: true },
    { label: 'standalone controller', registeredOnMastra: false },
  ])('$label', ({ registeredOnMastra }) => {
    it.each([{ lateWrite: 'after-claim' as const }, { lateWrite: 'between-read-and-claim' as const }])(
      'resumes the tool call once when the write lands $lateWrite',
      async ({ lateWrite }) => {
        const env = await setup({ registeredOnMastra, lateWrite });

        await env.session.sendMessage({ content: "Call read_data with 'a', then with 'b', then answer 'done'." });

        expect(env.held()).toBeGreaterThan(0);
        expect(env.errors()).toEqual([]);
        expect(env.reads).toEqual(['a', 'b']);
      },
      30_000,
    );
  });
});
