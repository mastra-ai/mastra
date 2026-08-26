import { describe, expect, it } from 'vitest';

import { presentTool, stringifyToolValue } from './tool-presentation';

describe('presentTool', () => {
  it('maps stable workspace aliases to humanized actions with their salient argument', () => {
    expect(presentTool('view', { path: 'src/a.ts' })).toMatchObject({ label: 'Read', detail: 'src/a.ts' });
    expect(presentTool('search_content', { pattern: 'useChat' })).toMatchObject({ label: 'Search', detail: 'useChat' });
    expect(presentTool('string_replace', { path: 'src/a.ts' })).toMatchObject({ label: 'Edit', detail: 'src/a.ts' });
  });

  it('marks terminal-style tools with their command for the expanded body', () => {
    expect(presentTool('execute_command', { command: 'pnpm test' })).toMatchObject({
      label: 'Run',
      detail: 'pnpm test',
      command: 'pnpm test',
    });
  });

  it('keeps the cd preamble out of the row but inside the command', () => {
    const cd = "cd '/Users/me/work spaces/repo' && pnpm build";
    expect(presentTool('execute_command', { command: cd })).toMatchObject({ detail: 'pnpm build', command: cd });
  });

  it('strips an unquoted cd preamble too', () => {
    const cd = 'cd packages/core && pnpm build';
    expect(presentTool('execute_command', { command: cd })).toMatchObject({ detail: 'pnpm build', command: cd });
  });

  it('leaves a bare cd alone — it is the whole command', () => {
    expect(presentTool('execute_command', { command: 'cd packages/core' })).toMatchObject({
      detail: 'cd packages/core',
    });
  });

  it('strips the raw workspace prefix before lookup', () => {
    expect(presentTool('mastra_workspace_read_file', { path: 'a.ts' })).toMatchObject({
      label: 'Read',
      detail: 'a.ts',
    });
  });

  it('prettifies unknown tool names instead of surfacing raw identifiers', () => {
    expect(presentTool('fetch_pull_request', undefined).label).toBe('Fetch pull request');
  });

  it('omits the detail when the salient argument has not streamed yet', () => {
    expect(presentTool('execute_command', undefined).detail).toBeUndefined();
  });
});

describe('stringifyToolValue', () => {
  it('passes strings through and pretty-prints the rest', () => {
    expect(stringifyToolValue('already text')).toBe('already text');
    expect(stringifyToolValue({ path: 'a.ts' })).toBe('{\n  "path": "a.ts"\n}');
  });

  it('falls back to String for values JSON cannot carry', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(stringifyToolValue(cyclic)).toBe('[object Object]');
    expect(stringifyToolValue(undefined)).toBe('undefined');
  });
});
