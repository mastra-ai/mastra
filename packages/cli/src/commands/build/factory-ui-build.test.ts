import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PinoLogger } from '@mastra/loggers';
import { execa } from 'execa';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectPackageManagerFromRoot, buildFactoryUI } from './factory-ui-build';

// Mock execa so we don't actually run subprocesses
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

const logger = new PinoLogger({ name: 'test', level: 'silent' });

describe('detectPackageManagerFromRoot', () => {
  it('detects pnpm from pnpm-lock.yaml', () => {
    const tmp = mkdtempSyncSafe();
    writeFileSyncSafe(join(tmp, 'pnpm-lock.yaml'), '');
    expect(detectPackageManagerFromRoot(tmp)).toBe('pnpm');
  });

  it('detects npm from package-lock.json', () => {
    const tmp = mkdtempSyncSafe();
    writeFileSyncSafe(join(tmp, 'package-lock.json'), '');
    expect(detectPackageManagerFromRoot(tmp)).toBe('npm');
  });

  it('detects yarn from yarn.lock', () => {
    const tmp = mkdtempSyncSafe();
    writeFileSyncSafe(join(tmp, 'yarn.lock'), '');
    expect(detectPackageManagerFromRoot(tmp)).toBe('yarn');
  });

  it('defaults to npm when no lockfile found', () => {
    const tmp = mkdtempSyncSafe();
    expect(detectPackageManagerFromRoot(tmp)).toBe('npm');
  });
});

describe('buildFactoryUI', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSyncSafe();
    vi.mocked(execa).mockReset();
  });

  afterEach(() => {
    rmSyncSafe(tmpDir);
  });

  it('runs build:ui with detected package manager', async () => {
    writeFileSyncSafe(join(tmpDir, 'pnpm-lock.yaml'), '');
    // Pre-create the expected output so the existence check passes
    const mastraDir = join(tmpDir, 'src', 'mastra');
    await mkdir(join(mastraDir, 'public', 'factory'), { recursive: true });
    await writeFile(join(mastraDir, 'public', 'factory', 'index.html'), '<html></html>');

    vi.mocked(execa).mockResolvedValue({} as any);

    await buildFactoryUI(tmpDir, mastraDir, logger);

    expect(execa).toHaveBeenCalledWith('pnpm', ['run', 'build:ui'], {
      cwd: tmpDir,
      stdio: 'inherit',
    });
  });

  it('throws when build:ui fails', async () => {
    writeFileSyncSafe(join(tmpDir, 'package-lock.json'), '');
    vi.mocked(execa).mockRejectedValue(new Error('build failed'));

    await expect(buildFactoryUI(tmpDir, join(tmpDir, 'src', 'mastra'), logger)).rejects.toThrow(
      /Factory UI build failed/,
    );
  });

  it('throws when index.html is not produced', async () => {
    writeFileSyncSafe(join(tmpDir, 'package-lock.json'), '');
    vi.mocked(execa).mockResolvedValue({} as any);

    // No index.html created
    await expect(buildFactoryUI(tmpDir, join(tmpDir, 'src', 'mastra'), logger)).rejects.toThrow(
      /did not produce expected output/,
    );
  });
});

// Helpers that use sync APIs for setup simplicity
function mkdtempSyncSafe(): string {
  return mkdtempSync(join(tmpdir(), 'factory-ui-build-test-'));
}

function writeFileSyncSafe(path: string, content: string): void {
  writeFileSync(path, content);
}

function rmSyncSafe(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
