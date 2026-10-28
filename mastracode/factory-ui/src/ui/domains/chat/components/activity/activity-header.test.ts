import { describe, expect, it } from 'vitest';

import type { ToolCall } from '../../services/transcript';
import { stretchHeader } from './activity-header';
import type { StretchView } from './activity-header';

const call = (toolName: string, args: unknown, status: ToolCall['status'] = 'done'): StretchView => ({
  kind: 'tool',
  key: `${toolName}-${JSON.stringify(args)}`,
  tool: { toolCallId: toolName, toolName, args, argsText: '', status, output: '' },
});
const thought: StretchView = { kind: 'reasoning', key: 'r', part: { type: 'reasoning', reasoning: 'Hmm' } };

const view = (path: string, status?: ToolCall['status']) => call('view', { path }, status);
const run = (command: string, status?: ToolCall['status'], description?: string) =>
  call('execute_command', { command, description }, status);

describe('stretchHeader while live', () => {
  it('reads the running call as Slack does', () => {
    expect(stretchHeader([view('a.ts'), view('src/b.ts', 'running')], true)).toMatchObject({
      label: 'Reading',
      detail: 'src/b.ts',
      name: 'Reading src/b.ts',
      status: 'running',
    });
  });

  it("prefers the call's own description", () => {
    const header = stretchHeader([run('rg -n tool', 'running', 'Inspecting tool output rendering')], true);
    expect(header).toMatchObject({
      label: 'Inspecting tool output rendering',
      name: 'Inspecting tool output rendering',
    });
    expect(header.detail).toBeUndefined();
  });

  it('follows the latest of parallel running calls', () => {
    expect(stretchHeader([view('a.ts', 'running'), run('pnpm test', 'running')], true).name).toBe('Running pnpm test');
  });

  it('reads Thinking between calls', () => {
    expect(stretchHeader([view('a.ts'), thought], true)).toMatchObject({ label: 'Thinking', status: 'running' });
  });
});

describe('stretchHeader once settled', () => {
  it('reads Thought for reasoning alone', () => {
    expect(stretchHeader([thought], false)).toMatchObject({ label: 'Thought', status: 'idle', tools: 0 });
  });

  it('names a single call in the past tense', () => {
    expect(stretchHeader([run('pnpm build')], false)).toMatchObject({
      label: 'Ran',
      detail: 'pnpm build',
      name: 'Ran pnpm build',
    });
  });

  it('names the calls, not the thinking between them', () => {
    expect(stretchHeader([thought, run('pnpm build')], false)).toMatchObject({ label: 'Ran', name: 'Ran pnpm build' });
    expect(stretchHeader([view('a.ts'), thought, view('b.ts'), run('pnpm test')], false).label).toBe(
      'Read files, ran a command',
    );
  });

  it('summarizes each kind once, in order of first use', () => {
    expect(stretchHeader([view('a.ts'), view('b.ts'), run('pnpm test')], false).label).toBe(
      'Read files, ran a command',
    );
  });

  it('cuts a long summary after three kinds', () => {
    const header = stretchHeader(
      [view('a.ts'), run('ls'), call('grep', { pattern: 'x' }), call('write_file', { path: 'a' }), call('mkdir', {})],
      false,
    );
    expect(header.label).toBe('Read a file, ran a command, searched code, and 2 more');
  });

  it('words a tool it does not know by its name', () => {
    expect(stretchHeader([call('fetch_pull_request', { number: 1 })], false).label).toBe('Used Fetch pull request');
  });

  it('counts failed and unfinished calls, and fails the line on any failure', () => {
    expect(stretchHeader([view('a.ts'), view('b.ts', 'error'), view('c.ts', 'running')], false)).toMatchObject({
      status: 'error',
      tools: 3,
      failed: 1,
      incomplete: 1,
    });
  });

  it('says how long the work took, to the second, and leaves out what took under one', () => {
    expect(stretchHeader([thought, run('pnpm build')], false, 72_400)).toMatchObject({
      duration: '1m 12s',
      name: 'Ran pnpm build, 1m 12s',
    });
    expect(stretchHeader([thought], false, 400).name).toBe('Thought');
  });

  it('says how long a lone thought lasted in its own words', () => {
    expect(stretchHeader([thought], false, 36_200).name).toBe('Thought for 36s');
  });
});
