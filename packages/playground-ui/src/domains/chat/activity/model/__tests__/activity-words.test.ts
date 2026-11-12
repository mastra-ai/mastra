import { describe, expect, it } from 'vitest';

import type { ActivityCallStatus } from '../activity-members';
import { callsOutcome, liveWords, outcomeText, settledWords, stretchPose, wordsName } from '../activity-words';
import { agentGlyph } from '@/ds/components/AgentIndicator';

const call = (toolName: string, args: unknown, status: ActivityCallStatus = 'done') => ({ toolName, args, status });
const view = (path: string, status?: ActivityCallStatus) => call('view', { path }, status);
const run = (command: string, status?: ActivityCallStatus, description?: string) =>
  call('execute_command', { command, description }, status);

describe('liveWords', () => {
  it('reads the running call as Slack does', () => {
    const words = liveWords([view('a.ts'), view('src/b.ts', 'running')]);
    expect(words).toMatchObject({ label: 'Reading', detail: 'src/b.ts' });
    expect(wordsName(words)).toBe('Reading src/b.ts');
  });

  it("prefers the call's own description", () => {
    const words = liveWords([run('rg -n tool', 'running', 'Inspecting tool output rendering')]);
    expect(wordsName(words)).toBe('Inspecting tool output rendering');
    expect(words.detail).toBeUndefined();
  });

  it('follows the latest of parallel running calls', () => {
    expect(wordsName(liveWords([view('a.ts', 'running'), run('pnpm test', 'running')]))).toBe('Running pnpm test');
  });

  it('changes shape as a Knowledge search is read and updated', () => {
    const search = call('knowledge_search', { query: 'Refund policy' });
    const read = call('knowledge_read', { page: 'Refund policy' });
    const page = call('knowledge_page', { page: 'Refund policy', op: 'write' });

    expect(stretchPose([{ ...search, status: 'running' }], true)).toBe('searching');
    expect(stretchPose([search, { ...read, status: 'running' }], true)).toBe('reading');
    expect(stretchPose([search, read, { ...page, status: 'running' }], true)).toBe('knowledge');
  });

  it('uses Knowledge operation arguments for the live morph and settled summary', () => {
    const write = call('knowledge_page', { op: 'write', page: 'Refunds' });
    const remove = call('knowledge_page', { op: 'delete', page: 'Outdated refunds' }, 'running');

    expect(stretchPose([write, remove], true)).toBe('deleting');
    expect(liveWords([write, remove])).toMatchObject({ label: 'Deleting page', icon: agentGlyph('deleting') });
    expect(settledWords([{ ...remove, status: 'done' }])).toMatchObject({
      label: 'Deleted page',
      icon: agentGlyph('deleting'),
    });
    expect(settledWords([write, { ...remove, status: 'done' }]).icon).toBe(agentGlyph('tool'));
  });

  it('reads Thinking between calls', () => {
    expect(liveWords([view('a.ts')]).label).toBe('Thinking');
  });
});

describe('settledWords', () => {
  it('reads Thought for reasoning alone', () => {
    expect(settledWords([]).label).toBe('Thought');
  });

  it("wears one kind's own glyph, and the tool glyph once kinds mix rather than whichever came first", () => {
    expect(settledWords([view('a.ts'), view('b.ts')]).icon).toBe(agentGlyph('reading'));
    expect(settledWords([view('a.ts'), run('ls')]).icon).toBe(agentGlyph('tool'));
  });

  it('distinguishes file edits, Knowledge pages, and notes in collapsed groups', () => {
    const edit = call('edit_file', { path: 'src/agent.ts' });
    const page = call('knowledge_page', { page: 'Refunds', op: 'write' });
    const note = call('knowledge_note', { page: 'Refunds', op: 'add' });

    expect(settledWords([page]).icon).not.toBe(settledWords([edit]).icon);
    expect(settledWords([note]).icon).not.toBe(settledWords([page]).icon);
    expect(settledWords([page, note]).icon).toBe(agentGlyph('tool'));
    expect(settledWords([edit, page]).icon).toBe(agentGlyph('tool'));
    expect(liveWords([{ ...page, status: 'running' }]).icon).toBe(settledWords([page]).icon);
  });

  it('names a single call in the past tense', () => {
    const words = settledWords([run('pnpm build')]);
    expect(words).toMatchObject({ label: 'Ran', detail: 'pnpm build' });
    expect(wordsName(words)).toBe('Ran pnpm build');
  });

  it('summarizes each kind once, in order of first use', () => {
    expect(settledWords([view('a.ts'), view('b.ts'), run('pnpm test')]).label).toBe('Read files, ran a command');
  });

  it('cuts a long summary after three kinds', () => {
    const words = settledWords([
      view('a.ts'),
      run('ls'),
      call('grep', { pattern: 'x' }),
      call('write_file', { path: 'a' }),
      call('mkdir', {}),
    ]);
    expect(words.label).toBe('Read a file, ran a command, searched code, and 2 more');
  });

  it('words a tool it does not know by its name', () => {
    expect(settledWords([call('fetch_pull_request', { number: 1 })]).label).toBe('Used Fetch pull request');
  });

  it('says how long the work took, to the second, and leaves out what took under one', () => {
    const words = settledWords([run('pnpm build')], 72_400);
    expect(words.duration).toBe('1m 12s');
    expect(wordsName(words)).toBe('Ran pnpm build, 1m 12s');
    expect(wordsName(settledWords([], 400))).toBe('Thought');
  });

  it('says how long a lone thought lasted in its own words', () => {
    expect(wordsName(settledWords([], 36_200))).toBe('Thought for 36s');
  });
});

describe('outcomeText', () => {
  it('counts failed and unfinished calls among several', () => {
    const calls = [view('a.ts'), view('b.ts', 'error'), view('c.ts', 'running')];
    expect(outcomeText(callsOutcome(calls), calls.length)).toBe('1 failed and 1 incomplete');
  });

  it('only says a lone call never finished', () => {
    expect(outcomeText(callsOutcome([view('a.ts', 'error')]), 1)).toBe('');
    expect(outcomeText(callsOutcome([view('a.ts', 'running')]), 1)).toBe('incomplete');
  });
});
