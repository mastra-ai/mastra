/**
 * A run started by one caller and approved by another: the approved call runs with the approving
 * caller's context, and the model steps after it are offered the tools the approving caller would get.
 * Each tool source below depends on the caller.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type Log = { offered: string[][]; ran: string[] };

/**
 * Records `id:caller` when run. A tool built for one caller and run for another records
 * `id:<caller> built for <builtFor>`, the way a real tool closes over its caller (an API client, a token).
 */
function ranAs(id: string, builtFor: string | undefined, context: any) {
  const who = context?.requestContext?.get('who');
  return builtFor === undefined || builtFor === who ? `${id}:${who}` : `${id}:${who} built for ${builtFor}`;
}

function tool(id: string, log: Log, requireApproval = false, builtFor?: string) {
  return createTool({
    id,
    description: id,
    inputSchema: z.object({}),
    requireApproval,
    execute: async (_input, context) => {
      log.ran.push(ranAs(id, builtFor, context));
      return { ok: true };
    },
  });
}

function createModel(log: Log) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt, tools }) => {
      log.offered.push((tools ?? []).map(t => t.name).sort());
      const answered = prompt.some(message => message.role === 'tool');
      const parts = answered
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage },
          ]
        : [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'approve', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function createRuntime(engine: 'default' | 'evented', storage: InMemoryStore, log: Log, recovery = false) {
  const agent = new Agent({
    id: 'matrix-agent',
    name: 'matrix-agent',
    instructions: 'Use your tools.',
    model: createModel(log),
    tools: ({ requestContext }) => {
      const who = requestContext.get('who') as string;
      return {
        approve: tool('approve', log, true, who),
        secret: tool('secret', log, false, who),
        [`${who}_agent`]: tool(`${who}_agent`, log),
      };
    },
    defaultOptions: ({ requestContext }) => {
      const who = requestContext.get('who') as string;
      return { toolsets: { defaults: { [`${who}_default`]: tool(`${who}_default`, log) } } };
    },
    inputProcessors: [
      {
        id: 'withhold-secret',
        processInputStep: ({ tools }: { tools?: Record<string, unknown> }) => {
          const { secret: _secret, ...rest } = tools ?? {};
          return { tools: rest };
        },
      },
    ],
  });
  const durable =
    engine === 'evented'
      ? createEventedAgent({ agent })
      : createDurableAgent({ agent, ...(recovery ? { storageVersion: 1 as const } : {}) });
  new Mastra({
    agents: { matrix: durable as any },
    storage,
    logger: false,
    ...(recovery ? { recovery: { durableAgents: 'auto' as const } } : {}),
  });
  return durable;
}

function caller(who: string) {
  const requestContext = new RequestContext();
  requestContext.set('who', who);
  return requestContext;
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  for await (const _chunk of stream.fullStream) {
    // consume
  }
}

describe.each(['default', 'evented'] as const)('resume by another caller (%s)', engine => {
  it.each([
    ['same process', true],
    ['same process', false],
    ['fresh process', true],
    ['fresh process', false],
  ] as const)(
    '%s, resume passes toolsets=%s: later steps offer the approving caller tools',
    async (path, resumeToolsets) => {
      globalRunRegistry.clear();
      const storage = new InMemoryStore();
      const log: Log = { offered: [], ran: [] };
      const starter = createRuntime(engine, storage, log);

      const stream = await starter.stream('Go', {
        requestContext: caller('alice'),
        toolsets: { start: { alice_call: tool('alice_call', log) } },
      });
      let toolCallId: string | undefined;
      for await (const chunk of stream.fullStream as AsyncIterable<any>) {
        if (chunk.type === 'tool-call-approval') {
          toolCallId = chunk.payload.toolCallId;
          break;
        }
      }
      expect(toolCallId).toBeTruthy();
      const workflows = (await storage.getStore('workflows'))!;
      await vi.waitFor(async () => {
        const run = await workflows.getWorkflowRunById({
          runId: stream.runId,
          workflowName: DurableStepIds.AGENTIC_LOOP,
        });
        expect((run?.snapshot as any)?.status).toBe('suspended');
      });
      expect(log.offered).toEqual([['alice_agent', 'alice_call', 'alice_default', 'approve']]);

      let approver = starter;
      if (path === 'fresh process') {
        globalRunRegistry.clear();
        approver = createRuntime(engine, storage, log);
      }
      await drain(
        await approver.approveToolCall({
          runId: stream.runId,
          toolCallId: toolCallId!,
          requestContext: caller('bob'),
          ...(resumeToolsets ? { toolsets: { resume: { bob_call: tool('bob_call', log) } } } : {}),
        }),
      );

      // Bob's agent and default tools, and the resume's own toolsets. A resume cannot repeat call-time
      // toolsets over HTTP, so without them the same process keeps the starting call's; another process
      // never had them.
      expect(log.ran).toEqual(['approve:bob']);
      const keepsStartingToolsets = !resumeToolsets && path === 'same process';
      expect(log.offered[1]).toEqual([
        ...(keepsStartingToolsets ? ['alice_call'] : []),
        'approve',
        'bob_agent',
        ...(resumeToolsets ? ['bob_call'] : []),
        'bob_default',
      ]);
    },
  );
});

describe('crash recovery, then resume by another caller', () => {
  it.each([
    { crash: 'before the model step', resumeToolsets: true },
    { crash: 'before the model step', resumeToolsets: false },
    { crash: 'after the model step', resumeToolsets: false },
  ])('crash $crash, resume passes toolsets=$resumeToolsets', async ({ crash, resumeToolsets }) => {
    globalRunRegistry.clear();
    const log: Log = { offered: [], ran: [] };
    const original = new InMemoryStore();
    const workflows = (await original.getStore('workflows'))!;
    const rows = new Map<string, any>();
    let crashRows: any[] | undefined;
    let suspended = false;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    workflows.persistWorkflowSnapshot = async args => {
      if (args.snapshot.status === 'suspended') suspended = true;
      if (!suspended) rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
      // Before the model step: the first checkpoint of the inner execution. After it: the last
      // checkpoint before the run suspends, so recovery resumes at the tool call.
      if (
        (crash === 'after the model step' ? !suspended : !crashRows) &&
        args.workflowName === DurableStepIds.AGENTIC_EXECUTION
      ) {
        crashRows = [...rows.values()].map(row => structuredClone(row));
      }
      return persist(args);
    };
    const starter = createRuntime('default', original, log, true);
    // No call-time toolsets: recovery refuses runs started with them (#25860).
    const stream = await starter.stream('Go', { requestContext: caller('alice') });
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') break;
    }
    expect(crashRows?.length).toBeGreaterThan(0);

    // The crashed process is gone; a new one (its own module graph) recovers from what it left.
    log.offered = [];
    vi.resetModules();
    const [
      { Mastra: M },
      { InMemoryStore: Store },
      { Agent: A },
      { createDurableAgent: durableFor },
      { createTool: makeTool },
      { RequestContext: RC },
    ] = await Promise.all([
      import('../../../mastra'),
      import('../../../storage'),
      import('../../agent'),
      import('../create-durable-agent'),
      import('../../../tools'),
      import('../../../request-context'),
    ]);
    const freshTool = (id: string, requireApproval = false, builtFor?: string) =>
      makeTool({
        id,
        description: id,
        inputSchema: z.object({}),
        requireApproval,
        execute: async (_input: unknown, context: any) => {
          log.ran.push(ranAs(id, builtFor, context));
          return { ok: true };
        },
      });
    const recoveringAgent = new A({
      id: 'matrix-agent',
      name: 'matrix-agent',
      instructions: 'Use your tools.',
      model: createModel(log),
      tools: ({ requestContext }: any) => {
        const who = requestContext.get('who') as string;
        return {
          approve: freshTool('approve', true, who),
          secret: freshTool('secret', false, who),
          [`${who}_agent`]: freshTool(`${who}_agent`),
        };
      },
      defaultOptions: ({ requestContext }: any) => {
        const who = requestContext.get('who') as string;
        return { toolsets: { defaults: { [`${who}_default`]: freshTool(`${who}_default`) } } };
      },
      inputProcessors: [
        {
          id: 'withhold-secret',
          processInputStep: ({ tools }: { tools?: Record<string, unknown> }) => {
            const { secret: _secret, ...rest } = tools ?? {};
            return { tools: rest };
          },
        },
      ],
    });
    const recovering = durableFor({ agent: recoveringAgent, storageVersion: 1 });
    const storage = new Store();
    new M({ agents: { matrix: recovering as any }, storage, logger: false, recovery: { durableAgents: 'auto' } });
    const recoveredWorkflows = (await storage.getStore('workflows'))!;
    for (const row of crashRows!) await recoveredWorkflows.persistWorkflowSnapshot(row);
    let toolCallId: string | undefined;
    for await (const chunk of (await recovering.recover(stream.runId)).fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    expect(toolCallId).toBeTruthy();
    await vi.waitFor(async () => {
      const run = await recoveredWorkflows.getWorkflowRunById({
        runId: stream.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      expect((run?.snapshot as any)?.status).toBe('suspended');
    });
    if (crash === 'before the model step') expect(log.offered[0]).toEqual(['alice_agent', 'alice_default', 'approve']);

    const bob = new RC();
    bob.set('who', 'bob');
    await drain(
      await recovering.approveToolCall({
        runId: stream.runId,
        toolCallId: toolCallId!,
        requestContext: bob,
        ...(resumeToolsets ? { toolsets: { resume: { bob_call: freshTool('bob_call') } } } : {}),
      }),
    );
    expect(log.ran).toEqual(['approve:bob']);
    // Recovered at the tool call, the next step rebuilds from the saved snapshot, whose ordinary
    // values (like `who` here, unlike the signed-in user) are the starting caller's. Tracked on COR-1660.
    if (crash === 'after the model step') return;
    expect(log.offered.at(-1)).toEqual([
      'approve',
      'bob_agent',
      ...(resumeToolsets ? ['bob_call'] : []),
      'bob_default',
    ]);
  });
});

describe('approving a call to a tool only the starting caller has', () => {
  function adminModel() {
    return new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const answered = prompt.some(message => message.role === 'tool');
        const parts = answered
          ? [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ]
          : [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'alice_admin', input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ];
        return {
          stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any[]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });
  }

  function adminRuntime(engine: 'plain' | 'default' | 'evented', storage: InMemoryStore, log: Log) {
    const agent = new Agent({
      id: 'admin-agent',
      name: 'admin-agent',
      instructions: 'Use your tools.',
      model: adminModel(),
      tools: ({ requestContext }) =>
        requestContext.get('who') === 'alice'
          ? { alice_admin: tool('alice_admin', log, true) }
          : { bob_tool: tool('bob_tool', log) },
    });
    const runtime =
      engine === 'plain' ? agent : engine === 'evented' ? createEventedAgent({ agent }) : createDurableAgent({ agent });
    new Mastra({ agents: { admin: runtime as any }, storage, logger: false });
    return runtime;
  }

  it.each([
    ['plain', 'same process'],
    ['plain', 'fresh process'],
    ['default', 'same process'],
    ['default', 'fresh process'],
    ['evented', 'same process'],
    ['evented', 'fresh process'],
  ] as const)('%s, %s: the call fails instead of running as the starting caller', async (engine, path) => {
    globalRunRegistry.clear();
    const storage = new InMemoryStore();
    const log: Log = { offered: [], ran: [] };
    const starter = adminRuntime(engine, storage, log) as Agent;
    const stream = await starter.stream('Go', { requestContext: caller('alice') });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    expect(toolCallId).toBeTruthy();
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const runs = await Promise.all(
        ['agentic-loop', DurableStepIds.AGENTIC_LOOP].map(workflowName =>
          workflows.getWorkflowRunById({ runId: stream.runId, workflowName }),
        ),
      );
      expect(runs.some(run => (run?.snapshot as any)?.status === 'suspended')).toBe(true);
    });

    let approver = starter;
    if (path === 'fresh process') {
      globalRunRegistry.clear();
      approver = adminRuntime(engine, storage, log) as Agent;
    }
    const errors: string[] = [];
    for await (const chunk of (
      await approver.approveToolCall({ runId: stream.runId, toolCallId: toolCallId!, requestContext: caller('bob') })
    ).fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-error') errors.push(String(chunk.payload?.error?.message ?? chunk.payload?.error));
    }

    expect(log.ran).toEqual([]);
    expect(errors.join('\n')).toContain('alice_admin');
  });
});

describe.each(['default', 'evented'] as const)('a same-process resume whose tools cannot be built (%s)', engine => {
  it("fails it, and a later resume without a request context does not run the earlier caller's tools", async () => {
    globalRunRegistry.clear();
    const log: Log = { offered: [], ran: [] };
    const agent = new Agent({
      id: 'matrix-agent',
      name: 'matrix-agent',
      instructions: 'Use your tools.',
      model: createModel(log),
      tools: ({ requestContext }) => {
        const who = requestContext.get('who') as string;
        if (who === 'unbuildable') throw new Error('tools unavailable');
        return { approve: tool('approve', log, true, who) };
      },
    });
    const durable = engine === 'evented' ? createEventedAgent({ agent }) : createDurableAgent({ agent });
    const storage = new InMemoryStore();
    new Mastra({ agents: { matrix: durable as any }, storage, logger: false });

    const stream = await durable.stream('Go', { requestContext: caller('alice') });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const run = await workflows.getWorkflowRunById({
        runId: stream.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      expect((run?.snapshot as any)?.status).toBe('suspended');
    });

    await expect(
      durable.approveToolCall({ runId: stream.runId, toolCallId: toolCallId!, requestContext: caller('unbuildable') }),
    ).rejects.toThrow('tools unavailable');

    const later = durable.approveToolCall({ runId: stream.runId, toolCallId: toolCallId! }).then(drain);
    await expect(later).rejects.toThrow('tools unavailable');
    expect(log.ran).toEqual([]);
  });
});
