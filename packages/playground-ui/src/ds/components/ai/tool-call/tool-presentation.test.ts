import { describe, expect, it } from 'vitest';

import { hasToolArguments, isTaskTool, presentTool, stringifyToolValue, toolEdit } from './tool-presentation';

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

  it("adds a command's description, keeping the label, detail, and command for consumers that pick fields", () => {
    const command = "cd packages/core && rg -n 'processor' src | head -20";
    const presentation = presentTool('execute_command', { description: 'Finding  the processor\n wiring', command });
    expect(presentation).toMatchObject({
      label: 'Run',
      detail: "rg -n 'processor' src | head -20",
      description: 'Finding the processor wiring',
      command,
    });
  });

  it('falls back to the command when the description is blank', () => {
    const presentation = presentTool('execute_command', { description: '  ', command: 'git status' });
    expect(presentation).toMatchObject({ label: 'Run', detail: 'git status', command: 'git status' });
    expect(presentation.description).toBeUndefined();
  });

  it('strips the raw workspace prefix before lookup', () => {
    expect(presentTool('mastra_workspace_read_file', { path: 'a.ts' })).toMatchObject({
      label: 'Read',
      detail: 'a.ts',
    });
  });

  it('turns the agent indicator into the work each call does, and a tool it does not know into a nut', () => {
    expect(presentTool('execute_command', { command: 'ls' }).pose).toBe('running');
    expect(presentTool('view', { path: 'a.ts' }).pose).toBe('reading');
    expect(presentTool('mastra_workspace_grep', { pattern: 'x' }).pose).toBe('searching');
    expect(presentTool('web_search', { query: 'oauth' }).pose).toBe('browsing');
    expect(presentTool('fetch_pull_request', undefined).pose).toBe('tool');
  });

  it('draws a file info call as a file read, not as a system notice', () => {
    expect(presentTool('mastra_workspace_file_stat', { path: 'a.ts' }).pose).toBe('reading');
  });

  it('recognizes namespaced tools without guessing ambiguous provider operations', () => {
    expect(presentTool('mcp__workspace__read_file', { path: 'src/a.ts' })).toMatchObject({
      pose: 'reading',
      detail: 'src/a.ts',
    });
    expect(presentTool('workspace.kill_process', { pid: 42 })).toMatchObject({ pose: 'stopping', detail: '42' });
    expect(presentTool('mcp__catalog__search', { query: 'refunds' }).pose).toBe('tool');
    expect(presentTool('provider_delete_file_backup', { path: 'backup' }).pose).toBe('tool');
    expect(presentTool('constructor', {}).pose).toBe('tool');
    expect(presentTool('mcp__provider__workflow-delete', {}).pose).toBe('tool');
    expect(presentTool('provider.agent-disconnect', {}).pose).toBe('tool');
    expect(presentTool('workflow-provider.delete', {}).pose).toBe('tool');
    expect(presentTool('agent-provider.delete', {}).pose).toBe('tool');
  });

  it('distinguishes running a command, reading its output, and stopping it', () => {
    const poses = ['execute_command', 'get_process_output', 'kill_process'].map(name => presentTool(name, {}).pose);
    expect(new Set(poses).size).toBe(3);
  });

  it('shows the action inside a Knowledge tool once its arguments arrive', () => {
    const calls = [
      presentTool('knowledge_page', undefined),
      presentTool('knowledge_page', { op: 'merge', page: 'A', into: 'B' }),
      presentTool('knowledge_page', { op: 'delete', page: 'A' }),
    ];
    expect(new Set(calls.map(call => call.pose)).size).toBe(3);
    expect(new Set(calls.map(call => call.label)).size).toBe(3);
    expect(presentTool('knowledge_pin', { op: 'unpin', page: 'A' }).pose).not.toBe(
      presentTool('knowledge_pin', { op: 'pin', page: 'A' }).pose,
    );
  });

  it('does not describe checking a recording as making one', () => {
    const record = presentTool('browser_record', { action: 'start' });
    const check = presentTool('browser_record', { action: 'status' });
    expect(check.pose).not.toBe(record.pose);
    expect(check.label).not.toBe(record.label);
  });

  it('recognizes an agent or workflow called as a tool by its name prefix', () => {
    expect(presentTool('agent-support', { prompt: 'Check refunds' }).pose).toBe('delegating');
    expect(presentTool('workflow-refund', {}).pose).toBe('workflow');
  });

  it('distinguishes using a skill, searching for skills, and reading a skill file', () => {
    const calls = [
      presentTool('skill', { name: 'Support' }),
      presentTool('skill_search', { query: 'Refunds' }),
      presentTool('skill_read', { path: 'support/SKILL.md' }),
    ];
    expect(new Set(calls.map(call => call.pose)).size).toBe(3);
    expect(new Set(calls.map(call => call.label)).size).toBe(3);
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

  it.each(['filesystem_edit_file', 'filesystem_string_replace', 'filesystem_str_replace'])(
    'keeps the diff from %s visible when ordinary arguments are hidden',
    toolName => {
      const args = { file_path: 'src/refunds.ts', old_string: 'return refund();', new_string: '' };
      expect(toolEdit(toolName, args)).toEqual({
        path: 'src/refunds.ts',
        oldText: 'return refund();',
        newText: '',
      });
      expect(hasToolArguments({ toolName, args, hideArguments: true })).toBe(true);
      expect(presentTool(toolName, args).pose).toBe('tool');
    },
  );

  it.each(['filesystem_write_file', 'filesystem_create_file'])('shows the file content written by %s', toolName => {
    const args = { path: 'src/refunds.ts', content: 'export const refunds = [];\n' };
    expect(toolEdit(toolName, args)).toEqual({ path: 'src/refunds.ts', content: args.content });
    expect(presentTool(toolName, args).pose).toBe('tool');
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

describe('hasToolArguments', () => {
  it('has nothing to show before any input arrives', () => {
    expect(hasToolArguments({ toolName: 'view', args: undefined, argsText: '' })).toBe(false);
  });

  it('has nothing to show for a tool called without arguments', () => {
    expect(hasToolArguments({ toolName: 'list_agents', args: {}, argsText: '{}' })).toBe(false);
  });

  it('shows partial streamed input before it parses', () => {
    expect(hasToolArguments({ toolName: 'view', args: undefined, argsText: '{"path":"src' })).toBe(true);
  });

  it('shows an edit even when ordinary arguments are hidden', () => {
    const args = { path: 'a.ts', old_string: 'a', new_string: 'b' };
    expect(hasToolArguments({ toolName: 'edit_file', args, hideArguments: true })).toBe(true);
    expect(hasToolArguments({ toolName: 'view', args: { path: 'a.ts' }, hideArguments: true })).toBe(false);
  });
});
