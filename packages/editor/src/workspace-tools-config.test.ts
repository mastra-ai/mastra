import type { StorageWorkspaceToolsConfig } from '@mastra/core/storage';
import type { WorkspaceToolsConfig } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';
import { toRuntimeWorkspaceToolsConfig, toStorageWorkspaceToolsConfig } from './workspace-tools-config';

describe('workspace tool configuration conversion', () => {
  it.each([true, false])('preserves static %s values in both shapes without mutating input', value => {
    const stored: StorageWorkspaceToolsConfig = {
      enabled: value,
      requireApproval: value,
      tools: {
        mastra_workspace_write_file: { enabled: value, requireApproval: value, requireReadBeforeWrite: value },
        mastra_workspace_read_file: { enabled: !value, requireApproval: !value },
      },
    };
    const original = structuredClone(stored);
    const runtime = toRuntimeWorkspaceToolsConfig(stored);
    expect(runtime).toEqual({ enabled: value, requireApproval: value, ...stored.tools });
    expect(runtime).not.toHaveProperty('tools');
    expect(toStorageWorkspaceToolsConfig(runtime)).toEqual(stored);
    expect(stored).toEqual(original);
    expect(runtime).toEqual({ enabled: value, requireApproval: value, ...original.tools });
  });

  it.each<StorageWorkspaceToolsConfig>([
    { enabled: false, requireApproval: true },
    { tools: { mastra_workspace_write_file: { requireReadBeforeWrite: true } } },
    { tools: { mastra_workspace_future_tool: { enabled: false } } },
  ])('round trips globals-only and per-tool-only configurations: %j', stored => {
    expect(toStorageWorkspaceToolsConfig(toRuntimeWorkspaceToolsConfig(stored))).toEqual(stored);
  });

  it.each<StorageWorkspaceToolsConfig>([{}, { tools: {} }, { tools: { mastra_workspace_write_file: {} } }])(
    'omits empty serialized configurations: %j',
    stored => {
      expect(toStorageWorkspaceToolsConfig(toRuntimeWorkspaceToolsConfig(stored))).toBeUndefined();
    },
  );

  it('retains static fields while omitting dynamic and unsupported settings without invoking callbacks', () => {
    const dynamic = vi.fn(() => true);
    const hook = vi.fn();
    const runtime: WorkspaceToolsConfig = {
      enabled: dynamic,
      requireApproval: false,
      hooks: { beforeToolCall: hook },
      writeLockTimeoutMs: 500,
      mastra_workspace_write_file: {
        enabled: false,
        requireApproval: dynamic,
        requireReadBeforeWrite: true,
        name: 'write',
        maxOutputTokens: 100,
      },
      mastra_workspace_read_file: { enabled: dynamic, requireApproval: dynamic, requireReadBeforeWrite: dynamic },
      mastra_workspace_execute_command: {},
    };
    expect(toStorageWorkspaceToolsConfig(runtime)).toEqual({
      requireApproval: false,
      tools: { mastra_workspace_write_file: { enabled: false, requireReadBeforeWrite: true } },
    });
    expect(runtime.enabled).toBe(dynamic);
    expect(runtime.mastra_workspace_write_file?.requireApproval).toBe(dynamic);
    expect(runtime.hooks?.beforeToolCall).toBe(hook);
    expect(dynamic).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
  });

  it('omits dynamic-only configurations', () => {
    const dynamic = vi.fn(() => false);
    expect(
      toStorageWorkspaceToolsConfig({
        enabled: dynamic,
        requireApproval: dynamic,
        mastra_workspace_write_file: { enabled: dynamic, requireApproval: dynamic, requireReadBeforeWrite: dynamic },
      }),
    ).toBeUndefined();
    expect(dynamic).not.toHaveBeenCalled();
  });
});
