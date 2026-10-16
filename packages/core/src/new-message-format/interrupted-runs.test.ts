import { tool } from '@internal/ai-v7';
import { convertArrayToReadableStream, MockLanguageModelV4 } from '@internal/ai-v7/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { scriptedModel, textTurn, toolCallTurn } from './model.mock';
import { repairOpenRun } from './repair';
import { runAgent } from './run';
import { InMemoryActionStorage } from './storage';
import { toModelMessages } from './to-model-messages';
import { isPersistable } from './types';
import type { MastraAction, PersistableAction } from './types';

const drain = async (run: AsyncIterable<unknown>) => {
  for await (const _ of run) void _;
};

/** Every tool call in a projected prompt has exactly one result, which providers require. */
function expectValidToolPairs(prompt: unknown) {
  const parts = (prompt as { content: unknown }[]).flatMap(m =>
    Array.isArray(m.content) ? (m.content as { type: string; toolCallId?: string }[]) : [],
  );
  const results = parts.filter(p => p.type === 'tool-result').map(p => p.toolCallId);
  for (const call of parts.filter(p => p.type === 'tool-call'))
    expect(
      results.filter(id => id === call.toolCallId),
      `one result for ${call.toolCallId}`,
    ).toHaveLength(1);
}

/** A storage that records the ids of each batch as it commits, and can delay or fail chosen batches. */
class ObservedStorage extends InMemoryActionStorage {
  commits: string[][] = [];
  delay?: (batch: PersistableAction[]) => number;
  fail?: (batch: PersistableAction[]) => boolean;
  override async saveActions(args: { actions: PersistableAction[] }) {
    const ms = this.delay?.(args.actions) ?? 0;
    if (ms) await new Promise(r => setTimeout(r, ms));
    if (this.fail?.(args.actions)) throw new Error('write failed');
    await super.saveActions(args);
    this.commits.push(args.actions.map(a => a.id));
  }
}

const hasStarted = (batch: PersistableAction[]) => batch.some(a => a.type === 'tool-started');

describe('the start gate', () => {
  it('B1: an approved call whose tool-started save fails does not run, and is closed as not started', async () => {
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
    const { model, prompts } = scriptedModel([toolCallTurn('call-1', 'deleteFile', { path: '/x' }), textTurn('OK.')]);
    const agent = new Agent({ id: 'files', name: 'files', instructions: 'Files.', model, tools: { deleteFile } });
    const storage = new InMemoryStore();
    new Mastra({ agents: { files: agent }, storage, logger: false });
    const store = (await storage.getStore('memory'))!;
    const memory = { thread: 'th1', resource: 'u1' };

    const first = await (await agent.stream('Delete /x', { memory })).result;
    const save = store.saveActions.bind(store);
    store.saveActions = async args => {
      if (hasStarted(args.actions)) throw new Error('write failed');
      return save(args);
    };
    await (await agent.approveToolCall({ runId: first.actions[0]!.runId!, memory })).result.catch(() => {});

    expect(executed).toBe(0);
    const log = await store.listActions({ threadId: 'th1' });
    expect(log.some(a => a.type === 'tool-started')).toBe(false);
    expect(log.find(a => a.type === 'tool-error')).toMatchObject({ toolCallId: 'call-1', code: 'TOOL_NOT_STARTED' });
    expect(repairOpenRun(log)).toEqual([]);
    expectValidToolPairs(prompts.at(-1));
  });

  it('B2: an abort before the tool-call is read writes no tool-started and the tool does not run', async () => {
    let executed = 0;
    const memory = new InMemoryActionStorage();
    const controller = new AbortController();
    const tools = {
      deleteFile: tool({
        inputSchema: z.object({ path: z.string() }),
        execute: async () => {
          executed++;
          return { deleted: true };
        },
      }),
    };
    const { model } = scriptedModel([toolCallTurn('c1', 'deleteFile', { path: '/x' }), textTurn('Done.')]);
    const run = runAgent({ model, tools, threadId: 't1', memory, input: 'delete /x', abortSignal: controller.signal });
    for await (const action of run) {
      if (action.type === 'turn-start') {
        controller.abort();
        await new Promise(r => setTimeout(r, 20));
        break;
      }
    }

    expect(executed).toBe(0);
    const log = await memory.listActions({ threadId: 't1' });
    const types = log.map(a => a.type);
    if (types.includes('tool-started'))
      expect(types.indexOf('tool-started')).toBeGreaterThan(types.indexOf('tool-call'));
    expect(log.find(a => a.type === 'tool-error')?.code ?? 'TOOL_NOT_STARTED').toBe('TOOL_NOT_STARTED');
    expect(types.at(-1)).toBe('run-aborted');
    expect(repairOpenRun(log)).toEqual([]);
  });

  it('B3: on an early return with a tool-started write in flight, batches commit in id order', async () => {
    const memory = new ObservedStorage();
    memory.delay = batch => (hasStarted(batch) ? 30 : 0);
    const tools = {
      deleteFile: tool({
        inputSchema: z.object({ path: z.string() }),
        execute: async () => ({ deleted: true }),
      }),
    };
    const { model } = scriptedModel([toolCallTurn('c1', 'deleteFile', { path: '/x' }), textTurn('Done.')]);
    for await (const action of runAgent({ model, tools, threadId: 't1', memory, input: 'delete /x' })) {
      if (action.type === 'tool-call') break;
    }
    await new Promise(r => setTimeout(r, 60));

    const committed = memory.commits.flat();
    expect(committed).toEqual([...committed].sort());
    // A reader paging with the exclusive `after` cursor from any commit sees every later row.
    const log = await memory.listActions({ threadId: 't1' });
    expect(log.map(a => a.id)).toEqual(committed);
    expect(repairOpenRun(log)).toEqual([]);
  });

  it('a streaming (generator) tool still streams through the gate', async () => {
    const memory = new InMemoryActionStorage();
    const tools = {
      countdown: tool({
        inputSchema: z.object({}),
        async *execute() {
          yield { left: 1 };
          yield { left: 0 };
        },
      }),
    };
    const { model } = scriptedModel([toolCallTurn('c1', 'countdown', {}), textTurn('Done.')]);
    const seen: string[] = [];
    for await (const a of runAgent({ model, tools, threadId: 't1', memory, input: 'count' })) seen.push(a.type);

    expect(seen).toContain('tool-output-delta');
    const log = await memory.listActions({ threadId: 't1' });
    expect(log.find(a => a.type === 'tool-result')).toMatchObject({ toolCallId: 'c1', output: { left: 0 } });
  });
});

describe('partial text', () => {
  it('B4: abort, then the consumer breaks after a text-delta: the text so far is stored, interrupted', async () => {
    const memory = new InMemoryActionStorage();
    const controller = new AbortController();
    const { model } = scriptedModel([textTurn('Half an answer')]);
    for await (const action of runAgent({
      model,
      threadId: 't1',
      memory,
      input: 'hi',
      abortSignal: controller.signal,
    })) {
      if (action.type === 'text-delta') {
        controller.abort();
        break;
      }
    }
    const log = await memory.listActions({ threadId: 't1' });
    expect(log.find(a => a.type === 'text' && a.role === 'assistant')).toMatchObject({
      text: 'Half an answer',
      interrupted: true,
    });
    const types = log.map(a => a.type);
    expect(types.indexOf('text', 2)).toBeLessThan(types.indexOf('run-aborted'));
    expect(types.filter(t => t === 'run-end' || t === 'run-aborted')).toEqual(['run-aborted']);
  });

  it('a mid-stream error part keeps the text so far, then the error, then one run-end', async () => {
    const memory = new InMemoryActionStorage();
    const model = new MockLanguageModelV4({
      modelId: 'mock-model',
      doStream: async () =>
        ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'Partial' },
            { type: 'error', error: new Error('overloaded') },
          ]),
        }) as never,
    });
    await drain(runAgent({ model, threadId: 't1', memory, input: 'hi' }));
    const log = await memory.listActions({ threadId: 't1' });
    const tail = log.slice(log.findIndex(a => a.type === 'turn-start') + 1).map(a => a.type);
    expect(tail).toEqual(['text', 'error', 'turn-end', 'run-end']);
    expect(log.find(a => a.type === 'text' && a.role === 'assistant')).toMatchObject({
      text: 'Partial',
      interrupted: true,
    });
    expect(log.at(-1)).toMatchObject({ type: 'run-end', finishReason: 'error' });
  });
});

describe('reading the log', () => {
  const row = (id: string, rest: Record<string, unknown>) =>
    ({ id, threadId: 't1', runId: 'r1', createdAt: new Date(0), ...rest }) as PersistableAction;

  it('repair skips rows from a newer format version, as projection does', async () => {
    const memory = new InMemoryActionStorage();
    await memory.saveActions({
      actions: [
        row('01J00000000000000000000001', { type: 'run-start', agentId: 'a', modelId: 'm', settings: {} }),
        row('01J00000000000000000000002', { type: 'text', role: 'user', text: 'hi' }),
        // A newer writer's ignorable row this reader can't read: it must not reopen or close anything.
        row('01J00000000000000000000003', { type: 'run-end', finishReason: 'stop', usage: {}, formatVersion: 2 }),
      ],
    });
    const { model } = scriptedModel([textTurn('Hello.')]);
    await drain(runAgent({ model, threadId: 't1', memory, input: 'again' }));
    const log = await memory.listActions({ threadId: 't1' });
    // r1's readable rows leave it open, so it gets its own closer; the v2 run-end isn't counted.
    expect(log.filter(a => a.runId === 'r1' && a.type === 'run-end' && a.formatVersion === 1)).toHaveLength(1);
  });

  it('projection keeps the first of two outcomes for one call', () => {
    const messages = toModelMessages([
      row('01', { type: 'tool-call', role: 'assistant', toolCallId: 'c1', toolName: 'pick', input: {} }),
      row('02', { type: 'tool-error', toolCallId: 'c1', toolName: 'pick', errorText: 'interrupted' }),
      row('03', { type: 'tool-result', toolCallId: 'c1', toolName: 'pick', output: 'blue' }),
    ]);
    expectValidToolPairs(messages);
  });
});

describe('two pending approvals in one run', () => {
  it('two resumes answer one each; each tool runs once and the other stays open in between', async () => {
    const executed: string[] = [];
    const deleteFile = createTool({
      id: 'deleteFile',
      description: 'Deletes a file',
      inputSchema: z.object({ path: z.string() }),
      requireApproval: true,
      execute: async ({ path }) => {
        executed.push(path);
        return { deleted: true };
      },
    });
    const twoCalls = [
      { type: 'stream-start', warnings: [] },
      { type: 'tool-call', toolCallId: 'c1', toolName: 'deleteFile', input: JSON.stringify({ path: '/a' }) },
      { type: 'tool-call', toolCallId: 'c2', toolName: 'deleteFile', input: JSON.stringify({ path: '/b' }) },
      ...toolCallTurn('x', 'x', {}).slice(-1),
    ];
    const { model, prompts } = scriptedModel([twoCalls, textTurn('Done.')]);
    const agent = new Agent({ id: 'files', name: 'files', instructions: 'Files.', model, tools: { deleteFile } });
    const storage = new InMemoryStore();
    new Mastra({ agents: { files: agent }, storage, logger: false });
    const store = (await storage.getStore('memory'))!;
    const memory = { thread: 'th1', resource: 'u1' };

    const first = await (await agent.stream('Delete /a and /b', { memory })).result;
    const runId = first.actions[0]!.runId!;
    await (
      await agent.approveToolCall({ runId, memory })
    ).result;
    const between = await store.listActions({ threadId: 'th1' });
    expect(executed).toHaveLength(1);
    expect(between.some(a => a.type === 'tool-denied' || a.type === 'tool-error')).toBe(false);

    await (
      await agent.approveToolCall({ runId, memory })
    ).result;
    expect([...executed].sort()).toEqual(['/a', '/b']);
    const log = await store.listActions({ threadId: 'th1' });
    expect(
      log
        .filter(a => a.type === 'tool-result')
        .map(a => a.toolCallId)
        .sort(),
    ).toEqual(['c1', 'c2']);
    expect(repairOpenRun(log)).toEqual([]);
    expectValidToolPairs(prompts.at(-1));
  });
});

describe('what a live reader sees', () => {
  const persisted = (actions: MastraAction[]) => actions.filter(isPersistable).map(a => a.id);

  it('streams persistable actions in the order the log stores them, tool-started included', async () => {
    const memory = new InMemoryActionStorage();
    const tools = {
      weather: tool({ inputSchema: z.object({}), execute: async () => ({ tempC: 21 }) }),
    };
    const { model } = scriptedModel([toolCallTurn('c1', 'weather', {}), textTurn('21C.')]);
    const streamed: MastraAction[] = [];
    for await (const a of runAgent({ model, tools, threadId: 't1', memory, input: 'weather?' })) streamed.push(a);
    const log = await memory.listActions({ threadId: 't1' });
    expect(persisted(streamed)).toEqual(log.map(a => a.id));
    expect(streamed.map(a => a.type)).toContain('tool-started');
  });

  it('on abort, a reader that keeps reading gets the text so far, then run-aborted last', async () => {
    const memory = new InMemoryActionStorage();
    const controller = new AbortController();
    const { model } = scriptedModel([textTurn('Half an answer')]);
    const streamed: MastraAction[] = [];
    for await (const a of runAgent({ model, threadId: 't1', memory, input: 'hi', abortSignal: controller.signal })) {
      streamed.push(a);
      if (a.type === 'text-delta') controller.abort();
    }
    expect(streamed.at(-1)?.type).toBe('run-aborted');
    const log = await memory.listActions({ threadId: 't1' });
    expect(persisted(streamed)).toEqual(log.map(a => a.id));
    // The mock delivers text-end before the abort lands, so the text is whole here; B4 covers interrupted text.
    expect(log.find(a => a.type === 'text' && a.role === 'assistant')).toMatchObject({ text: 'Half an answer' });
  });
});

describe('how a stopped run is labelled', () => {
  it('an early return with no abort and no error ends the run interrupted, not error', async () => {
    const memory = new InMemoryActionStorage();
    const { model } = scriptedModel([textTurn('Half an answer')]);
    for await (const action of runAgent({ model, threadId: 't1', memory, input: 'hi' })) {
      if (action.type === 'text-delta') break;
    }
    const log = await memory.listActions({ threadId: 't1' });
    expect(log.filter(a => a.type === 'run-end')).toEqual([expect.objectContaining({ finishReason: 'interrupted' })]);
  });
});
