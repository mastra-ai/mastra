import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MastraProjectDetector } from './detector';
import { LocalProjectSource } from './provider';
import type { DirectoryScanner } from './scanner';

describe('LocalProjectSource', () => {
  let provider: LocalProjectSource;
  let mockDetector: MastraProjectDetector;
  let mockScanner: DirectoryScanner;

  beforeEach(() => {
    mockDetector = {
      isMastraProject: vi.fn().mockResolvedValue(true),
      getProjectMetadata: vi.fn().mockResolvedValue({
        name: 'test-project',
        packageManager: 'pnpm',
        hasMastraConfig: true,
        isTypeScript: true,
        mastraDependencies: ['@mastra/core'],
      }),
    } as unknown as MastraProjectDetector;

    mockScanner = {
      scan: vi.fn(),
      scanMultiple: vi.fn().mockResolvedValue({
        projects: [
          {
            id: 'local_abc123',
            name: 'test-project',
            type: 'local',
            path: '/test/project',
            metadata: {
              name: 'test-project',
              packageManager: 'pnpm',
            },
          },
        ],
        skipped: [],
        errors: [],
      }),
    } as unknown as DirectoryScanner;

    provider = new LocalProjectSource({ basePaths: ['/test'] }, mockDetector, mockScanner);
  });

  describe('constructor', () => {
    it('should throw if no base paths provided', () => {
      expect(() => new LocalProjectSource({ basePaths: [] })).toThrow(
        'LocalProjectSource requires at least one base path',
      );
    });

    it('should accept valid configuration', () => {
      const source = new LocalProjectSource({
        basePaths: ['/test'],
        maxDepth: 3,
        watchChanges: true,
      });

      const config = source.getConfig();
      expect(config.maxDepth).toBe(3);
      expect(config.watchChanges).toBe(true);
    });
  });

  describe('listProjects', () => {
    it('should return discovered projects', async () => {
      const projects = await provider.listProjects('team-1');

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('test-project');
    });

    it('should use cache on subsequent calls', async () => {
      await provider.listProjects('team-1');
      await provider.listProjects('team-1');

      expect(mockScanner.scanMultiple).toHaveBeenCalledTimes(1);
    });

    it('should pass correct options to scanner', async () => {
      await provider.listProjects('team-1');

      expect(mockScanner.scanMultiple).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          include: ['*'],
          exclude: expect.arrayContaining(['node_modules', '.git']),
          maxDepth: 2,
        }),
      );
    });
  });

  describe('getProject', () => {
    it('should return cached project', async () => {
      await provider.listProjects('team-1'); // Populate cache
      const project = await provider.getProject('local_abc123');

      expect(project.name).toBe('test-project');
    });

    it('should throw if project not found', async () => {
      await expect(provider.getProject('nonexistent')).rejects.toThrow('Project not found');
    });

    it('should refresh cache if project not found initially', async () => {
      // First call will populate cache
      await provider.listProjects('team-1');

      // Clear scanner mock call count and clear cache to force rescan
      vi.mocked(mockScanner.scanMultiple).mockClear();
      provider.clearCache();

      // Request a non-existent project - should trigger rescan
      await expect(provider.getProject('nonexistent')).rejects.toThrow('Project not found');

      // Should have called scanMultiple again after cache clear
      expect(mockScanner.scanMultiple).toHaveBeenCalled();
    });
  });

  describe('validateAccess', () => {
    it('should return false for non-local source type', async () => {
      const result = await provider.validateAccess({
        id: '123',
        name: 'test',
        type: 'github',
        path: '/test',
      });

      expect(result).toBe(false);
    });
  });

  describe('watchChanges', () => {
    it('should return no-op if watching is disabled', () => {
      const cleanup = provider.watchChanges({ id: '1', name: 'test', type: 'local', path: '/test' }, () => {});

      expect(typeof cleanup).toBe('function');
    });

    it('should warn when watching is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      provider.watchChanges({ id: '1', name: 'test', type: 'local', path: '/test' }, () => {});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('watchChanges is disabled'));
      consoleSpy.mockRestore();
    });
  });

  describe('addProject', () => {
    it('should add a valid project to cache', async () => {
      const project = await provider.addProject('/new/project');

      expect(project.type).toBe('local');
      expect(project.name).toBe('test-project');
      expect(project.id).toMatch(/^local_[a-f0-9]+$/);
    });

    it('should throw for invalid project', async () => {
      vi.mocked(mockDetector.isMastraProject).mockResolvedValueOnce(false);

      await expect(provider.addProject('/invalid/project')).rejects.toThrow('Not a valid Mastra project');
    });
  });

  describe('removeProject', () => {
    it('should remove project from cache', async () => {
      await provider.listProjects('team-1');
      provider.removeProject('local_abc123');

      // Clear mock to check if rescan is triggered
      vi.mocked(mockScanner.scanMultiple).mockClear();

      // Getting the project should trigger rescan since it's not in cache
      await provider.getProject('local_abc123');
      expect(mockScanner.scanMultiple).toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should force rescan on next listProjects call', async () => {
      await provider.listProjects('team-1');

      provider.clearCache();

      // Clear mock call count
      vi.mocked(mockScanner.scanMultiple).mockClear();

      await provider.listProjects('team-1');

      expect(mockScanner.scanMultiple).toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = provider.getConfig();

      expect(config.basePaths).toBeDefined();
      expect(config.maxDepth).toBe(2);
      expect(config.watchChanges).toBe(false);
    });

    it('should return readonly config (not modifying original)', () => {
      const config1 = provider.getConfig();
      const config2 = provider.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
