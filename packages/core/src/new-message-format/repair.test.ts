import { tool } from '@internal/ai-v7';
import { MockLanguageModelV4 } from '@internal/ai-v7/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { scriptedModel, textTurn, toolCallTurn } from './model.mock';
import { repairOpenRun, SUPERSEDED_APPROVAL_REASON } from './repair';
import { runAgent } from './run';
import { InMemoryActionStorage } from './storage';
import { toModelMessages } from './to-model-messages';
import type { PersistableAction } from './types';

let n = 0;
const at = (runId: string, rest: Record<string, unknown>) =>
  ({
    id: `01J${String(++n).padStart(23, '0')}`,
    threadId: 't1',
    runId,
    createdAt: new Date(0),
    ...rest,
  }) as PersistableAction;
const userText = (runId: string, text: string) => at(runId, { type: 'text', role: 'user', text });
const call = (runId: string, toolCallId: string) =>
  at(runId, { type: 'tool-call', role: 'assistant', toolCallId, toolName: 'deleteFile', input: { path: '/x' } });
const runStart = (runId: string) => at(runId, { type: 'run-start', agentId: 'a', modelId: 'm', settings: {} });

/** A log a process left when it died after the model asked for a tool. */
const crashedAtToolCall = (started: boolean) => [
  runStart('r1'),
  userText('r1', 'delete /x'),
  at('r1', { type: 'turn-start' }),
  call('r1', 'c1'),
  ...(started ? [at('r1', { type: 'tool-started', toolCallId: 'c1', toolName: 'deleteFile' })] : []),
];

const types = (actions: { action: { type: string } }[]) => actions.map(c => c.action.type);

/** Every tool call in a projected prompt has a result, which providers require. */
function expectValidToolPairs(prompt: unknown) {
  const messages = prompt as { role: string; content: unknown }[];
  const parts = messages.flatMap(m =>
    Array.isArray(m.content) ? (m.content as { type: string; toolCallId?: string }[]) : [],
  );
  const calls = parts.filter(p => p.type === 'tool-call').map(p => p.toolCallId);
  const results = new Set(parts.filter(p => p.type === 'tool-result').map(p => p.toolCallId));
  for (const id of calls) expect(results.has(id), `tool call ${id} has a result`).toBe(true);
}

const drain = async (run: AsyncIterable<unknown>) => {
  for await (const _ of run) void _;
};

describe('repairOpenRun', () => {
  it('closes a call that never started, then the open turn and run', () => {
    const closers = repairOpenRun(crashedAtToolCall(false));
    expect(closers.map(c => c.action)).toEqual([
      expect.objectContaining({ type: 'tool-error', toolCallId: 'c1', code: 'TOOL_NOT_STARTED' }),
      { type: 'turn-end', finishReason: 'interrupted', usage: {} },
      { type: 'run-end', finishReason: 'interrupted', usage: {} },
    ]);
    expect(closers.every(c => c.runId === 'r1')).toBe(true);
  });

  it('marks a started call TOOL_OUTCOME_UNKNOWN and says so to the model', () => {
    const [error] = repairOpenRun(crashedAtToolCall(true));
    expect(error!.action).toMatchObject({ type: 'tool-error', code: 'TOOL_OUTCOME_UNKNOWN' });
    expect((error!.action as { errorText: string }).errorText).toMatch(/outcome is unknown/);
  });

  it('returns nothing for a repaired log', () => {
    const log = crashedAtToolCall(true);
    const repaired = [...log, ...repairOpenRun(log).map(c => at(c.runId!, c.action))];
    expect(repairOpenRun(repaired)).toEqual([]);
  });

  it('repairs every unclosed run, and only a turn that is still open', () => {
    const log = [
      runStart('r1'),
      userText('r1', 'a'),
      runStart('r2'),
      userText('r2', 'b'),
      at('r2', { type: 'turn-start' }),
      at('r2', { type: 'turn-end', finishReason: 'stop', usage: {} }),
    ];
    expect(repairOpenRun(log).map(c => [c.runId, c.action.type])).toEqual([
      ['r1', 'run-end'],
      ['r2', 'run-end'],
    ]);
  });

  it('reopens a run resumed after its run-end, so a crash in the resumed part is closed too', () => {
    const log = [
      ...crashedAtToolCall(false),
      at('r1', { type: 'tool-approval-requested', toolCallId: 'c1', toolName: 'deleteFile', approvalId: 'ap1' }),
      at('r1', { type: 'turn-end', finishReason: 'tool-calls', usage: {} }),
      at('r1', { type: 'run-end', finishReason: 'tool-calls', usage: {} }),
      at('r1', {
        type: 'tool-approval-responded',
        toolCallId: 'c1',
        toolName: 'deleteFile',
        approvalId: 'ap1',
        approved: true,
      }),
      at('r1', { type: 'tool-started', toolCallId: 'c1', toolName: 'deleteFile' }),
    ];
    expect(repairOpenRun(log).map(c => c.action)).toEqual([
      expect.objectContaining({ type: 'tool-error', code: 'TOOL_OUTCOME_UNKNOWN' }),
      { type: 'run-end', finishReason: 'interrupted', usage: {} },
    ]);
  });

  it('leaves a run that is waiting on its other approval closed, with the approved call open for its resume', () => {
    const log = [
      ...crashedAtToolCall(false),
      at('r1', { type: 'tool-approval-requested', toolCallId: 'c1', toolName: 'deleteFile', approvalId: 'ap1' }),
      at('r1', { type: 'tool-call', toolCallId: 'c2', toolName: 'deleteFile', input: { path: '/b' } }),
      at('r1', { type: 'tool-approval-requested', toolCallId: 'c2', toolName: 'deleteFile', approvalId: 'ap2' }),
      at('r1', { type: 'turn-end', finishReason: 'tool-calls', usage: {} }),
      at('r1', { type: 'run-end', finishReason: 'tool-calls', usage: {} }),
      at('r1', {
        type: 'tool-approval-responded',
        toolCallId: 'c1',
        toolName: 'deleteFile',
        approvalId: 'ap1',
        approved: true,
      }),
    ];
    expect(repairOpenRun(log, { resumingRunId: 'r1', answeredCallIds: new Set(['c1', 'c2']) })).toEqual([]);
    // New input instead: the unanswered call is superseded, the approved one never ran, and the run stays ended.
    expect(repairOpenRun(log).map(c => [c.action.type, 'code' in c.action ? c.action.code : undefined])).toEqual([
      ['tool-error', 'TOOL_NOT_STARTED'],
      ['tool-denied', undefined],
    ]);
  });

  it('closes an approved call that started in an earlier resume as outcome unknown when its run resumes', () => {
    const log = [
      ...crashedAtToolCall(false),
      at('r1', { type: 'tool-approval-requested', toolCallId: 'c1', toolName: 'deleteFile', approvalId: 'ap1' }),
      at('r1', { type: 'tool-call', toolCallId: 'c2', toolName: 'deleteFile', input: { path: '/b' } }),
      at('r1', { type: 'tool-approval-requested', toolCallId: 'c2', toolName: 'deleteFile', approvalId: 'ap2' }),
      at('r1', { type: 'turn-end', finishReason: 'tool-calls', usage: {} }),
      at('r1', { type: 'run-end', finishReason: 'tool-calls', usage: {} }),
      at('r1', {
        type: 'tool-approval-responded',
        toolCallId: 'c1',
        toolName: 'deleteFile',
        approvalId: 'ap1',
        approved: true,
      }),
      at('r1', { type: 'tool-started', toolCallId: 'c1', toolName: 'deleteFile' }),
    ];
    // The resume answering c2 leaves c2 to its input; c1 started, so it is not exempt and may have run.
    const closers = repairOpenRun(log, { resumingRunId: 'r1', answeredCallIds: new Set(['c2']) });
    expect(closers.map(c => c.action)).toEqual([
      expect.objectContaining({ type: 'tool-error', toolCallId: 'c1', code: 'TOOL_OUTCOME_UNKNOWN' }),
      { type: 'run-end', finishReason: 'interrupted', usage: {} },
    ]);
  });

  it('leaves a finished run closed when it writes rows after its run-end', () => {
    const log = [
      runStart('r1'),
      userText('r1', 'hi'),
      at('r1', { type: 'turn-start' }),
      at('r1', { type: 'text', role: 'assistant', text: 'Hello.' }),
      at('r1', { type: 'turn-end', finishReason: 'stop', usage: {} }),
      at('r1', { type: 'run-end', finishReason: 'stop', usage: {} }),
      at('r1', { type: 'thread-title-changed', title: 'Greeting' }),
    ];
    expect(repairOpenRun(log)).toEqual([]);
  });

  describe('a call waiting on approval', () => {
    const waiting = [
      ...crashedAtToolCall(false),
      at('r1', { type: 'tool-approval-requested', toolCallId: 'c1', toolName: 'deleteFile', approvalId: 'ap1' }),
      at('r1', { type: 'turn-end', finishReason: 'tool-calls', usage: {} }),
      at('r1', { type: 'run-end', finishReason: 'tool-calls', usage: {} }),
    ];

    it('stays open when the incoming run resumes its run', () => {
      expect(repairOpenRun(waiting, { resumingRunId: 'r1' })).toEqual([]);
    });

    it('is denied as superseded when anything else comes in', () => {
      expect(repairOpenRun(waiting, { resumingRunId: 'r9' }).map(c => c.action)).toEqual([
        { type: 'tool-denied', toolCallId: 'c1', toolName: 'deleteFile', reason: SUPERSEDED_APPROVAL_REASON },
      ]);
      expect(types(repairOpenRun(waiting))).toEqual(['tool-denied']);
    });
  });

  it('leaves a call the incoming input answers (a client tool outcome)', () => {
    const log = [
      ...crashedAtToolCall(false),
      at('r1', { type: 'turn-end', finishReason: 'tool-calls', usage: {} }),
      at('r1', { type: 'run-end', finishReason: 'tool-calls', usage: {} }),
    ];
    expect(repairOpenRun(log, { answeredCallIds: new Set(['c1']) })).toEqual([]);
    expect(types(repairOpenRun(log))).toEqual(['tool-error']);
  });

  it('ignores provider-executed calls, whose outcome comes from the provider', () => {
    const log = [
      runStart('r1'),
      at('r1', { ...call('r1', 'c1'), providerExecuted: true }),
      at('r1', { type: 'run-end', finishReason: 'stop', usage: {} }),
    ];
    expect(repairOpenRun(log)).toEqual([]);
  });

  it('projects a repaired log to valid tool call/result pairs', () => {
    const log = crashedAtToolCall(true);
    const repaired = [...log, ...repairOpenRun(log).map(c => at(c.runId!, c.action))];
    expectValidToolPairs(toModelMessages(repaired));
  });
});

describe('runAgent repairs and closes runs', () => {
  it('closes a crashed run before the next one starts, and the next prompt is valid', async () => {
    const memory = new InMemoryActionStorage();
    await memory.saveActions({ actions: crashedAtToolCall(true) });
    const { model, prompts } = scriptedModel([textTurn('I could not confirm the delete.')]);

    await drain(runAgent({ model, threadId: 't1', memory, runId: 'r2', input: 'did it work?' }));

    const log = await memory.listActions({ threadId: 't1' });
    const closers = log.filter(a => a.runId === 'r1').slice(-3);
    expect(closers.map(a => a.type)).toEqual(['tool-error', 'turn-end', 'run-end']);
    // Closers come before the new run's run-start.
    expect(log.findIndex(a => a.type === 'run-start' && a.runId === 'r2')).toBeGreaterThan(
      log.findIndex(a => a.type === 'run-end' && a.runId === 'r1'),
    );
    expectValidToolPairs(prompts[0]);
    expect(JSON.stringify(prompts[0])).toContain('outcome is unknown');
  });

  it('on abort while a tool runs: stores tool-started, an unknown outcome, then run-aborted; the next prompt is valid', async () => {
    const memory = new InMemoryActionStorage();
    const controller = new AbortController();
    const tools = {
      deleteFile: tool({
        inputSchema: z.object({ path: z.string() }),
        execute: async () => {
          controller.abort();
          await new Promise(resolve => setTimeout(resolve, 20));
          return { deleted: true };
        },
      }),
    };
    const { model } = scriptedModel([toolCallTurn('c1', 'deleteFile', { path: '/x' }), textTurn('Deleted.')]);
    await drain(
      runAgent({
        model,
        tools,
        threadId: 't1',
        memory,
        runId: 'r1',
        input: 'delete /x',
        abortSignal: controller.signal,
      }),
    ).catch(() => {});

    const log = await memory.listActions({ threadId: 't1' });
    const types = log.map(a => a.type);
    expect(types).toContain('tool-started');
    expect(types.indexOf('tool-started')).toBeGreaterThan(types.indexOf('tool-call'));
    expect(log.find(a => a.type === 'tool-error')).toMatchObject({ code: 'TOOL_OUTCOME_UNKNOWN' });
    expect(types.at(-1)).toBe('run-aborted');
    expect(types).not.toContain('run-end');

    const next = scriptedModel([textTurn('OK.')]);
    await drain(runAgent({ model: next.model, threadId: 't1', memory, input: 'anything else?' }));
    expectValidToolPairs(next.prompts[0]);
  });

  it('on abort mid-text: stores the text streamed so far, marked interrupted', async () => {
    const memory = new InMemoryActionStorage();
    const controller = new AbortController();
    const model = new MockLanguageModelV4({
      modelId: 'mock-model',
      doStream: async ({ abortSignal }) =>
        ({
          stream: new ReadableStream({
            start(c) {
              c.enqueue({ type: 'stream-start', warnings: [] });
              c.enqueue({ type: 'text-start', id: 't' });
              c.enqueue({ type: 'text-delta', id: 't', delta: 'Half an ans' });
              abortSignal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
            },
          }),
        }) as never,
    });
    const run = runAgent({ model, threadId: 't1', memory, input: 'hi', abortSignal: controller.signal });
    await (async () => {
      for await (const a of run) if (a.type === 'text-delta') controller.abort();
    })().catch(() => {});

    const log = await memory.listActions({ threadId: 't1' });
    expect(log.find(a => a.type === 'text' && a.role === 'assistant')).toMatchObject({
      text: 'Half an ans',
      interrupted: true,
    });
    expect(log.at(-1)!.type).toBe('run-aborted');
  });

  it('on a model error: stores the error, then closes the run with run-end error, also streamed', async () => {
    const memory = new InMemoryActionStorage();
    const failing = new MockLanguageModelV4({
      modelId: 'mock-model',
      doStream: async () => {
        throw new Error('provider down');
      },
    });
    const streamed: { type: string }[] = [];
    for await (const a of runAgent({ model: failing, threadId: 't1', memory, input: 'hi' })) streamed.push(a);
    const log = await memory.listActions({ threadId: 't1' });
    expect(log.find(a => a.type === 'error')).toMatchObject({ fatal: true, error: { message: 'provider down' } });
    expect(log.at(-1)).toMatchObject({ type: 'run-end', finishReason: 'error' });
    expect(streamed.at(-1)).toMatchObject({ type: 'run-end', finishReason: 'error' });
    expect(repairOpenRun(log)).toEqual([]);
  });

  it('rethrows the original error when writing the closers fails too', async () => {
    const memory = new InMemoryActionStorage();
    const { model } = scriptedModel([textTurn('Hi!')]);
    let saves = 0;
    const flaky = {
      listActions: memory.listActions.bind(memory),
      getLatestActionId: memory.getLatestActionId.bind(memory),
      saveActions: async (args: { actions: PersistableAction[] }) => {
        // The run-start write succeeds; the turn-end write fails first, then the closers' write.
        if (++saves === 1) return memory.saveActions(args);
        throw new Error(saves === 2 ? 'turn write failed' : 'closer write failed');
      },
    };
    await expect(drain(runAgent({ model, threadId: 't1', memory: flaky, input: 'hi' }))).rejects.toThrow(
      'turn write failed',
    );
    expect(saves).toBe(3);
  });
});

describe('approvals after repair', () => {
  const setup = () => {
    let executed = 0;
    const deleteFile = createTool({
      id: 'deleteFile',
      description: 'Deletes a file',
      inputSchema: z.object({ path: z.string() }),
      requireApproval: true,
      execute: async () => {
        executed++;
        return { deleted: true };
      },
    });
    const { model, prompts } = scriptedModel([
      toolCallTurn('call-1', 'deleteFile', { path: '/tmp/x' }),
      textTurn('Done.'),
      textTurn('Done.'),
    ]);
    const agent = new Agent({
      id: 'files',
      name: 'files',
      instructions: 'Manage files.',
      model,
      tools: { deleteFile },
    });
    const storage = new InMemoryStore();
    new Mastra({ agents: { files: agent }, storage, logger: false });
    return { agent, storage, prompts, executed: () => executed };
  };
  const memory = { thread: 'th1', resource: 'u1' };

  it('a new user message instead of an approval answer denies the call as superseded', async () => {
    const { agent, storage, prompts, executed } = setup();
    const first = await (await agent.__streamActions('Delete /tmp/x', { memory })).result;
    const runId = first.actions[0]!.runId!;

    await (
      await agent.__streamActions('Actually, never mind.', { memory })
    ).result;
    const store = (await storage.getStore('memory'))!;
    const log = await store.listActions({ threadId: 'th1' });
    expect(log.find(a => a.type === 'tool-denied')).toMatchObject({
      toolCallId: 'call-1',
      runId,
      reason: SUPERSEDED_APPROVAL_REASON,
    });
    expectValidToolPairs(prompts[1]);
    expect(executed()).toBe(0);
    await expect(agent.__approveToolCallActions({ runId, memory })).rejects.toThrow(/No pending tool approval/);
  });

  it('an approval answer resumes the call: it stays open and executes', async () => {
    const { agent, storage, executed } = setup();
    const first = await (await agent.__streamActions('Delete /tmp/x', { memory })).result;
    await (
      await agent.__approveToolCallActions({ runId: first.actions[0]!.runId!, memory })
    ).result;

    const log = await (await storage.getStore('memory'))!.listActions({ threadId: 'th1' });
    expect(executed()).toBe(1);
    expect(log.some(a => a.type === 'tool-denied' || a.type === 'tool-error')).toBe(false);
    expect(log.find(a => a.type === 'tool-result')).toMatchObject({ toolCallId: 'call-1' });
    expect(log.some(a => a.type === 'tool-started' && a.toolCallId === 'call-1')).toBe(true);
  });
});
