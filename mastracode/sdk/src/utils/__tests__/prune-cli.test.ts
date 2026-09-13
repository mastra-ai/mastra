import { LibSQLVector } from '@mastra/libsql';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The native driver is pulled in transitively by storage-maintenance; stub the
// libsql package so `vector instanceof LibSQLVector` is testable without
// touching real database files.
// vi.mock is hoisted above the imports, so the static import above still
// resolves to this stub.
vi.mock('@mastra/libsql', () => ({
  LibSQLVector: class LibSQLVector {
    close = vi.fn(async () => {});
    constructor(_config?: unknown) {}
  },
}));

vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: vi.fn(() => ({
    storage: { backend: 'libsql', libsql: {}, pg: {} },
  })),
}));

vi.mock('../project.js', () => ({
  detectProject: vi.fn(() => ({
    resourceId: 'res-1',
    name: 'proj',
    rootPath: '/proj',
    isWorktree: false,
  })),
  getStorageConfig: vi.fn(() => ({
    backend: 'libsql',
    url: 'file:/tmp/mc-prune-test.db',
    isRemote: false,
  })),
  getDatabasePath: () => '/tmp/mc-prune-default.db',
  getVectorDatabasePath: () => '/tmp/mc-prune-vectors.db',
}));

vi.mock('../storage-factory.js', () => ({
  createStorage: vi.fn(),
  createVectorStore: vi.fn(),
}));

// Keep createStorageMaintenance / DEFAULT_RETENTION / resolveLocalDbFiles real so
// the wiring under test is genuine; only the runner (already covered by
// storage-maintenance.test.ts) is stubbed.
vi.mock('../storage-maintenance.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../storage-maintenance.js')>();
  return { ...actual, runStorageMaintenance: vi.fn() };
});

import { loadSettings } from '../../onboarding/settings.js';
import { detectProject, getStorageConfig } from '../project.js';
import { runPruneCommand } from '../prune-cli.js';
import { createStorage, createVectorStore } from '../storage-factory.js';
import { DEFAULT_RETENTION, runStorageMaintenance } from '../storage-maintenance.js';
import type { StorageMaintenance } from '../storage-maintenance.js';

const SETTINGS_STORAGE = { backend: 'libsql', libsql: {}, pg: {} };

function makeStorage() {
  return {
    init: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    prune: vi.fn(async () => []),
  };
}

/** The maintenance handle handed to runStorageMaintenance by the last call. */
function lastMaintenance(): StorageMaintenance {
  const call = vi.mocked(runStorageMaintenance).mock.calls.at(-1);
  if (!call) throw new Error('runStorageMaintenance was not called');
  return call[0].maintenance;
}

function lastRunArgs() {
  const call = vi.mocked(runStorageMaintenance).mock.calls.at(-1);
  if (!call) throw new Error('runStorageMaintenance was not called');
  return call[0];
}

let storage: ReturnType<typeof makeStorage>;
let logged: string[];
let errored: string[];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadSettings).mockReturnValue({ storage: SETTINGS_STORAGE } as never);
  vi.mocked(detectProject).mockReturnValue({
    resourceId: 'res-1',
    name: 'proj',
    rootPath: '/proj',
    isWorktree: false,
  } as never);
  vi.mocked(getStorageConfig).mockReturnValue({
    backend: 'libsql',
    url: 'file:/tmp/mc-prune-test.db',
    isRemote: false,
  } as never);

  storage = makeStorage();
  vi.mocked(createStorage).mockResolvedValue({ storage, backend: 'libsql' } as never);
  vi.mocked(createVectorStore).mockResolvedValue(undefined);
  vi.mocked(runStorageMaintenance).mockResolvedValue(undefined);

  logged = [];
  errored = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    logged.push(String(line));
  });
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    errored.push(String(line));
  });
});

describe('runPruneCommand', () => {
  it('prunes with the standing retention policies and no vacuum by default', async () => {
    const code = await runPruneCommand([]);

    expect(code).toBe(0);
    expect(lastRunArgs().vacuum).toBe(false);
    expect(lastRunArgs().keepMemory).toBe(false);
    expect(lastMaintenance().retention).toEqual(DEFAULT_RETENTION);
    expect(lastMaintenance().backend).toBe('libsql');
  });

  it.each([
    [['--vacuum'], { vacuum: true, keepMemory: false }],
    [['--keep-memory'], { vacuum: false, keepMemory: true }],
    [['--vacuum', '--keep-memory'], { vacuum: true, keepMemory: true }],
    [['--keep-memory', '--vacuum'], { vacuum: true, keepMemory: true }],
  ])('maps %o to the expected flags', async (args, expected) => {
    expect(await runPruneCommand(args)).toBe(0);
    expect(lastRunArgs().vacuum).toBe(expected.vacuum);
    expect(lastRunArgs().keepMemory).toBe(expected.keepMemory);
  });

  it('rejects unknown flags without touching the database', async () => {
    const code = await runPruneCommand(['--bogus']);

    expect(code).toBe(1);
    expect(runStorageMaintenance).not.toHaveBeenCalled();
    expect(createStorage).not.toHaveBeenCalled();
    expect(errored.join('\n')).toContain('Unknown prune option: --bogus');
    expect(errored.join('\n')).toContain('Usage: mastracode prune');
  });

  it('prints usage for --help and does not prune', async () => {
    const code = await runPruneCommand(['--help']);

    expect(code).toBe(0);
    expect(runStorageMaintenance).not.toHaveBeenCalled();
    expect(createStorage).not.toHaveBeenCalled();
    expect(logged.join('\n')).toContain('Usage: mastracode prune');
  });

  it('initializes the store before pruning', async () => {
    // Without init the retention DELETEs run against tables that may not exist
    // yet ("no such table"). The libsql factory does not init on our behalf.
    const order: string[] = [];
    storage.init.mockImplementation(async () => {
      order.push('init');
    });
    vi.mocked(runStorageMaintenance).mockImplementation(async () => {
      order.push('prune');
    });

    expect(await runPruneCommand([])).toBe(0);
    expect(order).toEqual(['init', 'prune']);
  });

  it('resolves storage from the detected project and global settings', async () => {
    // Guards against pruning the wrong database: a project can point at its own
    // .mastracode/database.json, and MASTRA_DB_PATH / settings must be honored.
    await runPruneCommand([]);

    expect(detectProject).toHaveBeenCalledWith(process.cwd());
    expect(getStorageConfig).toHaveBeenCalledWith('/proj', SETTINGS_STORAGE, '.mastracode');
    expect(createStorage).toHaveBeenCalledWith({
      backend: 'libsql',
      url: 'file:/tmp/mc-prune-test.db',
      isRemote: false,
    });
    expect(logged.join('\n')).toContain('Database: /tmp/mc-prune-test.db');
  });

  it('closes the vector connection alongside storage for libsql vectors', async () => {
    // The compaction's file swap refuses to run while a connection is open, so
    // the vector store must close with storage.
    const vector = new (LibSQLVector as any)();
    vi.mocked(createVectorStore).mockResolvedValue(vector);

    await runPruneCommand(['--vacuum']);
    await lastMaintenance().closeStorage!();

    expect(storage.close).toHaveBeenCalledOnce();
    expect(vector.close).toHaveBeenCalledOnce();
  });

  it('does not wire closeVector for a non-libsql vector store', async () => {
    const foreignClose = vi.fn(async () => {});
    vi.mocked(createVectorStore).mockResolvedValue({ close: foreignClose } as never);

    await runPruneCommand([]);
    await lastMaintenance().closeStorage!();

    expect(storage.close).toHaveBeenCalledOnce();
    // A PG vector shares the store's connection — closing it here would be wrong.
    expect(foreignClose).not.toHaveBeenCalled();
  });

  it('returns 1 and still releases the connection when maintenance fails', async () => {
    vi.mocked(runStorageMaintenance).mockRejectedValue(new Error('SQLITE_BUSY'));

    const code = await runPruneCommand(['--vacuum']);

    expect(code).toBe(1);
    expect(errored.join('\n')).toContain('Storage maintenance failed: SQLITE_BUSY');
    expect(storage.close).toHaveBeenCalledOnce();
  });

  it('surfaces the storage fallback warning', async () => {
    vi.mocked(createStorage).mockResolvedValue({
      storage,
      backend: 'libsql',
      warning: 'Using LibSQL fallback.',
    } as never);

    await runPruneCommand([]);

    expect(logged.join('\n')).toContain('Using LibSQL fallback.');
  });
});
