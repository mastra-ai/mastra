import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai-v7';
import { runAgent } from '@mastra/core/new-message-format';
import type { AgentInput, MastraAction } from '@mastra/core/new-message-format';
import { LibSQLStore } from '@mastra/libsql';
import { afterAll, describe, expect, it } from 'vitest';

import { Memory } from './index';

const dir = mkdtempSync(join(tmpdir(), 'mastra-actions-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe.skipIf(!process.env.OPENAI_API_KEY)('action-native recall on LibSQL', () => {
  it('recalls a v5 UIMessage run from a v7 ModelMessage run', async () => {
    const memory = new Memory({ storage: new LibSQLStore({ id: 'actions', url: `file:${join(dir, 'db.sqlite')}` }) });
    const model = openai('gpt-4o-mini');
    const threadId = 'thread-recall';

    const run = async (runId: string, input: AgentInput) => {
      const out: MastraAction[] = [];
      for await (const a of runAgent({ model, memory, threadId, resourceId: 'user-1', runId, input })) out.push(a);
      return out;
    };

    const first = await run('run-1', [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Remember: my favourite colour is teal. Reply "ok".' }] },
    ]);
    expect(first.some(a => a.type === 'text-delta')).toBe(true);

    const second = await run('run-2', [
      { role: 'user', content: [{ type: 'text', text: 'What is my favourite colour? One word.' }] },
    ]);
    const answer = second.findLast(a => a.type === 'text' && a.role === 'assistant');
    expect(answer && 'text' in answer ? answer.text.toLowerCase() : '').toContain('teal');

    const stored = await memory.listActions({ threadId });
    expect(stored.map(a => a.id)).toEqual([...first, ...second].filter(a => !a.transient).map(a => a.id));
    expect(stored.some(a => a.transient)).toBe(false);
    expect(new Set(stored.map(a => a.runId))).toEqual(new Set(['run-1', 'run-2']));
    expect(stored.filter(a => a.type === 'text' && a.role === 'user')).toHaveLength(2);
  });
});
