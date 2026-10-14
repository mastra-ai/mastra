/**
 * T64 background-transcript-transform (plain, durable, evented).
 *
 * Ported from validation harness case T64 (G9).
 *
 * A background (deferred) tool whose result carries a tool-level
 * `transform.transcript.output`. The background-result commit and the
 * MessageHistory output-processor save both write the same assistant message,
 * so the persisted tool result must be the redacted transcript copy on every
 * engine, never the raw payload, and it must not flip back to raw once the run
 * has settled.
 *
 * Excluded, as in the harness: the agent-level transform policy (T34),
 * recovery mid background task (T4), and the `display` target (Studio).
 *
 * `expectEngineParity` is not used here for two reasons: its internal Mastra
 * host neither enables `backgroundTasks` nor starts workers, and the claim is
 * about persisted memory state, which the parity snapshot does not record. The
 * three engines are therefore built here exactly as the helper builds them and
 * their contracts are compared directly.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { PARITY_ENGINES, createRecordingModel, textOnlyTape, toolCallTape, type ParityEngine } from './parity-harness';

const ENGINES = PARITY_ENGINES;
const RAW_SECRET = 'raw-secret';
const REDACTED_SECRET = 'transcript-redacted';
const MAX_IDLE_MS = 20_000;

/** The background placeholder names a task id; the id itself is volatile. */
const TASK_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** The harness's script: one deferred tool call, then text once it has a result. */
function respond(request: { prompt: readonly unknown[] }) {
  const prompt = request.prompt as Array<{ role?: string; content?: unknown }>;
  const hasToolResult = prompt.some(
    message =>
      message.role === 'tool' ||
      (Array.isArray(message.content) &&
        message.content.some(part => (part as { type?: string })?.type === 'tool-result')),
  );
  return hasToolResult
    ? textOnlyTape('done')
    : toolCallTape('echo', { n: 1, _background: { disposition: 'deferred' } });
}

const ECHO_TOOL = createTool({
  id: 'echo',
  description: 'T64 echo',
  inputSchema: z.object({ n: z.number() }),
  execute: async input => ({ n: input?.n ?? 1, secret: RAW_SECRET }),
  transform: {
    transcript: {
      output: context => {
        const { n } = context.output as { n: number };
        return { n, secret: REDACTED_SECRET };
      },
    },
  },
});

/** Persisted tool-invocation parts, as the harness reads them off storage. */
function toolParts(messages: Array<{ content?: { parts?: unknown[] } }>) {
  return messages
    .flatMap(message => message.content?.parts ?? [])
    .filter((part): part is { toolInvocation?: { toolName?: string; state?: string; result?: unknown } } => {
      return (part as { type?: string })?.type === 'tool-invocation';
    })
    .map(part => ({
      toolName: part.toolInvocation?.toolName,
      state: part.toolInvocation?.state,
      result: part.toolInvocation?.result,
    }));
}

interface Contract {
  engine: ParityEngine;
  threw: string | null;
  finishes: number;
  errors: number;
  backgroundCompleted: number;
  toModel: string[];
  persistedAtFinish: ReturnType<typeof toolParts>;
  persistedLater: ReturnType<typeof toolParts>;
}

async function drive(engine: ParityEngine): Promise<Contract> {
  const thread = `t64-thread-${engine}`;
  const resource = `t64-resource-${engine}`;
  const memory = new MockMemory();
  const storage = new MockStore();
  const pubsub = new EventEmitterPubSub();

  const { model, requests } = createRecordingModel({ respond });
  const agent: Agent<any, any, any> = new Agent({
    id: 't64-agent',
    name: 'T64 Agent',
    instructions: 'Follow the script.',
    model,
    tools: { echo: ECHO_TOOL },
    backgroundTasks: { tools: { echo: true } },
    memory,
  });

  let wrapper: ReturnType<typeof createDurableAgent> | ReturnType<typeof createEventedAgent> | undefined;
  if (engine === 'durable') wrapper = createDurableAgent({ agent, pubsub });
  if (engine === 'evented') wrapper = createEventedAgent({ agent, pubsub });

  const host = new Mastra({
    logger: false,
    storage,
    backgroundTasks: { enabled: true },
    agents: { 't64-agent': (wrapper ?? agent) as Agent<any, any, any> },
  });
  await host.startWorkers();

  if (wrapper && engine === 'evented') {
    // Without atomic storage the evented agent silently runs on the default engine.
    expect((wrapper.getWorkflow() as unknown as { engineType?: string }).engineType).toBe('evented');
  }

  const contract: Contract = {
    engine,
    threw: null,
    finishes: 0,
    errors: 0,
    backgroundCompleted: 0,
    toModel: [],
    persistedAtFinish: [],
    persistedLater: [],
  };

  const snap = async () => toolParts((await memory.recall({ threadId: thread, resourceId: resource })).messages);

  let cleanup = () => {};
  let released = false;
  // The run's resources have to be released before the settled transcript is
  // read, and again (once) if an assertion fails in between, so a failed parity
  // test cannot leave the workers running.
  const release = async () => {
    if (released) return;
    released = true;
    cleanup();
    await host.backgroundTaskManager?.shutdown();
    await pubsub.close();
  };

  try {
    try {
      // plain resolves to the output itself; the wrappers resolve to { output, cleanup }.
      const streamed = (await (wrapper ?? agent).stream('Go.', {
        memory: { thread, resource },
        runId: `t64-run-${engine}`,
        untilIdle: { maxIdleMs: MAX_IDLE_MS },
        maxSteps: 4,
      })) as {
        fullStream: AsyncIterable<{ type?: string }>;
        output?: { fullStream: AsyncIterable<{ type?: string }> };
        cleanup?: () => void;
      };
      const output = streamed.output ?? streamed;
      cleanup = streamed.cleanup ?? (() => {});

      for await (const chunk of output.fullStream) {
        if (chunk.type === 'finish') contract.finishes++;
        if (chunk.type === 'error' || chunk.type === 'abort' || chunk.type === 'tripwire') contract.errors++;
        if (chunk.type === 'background-task-completed') contract.backgroundCompleted++;
      }
    } catch (error) {
      contract.threw = String((error as Error)?.message ?? error).slice(0, 200);
    }

    contract.toModel = requests.flatMap(({ prompt }) =>
      (prompt as Array<{ role?: string; content?: unknown }>)
        .filter(message => message.role === 'tool')
        .flatMap(message => (Array.isArray(message.content) ? message.content : []))
        .map(part => JSON.stringify((part as { output?: unknown }).output ?? part).replace(TASK_ID, '<id>')),
    );

    contract.persistedAtFinish = await snap();
    await release();

    contract.persistedLater = await snap();
    return contract;
  } finally {
    await release();
    await host.shutdown();
  }
}

describe('T64 background tool transcript transform (plain, durable, evented)', () => {
  const contracts = new Map<ParityEngine, Contract>();

  beforeEach(() => contracts.clear());

  afterEach(() => contracts.clear());

  it('every engine persists the redacted background result and does not flip it back', async () => {
    for (const engine of ENGINES) contracts.set(engine, await drive(engine));

    for (const engine of ENGINES) {
      const contract = contracts.get(engine)!;

      // 'run settled with a finish and no error'
      expect(contract.threw).toBeNull();
      expect(contract.finishes).toBeGreaterThanOrEqual(1);
      expect(contract.errors).toBe(0);

      // the tool really was deferred, not executed inline
      expect(contract.backgroundCompleted).toBeGreaterThanOrEqual(1);

      // 'background result reached the model'
      expect(contract.toModel.some(value => value.includes('"n":1'))).toBe(true);

      // 'persisted tool result is the redacted transcript copy'
      const serialized = JSON.stringify(contract.persistedLater);
      expect(serialized).toContain(REDACTED_SECRET);
      expect(serialized).not.toContain(RAW_SECRET);

      // 'persisted copy did not flip after the run settled'
      expect(contract.persistedLater).toEqual(contract.persistedAtFinish);
    }

    // The engines must agree, not merely each satisfy the claims.
    const [plain, ...rest] = ENGINES.map(engine => contracts.get(engine)!);
    for (const contract of rest) {
      expect({ ...contract, engine: undefined }).toEqual({ ...plain!, engine: undefined });
    }
  });
});
