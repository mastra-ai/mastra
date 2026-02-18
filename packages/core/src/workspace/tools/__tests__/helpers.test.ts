import { describe, it, expect, vi } from 'vitest';

import type { ToolExecutionContext } from '../../../tools/types';
import { Workspace } from '../../workspace';
import { emitWorkspaceMetadata, requireWorkspace, requireFilesystem, requireSandbox } from '../helpers';

const dummySandbox = { id: 'sb-1', name: 'test-sandbox', provider: 'local', status: 'running' as const };
const dummyFilesystem = {
  id: 'fs-1',
  name: 'test-fs',
  provider: 'local',
  status: 'ready' as const,
  readOnly: false,
};

function createMockWorkspace(options: { filesystem?: boolean; sandbox?: boolean } = { sandbox: true }) {
  // Workspace requires at least one of filesystem/sandbox/skills — always provide at least one
  return new Workspace({
    id: 'ws-test',
    name: 'Test Workspace',
    filesystem: options.filesystem ? (dummyFilesystem as any) : undefined,
    sandbox: options.sandbox ? (dummySandbox as any) : undefined,
  });
}

describe('emitWorkspaceMetadata', () => {
  it('emits data-workspace-metadata with workspace info and toolName', async () => {
    const writerCustom = vi.fn();
    const workspace = createMockWorkspace({ filesystem: true, sandbox: true });
    const context: ToolExecutionContext = {
      workspace,
      writer: { custom: writerCustom } as any,
    };

    await emitWorkspaceMetadata(context, 'mastra_workspace_read_file');

    expect(writerCustom).toHaveBeenCalledTimes(1);
    const call = writerCustom.mock.calls[0][0];
    expect(call.type).toBe('data-workspace-metadata');
    expect(call.data.toolName).toBe('mastra_workspace_read_file');
    expect(call.data.id).toBe('ws-test');
    expect(call.data.name).toBe('Test Workspace');
  });

  it('does not throw when writer is undefined', async () => {
    const workspace = createMockWorkspace();
    const context: ToolExecutionContext = { workspace };

    await expect(emitWorkspaceMetadata(context, 'test_tool')).resolves.not.toThrow();
  });

  it('throws when workspace is not in context', async () => {
    const context: ToolExecutionContext = {};

    await expect(emitWorkspaceMetadata(context, 'test_tool')).rejects.toThrow();
  });
});

describe('requireWorkspace', () => {
  it('returns workspace when present', () => {
    const workspace = createMockWorkspace();
    const context: ToolExecutionContext = { workspace };

    expect(requireWorkspace(context)).toBe(workspace);
  });

  it('throws when workspace is missing', () => {
    expect(() => requireWorkspace({})).toThrow();
  });
});

describe('requireFilesystem', () => {
  it('returns workspace and filesystem when both present', () => {
    const workspace = createMockWorkspace({ filesystem: true, sandbox: true });
    const context: ToolExecutionContext = { workspace };

    const result = requireFilesystem(context);
    expect(result.workspace).toBe(workspace);
    expect(result.filesystem).toBe(workspace.filesystem);
  });

  it('throws when filesystem is missing', () => {
    const workspace = createMockWorkspace();
    const context: ToolExecutionContext = { workspace };

    expect(() => requireFilesystem(context)).toThrow();
  });
});

describe('requireSandbox', () => {
  it('returns workspace and sandbox when both present', () => {
    const workspace = createMockWorkspace({ sandbox: true });
    const context: ToolExecutionContext = { workspace };

    const result = requireSandbox(context);
    expect(result.workspace).toBe(workspace);
    expect(result.sandbox).toBe(workspace.sandbox);
  });

  it('throws when sandbox is missing', () => {
    const workspace = createMockWorkspace({ filesystem: true });
    const context: ToolExecutionContext = { workspace };

    expect(() => requireSandbox(context)).toThrow();
  });
});
