import { describe, expect, it } from 'vitest';

import { WORKSPACE_TOOLS } from '../../workspace/constants';

import {
  classifyHarnessWorkspaceToolAction,
  getHarnessWorkspaceActionPathInput,
  isHarnessWorkspaceFileMutationTool,
} from './workspace-actions';

describe('Harness v1 workspace action taxonomy', () => {
  const pathFor = (inputPath: string) => ({ inputPath });

  it('classifies canonical filesystem tool ids', () => {
    expect(
      classifyHarnessWorkspaceToolAction(
        WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        { path: 'src/index.ts', content: 'export {};' },
        { pathFor },
      ),
    ).toMatchObject({
      actionKind: 'file',
      operation: 'write',
      mutatesWorkspace: true,
      pathInput: 'src/index.ts',
      path: { inputPath: 'src/index.ts' },
      action: {
        kind: 'file',
        operation: 'write',
        toolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
      },
    });

    expect(
      classifyHarnessWorkspaceToolAction(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE, { path: 'src/index.ts' }, { pathFor }),
    ).toMatchObject({
      actionKind: 'file',
      operation: 'patch',
      mutatesWorkspace: true,
      pathInput: 'src/index.ts',
    });
  });

  it('classifies MC remapped workspace aliases through the same taxonomy', () => {
    expect(classifyHarnessWorkspaceToolAction('write_file', { path: 'src/app.ts' }, { pathFor })).toMatchObject({
      actionKind: 'file',
      operation: 'write',
      mutatesWorkspace: true,
      action: {
        toolName: 'write_file',
        canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
      },
    });
    expect(classifyHarnessWorkspaceToolAction('string_replace_lsp', { path: 'src/app.ts' }, { pathFor })).toMatchObject(
      {
        actionKind: 'file',
        operation: 'patch',
        mutatesWorkspace: true,
        action: {
          toolName: 'string_replace_lsp',
          canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
        },
      },
    );
    expect(classifyHarnessWorkspaceToolAction('ast_smart_edit', { path: 'src/app.ts' }, { pathFor })).toMatchObject({
      actionKind: 'file',
      operation: 'patch',
      mutatesWorkspace: true,
      action: {
        toolName: 'ast_smart_edit',
        canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT,
      },
    });
  });

  it('classifies configured workspace remaps without knowing the alias in advance', () => {
    expect(
      classifyHarnessWorkspaceToolAction(
        'replace_text',
        { path: 'src/app.ts' },
        {
          pathFor,
          toolNameConfig: {
            [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { name: 'replace_text' },
          },
        },
      ),
    ).toMatchObject({
      actionKind: 'file',
      operation: 'patch',
      mutatesWorkspace: true,
      action: {
        toolName: 'replace_text',
        canonicalToolName: WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
      },
    });
  });

  it('defaults list and grep read scopes to the workspace root', () => {
    expect(classifyHarnessWorkspaceToolAction('find_files', {}, { pathFor })).toMatchObject({
      actionKind: 'file',
      operation: 'read',
      mutatesWorkspace: false,
      pathInput: '.',
      path: { inputPath: '.' },
    });
    expect(classifyHarnessWorkspaceToolAction('search_content', { pattern: 'TODO' }, { pathFor })).toMatchObject({
      actionKind: 'file',
      operation: 'read',
      mutatesWorkspace: false,
      pathInput: '.',
      path: { inputPath: '.' },
    });
  });

  it('classifies command and process tools without file paths', () => {
    expect(
      classifyHarnessWorkspaceToolAction(
        'execute_command',
        { command: 'pnpm test', cwd: 'packages/core' },
        { pathFor },
      ),
    ).toMatchObject({
      actionKind: 'command',
      operation: 'execute',
      mutatesWorkspace: true,
      cwdInput: 'packages/core',
      cwd: { inputPath: 'packages/core' },
      action: {
        kind: 'command',
        command: 'pnpm test',
        canonicalToolName: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
      },
    });
    expect(classifyHarnessWorkspaceToolAction('get_process_output', { pid: '42' })).toMatchObject({
      actionKind: 'command',
      operation: 'read_output',
      mutatesWorkspace: false,
    });
    expect(classifyHarnessWorkspaceToolAction('kill_process', { pid: '42' })).toMatchObject({
      actionKind: 'command',
      operation: 'kill',
      mutatesWorkspace: true,
    });
  });

  it('exposes mutation and path helpers for compatibility UIs', () => {
    expect(isHarnessWorkspaceFileMutationTool('write_file')).toBe(true);
    expect(isHarnessWorkspaceFileMutationTool('string_replace_lsp')).toBe(true);
    expect(isHarnessWorkspaceFileMutationTool('view')).toBe(false);
    expect(isHarnessWorkspaceFileMutationTool('execute_command')).toBe(false);
    expect(getHarnessWorkspaceActionPathInput('write_file', { path: 'src/app.ts' })).toBe('src/app.ts');
    expect(getHarnessWorkspaceActionPathInput('write_file', { path: '' })).toBeUndefined();
  });

  it('does not classify unknown tools or missing required paths', () => {
    expect(classifyHarnessWorkspaceToolAction('custom_tool', {})).toBeUndefined();
    expect(classifyHarnessWorkspaceToolAction('write_file', {})).toBeUndefined();
  });
});
