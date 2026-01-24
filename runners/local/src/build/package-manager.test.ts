import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  detectPackageManager,
  getInstallArgs,
  getBuildArgs,
  hasBuildScript,
} from './package-manager';

describe('package-manager', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pm-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm from lock file', async () => {
      await fs.writeFile(path.join(testDir, 'pnpm-lock.yaml'), '');
      await fs.writeFile(path.join(testDir, 'package.json'), '{}');

      expect(await detectPackageManager(testDir)).toBe('pnpm');
    });

    it('should detect yarn from lock file', async () => {
      await fs.writeFile(path.join(testDir, 'yarn.lock'), '');
      await fs.writeFile(path.join(testDir, 'package.json'), '{}');

      expect(await detectPackageManager(testDir)).toBe('yarn');
    });

    it('should detect npm from lock file', async () => {
      await fs.writeFile(path.join(testDir, 'package-lock.json'), '{}');
      await fs.writeFile(path.join(testDir, 'package.json'), '{}');

      expect(await detectPackageManager(testDir)).toBe('npm');
    });

    it('should detect bun from lock file', async () => {
      await fs.writeFile(path.join(testDir, 'bun.lockb'), '');
      await fs.writeFile(path.join(testDir, 'package.json'), '{}');

      expect(await detectPackageManager(testDir)).toBe('bun');
    });

    it('should detect from packageManager field in package.json', async () => {
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ packageManager: 'pnpm@8.0.0' }),
      );

      expect(await detectPackageManager(testDir)).toBe('pnpm');
    });

    it('should default to npm when no indicators found', async () => {
      await fs.writeFile(path.join(testDir, 'package.json'), '{}');

      expect(await detectPackageManager(testDir)).toBe('npm');
    });

    it('should default to npm when no package.json exists', async () => {
      expect(await detectPackageManager(testDir)).toBe('npm');
    });
  });

  describe('getInstallArgs', () => {
    it('should return correct args for npm', () => {
      const args = getInstallArgs('npm');
      expect(args).toContain('install');
      expect(args).toContain('--audit=false');
    });

    it('should return correct args for pnpm', () => {
      const args = getInstallArgs('pnpm');
      expect(args).toContain('install');
      expect(args).toContain('--ignore-workspace');
    });

    it('should return correct args for yarn', () => {
      const args = getInstallArgs('yarn');
      expect(args).toContain('install');
      expect(args).toContain('--silent');
    });

    it('should return correct args for bun', () => {
      const args = getInstallArgs('bun');
      expect(args).toContain('install');
      expect(args).toContain('--silent');
    });
  });

  describe('getBuildArgs', () => {
    it('should return run build for all package managers', () => {
      for (const pm of ['npm', 'pnpm', 'yarn', 'bun'] as const) {
        const args = getBuildArgs(pm);
        expect(args).toEqual(['run', 'build']);
      }
    });
  });

  describe('hasBuildScript', () => {
    it('should return true when build script exists', async () => {
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ scripts: { build: 'tsc' } }),
      );

      expect(await hasBuildScript(testDir)).toBe(true);
    });

    it('should return false when no build script', async () => {
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ scripts: { test: 'vitest' } }),
      );

      expect(await hasBuildScript(testDir)).toBe(false);
    });

    it('should return false when no scripts field', async () => {
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      expect(await hasBuildScript(testDir)).toBe(false);
    });

    it('should return false when no package.json', async () => {
      expect(await hasBuildScript(testDir)).toBe(false);
    });
  });
});
