/**
 * Ported from validation harness case T66 (processor-approval-tool).
 *
 * The script calls a `requireApproval` tool twice inside one step, so the run
 * suspends twice and each suspend point needs its own approval. The `processor`
 * variant only has the tool because an input processor adds it to the step
 * (COR-1339); the `static` variant registers the same tool on the agent as a
 * control that the approval gate is not simply blind to the tool.
 *
 * `expectEngineParity` cannot drive this case. Plain ends its stream at a
 * suspension and only records the suspension once the segment is drained to the
 * end, while durable and evented keep the stream open until the run is resumed.
 * The helper stops every drain at the first suspension chunk, which is enough
 * for a single approval (its own approval scenario) but leaves plain's second
 * approval unregistered: approving the second call then fails with "cannot
 * resume tool call ... because it is not suspended". The helper also has no
 * equivalent of the harness's per-condition `stopOn`, so this case builds the
 * three engines directly and drives them the way the harness does — plain's
 * segments are read to the end, durable/evented segments stop at the suspension
 * chunk.
 *
 * Excluded, as in the harness: recovery while suspended on a processor-added
 * tool, `activeTools` narrowing by the processor, and the `called` tool-call
 * concurrency strategy. The harness's 300 ms tool sleep and `HANG_MS` race are
 * replaced by the tool's own recorded start/commit order, which is strictly
 * stronger and uses no timers; a hang surfaces as a test timeout instead.
 *
 * Two chunk-level differences are not asserted here because no ticket describes
 * them (see COR-1407): durable and evented emit a tool call's `tool-result`
 * chunk in the resumed segment that follows its approval, while plain emits
 * every tool-result at the end of the step. The counts agree; only the position
 * differs.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { InputProcessor } from '../../../processors';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import {
  PARITY_ENGINES,
  createRecordingModel,
  textOnlyTape,
  type ModelTape,
  type ParityEngine,
} from './parity-harness';

const CALLS = [1, 2];
const THREAD = 'thread-t66';
const RESOURCE = 'resource-t66';
const TEST_TIMEOUT_MS = 30_000;

const VARIANTS = ['processor', 'static'] as const;
type Variant = (typeof VARIANTS)[number];

/**
 * `toolCallTape` only builds one call, and the case needs both calls in a single
 * step.
 */
const TWO_GATED_CALLS_TAPE: ModelTape = [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id: 'parity-id-0', modelId: 'parity-model', timestamp: new Date(0) },
  ...CALLS.map(n => ({
    type: 'tool-call' as const,
    toolCallId: `parity-call-${n}`,
    toolName: 'gated',
    input: JSON.stringify({ n }),
    providerExecuted: false,
  })),
  { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
];

type EngineContract = {
  engine: ParityEngine;
  variant: Variant;
  /** Tool call ids whose approval was resolved, in the order asked. */
  approvals: string[];
  /** `start:<n>` / `commit:<n>` in the order the tool observed them. */
  log: string[];
  finishes: number;
  errors: number;
  /** Persisted `gated` tool invocations: name and state, in storage order. */
  persisted: Array<{ toolName: string; state: string }>;
};

/** Reads a segment, stopping at its suspension on the engines that keep it open. */
async function readSegment(engine: ParityEngine, output: unknown) {
  const types: string[] = [];
  const approvals: string[] = [];
  const stream = (output as { fullStream: AsyncIterable<{ type?: string; payload?: { toolCallId?: string } }> })
    .fullStream;
  for await (const chunk of stream) {
    types.push(chunk.type ?? '');
    if (chunk.type === 'tool-call-suspended' || chunk.type === 'tool-call-approval') {
      approvals.push(chunk.payload?.toolCallId ?? '');
      // Plain ends its stream at a suspension; durable and evented leave it open
      // until the run is resumed (closeOnSuspend only applies to `resume`).
      if (engine !== 'plain') break;
    }
  }
  return { types, approvals };
}

async function drive(engine: ParityEngine, variant: Variant): Promise<EngineContract> {
  const log: string[] = [];
  const gated = createTool({
    id: 'gated',
    description: 'Gated side effect n. Requires approval.',
    inputSchema: z.object({ n: z.number() }),
    requireApproval: true,
    execute: async ({ n }) => {
      log.push(`start:${n}`);
      log.push(`commit:${n}`);
      return { done: n };
    },
  });

  const pubsub = new EventEmitterPubSub();
  const memory = new MockMemory();
  const agent = new Agent({
    id: 't66-agent',
    name: 'T66 Agent',
    instructions: 'Follow the script.',
    model: createRecordingModel({ tapes: [TWO_GATED_CALLS_TAPE, textOnlyTape('approved 2')] }).model as never,
    memory,
    tools: variant === 'static' ? { gated } : {},
    inputProcessors:
      variant === 'processor'
        ? [
            {
              id: 'cor1339-add-tool',
              processInputStep: ({ tools }: { tools?: Record<string, unknown> }) => ({
                tools: { ...(tools ?? {}), gated },
              }),
            } as unknown as InputProcessor,
          ]
        : [],
  });

  const wrapper =
    engine === 'durable'
      ? createDurableAgent({ agent, pubsub })
      : engine === 'evented'
        ? createEventedAgent({ agent })
        : undefined;
  const host = new Mastra({ agents: { [agent.id]: wrapper ?? agent }, storage: new InMemoryStore(), logger: false });

  const registered = host.getAgent('t66-agent') as unknown as {
    stream: (messages: string, options: Record<string, unknown>) => Promise<unknown>;
    approveToolCall: (options: Record<string, unknown>) => Promise<unknown>;
    getWorkflow?: () => { engineType?: string };
  };
  if (wrapper && engine === 'evented') {
    expect(registered.getWorkflow?.().engineType, 'evented agent resolved to the default engine').toBe('evented');
  }

  const memoryOptions = { thread: THREAD, resource: RESOURCE };
  const streamOptions = { memory: memoryOptions, runId: `parity-t66-${engine}`, maxSteps: 4 };

  const approvals: string[] = [];
  let finishes = 0;
  let errors = 0;

  const opening = (await registered.stream('Run gated 1 and 2.', streamOptions)) as {
    output?: unknown;
    cleanup?: () => void | Promise<void>;
  };
  const openingOutput = engine === 'plain' ? opening : opening.output;

  try {
    let segment = await readSegment(engine, openingOutput);
    finishes += segment.types.filter(type => type === 'finish').length;
    errors += segment.types.filter(type => type === 'error' || type === 'tool-error').length;
    let pending = [...segment.approvals];

    while (pending.length > 0) {
      const toolCallId = pending.shift()!;
      approvals.push(toolCallId);
      // Plain's Agent and both wrappers return the resumed output directly.
      const resumed = await registered.approveToolCall({ ...streamOptions, toolCallId });
      segment = await readSegment(engine, resumed);
      finishes += segment.types.filter(type => type === 'finish').length;
      errors += segment.types.filter(type => type === 'error' || type === 'tool-error').length;
      pending = [...new Set([...pending, ...segment.approvals.filter(id => id !== toolCallId)])];
    }
  } finally {
    await opening.cleanup?.();
    await pubsub.close();
    await host.shutdown();
  }

  const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
  const persisted = messages
    .flatMap(message => (message.content as { parts?: Array<Record<string, any>> } | undefined)?.parts ?? [])
    .filter(part => part.type === 'tool-invocation' && part.toolInvocation?.toolName === 'gated')
    .map(part => ({ toolName: part.toolInvocation.toolName as string, state: part.toolInvocation.state as string }));

  return { engine, variant, approvals, log, finishes, errors, persisted };
}

/** Generated ids are not compared, matching the harness's contract. */
function comparable(contract: EngineContract) {
  return {
    variant: contract.variant,
    log: contract.log,
    approvals: contract.approvals.length,
    finishes: contract.finishes,
    persisted: contract.persisted.map(part => part.state),
  };
}

describe('durable agent: T66 processor-added approval tool', () => {
  it.each(VARIANTS)(
    'resolves one approval per call: %s',
    async variant => {
      const contracts: EngineContract[] = [];
      for (const engine of PARITY_ENGINES) contracts.push(await drive(engine, variant));

      const plain = contracts[0]!;
      for (const contract of contracts) {
        expect(contract.variant).toBe(variant);
        // One approval per call, each for a distinct tool call.
        expect(contract.approvals, `${contract.engine}: approvals`).toHaveLength(CALLS.length);
        expect(new Set(contract.approvals).size, `${contract.engine}: distinct tool calls`).toBe(CALLS.length);
        // Each call started and committed exactly once, and calls ran sequentially.
        expect(contract.log, `${contract.engine}: tool call log`).toEqual([
          'start:1',
          'commit:1',
          'start:2',
          'commit:2',
        ]);
        // The run ended with a finish and no error.
        expect(contract.finishes, `${contract.engine}: finishes`).toBeGreaterThanOrEqual(1);
        expect(contract.errors, `${contract.engine}: errors`).toBe(0);
        // Both gated results reached memory.
        expect(contract.persisted, `${contract.engine}: persisted results`).toEqual([
          { toolName: 'gated', state: 'result' },
          { toolName: 'gated', state: 'result' },
        ]);
      }

      const plainContract = comparable(plain);
      expect(contracts.slice(1).map(comparable)).toEqual(contracts.slice(1).map(() => plainContract));
    },
    TEST_TIMEOUT_MS,
  );
});
