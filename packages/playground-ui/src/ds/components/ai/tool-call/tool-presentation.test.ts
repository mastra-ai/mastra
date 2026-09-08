import { describe, expect, it } from 'vitest';

import { isTaskTool, presentTool, stringifyToolValue, toolEdit } from './tool-presentation';

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

describe('toolEdit', () => {
  it('reads a replacement as the two sides of a diff, an empty new side included', () => {
    expect(toolEdit('mastra_workspace_edit_file', { path: 'a.ts', old_string: 'x', new_string: '' })).toEqual({
      path: 'a.ts',
      oldText: 'x',
      newText: '',
    });
  });

  it('reads a written file as its content', () => {
    expect(toolEdit('write_file', { path: 'a.ts', content: 'x' })).toEqual({ path: 'a.ts', content: 'x' });
  });

  it('leaves other calls to the raw arguments', () => {
    expect(toolEdit('view', { path: 'a.ts' })).toBeUndefined();
    expect(toolEdit('edit_file', { path: 'a.ts' })).toBeUndefined();
  });
});

describe('isTaskTool', () => {
  it('names the four task tools the docked task list draws, and nothing else', () => {
    expect(['task_write', 'task_update', 'task_complete', 'task_check'].every(isTaskTool)).toBe(true);
    expect(['view', 'task', 'ask_user'].some(isTaskTool)).toBe(false);
  });
});
