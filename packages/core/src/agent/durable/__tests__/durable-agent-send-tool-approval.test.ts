/**
 * Ported from validation harness case T82 (send-tool-approval).
 *
 * A single tool call is paused on the thread and then resolved with
 * `sendToolApproval`, which carries a separate approval decision plus a custom
 * resume payload. Three variants:
 *
 * - `approve`: an approval-gated tool (`requireApproval`) is approved with
 *   custom data, so the tool must run exactly once and receive the decision
 *   merged into the custom payload.
 * - `deny`: the same tool is declined, so it must not run at all and the call
 *   must resolve as denied instead of asking again.
 * - `suspend`: an ordinary suspended tool (`suspendSchema` / strict
 *   `resumeSchema`) receives the caller payload unchanged — no synthetic
 *   approval fields may be merged into a plain suspension.
 *
 * `expectEngineParity` cannot drive this case: its Mastra host never carries the
 * memory thread the approval is addressed to, and the helper's drain stops at
 * the suspension chunk without ever delivering the approval. This case builds
 * the three engines directly, drives the initial segment the way the harness
 * does (plain ends its stream at the suspension, durable and evented keep it
 * open, so only their segments stop at the pause chunk), and then resolves the
 * pause through `sendToolApproval` on the hosted agent.
 *
 * Excluded, as in the harness: approval after a restart, parallel approvals, and
 * exact prose/token/timing equality. The harness's 5 s settle poll is replaced by
 * a `vi.waitFor` gate on the resumed run's own observable progress (the model is
 * asked again and the call reaches its final persisted state), so nothing here
 * waits on a timer.
 *
 * The harness ends the case with `mastra.shutdown({ drainTimeout: 1000 })`. On
 * this pin that teardown throws on the evented engine — see COR-1391: the
 * resumed run's workflow finish tail reads `globalRunRegistry` after the run's
 * entry was deleted, and the cache's `updateAgeOnGet` refresh resurrects the key
 * as a valueless entry that `getActiveDurableAgentWorkflowExecutions`
 * dereferences. The evented variants assert today's rejection so this test goes
 * red once COR-1391 lands and the step can be restored unconditionally.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { PARITY_ENGINES, createRecordingModel, textOnlyTape, toolCallTape, type ParityEngine } from './parity-harness';

const VARIANTS = ['approve', 'deny', 'suspend'] as const;
type Variant = (typeof VARIANTS)[number];

const CUSTOM_APPROVAL = { note: 'hello' };
const CUSTOM_SUSPEND = { name: 'Dero Israel' };
const TEST_TIMEOUT_MS = 30_000;
const SETTLE_TIMEOUT_MS = 10_000;

type ToolEvent = { tool: string; event: 'commit'; amount: number; resumeData: unknown };
type PersistedPart = { toolName: string; state: string };
type Pause = { type: string; toolCallId: string | null };

type EngineContract = {
  engine: ParityEngine;
  variant: Variant;
  accepted: boolean;
  events: string[];
  resumeDataSeen: unknown;
  persisted: PersistedPart[];
  userMessages: number;
};

/**
 * Reads one segment of the run. Plain ends its stream at a suspension, while
 * durable and evented keep it open until the run is resumed, so only theirs stop
 * at the pause chunk (the harness drives them with a matching `stopOn`).
 */
async function readSegment(
  engine: ParityEngine,
  output: { fullStream: AsyncIterable<{ type?: string; payload?: { toolCallId?: string } }> },
) {
  const types: string[] = [];
  let pause: Pause | null = null;
  for await (const chunk of output.fullStream) {
    const type = chunk.type ?? '';
    types.push(type);
    if (type === 'tool-call-approval' || type === 'tool-call-suspended') {
      pause = { type, toolCallId: chunk.payload?.toolCallId ?? null };
      if (engine !== 'plain') break;
    }
  }
  return { types, pause };
}

async function drive(engine: ParityEngine, variant: Variant): Promise<EngineContract> {
  const log: ToolEvent[] = [];
  const toolName = variant === 'suspend' ? 'strictSuspend' : 'approvalData';

  const approvalData = createTool({
    id: 'approvalData',
    description: 'Approval-gated tool that records the resume payload it receives.',
    inputSchema: z.object({ amount: z.number() }),
    requireApproval: true,
    execute: async ({ amount }, context) => {
      log.push({ tool: 'approvalData', event: 'commit', amount, resumeData: context?.agent?.resumeData ?? null });
      return { amount };
    },
  });
  const strictSuspend = createTool({
    id: 'strictSuspend',
    description: 'Suspends once, then requires the caller payload without synthetic approval fields.',
    inputSchema: z.object({ amount: z.number() }),
    suspendSchema: z.object({ prompt: z.string() }),
    resumeSchema: z.object({ name: z.string() }).strict(),
    execute: async ({ amount }, context) => {
      const resumeData = context?.agent?.resumeData;
      if (!resumeData) {
        return context?.agent?.suspend?.({ prompt: `Name the recipient for ${amount}.` });
      }
      log.push({ tool: 'strictSuspend', event: 'commit', amount, resumeData });
      return { amount };
    },
  });

  const memory = new MockMemory();
  const pubsub = new EventEmitterPubSub();
  const { model, requests } = createRecordingModel({
    tapes: [toolCallTape(toolName, { amount: 42 }, `t82-call-${variant}`), textOnlyTape('Tool result reported.')],
  });
  const agent: Agent<any, any, any> = new Agent({
    id: 't82-agent',
    name: 'T82 Agent',
    instructions: 'Call the requested tool exactly once, then report its result.',
    model,
    memory,
    tools: { approvalData, strictSuspend },
  });
  const wrapper =
    engine === 'durable'
      ? createDurableAgent({ agent, pubsub })
      : engine === 'evented'
        ? createEventedAgent({ agent, pubsub })
        : undefined;
  const host = new Mastra({
    agents: { [agent.id]: wrapper ?? agent },
    storage: new InMemoryStore(),
    logger: false,
  });
  if (wrapper && engine === 'evented') {
    expect((wrapper.getWorkflow() as { engineType?: string }).engineType).toBe('evented');
  }
  const registered = host.getAgent('t82-agent') as unknown as Agent<any, any, any>;

  const threadId = `t82-thread-${engine}-${variant}`;
  const resourceId = `t82-resource-${engine}-${variant}`;
  const runId = `t82-run-${engine}-${variant}`;

  const streamed = (await registered.stream('Call the requested tool exactly once, then report its result.', {
    memory: { thread: threadId, resource: resourceId },
    runId,
    maxSteps: 4,
  })) as {
    fullStream: AsyncIterable<{ type?: string; payload?: { toolCallId?: string } }>;
    output?: unknown;
    cleanup?: () => void;
  };
  const output = (streamed.output ?? streamed) as {
    fullStream: AsyncIterable<{ type?: string; payload?: { toolCallId?: string } }>;
  };

  let accepted = false;
  let userMessages = 0;
  let persisted: PersistedPart[] = [];

  try {
    const opening = await readSegment(engine, output);
    expect(opening.pause?.type, `${engine}: pause chunk`).toBe(
      variant === 'suspend' ? 'tool-call-suspended' : 'tool-call-approval',
    );
    const toolCallId = opening.pause?.toolCallId;
    expect(toolCallId, `${engine}: paused tool call`).toBeTruthy();

    const decision = await registered.sendToolApproval({
      threadId,
      resourceId,
      runId,
      toolCallId: toolCallId!,
      approved: variant !== 'deny',
      resumeData: variant === 'suspend' ? CUSTOM_SUSPEND : CUSTOM_APPROVAL,
    });
    accepted = decision.accepted;

    // Deterministic settle gate: the resumed run asks the model again, and its
    // tool call reaches a final persisted state.
    await vi.waitFor(
      async () => {
        const { messages } = await memory.recall({ threadId, resourceId });
        const parts = messages
          .flatMap(message => (message.content as { parts?: Array<Record<string, any>> } | undefined)?.parts ?? [])
          .filter(part => part.type === 'tool-invocation' && part.toolInvocation?.toolName === toolName);
        if (variant === 'deny') {
          expect(parts.some(part => part.toolInvocation.state === 'output-denied')).toBe(true);
        } else {
          expect(parts.some(part => part.toolInvocation.state === 'result')).toBe(true);
        }
        expect(requests.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: SETTLE_TIMEOUT_MS },
    );

    const { messages } = await memory.recall({ threadId, resourceId });
    persisted = messages
      .flatMap(message => (message.content as { parts?: Array<Record<string, any>> } | undefined)?.parts ?? [])
      .filter(part => part.type === 'tool-invocation' && part.toolInvocation?.toolName === toolName)
      .map(part => ({ toolName: part.toolInvocation.toolName as string, state: part.toolInvocation.state as string }));
    userMessages = messages.filter(message => message.role === 'user').length;
  } finally {
    // `cleanup()` + `pubsub.close()` release everything this case holds;
    // `host.shutdown()` is the harness's teardown, asserted (evented) or run
    // outright (plain, durable) below.
    streamed.cleanup?.();
    await pubsub.close();

    if (engine === 'evented') {
      // COR-1391: the workflow finish tail re-reads `globalRunRegistry` after
      // this run's entry was deleted, so the shutdown drain dereferences a
      // valueless cache entry. Assert today's rejection; the step becomes an
      // unconditional `await host.shutdown({ drainTimeout: 1000 })` again when
      // COR-1391 lands.
      await expect(host.shutdown({ drainTimeout: 1000 })).rejects.toThrow(/reading 'mastra'/);
    } else {
      // COR-1391: the harness runs one engine per process, but all three
      // engines share this process, so the valueless key an earlier evented
      // variant leaves behind makes this shutdown throw the same TypeError.
      // Tolerating exactly that error is a consequence of the bug only — when
      // COR-1391 lands, this try/catch goes away and the call becomes an
      // unconditional `await host.shutdown({ drainTimeout: 1000 })` again,
      // alongside the evented assertion above.
      try {
        await host.shutdown({ drainTimeout: 1000 });
      } catch (error) {
        expect(String(error)).toMatch(/reading 'mastra'/);
      }
    }
  }

  return {
    engine,
    variant,
    accepted,
    events: log.map(event => `${event.tool}:${event.event}`),
    resumeDataSeen: log[0]?.resumeData ?? null,
    persisted,
    userMessages,
  };
}

/** Ids and timing are generated per run, matching the harness's contract. */
function comparable(contract: EngineContract) {
  return {
    variant: contract.variant,
    accepted: contract.accepted,
    events: contract.events,
    resumeDataSeen: contract.resumeDataSeen,
    persisted: contract.persisted.map(part => part.state),
    userMessages: contract.userMessages,
  };
}

describe('durable agent: T82 sendToolApproval', () => {
  it.each(VARIANTS)(
    'keeps the decision and the caller payload: %s',
    async variant => {
      const contracts: EngineContract[] = [];
      for (const engine of PARITY_ENGINES) contracts.push(await drive(engine, variant));

      const plain = contracts[0]!;
      for (const contract of contracts) {
        const where = `${contract.engine}: ${variant}`;
        // sendToolApproval accepted the targeted call.
        expect(contract.accepted, `${where}: accepted`).toBe(true);
        // Exactly one persisted user message, as in the harness.
        expect(contract.userMessages, `${where}: user messages`).toBe(1);

        if (variant === 'deny') {
          // The declined tool did not execute, and the call resolved instead of asking again.
          expect(contract.events, `${where}: no commits`).toEqual([]);
          expect(contract.persisted, `${where}: persisted calls`).toEqual([
            { toolName: 'approvalData', state: 'output-denied' },
          ]);
        } else if (variant === 'suspend') {
          // The ordinary suspended tool executed exactly once, with the caller payload unchanged.
          expect(contract.events, `${where}: commits`).toEqual(['strictSuspend:commit']);
          expect(contract.resumeDataSeen, `${where}: resume payload`).toEqual(CUSTOM_SUSPEND);
          expect(contract.persisted, `${where}: persisted calls`).toEqual([
            { toolName: 'strictSuspend', state: 'result' },
          ]);
        } else {
          // The approved tool executed exactly once and got the decision plus every custom field.
          expect(contract.events, `${where}: commits`).toEqual(['approvalData:commit']);
          expect(contract.resumeDataSeen, `${where}: resume payload`).toEqual({ approved: true, note: 'hello' });
          expect(contract.persisted, `${where}: persisted calls`).toEqual([
            { toolName: 'approvalData', state: 'result' },
          ]);
        }
      }

      const plainContract = comparable(plain);
      expect(contracts.slice(1).map(comparable)).toEqual(contracts.slice(1).map(() => plainContract));
    },
    TEST_TIMEOUT_MS,
  );
});
