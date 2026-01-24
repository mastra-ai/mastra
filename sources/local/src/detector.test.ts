import * as fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraProjectDetector } from './detector';

// Mock fs module
vi.mock('node:fs/promises');

describe('MastraProjectDetector', () => {
  let detector: MastraProjectDetector;

  beforeEach(() => {
    detector = new MastraProjectDetector();
    vi.clearAllMocks();
  });

  describe('isMastraProject', () => {
    it('should return false if no package.json exists', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(false);
    });

    it('should return true if project has @mastra/core dependency', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            '@mastra/core': '^1.0.0',
          },
        }),
      );

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(true);
    });

    it('should return true if project has mastra.config.ts', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        // package.json exists
        if (String(filePath).endsWith('package.json')) return;
        // mastra.config.ts exists
        if (String(filePath).endsWith('mastra.config.ts')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-project',
          dependencies: {},
        }),
      );

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(true);
    });

    it('should return false if no Mastra indicators present', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            express: '^4.0.0',
          },
        }),
      );

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(false);
    });

    it('should return true if project has mastra dependency', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            mastra: '^1.0.0',
          },
        }),
      );

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(true);
    });

    it('should return true if project has @mastra/cli devDependency', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-project',
          devDependencies: {
            '@mastra/cli': '^1.0.0',
          },
        }),
      );

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(true);
    });
  });

  describe('getProjectMetadata', () => {
    it('should return complete metadata for a Mastra project', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json')) {
          return JSON.stringify({
            name: 'my-mastra-app',
            version: '1.0.0',
            description: 'A Mastra application',
            main: 'dist/index.js',
            dependencies: {
              '@mastra/core': '^1.0.0',
              '@mastra/server': '^1.0.0',
            },
          });
        }
        throw new Error('ENOENT');
      });

      const metadata = await detector.getProjectMetadata('/test/project');

      expect(metadata.name).toBe('my-mastra-app');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.mastraDependencies).toContain('@mastra/core');
      expect(metadata.mastraDependencies).toContain('@mastra/server');
    });

    it('should detect package manager from lock file', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json') || String(filePath).endsWith('pnpm-lock.yaml')) {
          return;
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          dependencies: { '@mastra/core': '*' },
        }),
      );

      const metadata = await detector.getProjectMetadata('/test/project');

      expect(metadata.packageManager).toBe('pnpm');
    });

    it('should detect yarn package manager', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json') || String(filePath).endsWith('yarn.lock')) {
          return;
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          dependencies: { '@mastra/core': '*' },
        }),
      );

      const metadata = await detector.getProjectMetadata('/test/project');

      expect(metadata.packageManager).toBe('yarn');
    });

    it('should detect bun package manager', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json') || String(filePath).endsWith('bun.lockb')) {
          return;
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          dependencies: { '@mastra/core': '*' },
        }),
      );

      const metadata = await detector.getProjectMetadata('/test/project');

      expect(metadata.packageManager).toBe('bun');
    });

    it('should default to npm if no lock file found', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          dependencies: { '@mastra/core': '*' },
        }),
      );

      const metadata = await detector.getProjectMetadata('/test/project');

      expect(metadata.packageManager).toBe('npm');
    });

    it('should detect TypeScript project', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (
          String(filePath).endsWith('package.json') ||
          String(filePath).endsWith('tsconfig.json') ||
          String(filePath).endsWith('pnpm-lock.yaml')
        ) {
          return;
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          dependencies: { '@mastra/core': '*' },
        }),
      );

      const metadata = await detector.getProjectMetadata('/test/project');

      expect(metadata.isTypeScript).toBe(true);
    });

    it('should throw if no package.json found', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await expect(detector.getProjectMetadata('/test/project')).rejects.toThrow('No package.json found');
    });

    it('should throw if not a valid Mastra project', async () => {
      vi.mocked(fs.access).mockImplementation(async filePath => {
        if (String(filePath).endsWith('package.json')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          dependencies: { express: '*' },
        }),
      );

      await expect(detector.getProjectMetadata('/test/project')).rejects.toThrow('is not a valid Mastra project');
    });
  });

  describe('detectPackageManager', () => {
    it('should detect from packageManager field in package.json', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT')); // No lock files
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          packageManager: 'pnpm@8.0.0',
        }),
      );

      const pm = await detector.detectPackageManager('/test/project');

      expect(pm).toBe('pnpm');
    });

    it('should detect yarn from packageManager field', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          packageManager: 'yarn@4.0.0',
        }),
      );

      const pm = await detector.detectPackageManager('/test/project');

      expect(pm).toBe('yarn');
    });
  });
});
