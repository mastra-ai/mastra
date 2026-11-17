import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Mastra } from '../../../../mastra';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import type { RequireToolApproval } from '../../../../tools';
import { AGENTIC_LOOP_WORKFLOW_ID } from '../../../loop-builder';
import { REQUIRE_TOOL_APPROVAL_FALLBACK_KEY } from '../../../workflows/agentic-execution/tool-approval-verdict';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * A tool call that starts after another call of the same step was suspended and resumed.
 *
 * The model emits a call that suspends itself (`ask`) and an approval-gated call. Calls run one
 * at a time (a registered tool can suspend), so the gated call first starts inside the resumed
 * run. It must ask for its own approval whatever form the approval policy takes.
 */
describeForAllEngines('AIMock loop scenario: approval of a tool call started after a resume', engine => {
  const getMock = useLoopScenarioAimock();
  const isPlainLoop = !isDurableEngineVariant(engine);

  type Run = { output?: any; fullStream: AsyncIterable<ChunkType>; runId: string };
  type ToolCall = { id: string; name: string; arguments: Record<string, unknown> };

  function buildTools(log: string[], askSuspendPayloads: unknown[], { deleteAllRequiresApproval = false } = {}) {
    return {
      ask: createTool({
        id: 'ask',
        description: 'Ask the user a question.',
        inputSchema: z.object({}),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async (_input, { agent }) => {
          const answer = (agent?.resumeData as { answer?: string } | undefined)?.answer;
          if (!answer) return agent!.suspend({ question: 'Which files?' });
          log.push('ran:ask');
          askSuspendPayloads.push(agent?.suspendPayload);
          return { answer };
        },
      }),
      delete_file: createTool({
        id: 'delete_file',
        description: 'Delete a file.',
        inputSchema: z.object({ path: z.string() }),
        execute: async () => {
          log.push('ran:delete_file');
          return { deleted: true };
        },
      }),
      delete_all: createTool({
        id: 'delete_all',
        description: 'Delete every file.',
        inputSchema: z.object({}),
        ...(deleteAllRequiresApproval ? { requireApproval: true } : {}),
        execute: async () => {
          log.push('ran:delete_all');
          return { count: 5 };
        },
      }),
      read_file: createTool({
        id: 'read_file',
        description: 'Read a file.',
        inputSchema: z.object({ path: z.string() }),
        execute: async () => {
          log.push('ran:read_file');
          return { content: 'hello' };
        },
      }),
      // Can suspend, so it is never started before the model finishes streaming.
      check_disk: createTool({
        id: 'check_disk',
        description: 'Check free disk space.',
        inputSchema: z.object({}),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async () => {
          log.push('ran:check_disk');
          return { free: '10GB' };
        },
      }),
    };
  }

  /**
   * Streams the run and answers every pause: approvals are approved, suspensions resumed with
   * an answer. `log` records each pause next to the tool executions, in the order they happened.
   */
  async function drive({
    toolCalls,
    requireToolApproval,
    deleteAllRequiresApproval,
    passPolicyOnResume = false,
    onlyCalledTools = false,
    beforeFirstResume,
    nextStepToolCalls,
  }: {
    toolCalls: ToolCall[];
    requireToolApproval?: RequireToolApproval;
    deleteAllRequiresApproval?: boolean;
    /** Pass `requireToolApproval` again on every resume. */
    passPolicyOnResume?: boolean;
    /** Register only the called tools, so no other tool forces the calls to run one at a time. */
    onlyCalledTools?: boolean;
    beforeFirstResume?: (mastra: Mastra, runId: string) => Promise<void>;
    /** Calls the model emits in its next response, after the first calls have results. */
    nextStepToolCalls?: ToolCall[];
  }) {
    const llm = getMock();
    const responses = [{ toolCalls }, ...(nextStepToolCalls ? [{ toolCalls: nextStepToolCalls }] : [])];
    responses.forEach((response, sequenceIndex) => llm.on({ endpoint: 'chat', sequenceIndex }, response));
    llm.on({ endpoint: 'chat', sequenceIndex: responses.length }, { content: 'done' });

    const log: string[] = [];
    // What the resumed `ask` received as the payload it suspended with.
    const askSuspendPayloads: unknown[] = [];
    const allTools = buildTools(log, askSuspendPayloads, { deleteAllRequiresApproval });
    const calledNames = new Set([...toolCalls, ...(nextStepToolCalls ?? [])].map(call => call.name));
    const tools = onlyCalledTools
      ? Object.fromEntries(Object.entries(allTools).filter(([name]) => calledNames.has(name)))
      : allTools;
    const { agent, mastra } = await createSharedAgent(llm, { engine, instructions: 'Use the tools.', tools });
    const scenarioAgent = agent as any;
    const resumePolicy = passPolicyOnResume ? { requireToolApproval } : {};

    let run: Run = await scenarioAgent.stream('Clean up my files.', {
      ...(requireToolApproval !== undefined ? { requireToolApproval } : {}),
    });
    const runId = run.runId;
    const answered = new Set<string>();
    for (let resumes = 0; resumes <= calledNames.size * 2 + 2; resumes++) {
      let pause: { kind: 'approval' | 'suspended'; toolCallId: string } | undefined;
      for await (const chunk of run.fullStream) {
        if (chunk.type !== 'tool-call-approval' && chunk.type !== 'tool-call-suspended') continue;
        const kind = chunk.type === 'tool-call-approval' ? 'approval' : 'suspended';
        const toolCallId = (chunk.payload as { toolCallId: string }).toolCallId;
        if (answered.has(`${kind}:${toolCallId}`)) continue;
        log.push(`${kind}:${toolCallId}`);
        pause ??= { kind, toolCallId };
        // Durable streams stay open while the run is suspended.
        if (isDurableEngineVariant(engine)) break;
      }
      if (!pause) break;
      if (answered.size === 0) await beforeFirstResume?.(mastra, runId);
      answered.add(`${pause.kind}:${pause.toolCallId}`);
      run =
        pause.kind === 'approval'
          ? await scenarioAgent.approveToolCall({ runId, toolCallId: pause.toolCallId, ...resumePolicy })
          : await scenarioAgent.resumeStream(
              { answer: 'all of them' },
              { runId, toolCallId: pause.toolCallId, ...resumePolicy },
            );
    }

    return { log, askSuspendPayloads, text: await (run.output ?? run).text };
  }

  /**
   * Resolves once the agent run is stored as suspended. A durable stream announces a suspension
   * before the run is stored, so a test that edits the stored run waits for the write itself.
   */
  async function untilStoredSuspended(store: any, runId: string): Promise<void> {
    const isSuspended = async () =>
      (await store.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId }))?.status === 'suspended' ||
      (await store.loadWorkflowSnapshot({ workflowName: 'durable-agentic-loop', runId }))?.status === 'suspended';
    let resolveStored!: () => void;
    const stored = new Promise<void>(resolve => (resolveStored = resolve));
    // Wrapped before the first read, so a write that lands during that read is still seen.
    const writers = new Set<string>();
    for (let proto = store; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (/^(persist|update|save|write)/.test(name) && typeof store[name] === 'function') writers.add(name);
      }
    }
    for (const name of writers) {
      const original = store[name].bind(store);
      store[name] = async (...args: unknown[]) => {
        const result = await original(...args);
        if (await isSuspended()) resolveStored();
        return result;
      };
    }
    if (await isSuspended()) resolveStored();
    await stored;
  }

  /**
   * Rewrites the stored snapshots of a suspended agent run (the loop and its nested execution
   * run) the way an earlier version would have stored them. Returns how many it changed.
   */
  async function editStoredRuns(
    mastra: Mastra,
    runId: string,
    edit: (snapshot: Record<string, unknown>) => boolean,
  ): Promise<number> {
    const store = (await mastra.getStorage()!.getStore('workflows'))!;
    await untilStoredSuspended(store, runId);
    let changed = 0;
    for (const run of (await store.listWorkflowRuns({})).runs) {
      const snapshot = (await store.loadWorkflowSnapshot({ workflowName: run.workflowName, runId: run.runId })) as
        | (Record<string, unknown> & { parentWorkflow?: { runId?: string } })
        | null;
      if (!snapshot || (run.runId !== runId && snapshot.parentWorkflow?.runId !== runId)) continue;
      if (!edit(snapshot)) continue;
      await store.persistWorkflowSnapshot({
        workflowName: run.workflowName,
        runId: run.runId,
        snapshot: snapshot as never,
      });
      changed++;
    }
    return changed;
  }

  const askThenDeleteAll = [
    { id: 'call_ask', name: 'ask', arguments: {} },
    { id: 'call_delete_all', name: 'delete_all', arguments: {} },
  ];

  it.each([
    { policy: 'a tool-level requireApproval', deleteAllRequiresApproval: true },
    { policy: 'requireToolApproval: true', requireToolApproval: true },
    {
      policy: 'a requireToolApproval function',
      requireToolApproval: ({ toolName }: { toolName: string }) => /^delete_/.test(toolName),
    },
  ])(
    'asks for approval of a call started after a resumed suspension, with $policy',
    async ({ deleteAllRequiresApproval, requireToolApproval }) => {
      const { log, askSuspendPayloads, text } = await drive({
        toolCalls: askThenDeleteAll,
        requireToolApproval: requireToolApproval as RequireToolApproval | undefined,
        deleteAllRequiresApproval,
      });

      // A boolean policy also gates `ask`, which is approved before it suspends.
      const askPauses =
        requireToolApproval === true ? ['approval:call_ask', 'suspended:call_ask'] : ['suspended:call_ask'];
      expect(log).toEqual([...askPauses, 'ran:ask', 'approval:call_delete_all', 'ran:delete_all']);
      // The resumed call still gets the payload it suspended with.
      expect(askSuspendPayloads).toEqual([{ question: 'Which files?' }]);
      expect(text).toBe('done');
    },
  );

  it('runs a call started after a resumed suspension without asking when no policy is set', async () => {
    const { log, text } = await drive({
      toolCalls: [
        { id: 'call_ask', name: 'ask', arguments: {} },
        { id: 'call_check', name: 'check_disk', arguments: {} },
      ],
    });

    expect(log).toEqual(['suspended:call_ask', 'ran:ask', 'ran:check_disk']);
    expect(text).toBe('done');
  });

  const deleteThenRead = [
    { id: 'call_delete', name: 'delete_file', arguments: { path: 'a.txt' } },
    { id: 'call_read', name: 'read_file', arguments: { path: 'b.txt' } },
  ];
  const deletePattern = ({ toolName }: { toolName: string }) => /^delete_/.test(toolName);

  // The plain loop cannot keep a function policy across a resume: it stores only that a
  // policy was set, and gates every call that starts after the resume. Durable and evented
  // agents read the live function from the run registry in the same process.
  it(
    isPlainLoop
      ? 'asks for every call started after a resume that does not pass the policy function again'
      : 'does not ask for a call started after a resume that the policy function does not match',
    async () => {
      const { log, text } = await drive({ toolCalls: deleteThenRead, requireToolApproval: deletePattern });

      expect(log).toEqual(
        isPlainLoop
          ? ['approval:call_delete', 'ran:delete_file', 'approval:call_read', 'ran:read_file']
          : ['approval:call_delete', 'ran:delete_file', 'ran:read_file'],
      );
      expect(text).toBe('done');
    },
  );

  it('decides per call after a resume that passes the policy function again', async () => {
    const { log, text } = await drive({
      toolCalls: deleteThenRead,
      requireToolApproval: deletePattern,
      passPolicyOnResume: true,
    });

    expect(log).toEqual(['approval:call_delete', 'ran:delete_file', 'ran:read_file']);
    expect(text).toBe('done');
  });

  // A call the model emits in a later response of the resumed run could be started while the
  // response still streams, before the step reaches its approval gate.
  it('asks for approval of a call the model emits after a resume that does not pass the policy function again', async () => {
    const { log, text } = await drive({
      toolCalls: [{ id: 'call_delete', name: 'delete_file', arguments: { path: 'a.txt' } }],
      nextStepToolCalls: [{ id: 'call_delete_all', name: 'delete_all', arguments: {} }],
      requireToolApproval: deletePattern,
      onlyCalledTools: true,
    });

    expect(log).toEqual(['approval:call_delete', 'ran:delete_file', 'approval:call_delete_all', 'ran:delete_all']);
    expect(text).toBe('done');
  });

  // A run stored by an earlier version keeps no trace of a function policy. Nothing forces the
  // calls to run one at a time on resume, so `delete_all` starts next to the approved call and
  // is handed that call's approval payload, the only sign left that the run needed approvals.
  it('asks for approval of a call started next to a resumed approval in a run stored without its policy', async () => {
    let edited = 0;
    const { log, text } = await drive({
      toolCalls: [
        { id: 'call_delete', name: 'delete_file', arguments: { path: 'a.txt' } },
        { id: 'call_delete_all', name: 'delete_all', arguments: {} },
      ],
      requireToolApproval: deletePattern,
      onlyCalledTools: true,
      beforeFirstResume: async (mastra, runId) => {
        // Durable and evented agents store a boolean shadow in their own run input instead.
        if (!isPlainLoop) return;
        edited = await editStoredRuns(mastra, runId, snapshot => {
          const requestContext = (snapshot as { requestContext?: Record<string, unknown> }).requestContext;
          if (requestContext?.[REQUIRE_TOOL_APPROVAL_FALLBACK_KEY] !== true) return false;
          delete requestContext[REQUIRE_TOOL_APPROVAL_FALLBACK_KEY];
          return true;
        });
      },
    });

    // The agent loop and its nested execution workflow each store the request context.
    expect(edited).toBe(isPlainLoop ? 2 : 0);
    // Both calls run in the resumed run, so their entries interleave.
    expect(log[0]).toBe('approval:call_delete');
    expect([...log].sort()).toEqual([
      'approval:call_delete',
      'approval:call_delete_all',
      'ran:delete_all',
      'ran:delete_file',
    ]);
    expect(log.indexOf('approval:call_delete_all')).toBeLessThan(log.indexOf('ran:delete_all'));
    expect(text).toBe('done');
  });

  // Suspensions stored before @mastra/core 1.50.0 did not name their tool call. The evented
  // engine hands such a payload to the call that starts next as well; read as that call's own,
  // it would let `delete_all` skip its approval.
  it('asks for approval of a call started after resuming a suspension stored without its tool call id', async () => {
    let stripped = 0;
    const { log, askSuspendPayloads, text } = await drive({
      toolCalls: askThenDeleteAll,
      deleteAllRequiresApproval: true,
      beforeFirstResume: async (mastra, runId) => {
        const strip = (value: unknown): boolean => {
          if (!value || typeof value !== 'object') return false;
          let changed = false;
          if ('toolCallSuspended' in value && 'toolCallId' in value) {
            delete (value as { toolCallId?: unknown }).toolCallId;
            changed = true;
          }
          for (const child of Object.values(value)) changed = strip(child) || changed;
          return changed;
        };
        stripped = await editStoredRuns(mastra, runId, strip);
      },
    });

    expect(stripped).toBeGreaterThan(0);
    expect(log).toEqual(['suspended:call_ask', 'ran:ask', 'approval:call_delete_all', 'ran:delete_all']);
    // `ask` resumes with its resume data but no longer receives the payload it suspended with.
    expect(askSuspendPayloads).toEqual([undefined]);
    expect(text).toBe('done');
  });
});
