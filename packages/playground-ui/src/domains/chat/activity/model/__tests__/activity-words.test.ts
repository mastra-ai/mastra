import { describe, expect, it } from 'vitest';

import type { ActivityCallStatus } from '../activity-members';
import { callsOutcome, liveWords, outcomeText, settledWords, wordsName } from '../activity-words';

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

  it('reads Thinking between calls', () => {
    expect(liveWords([view('a.ts')]).label).toBe('Thinking');
  });
});

describe('settledWords', () => {
  it('reads Thought for reasoning alone', () => {
    expect(settledWords([]).label).toBe('Thought');
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
    expect(outcomeText(callsOutcome(calls), calls.length)).toBe('1 failed · 1 incomplete');
  });

  it('only says a lone call never finished', () => {
    expect(outcomeText(callsOutcome([view('a.ts', 'error')]), 1)).toBe('');
    expect(outcomeText(callsOutcome([view('a.ts', 'running')]), 1)).toBe('incomplete');
  });
});
