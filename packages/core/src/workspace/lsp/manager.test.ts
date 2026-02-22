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
const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockNotifyOpen = vi.fn();
const mockNotifyChange = vi.fn();
const mockNotifyClose = vi.fn();

// Mock the client module with a proper class
vi.mock('./client', () => ({
  LSPClient: class MockLSPClient {
    initialize = mockInitialize;
    notifyOpen = mockNotifyOpen;
    notifyChange = mockNotifyChange;
    notifyClose = mockNotifyClose;
    waitForDiagnostics = mockWaitForDiagnostics;
    shutdown = mockShutdown;
  },
  loadLSPDeps: vi.fn().mockResolvedValue({}),
  isLSPAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('./servers', () => ({
  walkUp: vi.fn().mockImplementation((startDir: string, _markers: string[]) => {
    // Simulate finding project roots at specific directories
    if (startDir.startsWith('/project') || startDir === '/project') return '/project';
    if (startDir.startsWith('/other-project') || startDir === '/other-project') return '/other-project';
    return null;
  }),
  getServersForFile: vi.fn().mockImplementation(function getServersForFile(filePath: string) {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      return [
        {
          id: 'typescript',
          name: 'TypeScript Language Server',
          languageIds: ['typescript', 'typescriptreact'],
          markers: ['tsconfig.json', 'package.json'],
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
    it('exposes the default root passed to the constructor', () => {
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

    it('reuses client for same server + project root', async () => {
      const client1 = await manager.getClient('/project/src/app.ts');
      const client2 = await manager.getClient('/project/src/other.ts');
      expect(client1).toBe(client2);
    });

    it('creates separate clients for files in different project roots', async () => {
      const client1 = await manager.getClient('/project/src/app.ts');
      const client2 = await manager.getClient('/other-project/src/app.ts');
      expect(client1).not.toBe(client2);
      expect(client1).not.toBeNull();
      expect(client2).not.toBeNull();
    });

    it('falls back to default root when walkup finds nothing', async () => {
      const { walkUp } = await import('./servers');
      const client = await manager.getClient('/unknown/path/app.ts');
      expect(walkUp).toHaveBeenCalledWith('/unknown/path', ['tsconfig.json', 'package.json']);
      expect(client).not.toBeNull();
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

  describe('concurrent getClient', () => {
    it('deduplicates concurrent calls for the same file', async () => {
      // Both calls should resolve to the same client, with initialize called only once
      const [client1, client2] = await Promise.all([
        manager.getClient('/project/src/app.ts'),
        manager.getClient('/project/src/app.ts'),
      ]);

      expect(client1).toBe(client2);
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent calls for different files in same project root', async () => {
      const [client1, client2] = await Promise.all([
        manager.getClient('/project/src/app.ts'),
        manager.getClient('/project/src/other.ts'),
      ]);

      expect(client1).toBe(client2);
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('initialization timeout', () => {
    it('returns null when initialization times out', async () => {
      const timeoutManager = new LSPManager(mockProcessManager, '/project', { initTimeout: 50 });
      // Make initialize hang longer than the timeout
      mockInitialize.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 5000)));

      const client = await timeoutManager.getClient('/project/src/app.ts');

      expect(client).toBeNull();
      await timeoutManager.shutdownAll();
    });

    it('cleans up client after timeout', async () => {
      const timeoutManager = new LSPManager(mockProcessManager, '/project', { initTimeout: 50 });
      mockInitialize.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 5000)));

      await timeoutManager.getClient('/project/src/app.ts');

      // Subsequent call should attempt a fresh initialization
      mockInitialize.mockResolvedValueOnce(undefined);
      const client = await timeoutManager.getClient('/project/src/app.ts');
      expect(client).not.toBeNull();
      await timeoutManager.shutdownAll();
    });

    it('returns null when initialization throws', async () => {
      mockInitialize.mockRejectedValueOnce(new Error('spawn failed'));

      const client = await manager.getClient('/project/src/app.ts');

      expect(client).toBeNull();
    });
  });

  describe('getDiagnostics call ordering', () => {
    it('calls notifyOpen, notifyChange, waitForDiagnostics, then notifyClose', async () => {
      const callOrder: string[] = [];
      mockNotifyOpen.mockImplementation(() => callOrder.push('open'));
      mockNotifyChange.mockImplementation(() => callOrder.push('change'));
      mockWaitForDiagnostics.mockImplementation(async () => {
        callOrder.push('waitForDiagnostics');
        return [];
      });
      mockNotifyClose.mockImplementation(() => callOrder.push('close'));

      await manager.getDiagnostics('/project/src/app.ts', 'const x = 1');

      expect(callOrder).toEqual(['open', 'change', 'waitForDiagnostics', 'close']);
    });

    it('passes correct arguments to notifyOpen', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([]);

      await manager.getDiagnostics('/project/src/app.ts', 'const x = 1');

      expect(mockNotifyOpen).toHaveBeenCalledWith('/project/src/app.ts', 'const x = 1', 'typescript');
    });

    it('passes version 1 to notifyChange', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([]);

      await manager.getDiagnostics('/project/src/app.ts', 'const x = 1');

      expect(mockNotifyChange).toHaveBeenCalledWith('/project/src/app.ts', 'const x = 1', 1);
    });

    it('calls notifyClose even when waitForDiagnostics throws', async () => {
      mockWaitForDiagnostics.mockRejectedValueOnce(new Error('diagnostics failed'));

      const result = await manager.getDiagnostics('/project/src/app.ts', 'const x = 1');

      expect(mockNotifyClose).toHaveBeenCalledWith('/project/src/app.ts');
      expect(result).toEqual([]);
    });

    it('uses configured diagnosticTimeout', async () => {
      const configuredManager = new LSPManager(mockProcessManager, '/project', { diagnosticTimeout: 3000 });
      mockWaitForDiagnostics.mockResolvedValueOnce([]);

      await configuredManager.getDiagnostics('/project/src/app.ts', 'code');

      expect(mockWaitForDiagnostics).toHaveBeenCalledWith('/project/src/app.ts', 3000);
      await configuredManager.shutdownAll();
    });
  });

  describe('severity mapping', () => {
    it('maps severity 1 to error', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([
        { severity: 1, message: 'err', range: { start: { line: 0, character: 0 } } },
      ]);
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'code');
      expect(diagnostics[0]!.severity).toBe('error');
    });

    it('maps severity 2 to warning', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([
        { severity: 2, message: 'warn', range: { start: { line: 0, character: 0 } } },
      ]);
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'code');
      expect(diagnostics[0]!.severity).toBe('warning');
    });

    it('maps severity 3 to info', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([
        { severity: 3, message: 'info', range: { start: { line: 0, character: 0 } } },
      ]);
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'code');
      expect(diagnostics[0]!.severity).toBe('info');
    });

    it('maps severity 4 to hint', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([
        { severity: 4, message: 'hint', range: { start: { line: 0, character: 0 } } },
      ]);
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'code');
      expect(diagnostics[0]!.severity).toBe('hint');
    });

    it('maps unknown severity to warning', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([
        { severity: 99, message: 'unknown', range: { start: { line: 0, character: 0 } } },
      ]);
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'code');
      expect(diagnostics[0]!.severity).toBe('warning');
    });

    it('maps undefined severity to warning', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([
        { message: 'no sev', range: { start: { line: 0, character: 0 } } },
      ]);
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'code');
      expect(diagnostics[0]!.severity).toBe('warning');
    });

    it('converts 0-indexed LSP positions to 1-indexed', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([
        { severity: 1, message: 'err', range: { start: { line: 0, character: 0 } } },
      ]);
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'code');
      expect(diagnostics[0]!.line).toBe(1);
      expect(diagnostics[0]!.character).toBe(1);
    });

    it('handles missing range gracefully', async () => {
      mockWaitForDiagnostics.mockResolvedValueOnce([{ severity: 1, message: 'no range' }]);
      const diagnostics = await manager.getDiagnostics('/project/src/app.ts', 'code');
      expect(diagnostics[0]!.line).toBe(1);
      expect(diagnostics[0]!.character).toBe(1);
    });
  });
});
