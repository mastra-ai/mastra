import * as fs from 'fs';
import { MastraError } from '@mastra/core/error';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { installDeps, installNodeVersion, runInstallCommand, runBuildCommand } from './deps.js';
import { runWithExeca } from './execa.js';
import { logger } from './logger.js';

vi.mock('fs');
vi.mock('./execa.js');
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('deps utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear module cache by resetting modules
    vi.resetModules();
  });

  describe('detectPm', () => {
    it('should detect pnpm from pnpm-lock.yaml', async () => {
      // Re-import to get fresh module without cache
      const { detectPm } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('pnpm-lock.yaml'));

      const result = detectPm({ path: '/test/project' });
      expect(result).toBe('pnpm');
    });

    it('should detect npm from package-lock.json', async () => {
      const { detectPm } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('package-lock.json'));

      const result = detectPm({ path: '/test/project' });
      expect(result).toBe('npm');
    });

    it('should detect yarn from yarn.lock', async () => {
      const { detectPm } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('yarn.lock'));

      const result = detectPm({ path: '/test/project' });
      expect(result).toBe('yarn');
    });

    it('should detect bun from bun.lock', async () => {
      const { detectPm } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('bun.lock'));

      const result = detectPm({ path: '/test/project' });
      expect(result).toBe('bun');
    });

    it('should default to npm when no lock file found', async () => {
      const { detectPm } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = detectPm({ path: '/test/project' });
      expect(result).toBe('npm');
    });

    it('should search parent directories for lock files', async () => {
      const { detectPm } = await import('./deps.js');

      const existsSyncMock = vi.mocked(fs.existsSync);

      // Set up mock to find pnpm-lock.yaml in parent directory
      existsSyncMock.mockImplementation(path => {
        // Only return true for pnpm-lock.yaml in parent
        return path.toString() === '/test/deep/nested/pnpm-lock.yaml';
      });

      const result = detectPm({ path: '/test/deep/nested/project' });
      expect(result).toBe('pnpm');
      // Should check multiple directories
      expect(existsSyncMock.mock.calls.length).toBeGreaterThanOrEqual(5);
    });

    it('should cache results', async () => {
      const { detectPm } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('yarn.lock'));

      const path = '/test/cached';

      // First call
      const result1 = detectPm({ path });
      expect(result1).toBe('yarn');

      // Clear mock to ensure it's not called again
      vi.mocked(fs.existsSync).mockClear();

      // Second call should use cache
      const result2 = detectPm({ path });
      expect(result2).toBe('yarn');
      expect(fs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe('installNodeVersion', () => {
    it('should install node version when .nvmrc exists', async () => {
      vi.mocked(fs.accessSync).mockImplementation(path => {
        if (path.toString().endsWith('.nvmrc')) return;
        throw new Error('File not found');
      });

      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await installNodeVersion({ path: '/test/project' });

      expect(logger.info).toHaveBeenCalledWith('Node version file found, installing specified Node.js version...');
      expect(runWithExeca).toHaveBeenCalledWith({
        cmd: 'n',
        args: ['auto'],
        cwd: '/test/project',
      });
    });

    it('should install node version when .node-version exists', async () => {
      vi.mocked(fs.accessSync).mockImplementation(path => {
        if (path.toString().endsWith('.node-version')) return;
        throw new Error('File not found');
      });

      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await installNodeVersion({ path: '/test/project' });

      expect(runWithExeca).toHaveBeenCalled();
    });

    it('should do nothing when no version files exist', async () => {
      vi.mocked(fs.accessSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      await installNodeVersion({ path: '/test/project' });

      expect(logger.info).not.toHaveBeenCalled();
      expect(runWithExeca).not.toHaveBeenCalled();
    });

    it('should throw MastraError when n command fails', async () => {
      vi.mocked(fs.accessSync).mockImplementation(path => {
        if (path.toString().endsWith('.nvmrc')) return;
        throw new Error('File not found');
      });

      const error = new Error('n command failed');
      vi.mocked(runWithExeca).mockResolvedValue({ success: false, error });

      await expect(installNodeVersion({ path: '/test/project' })).rejects.toThrow(MastraError);

      try {
        await installNodeVersion({ path: '/test/project' });
      } catch (err) {
        expect(err).toBeInstanceOf(MastraError);
        expect((err as MastraError).id).toBe('NODE_FAIL_INSTALL_SPECIFIED_VERSION');
      }
    });
  });

  describe('installDeps', () => {
    it('should install dependencies with detected package manager', async () => {
      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('pnpm-lock.yaml'));
      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await installDeps({ path: '/test/project' });

      expect(logger.info).toHaveBeenCalledWith('Installing dependencies with pnpm in /test/project');
      expect(runWithExeca).toHaveBeenCalledWith({
        cmd: 'pnpm',
        args: ['install'],
        cwd: '/test/project',
      });
    });

    it('should use provided package manager', async () => {
      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await installDeps({ path: '/test/project', pm: 'yarn' });

      expect(logger.info).toHaveBeenCalledWith('Installing dependencies with yarn in /test/project');
      expect(runWithExeca).toHaveBeenCalledWith({
        cmd: 'yarn',
        args: ['install'],
        cwd: '/test/project',
      });
    });

    it('should throw MastraError when install fails', async () => {
      const error = new Error('Install failed');
      vi.mocked(runWithExeca).mockResolvedValue({ success: false, error });
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(installDeps({ path: '/test/project' })).rejects.toThrow(MastraError);

      try {
        await installDeps({ path: '/test/project' });
      } catch (err) {
        expect(err).toBeInstanceOf(MastraError);
        expect((err as MastraError).id).toBe('FAIL_INSTALL_DEPS');
      }
    });
  });

  describe('runInstallCommand', () => {
    it('should run custom install command', async () => {
      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await runInstallCommand({ path: '/test/project', installCommand: 'npm ci' });

      expect(logger.info).toHaveBeenCalledWith('Running install command npm ci in workspace with /test/project');
      expect(runWithExeca).toHaveBeenCalledWith({
        cmd: 'sh',
        args: ['-c', 'npm ci'],
        cwd: '/test/project',
      });
    });

    it('should throw MastraError when command fails', async () => {
      const error = new Error('Command failed');
      vi.mocked(runWithExeca).mockResolvedValue({ success: false, error });

      await expect(runInstallCommand({ path: '/test/project', installCommand: 'npm ci' })).rejects.toThrow(MastraError);
    });
  });

  describe('runScript', () => {
    it('should run npm scripts correctly', async () => {
      const { runScript } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('package-lock.json'));
      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await runScript({ scriptName: 'build', path: '/test/project' });

      expect(runWithExeca).toHaveBeenCalledWith({
        cmd: 'npm',
        args: ['run', 'build'],
        cwd: '/test/project',
      });
    });

    it('should run non-npm scripts without "run"', async () => {
      const { runScript } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('pnpm-lock.yaml'));
      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await runScript({ scriptName: 'build', path: '/test/project' });

      expect(runWithExeca).toHaveBeenCalledWith({
        cmd: 'pnpm',
        args: ['build'],
        cwd: '/test/project',
      });
    });

    it('should pass additional arguments', async () => {
      const { runScript } = await import('./deps.js');

      vi.mocked(fs.existsSync).mockImplementation(path => path.toString().endsWith('package-lock.json'));
      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await runScript({ scriptName: 'test', path: '/test/project', args: ['--watch', '--coverage'] });

      expect(runWithExeca).toHaveBeenCalledWith({
        cmd: 'npm',
        args: ['run', 'test', '--watch', '--coverage'],
        cwd: '/test/project',
      });
    });

    it('should throw MastraError when script fails', async () => {
      const { runScript } = await import('./deps.js');

      const error = new Error('Script failed');
      vi.mocked(runWithExeca).mockResolvedValue({ success: false, error });
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(runScript({ scriptName: 'build', path: '/test/project' })).rejects.toThrow('Script failed');
    });
  });

  describe('runBuildCommand', () => {
    it('should run build command', async () => {
      vi.mocked(runWithExeca).mockResolvedValue({ success: true, error: undefined });

      await runBuildCommand({ command: 'tsc && vite build', path: '/test/project' });

      expect(logger.info).toHaveBeenCalledWith('Running build command tsc && vite build');
      expect(runWithExeca).toHaveBeenCalledWith({
        cmd: 'sh',
        args: ['-c', 'tsc && vite build'],
        cwd: '/test/project',
      });
    });

    it('should throw MastraError when build fails', async () => {
      const error = new Error('Build failed');
      vi.mocked(runWithExeca).mockResolvedValue({ success: false, error });

      await expect(runBuildCommand({ command: 'build', path: '/test/project' })).rejects.toThrow(MastraError);
    });
  });
});
