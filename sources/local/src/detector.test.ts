import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MastraProjectDetector } from './detector';

describe('MastraProjectDetector', () => {
  let detector: MastraProjectDetector;
  let testDir: string;

  beforeEach(async () => {
    detector = new MastraProjectDetector();
    testDir = join(tmpdir(), `mastra-detector-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('detect', () => {
    it('returns true for directory with @mastra/core in dependencies', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          '@mastra/core': '^1.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));

      const result = await detector.detect(testDir);
      expect(result).toBe(true);
    });

    it('returns true for directory with @mastra/core in devDependencies', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          '@mastra/core': '^1.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));

      const result = await detector.detect(testDir);
      expect(result).toBe(true);
    });

    it('returns false for directory without @mastra/core', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          express: '^4.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));

      const result = await detector.detect(testDir);
      expect(result).toBe(false);
    });

    it('returns false for directory without package.json', async () => {
      const result = await detector.detect(testDir);
      expect(result).toBe(false);
    });

    it('returns false for directory with invalid package.json', async () => {
      await writeFile(join(testDir, 'package.json'), 'not valid json');

      const result = await detector.detect(testDir);
      expect(result).toBe(false);
    });

    it('returns false for non-existent directory', async () => {
      const result = await detector.detect('/non/existent/path');
      expect(result).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('extracts project metadata correctly', async () => {
      const packageJson = {
        name: 'my-mastra-project',
        version: '2.0.0',
        dependencies: {
          '@mastra/core': '^1.2.3',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));

      const metadata = await detector.getMetadata(testDir);
      expect(metadata.name).toBe('my-mastra-project');
      expect(metadata.version).toBe('2.0.0');
      expect(metadata.mastraVersion).toBe('^1.2.3');
    });

    it('detects pnpm package manager', async () => {
      const packageJson = { name: 'test', dependencies: { '@mastra/core': '1.0.0' } };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(testDir, 'pnpm-lock.yaml'), '');

      const metadata = await detector.getMetadata(testDir);
      expect(metadata.packageManager).toBe('pnpm');
    });

    it('detects yarn package manager', async () => {
      const packageJson = { name: 'test', dependencies: { '@mastra/core': '1.0.0' } };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(testDir, 'yarn.lock'), '');

      const metadata = await detector.getMetadata(testDir);
      expect(metadata.packageManager).toBe('yarn');
    });

    it('detects bun package manager', async () => {
      const packageJson = { name: 'test', dependencies: { '@mastra/core': '1.0.0' } };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(testDir, 'bun.lockb'), '');

      const metadata = await detector.getMetadata(testDir);
      expect(metadata.packageManager).toBe('bun');
    });

    it('detects npm package manager', async () => {
      const packageJson = { name: 'test', dependencies: { '@mastra/core': '1.0.0' } };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(testDir, 'package-lock.json'), '{}');

      const metadata = await detector.getMetadata(testDir);
      expect(metadata.packageManager).toBe('npm');
    });

    it('defaults to npm when no lock file found', async () => {
      const packageJson = { name: 'test', dependencies: { '@mastra/core': '1.0.0' } };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));

      const metadata = await detector.getMetadata(testDir);
      expect(metadata.packageManager).toBe('npm');
    });

    it('returns empty metadata for non-existent directory', async () => {
      const metadata = await detector.getMetadata('/non/existent/path');
      expect(metadata).toEqual({});
    });

    it('returns empty metadata for invalid package.json', async () => {
      await writeFile(join(testDir, 'package.json'), 'invalid json');

      const metadata = await detector.getMetadata(testDir);
      expect(metadata).toEqual({});
    });

    it('gets mastraVersion from devDependencies if not in dependencies', async () => {
      const packageJson = {
        name: 'test',
        devDependencies: {
          '@mastra/core': '^2.0.0',
        },
      };
      await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson));

      const metadata = await detector.getMetadata(testDir);
      expect(metadata.mastraVersion).toBe('^2.0.0');
    });
  });
});
