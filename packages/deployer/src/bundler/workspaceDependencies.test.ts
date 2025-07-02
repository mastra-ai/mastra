import type { IMastraLogger } from '@mastra/core/logger';
import type { WorkspacesRoot } from 'find-workspaces';
import { findWorkspacesRoot } from 'find-workspaces';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DepsService } from '../services';
import { collectTransitiveWorkspaceDependencies, packWorkspaceDependencies } from './workspaceDependencies';

vi.mock('find-workspaces', () => ({
  findWorkspacesRoot: vi.fn().mockReturnValue({ location: '/mock-root' }),
}));

vi.mock('fs-extra', () => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services', () => ({
  DepsService: vi.fn().mockImplementation(() => ({
    __setLogger: vi.fn(),
    getWorkspaceDependencyPath: vi.fn().mockReturnValue('mock-tgz-path'),
    pack: vi.fn().mockResolvedValue('mock-tgz-path'),
  })),
}));

describe('workspaceDependencies', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warning: vi.fn(),
  } as unknown as IMastraLogger;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collectTransitiveWorkspaceDependencies', () => {
    it('should collect direct dependencies', () => {
      const workspaceMap = new Map<
        string,
        { location: string; dependencies: Record<string, string> | undefined; version: string | undefined }
      >([['pkg-a', { location: '/pkg-a', dependencies: {}, version: '1.0.0' }]]);
      const initialDeps = new Set(['pkg-a']);

      const result = collectTransitiveWorkspaceDependencies({
        workspaceMap,
        initialDependencies: initialDeps,
        logger: mockLogger,
      });

      expect(result.usedWorkspacePackages.size).toBe(1);
      expect(result.usedWorkspacePackages.has('pkg-a')).toBe(true);
    });

    it('should collect transitive dependencies', () => {
      const workspaceMap = new Map<
        string,
        { location: string; dependencies: Record<string, string> | undefined; version: string | undefined }
      >([
        ['pkg-a', { location: '/pkg-a', dependencies: { 'pkg-b': '1.0.0' }, version: '1.0.0' }],
        ['pkg-b', { location: '/pkg-b', dependencies: {}, version: '1.0.0' }],
      ]);
      const initialDeps = new Set(['pkg-a']);

      const result = collectTransitiveWorkspaceDependencies({
        workspaceMap,
        initialDependencies: initialDeps,
        logger: mockLogger,
      });

      expect(result.usedWorkspacePackages.size).toBe(2);
      expect(result.usedWorkspacePackages.has('pkg-a')).toBe(true);
      expect(result.usedWorkspacePackages.has('pkg-b')).toBe(true);
    });

    it('should handle circular dependencies', () => {
      const workspaceMap = new Map<
        string,
        { location: string; dependencies: Record<string, string> | undefined; version: string | undefined }
      >([
        ['pkg-a', { location: '/pkg-a', dependencies: { 'pkg-b': '1.0.0' }, version: '1.0.0' }],
        ['pkg-b', { location: '/pkg-b', dependencies: { 'pkg-a': '1.0.0' }, version: '1.0.0' }],
      ]);
      const initialDeps = new Set(['pkg-a']);

      const result = collectTransitiveWorkspaceDependencies({
        workspaceMap,
        initialDependencies: initialDeps,
        logger: mockLogger,
      });

      expect(result.usedWorkspacePackages.size).toBe(2);
    });

    it('should handle missing workspace packages', () => {
      const workspaceMap = new Map<
        string,
        { location: string; dependencies: Record<string, string> | undefined; version: string | undefined }
      >([['pkg-a', { location: '/pkg-a', dependencies: { 'pkg-missing': '1.0.0' }, version: '1.0.0' }]]);
      const initialDeps = new Set(['pkg-a']);

      const result = collectTransitiveWorkspaceDependencies({
        workspaceMap,
        initialDependencies: initialDeps,
        logger: mockLogger,
      });

      expect(result.usedWorkspacePackages.size).toBe(1);
      expect(result.usedWorkspacePackages.has('pkg-a')).toBe(true);
    });
  });

  describe('packWorkspaceDependencies', () => {
    const mockRoot = { location: '/root' };
    const mockDepsService = {
      pack: vi.fn(),
      __setLogger: vi.fn(),
      getWorkspaceDependencyPath: vi.fn().mockReturnValue('mock-tgz-path'),
    };

    beforeEach(() => {
      vi.mocked(findWorkspacesRoot).mockReturnValue(mockRoot as unknown as WorkspacesRoot);
      vi.mocked(DepsService).mockImplementation(() => mockDepsService as unknown as DepsService);
    });

    it('should package workspace dependencies in batches', async () => {
      const workspaceMap = new Map<
        string,
        { location: string; dependencies: Record<string, string> | undefined; version: string | undefined }
      >([
        ['pkg-a', { location: '/pkg-a', dependencies: {}, version: '1.0.0' }],
        ['pkg-b', { location: '/pkg-b', dependencies: {}, version: '1.0.0' }],
        ['pkg-c', { location: '/pkg-c', dependencies: {}, version: '1.0.0' }],
      ]);
      const usedWorkspacePackages = new Set(['pkg-a', 'pkg-b', 'pkg-c']);

      await packWorkspaceDependencies({
        workspaceMap,
        usedWorkspacePackages,
        bundleOutputDir: '/output',
        logger: mockLogger,
      });

      expect(mockDepsService.pack).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully packaged 3'));
    });

    it('should do nothing with empty workspace packages', async () => {
      await packWorkspaceDependencies({
        workspaceMap: new Map(),
        usedWorkspacePackages: new Set(),
        bundleOutputDir: '/output',
        logger: mockLogger,
      });
      expect(mockDepsService.pack).not.toHaveBeenCalled();
    });

    it('should throw error when workspace root not found', async () => {
      vi.mocked(findWorkspacesRoot).mockReturnValue(null);
      const workspaceMap = new Map<
        string,
        { location: string; dependencies: Record<string, string> | undefined; version: string | undefined }
      >([['pkg-a', { location: '/pkg-a', dependencies: {}, version: '1.0.0' }]]);
      const usedWorkspacePackages = new Set(['pkg-a']);

      await expect(
        packWorkspaceDependencies({
          workspaceMap,
          usedWorkspacePackages,
          bundleOutputDir: '/output',
          logger: mockLogger,
        }),
      ).rejects.toThrow('Could not find workspace root');
    });
  });
});
