import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '@mastra/core';
import type { FilesystemProvider } from '@mastra/core/editor';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { MastraEditor } from '../index';

describe('editor e2e scenario: workspace provider hydration', () => {
  it('hydrates stored workspace snapshots through registered filesystem providers and preserves workspace options', async () => {
    // USER STORY: A Studio user stores a workspace with external filesystem settings and expects runtime agents to use that provider.
    // ARRANGE
    const createdConfigs: unknown[] = [];
    const provider: FilesystemProvider<{ endpoint: string }> = {
      id: 'scenario-fs',
      name: 'Scenario FS',
      createFilesystem: config => {
        createdConfigs.push(config);
        return {
          id: 'scenario-fs-instance',
          name: 'Scenario FS Instance',
          provider: 'scenario-fs',
          readOnly: false,
          readFile: vi.fn(),
          writeFile: vi.fn(),
          mkdir: vi.fn(),
          readdir: vi.fn(),
          stat: vi.fn(),
          exists: vi.fn(),
          rm: vi.fn(),
          watch: vi.fn(),
          destroy: vi.fn(),
          getInfo: () => ({ provider: 'scenario-fs', config, readOnly: false }),
        } as any;
      },
    };
    const customEditor = new MastraEditor({
      filesystems: { 'scenario-fs': provider },
    });
    new Mastra({ storage: new InMemoryStore(), editor: customEditor });

    // ACT
    const workspace = await customEditor.workspace.hydrateSnapshotToWorkspace('scenario-workspace', {
      name: 'Scenario Workspace',
      filesystem: { provider: 'scenario-fs', config: { endpoint: 'https://fs.example.test' } },
      tools: { enabled: true, requireApproval: true },
      autoSync: true,
      operationTimeout: 12_000,
    });

    // ASSERT
    expect(workspace).toBeInstanceOf(Workspace);
    expect(createdConfigs).toEqual([{ endpoint: 'https://fs.example.test' }]);
    const snapshot = await customEditor.workspace.snapshotFromWorkspace(
      workspace as Parameters<typeof customEditor.workspace.snapshotFromWorkspace>[0],
    );
    expect(snapshot).toMatchObject({
      name: 'Scenario Workspace',
      filesystem: { provider: 'scenario-fs', readOnly: false },
    });
  });
});
