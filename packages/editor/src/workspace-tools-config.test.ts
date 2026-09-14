import { describe, expect, it } from 'vitest';

import { toRuntimeWorkspaceToolsConfig, toStorageWorkspaceToolsConfig } from './workspace-tools-config';

describe('workspace tools config mapping', () => {
  it('flattens stored per-tool settings into the runtime shape', () => {
    const runtime = toRuntimeWorkspaceToolsConfig({
      enabled: true,
      requireApproval: false,
      tools: {
        mastra_workspace_write_file: { enabled: false, requireReadBeforeWrite: true },
      },
    });

    expect(runtime).toEqual({
      enabled: true,
      requireApproval: false,
      mastra_workspace_write_file: { enabled: false, requireReadBeforeWrite: true },
    });
    expect(runtime).not.toHaveProperty('tools');
  });

  it('nests only serializable runtime settings in the storage shape', () => {
    const dynamic = () => true;
    const stored = toStorageWorkspaceToolsConfig({
      enabled: dynamic,
      requireApproval: true,
      mastra_workspace_write_file: {
        enabled: false,
        requireApproval: dynamic,
        requireReadBeforeWrite: true,
        maxOutputTokens: 500,
      },
    });

    expect(stored).toEqual({
      requireApproval: true,
      tools: {
        mastra_workspace_write_file: { enabled: false, requireReadBeforeWrite: true },
      },
    });
  });

  it('round-trips stored boolean settings', () => {
    const stored = {
      enabled: false,
      tools: {
        mastra_workspace_read_file: { enabled: true, requireApproval: true },
      },
    };

    expect(toStorageWorkspaceToolsConfig(toRuntimeWorkspaceToolsConfig(stored))).toEqual(stored);
  });

  it('omits a storage config when no static values can be persisted', () => {
    expect(
      toStorageWorkspaceToolsConfig({
        enabled: () => true,
        mastra_workspace_write_file: { enabled: () => false },
      }),
    ).toBeUndefined();
  });
});
