import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { Workspace } from '@mastra/core/workspace';
import { LocalFilesystem } from '@mastra/core/workspace';
import { MastraEditor, snapshotsMatch } from './index';

// =============================================================================
// Helpers
// =============================================================================

const mockLogger = () => ({
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
  trackException: vi.fn(),
});

let testStorageCount = 0;

/** Wait for an async condition to become true (polls every 50ms, max 3s) */
const waitFor = async (condition: () => Promise<boolean>, timeoutMs = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('waitFor timed out');
};

// =============================================================================
// snapshotsMatch — unit tests
// =============================================================================

describe('snapshotsMatch', () => {
  it('returns true for identical snapshots', () => {
    const snapshot = { name: 'ws', filesystem: { provider: 'local', config: { basePath: '/tmp' } } };
    expect(snapshotsMatch(snapshot, snapshot)).toBe(true);
  });

  it('returns true when both have only name', () => {
    expect(snapshotsMatch({ name: 'ws' }, { name: 'ws' })).toBe(true);
  });

  it('returns false when names differ', () => {
    expect(snapshotsMatch({ name: 'a' }, { name: 'b' })).toBe(false);
  });

  it('returns false when one has filesystem and other does not', () => {
    const a = { name: 'ws' };
    const b = { name: 'ws', filesystem: { provider: 'local', config: {} } };
    expect(snapshotsMatch(a, b)).toBe(false);
  });

  it('returns false when filesystem config differs', () => {
    const a = { name: 'ws', filesystem: { provider: 'local', config: { basePath: '/a' } } };
    const b = { name: 'ws', filesystem: { provider: 'local', config: { basePath: '/b' } } };
    expect(snapshotsMatch(a, b)).toBe(false);
  });

  it('returns false when filesystem provider differs', () => {
    const a = { name: 'ws', filesystem: { provider: 'local', config: {} } };
    const b = { name: 'ws', filesystem: { provider: 's3', config: {} } };
    expect(snapshotsMatch(a, b)).toBe(false);
  });

  it('returns true when both have undefined optional fields', () => {
    const a = { name: 'ws', description: undefined, sandbox: undefined };
    const b = { name: 'ws' };
    expect(snapshotsMatch(a, b)).toBe(true);
  });

  it('detects sandbox changes', () => {
    const a = { name: 'ws', sandbox: { provider: 'local', config: {} } };
    const b = { name: 'ws', sandbox: { provider: 'e2b', config: {} } };
    expect(snapshotsMatch(a, b)).toBe(false);
  });

  it('detects tools config changes', () => {
    const a = { name: 'ws', tools: { enabled: true } };
    const b = { name: 'ws', tools: { enabled: false } };
    expect(snapshotsMatch(a, b)).toBe(false);
  });

  it('ignores metadata fields not in snapshot keys', () => {
    // snapshotsMatch only compares config fields, not id/metadata/status
    const stored = { name: 'ws', id: 'x', status: 'draft' as const } as any;
    const runtime = { name: 'ws' };
    expect(snapshotsMatch(stored, runtime)).toBe(true);
  });
});

// =============================================================================
// ensureBuilderWorkspaces — metadata tagging & config drift upsert
// =============================================================================

describe('ensureBuilderWorkspaces', () => {
  it('creates workspace with builder metadata on first startup', async () => {
    const storage = new LibSQLStore({ id: `ws-builder-meta-${testStorageCount++}`, url: ':memory:' });
    await storage.init();

    // Register a runtime workspace that the builder will reference
    const workspace = new Workspace({
      id: 'builder-ws',
      name: 'Builder Workspace',
      filesystem: new LocalFilesystem({ basePath: '/tmp/builder-test' }),
    });

    const editor = new MastraEditor({
      logger: mockLogger() as any,
      builder: {
        enabled: true,
        configuration: {
          agent: {
            workspace: { type: 'id', workspaceId: 'builder-ws' },
          },
        },
      } as any,
    });

    new Mastra({ storage, editor, workspace });

    // Wait for ensureBuilderWorkspaces to complete (fire-and-forget)
    const workspaceStore = (await storage.getStore('workspaces'))!;
    await waitFor(async () => {
      const ws = await workspaceStore.getByIdResolved('builder-ws');
      return ws !== null && ws !== undefined;
    });

    const ws = await workspaceStore.getByIdResolved('builder-ws');
    expect(ws).toBeDefined();
    expect(ws!.name).toBe('Builder Workspace');
    expect(ws!.metadata).toEqual(
      expect.objectContaining({
        source: 'builder',
        builderWorkspaceId: 'builder-ws',
      }),
    );
  });

  it('updates workspace config when runtime snapshot differs from DB', async () => {
    const storage = new LibSQLStore({ id: `ws-drift-${testStorageCount++}`, url: ':memory:' });
    await storage.init();

    // Pre-create workspace with old config (simulating previous startup)
    const workspaceStore = (await storage.getStore('workspaces'))!;
    await workspaceStore.create({
      workspace: {
        id: 'builder-ws',
        name: 'Builder Workspace',
        metadata: { source: 'builder', builderWorkspaceId: 'builder-ws' },
        filesystem: { provider: 'local', config: { basePath: '/tmp/old' } },
      },
    });

    // Now start with a different config
    const workspace = new Workspace({
      id: 'builder-ws',
      name: 'Builder Workspace',
      filesystem: new LocalFilesystem({ basePath: '/tmp/new' }),
    });

    const editor = new MastraEditor({
      logger: mockLogger() as any,
      builder: {
        enabled: true,
        configuration: {
          agent: {
            workspace: { type: 'id', workspaceId: 'builder-ws' },
          },
        },
      } as any,
    });

    new Mastra({ storage, editor, workspace });

    // Wait for the config drift update
    await waitFor(async () => {
      // Need to bypass editor cache — go directly to store
      const ws = await workspaceStore.getByIdResolved('builder-ws');
      return ws?.filesystem?.config?.basePath === '/tmp/new';
    });

    const ws = await workspaceStore.getByIdResolved('builder-ws');
    expect(ws!.filesystem!.config).toEqual(expect.objectContaining({ basePath: '/tmp/new' }));
  });

  it('does nothing when snapshot matches', async () => {
    const storage = new LibSQLStore({ id: `ws-match-${testStorageCount++}`, url: ':memory:' });
    await storage.init();

    // Pre-create workspace with matching config
    const workspaceStore = (await storage.getStore('workspaces'))!;
    await workspaceStore.create({
      workspace: {
        id: 'builder-ws',
        name: 'Builder Workspace',
        metadata: { source: 'builder', builderWorkspaceId: 'builder-ws' },
        filesystem: { provider: 'local', config: { basePath: '/tmp/same', contained: true } },
      },
    });

    const workspace = new Workspace({
      id: 'builder-ws',
      name: 'Builder Workspace',
      filesystem: new LocalFilesystem({ basePath: '/tmp/same' }),
    });

    const logger = mockLogger();
    const editor = new MastraEditor({
      logger: logger as any,
      builder: {
        enabled: true,
        configuration: {
          agent: {
            workspace: { type: 'id', workspaceId: 'builder-ws' },
          },
        },
      } as any,
    });

    new Mastra({ storage, editor, workspace });

    // Give it time to complete
    await new Promise(r => setTimeout(r, 500));

    // No config drift log message
    const infoCalls = logger.info.mock.calls.map((c: any[]) => c[0]);
    expect(infoCalls).not.toContainEqual(expect.stringContaining('config drifted'));
  });

  it('backfills metadata on existing workspace without source tag', async () => {
    const storage = new LibSQLStore({ id: `ws-backfill-${testStorageCount++}`, url: ':memory:' });
    await storage.init();

    // Pre-create workspace WITHOUT builder metadata (simulating pre-change deployment)
    const workspaceStore = (await storage.getStore('workspaces'))!;
    await workspaceStore.create({
      workspace: {
        id: 'builder-ws',
        name: 'Builder Workspace',
        filesystem: { provider: 'local', config: { basePath: '/tmp/same', contained: true } },
      },
    });

    const workspace = new Workspace({
      id: 'builder-ws',
      name: 'Builder Workspace',
      filesystem: new LocalFilesystem({ basePath: '/tmp/same' }),
    });

    const editor = new MastraEditor({
      logger: mockLogger() as any,
      builder: {
        enabled: true,
        configuration: {
          agent: {
            workspace: { type: 'id', workspaceId: 'builder-ws' },
          },
        },
      } as any,
    });

    new Mastra({ storage, editor, workspace });

    // Wait for metadata backfill
    await waitFor(async () => {
      const ws = await workspaceStore.getByIdResolved('builder-ws');
      return ws?.metadata?.source === 'builder';
    });

    const ws = await workspaceStore.getByIdResolved('builder-ws');
    expect(ws!.metadata).toEqual(
      expect.objectContaining({
        source: 'builder',
        builderWorkspaceId: 'builder-ws',
      }),
    );
  });
});

// =============================================================================
// reconcileBuilderWorkspaces — orphan detection
// =============================================================================

describe('reconcileBuilderWorkspaces', () => {
  it('archives orphaned builder workspaces', async () => {
    const storage = new LibSQLStore({ id: `ws-orphan-${testStorageCount++}`, url: ':memory:' });
    await storage.init();

    const workspaceStore = (await storage.getStore('workspaces'))!;

    // Create an old builder workspace (orphan — builder config now points elsewhere)
    await workspaceStore.create({
      workspace: {
        id: 'old-builder-ws',
        name: 'Old Builder Workspace',
        metadata: { source: 'builder', builderWorkspaceId: 'old-builder-ws' },
        filesystem: { provider: 'local', config: { basePath: '/tmp/old' } },
      },
    });

    // Current workspace is different
    const workspace = new Workspace({
      id: 'new-builder-ws',
      name: 'New Builder Workspace',
      filesystem: new LocalFilesystem({ basePath: '/tmp/new' }),
    });

    const editor = new MastraEditor({
      logger: mockLogger() as any,
      builder: {
        enabled: true,
        configuration: {
          agent: {
            workspace: { type: 'id', workspaceId: 'new-builder-ws' },
          },
        },
      } as any,
    });

    new Mastra({ storage, editor, workspace });

    // Wait for reconciliation to archive the old workspace
    await waitFor(async () => {
      const ws = await workspaceStore.getById('old-builder-ws');
      return ws?.status === 'archived';
    });

    const oldWs = await workspaceStore.getById('old-builder-ws');
    expect(oldWs!.status).toBe('archived');

    // New workspace should be created and active
    await waitFor(async () => {
      const ws = await workspaceStore.getByIdResolved('new-builder-ws');
      return ws !== null && ws !== undefined;
    });

    const newWs = await workspaceStore.getByIdResolved('new-builder-ws');
    expect(newWs).toBeDefined();
    expect(newWs!.status).toBe('draft');
  });

  it('does not archive non-builder workspaces', async () => {
    const storage = new LibSQLStore({ id: `ws-noarch-${testStorageCount++}`, url: ':memory:' });
    await storage.init();

    const workspaceStore = (await storage.getStore('workspaces'))!;

    // Create a user-created workspace (no builder metadata)
    await workspaceStore.create({
      workspace: {
        id: 'user-ws',
        name: 'User Workspace',
        filesystem: { provider: 'local', config: { basePath: '/tmp/user' } },
      },
    });

    const workspace = new Workspace({
      id: 'builder-ws',
      name: 'Builder Workspace',
      filesystem: new LocalFilesystem({ basePath: '/tmp/builder' }),
    });

    const editor = new MastraEditor({
      logger: mockLogger() as any,
      builder: {
        enabled: true,
        configuration: {
          agent: {
            workspace: { type: 'id', workspaceId: 'builder-ws' },
          },
        },
      } as any,
    });

    new Mastra({ storage, editor, workspace });

    // Wait for reconciliation to complete (new workspace created)
    await waitFor(async () => {
      const ws = await workspaceStore.getByIdResolved('builder-ws');
      return ws !== null && ws !== undefined;
    });

    // Give extra time for reconciliation to finish
    await new Promise(r => setTimeout(r, 300));

    // User workspace should NOT be touched
    const userWs = await workspaceStore.getById('user-ws');
    expect(userWs!.status).toBe('draft');
  });

  it('does not archive the current builder workspace', async () => {
    const storage = new LibSQLStore({ id: `ws-current-${testStorageCount++}`, url: ':memory:' });
    await storage.init();

    const workspaceStore = (await storage.getStore('workspaces'))!;

    // Pre-create current workspace with builder metadata
    await workspaceStore.create({
      workspace: {
        id: 'builder-ws',
        name: 'Builder Workspace',
        metadata: { source: 'builder', builderWorkspaceId: 'builder-ws' },
        filesystem: { provider: 'local', config: { basePath: '/tmp/same', contained: true } },
      },
    });

    const workspace = new Workspace({
      id: 'builder-ws',
      name: 'Builder Workspace',
      filesystem: new LocalFilesystem({ basePath: '/tmp/same' }),
    });

    const editor = new MastraEditor({
      logger: mockLogger() as any,
      builder: {
        enabled: true,
        configuration: {
          agent: {
            workspace: { type: 'id', workspaceId: 'builder-ws' },
          },
        },
      } as any,
    });

    new Mastra({ storage, editor, workspace });

    // Give time for reconciliation to run
    await new Promise(r => setTimeout(r, 500));

    // Current workspace should still be active (not archived)
    const ws = await workspaceStore.getById('builder-ws');
    expect(ws!.status).not.toBe('archived');
  });
});
