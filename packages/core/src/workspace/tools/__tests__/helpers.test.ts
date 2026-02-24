import { describe, it, expect, vi } from 'vitest';

import type { ToolExecutionContext } from '../../../tools/types';
import type { LSPDiagnostic } from '../../lsp/types';
import { Workspace } from '../../workspace';
import {
  emitWorkspaceMetadata,
  getEditDiagnosticsText,
  requireWorkspace,
  requireFilesystem,
  requireSandbox,
} from '../helpers';

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

    await emitWorkspaceMetadata(context, 'my_test_tool');

    expect(writerCustom).toHaveBeenCalledTimes(1);
    const call = writerCustom.mock.calls[0][0];
    expect(call.type).toBe('data-workspace-metadata');
    expect(call.data.toolName).toBe('my_test_tool');
    expect(call.data.id).toBe('ws-test');
    expect(call.data.name).toBe('Test Workspace');
  });

  it('includes toolCallId from agent context', async () => {
    const writerCustom = vi.fn();
    const workspace = createMockWorkspace({ filesystem: true });
    const context: ToolExecutionContext = {
      workspace,
      writer: { custom: writerCustom } as any,
      agent: { toolCallId: 'call-123' } as any,
    };

    await emitWorkspaceMetadata(context, 'my_test_tool');

    const call = writerCustom.mock.calls[0][0];
    expect(call.data.toolCallId).toBe('call-123');
  });

  it('sets toolCallId to undefined when no agent context', async () => {
    const writerCustom = vi.fn();
    const workspace = createMockWorkspace({ filesystem: true });
    const context: ToolExecutionContext = {
      workspace,
      writer: { custom: writerCustom } as any,
    };

    await emitWorkspaceMetadata(context, 'my_test_tool');

    const call = writerCustom.mock.calls[0][0];
    expect(call.data.toolCallId).toBeUndefined();
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

describe('getEditDiagnosticsText', () => {
  function createMockLSPWorkspace(diagnostics: LSPDiagnostic[] = []) {
    const mockLsp = {
      root: '/project',
      getDiagnostics: vi.fn().mockResolvedValue(diagnostics),
    };
    const workspace = createMockWorkspace({ sandbox: true });
    // Attach mock LSP manager
    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });
    return { workspace, mockLsp };
  }

  it('returns empty string when workspace has no LSP manager', async () => {
    const workspace = createMockWorkspace({ sandbox: true });
    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'const x = 1');
    expect(result).toBe('');
  });

  it('returns empty string when diagnostics are empty', async () => {
    const { workspace } = createMockLSPWorkspace([]);
    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'const x = 1');
    expect(result).toBe('');
  });

  it('formats error diagnostics', async () => {
    const { workspace } = createMockLSPWorkspace([
      {
        severity: 'error',
        message: "Type 'string' is not assignable to type 'number'.",
        line: 5,
        character: 3,
        source: 'ts',
      },
    ]);

    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'const x: number = "hello"');

    expect(result).toContain('LSP Diagnostics:');
    expect(result).toContain('Errors:');
    expect(result).toContain("5:3 - Type 'string' is not assignable to type 'number'. [ts]");
  });

  it('formats warnings separately from errors', async () => {
    const { workspace } = createMockLSPWorkspace([
      { severity: 'error', message: 'Type error', line: 1, character: 1, source: 'ts' },
      { severity: 'warning', message: 'Unused variable', line: 2, character: 1, source: 'ts' },
    ]);

    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'code');

    expect(result).toContain('Errors:');
    expect(result).toContain('Warnings:');
    // Errors should appear before warnings
    const errIdx = result.indexOf('Errors:');
    const warnIdx = result.indexOf('Warnings:');
    expect(errIdx).toBeLessThan(warnIdx);
  });

  it('groups all severity levels', async () => {
    const { workspace } = createMockLSPWorkspace([
      { severity: 'error', message: 'Error msg', line: 1, character: 1 },
      { severity: 'warning', message: 'Warning msg', line: 2, character: 1 },
      { severity: 'info', message: 'Info msg', line: 3, character: 1 },
      { severity: 'hint', message: 'Hint msg', line: 4, character: 1 },
    ]);

    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'code');

    expect(result).toContain('Errors:');
    expect(result).toContain('Warnings:');
    expect(result).toContain('Info:');
    expect(result).toContain('Hints:');
  });

  it('omits source tag when source is undefined', async () => {
    const { workspace } = createMockLSPWorkspace([{ severity: 'error', message: 'No source', line: 1, character: 1 }]);

    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'code');

    expect(result).toContain('1:1 - No source');
    expect(result).not.toContain('[');
  });

  it('deduplicates identical diagnostics', async () => {
    const dup: LSPDiagnostic = { severity: 'error', message: 'Duplicate', line: 1, character: 1, source: 'ts' };
    const { workspace } = createMockLSPWorkspace([dup, dup, dup]);

    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'code');

    // Should only appear once
    const matches = result.match(/Duplicate/g);
    expect(matches).toHaveLength(1);
  });

  it('keeps diagnostics with different locations', async () => {
    const { workspace } = createMockLSPWorkspace([
      { severity: 'error', message: 'Same message', line: 1, character: 1, source: 'ts' },
      { severity: 'error', message: 'Same message', line: 5, character: 1, source: 'ts' },
    ]);

    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'code');

    const matches = result.match(/Same message/g);
    expect(matches).toHaveLength(2);
  });

  it('resolves relative paths using lspManager.root', async () => {
    const { workspace, mockLsp } = createMockLSPWorkspace([]);

    await getEditDiagnosticsText(workspace, 'src/app.ts', 'code');

    expect(mockLsp.getDiagnostics).toHaveBeenCalledWith('/project/src/app.ts', 'code');
  });

  it('treats /-prefixed paths as virtual when no resolveAbsolutePath', async () => {
    const { workspace, mockLsp } = createMockLSPWorkspace([]);

    // Without resolveAbsolutePath, /src/app.ts is treated as virtual
    // and resolved relative to lspManager.root
    await getEditDiagnosticsText(workspace, '/src/app.ts', 'code');

    expect(mockLsp.getDiagnostics).toHaveBeenCalledWith('/project/src/app.ts', 'code');
  });

  it('uses resolveAbsolutePath from filesystem when available', async () => {
    const { workspace, mockLsp } = createMockLSPWorkspace([]);
    // Mock filesystem with resolveAbsolutePath (simulates contained: true)
    Object.defineProperty(workspace, 'filesystem', {
      get: () => ({ resolveAbsolutePath: (p: string) => '/my-base' + (p.startsWith('/') ? p : '/' + p) }),
    });

    await getEditDiagnosticsText(workspace, '/src/app.ts', 'code');

    expect(mockLsp.getDiagnostics).toHaveBeenCalledWith('/my-base/src/app.ts', 'code');
  });

  it('uses resolveAbsolutePath for contained: false (absolute paths pass through)', async () => {
    const { workspace, mockLsp } = createMockLSPWorkspace([]);
    // Mock filesystem with resolveAbsolutePath (simulates contained: false)
    Object.defineProperty(workspace, 'filesystem', {
      get: () => ({ resolveAbsolutePath: (p: string) => p }),
    });

    await getEditDiagnosticsText(workspace, '/Users/me/project/src/app.ts', 'code');

    expect(mockLsp.getDiagnostics).toHaveBeenCalledWith('/Users/me/project/src/app.ts', 'code');
  });

  it('falls back to lspManager.root when resolveAbsolutePath returns undefined', async () => {
    const { workspace, mockLsp } = createMockLSPWorkspace([]);
    // Mock filesystem that can't resolve the path (e.g. remote filesystem)
    Object.defineProperty(workspace, 'filesystem', {
      get: () => ({ resolveAbsolutePath: () => undefined }),
    });

    await getEditDiagnosticsText(workspace, '/src/app.ts', 'code');

    expect(mockLsp.getDiagnostics).toHaveBeenCalledWith('/project/src/app.ts', 'code');
  });

  it('truncates long output', async () => {
    // Generate many diagnostics to exceed 2000 chars
    const diagnostics: LSPDiagnostic[] = [];
    for (let i = 0; i < 100; i++) {
      diagnostics.push({
        severity: 'error',
        message: `Error on line ${i}: This is a long error message that takes up space in the output buffer to ensure truncation`,
        line: i,
        character: 1,
        source: 'ts',
      });
    }
    const { workspace } = createMockLSPWorkspace(diagnostics);

    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'code');

    expect(result.length).toBeLessThanOrEqual(2050); // 2000 + '\n  ... (truncated)' (18 chars)
    expect(result).toContain('... (truncated)');
  });

  it('returns empty string when getDiagnostics throws', async () => {
    const mockLsp = {
      root: '/project',
      getDiagnostics: vi.fn().mockRejectedValue(new Error('LSP crashed')),
    };
    const workspace = createMockWorkspace({ sandbox: true });
    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

    const result = await getEditDiagnosticsText(workspace, 'src/app.ts', 'code');
    expect(result).toBe('');
  });

  it('returns empty string on timeout', async () => {
    vi.useFakeTimers();
    try {
      const mockLsp = {
        root: '/project',
        getDiagnostics: vi.fn().mockImplementation(
          () =>
            new Promise((_resolve, reject) => {
              // This will be triggered when fake timers advance past 10s (DIAG_TIMEOUT_MS)
              setTimeout(() => reject(new Error('LSP diagnostics timeout')), 15_000);
            }),
        ),
      };
      const workspace = createMockWorkspace({ sandbox: true });
      Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

      const resultPromise = getEditDiagnosticsText(workspace, 'src/app.ts', 'code');

      // Advance past the internal DIAG_TIMEOUT_MS (10_000ms) to trigger the Promise.race timeout
      await vi.advanceTimersByTimeAsync(11_000);

      const result = await resultPromise;
      expect(result).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
