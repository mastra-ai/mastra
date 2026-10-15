import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai-v7';
import { Agent } from '@mastra/core/agent';
import type { ActionRunOutput, MastraAction, PersistableAction } from '@mastra/core/new-message-format';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from './index';

const dir = mkdtempSync(join(tmpdir(), 'mastra-agent-actions-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const memory = new Memory({ storage: new LibSQLStore({ id: 'agent-actions', url: `file:${join(dir, 'db.sqlite')}` }) });

const weather = createTool({
  id: 'weather',
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, tempC: 21, conditions: 'sunny' }),
});

const lookupOrder = createTool({
  id: 'lookupOrder',
  description: 'Look up an order by id',
  inputSchema: z.object({ orderId: z.string() }),
  execute: async () => {
    throw new Error('order service unavailable');
  },
});

const deleteFile = createTool({
  id: 'deleteFile',
  description: 'Delete a file by path',
  inputSchema: z.object({ path: z.string() }),
  requireApproval: true,
  execute: async ({ path }) => ({ deleted: path }),
});

const agent = new Agent({
  id: 'action-agent',
  name: 'Action Agent',
  instructions: 'You are concise. Use tools when asked. Never ask for confirmation, just call the tool.',
  model: openai('gpt-4o-mini'),
  tools: { weather, lookupOrder, deleteFile },
  memory,
});

let threadCounter = 0;
const newThread = () => ({ thread: `thread-${++threadCounter}`, resource: 'user-1' });

async function drain(output: ActionRunOutput) {
  const streamed: MastraAction[] = [];
  for await (const action of output.fullStream) streamed.push(action);
  return { streamed, result: await output.result };
}

/** Storage for this run holds exactly the non-transient streamed actions, in order, and no deltas. */
async function expectStoredMatchesStream(threadId: string, runId: string, streamed: MastraAction[]) {
  const stored = await memory.listActions({ threadId, runId });
  expect(stored.map(a => a.id)).toEqual(streamed.filter(a => !a.transient).map(a => a.id));
  const deltaTypes = [
    'text-start',
    'text-delta',
    'reasoning-start',
    'reasoning-delta',
    'tool-input-start',
    'tool-input-delta',
    'tool-output-delta',
  ];
  expect(stored.filter(a => a.transient || deltaTypes.includes(a.type))).toEqual([]);
  return stored;
}

const types = (actions: PersistableAction[]) => actions.map(a => a.type);

describe.skipIf(!process.env.OPENAI_API_KEY)('Agent.stream on actions (LibSQL)', () => {
  it('plain text: deltas, then the closing text; result drains', async () => {
    const mem = newThread();
    const { streamed, result } = await drain(await agent.stream('Say exactly: hello world', { memory: mem }));

    const text = streamed.findLast(a => a.type === 'text' && a.role === 'assistant');
    if (text?.type !== 'text') throw new Error('no assistant text');
    const deltas = streamed.filter(a => a.type === 'text-delta' && a.contentId === text.contentId);
    expect(deltas.length).toBeGreaterThan(0);
    expect(streamed.indexOf(deltas[0]!)).toBeLessThan(streamed.indexOf(text));
    expect(deltas.map(d => (d.type === 'text-delta' ? d.delta : '')).join('')).toBe(text.text);

    expect(result.text.toLowerCase()).toContain('hello world');
    expect(result.finishReason).toBe('stop');

    const stored = await expectStoredMatchesStream(mem.thread, result.runId, streamed);
    expect(types(stored)).toEqual(['text', 'turn-start', 'text', 'turn-end', 'run-end']);
    expect(result.actions.map(a => a.id)).toEqual(stored.map(a => a.id));
  });

  it('generate() returns the drained result', async () => {
    const result = await agent.generate('Reply with the single word: pong', { memory: newThread() });
    expect(result.text.toLowerCase()).toContain('pong');
  });

  it('tools: tool-input deltas, then tool-call → tool-result', async () => {
    const mem = newThread();
    const { streamed, result } = await drain(
      await agent.stream('What is the weather in Paris? Use the weather tool.', { memory: mem }),
    );

    const call = streamed.find(a => a.type === 'tool-call');
    if (call?.type !== 'tool-call') throw new Error('no tool-call');
    const inputStart = streamed.findIndex(a => a.type === 'tool-input-start' && a.toolCallId === call.toolCallId);
    expect(inputStart).toBeGreaterThanOrEqual(0);
    expect(inputStart).toBeLessThan(streamed.indexOf(call));

    const stored = await expectStoredMatchesStream(mem.thread, result.runId, streamed);
    expect(types(stored)).toEqual([
      'text',
      'turn-start',
      'tool-call',
      'tool-result',
      'turn-end',
      'turn-start',
      'text',
      'turn-end',
      'run-end',
    ]);
    const toolResult = stored.find(a => a.type === 'tool-result');
    expect(toolResult?.type === 'tool-result' && toolResult.output).toMatchObject({ tempC: 21 });
    expect(result.text).toMatch(/21/);
  });

  it('tool error: stored as tool-error, not a run error', async () => {
    const mem = newThread();
    const { streamed, result } = await drain(
      await agent.stream('Look up order 42 with the lookupOrder tool.', { memory: mem, maxSteps: 2 }),
    );
    const stored = await expectStoredMatchesStream(mem.thread, result.runId, streamed);
    const toolError = stored.find(a => a.type === 'tool-error');
    expect(toolError?.type === 'tool-error' && toolError.errorText).toContain('order service unavailable');
    expect(stored.some(a => a.type === 'error')).toBe(false);
  });

  it.each([
    ['approve', true],
    ['decline', false],
  ] as const)('approval round trip: %s', async (_label, approved) => {
    const mem = newThread();
    const first = await drain(await agent.stream('Delete the file /tmp/report.txt.', { memory: mem }));

    const request = first.streamed.find(a => a.type === 'tool-approval-requested');
    if (request?.type !== 'tool-approval-requested') throw new Error('no approval request');
    expect(first.streamed.some(a => a.type === 'tool-result')).toBe(false);
    await expectStoredMatchesStream(mem.thread, first.result.runId, first.streamed);

    const resumeOptions = { memory: mem, runId: first.result.runId, toolCallId: request.toolCallId };
    const resumed = await drain(
      approved
        ? await agent.approveToolCall(resumeOptions)
        : await agent.declineToolCall({ ...resumeOptions, reason: 'not allowed' }),
    );

    const runLog = await memory.listActions({ threadId: mem.thread, runId: first.result.runId });
    expect(runLog.map(a => a.id)).toEqual(
      [...first.streamed, ...resumed.streamed].filter(a => !a.transient).map(a => a.id),
    );
    const response = runLog.find(a => a.type === 'tool-approval-responded');
    expect(response).toMatchObject({ approvalId: request.approvalId, toolCallId: request.toolCallId, approved });

    if (approved) {
      const toolResult = runLog.find(a => a.type === 'tool-result');
      expect(toolResult?.type === 'tool-result' && toolResult.output).toEqual({ deleted: '/tmp/report.txt' });
    } else {
      expect(runLog.some(a => a.type === 'tool-result')).toBe(false);
      expect(runLog.some(a => a.type === 'tool-denied')).toBe(true);
    }
    expect(runLog.at(-1)?.type).toBe('run-end');

    await expect(agent.approveToolCall(resumeOptions)).rejects.toThrow(/No pending tool approval/);
  });

  it('recall across runs with mixed input formats (v5 UIMessage, then v7 ModelMessage)', async () => {
    const mem = newThread();
    const first = await drain(
      await agent.stream(
        [
          {
            id: 'm1',
            role: 'user',
            parts: [{ type: 'text', text: 'Remember: my favourite colour is teal. Reply "ok".' }],
          },
        ],
        { memory: mem },
      ),
    );
    const second = await drain(
      await agent.stream(
        [{ role: 'user', content: [{ type: 'text', text: 'What is my favourite colour? One word.' }] }],
        {
          memory: mem,
        },
      ),
    );
    expect(second.result.text.toLowerCase()).toContain('teal');

    const stored = await memory.listActions({ threadId: mem.thread });
    expect(stored.map(a => a.id)).toEqual(
      [...first.streamed, ...second.streamed].filter(a => !a.transient).map(a => a.id),
    );
    expect(new Set(stored.map(a => a.runId))).toEqual(new Set([first.result.runId, second.result.runId]));
  });

  it('abort: ends with run-aborted and stores what streamed', async () => {
    const mem = newThread();
    const controller = new AbortController();
    const output = await agent.stream('Write a 400 word story about a lighthouse.', {
      memory: mem,
      abortSignal: controller.signal,
    });

    const streamed: MastraAction[] = [];
    for await (const action of output.fullStream) {
      streamed.push(action);
      if (action.type === 'text-delta') controller.abort();
    }
    expect(streamed.at(-1)?.type).toBe('run-aborted');
    expect(streamed.some(a => a.type === 'run-end')).toBe(false);
    await expectStoredMatchesStream(mem.thread, output.runId, streamed);
  });
});
