import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { SandboxProcessManager } from '../sandbox/process-manager';
import { LSPManager } from './manager';

const mockWaitForDiagnostics = vi.fn().mockResolvedValue([
  {
    severity: 1,
    message: "Type 'string' is not assignable to type 'number'.",
    range: { start: { line: 11, character: 4 } },
    source: 'ts',
  },
  {
    severity: 2,
    message: "'unused' is declared but its value is never read.",
    range: { start: { line: 2, character: 0 } },
    source: 'ts',
  },
]);

const mockShutdown = vi.fn().mockResolvedValue(undefined);

// Mock the client module with a proper class
vi.mock('./client', () => ({
  LSPClient: class MockLSPClient {
    initialize = vi.fn().mockResolvedValue(undefined);
    notifyOpen = vi.fn();
    notifyChange = vi.fn();
    notifyClose = vi.fn();
    waitForDiagnostics = mockWaitForDiagnostics;
    shutdown = mockShutdown;
  },
  loadLSPDeps: vi.fn().mockResolvedValue({}),
  isLSPAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('./servers', () => ({
  getServersForFile: vi.fn().mockImplementation(function getServersForFile(filePath: string) {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      return [
        {
          id: 'typescript',
          name: 'TypeScript Language Server',
          languageIds: ['typescript', 'typescriptreact'],
          command: () => 'typescript-language-server --stdio',
        },
      ];
    }
    return [];
  }),
}));

/** Minimal mock process manager for tests */
const mockProcessManager = {
  spawn: vi.fn().mockResolvedValue({ pid: 1, kill: vi.fn(), reader: {}, writer: {} }),
  list: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(undefined),
  kill: vi.fn().mockResolvedValue(true),
} as unknown as SandboxProcessManager;

describe('LSPManager', () => {
  let manager: LSPManager;

  beforeEach(() => {
    manager = new LSPManager(mockProcessManager, '/project');
  });

  afterEach(async () => {
    await manager.shutdownAll();
    vi.clearAllMocks();
  });

  describe('root', () => {
    it('exposes the root passed to the constructor', () => {
      expect(manager.root).toBe('/project');
    });
  });

  describe('getClient', () => {
    it('returns null for unsupported file types', async () => {
      const client = await manager.getClient('/project/README.md');
      expect(client).toBeNull();
    });

    it('returns a client for TypeScript files', async () => {
      const client = await manager.getClient('/project/src/app.ts');
      expect(client).not.toBeNull();
    });

    it('reuses client for same server + workspace', async () => {
      const client1 = await manager.getClient('/project/src/app.ts');
      const client2 = await manager.getClient('/project/src/other.ts');
      expect(client1).toBe(client2);
    });
  });

  describe('getDiagnostics', () => {
    it('returns normalized diagnostics for TypeScript files', async () => {
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'const x: number = "hello"');

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics[0]).toEqual({
        severity: 'error',
        message: "Type 'string' is not assignable to type 'number'.",
        line: 12,
        character: 5,
        source: 'ts',
      });
      expect(diagnostics[1]).toEqual({
        severity: 'warning',
        message: "'unused' is declared but its value is never read.",
        line: 3,
        character: 1,
        source: 'ts',
      });
    });

    it('returns empty array for unsupported files', async () => {
      const diagnostics = await manager.getDiagnostics('/project/data.json', '{}');
      expect(diagnostics).toEqual([]);
    });
  });

  describe('shutdownAll', () => {
    it('cleans up all clients', async () => {
      await manager.getClient('/project/src/app.ts');

      await manager.shutdownAll();

      // After shutdown, getting a new client should create a fresh one
      const client = await manager.getClient('/project/src/app.ts');
      expect(client).not.toBeNull();
    });
  });

  describe('config', () => {
    it('respects disableServers config', async () => {
      const { getServersForFile } = await import('./servers');
      const restrictedManager = new LSPManager(mockProcessManager, '/project', { disableServers: ['eslint'] });

      await restrictedManager.getClient('/project/src/app.ts');

      expect(getServersForFile).toHaveBeenCalledWith('/project/src/app.ts', ['eslint']);
      await restrictedManager.shutdownAll();
    });
  });
});
