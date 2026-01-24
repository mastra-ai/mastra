import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { spawnCommand, runCommand } from './spawner';

describe('spawner', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spawner-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('spawnCommand', () => {
    it('should spawn a command and return child process', () => {
      const proc = spawnCommand('node', ['--version'], {
        cwd: testDir,
        env: {},
      });

      expect(proc).toBeDefined();
      expect(proc.pid).toBeDefined();

      // Clean up
      proc.kill();
    });

    it('should stream stdout to callback', async () => {
      const lines: string[] = [];
      const onOutput = vi.fn((line: string) => lines.push(line));

      const proc = spawnCommand('node', ['-e', 'console.log("hello")'], {
        cwd: testDir,
        env: {},
        onOutput,
      });

      await new Promise<void>(resolve => {
        proc.on('close', () => resolve());
      });

      expect(onOutput).toHaveBeenCalled();
      expect(lines.some(l => l.includes('hello'))).toBe(true);
    });

    it('should stream stderr to callback with [stderr] prefix', async () => {
      const lines: string[] = [];
      const onOutput = vi.fn((line: string) => lines.push(line));

      const proc = spawnCommand('node', ['-e', 'console.error("error message")'], {
        cwd: testDir,
        env: {},
        onOutput,
      });

      await new Promise<void>(resolve => {
        proc.on('close', () => resolve());
      });

      expect(onOutput).toHaveBeenCalled();
      expect(lines.some(l => l.includes('[stderr]') && l.includes('error message'))).toBe(true);
    });

    it('should pass environment variables', async () => {
      const lines: string[] = [];
      const onOutput = vi.fn((line: string) => lines.push(line));

      const proc = spawnCommand('node', ['-e', 'console.log(process.env.TEST_VAR)'], {
        cwd: testDir,
        env: { TEST_VAR: 'test-value-123' },
        onOutput,
      });

      await new Promise<void>(resolve => {
        proc.on('close', () => resolve());
      });

      expect(lines.some(l => l.includes('test-value-123'))).toBe(true);
    });

    it('should use specified working directory', async () => {
      const lines: string[] = [];
      const onOutput = vi.fn((line: string) => lines.push(line));

      const proc = spawnCommand('node', ['-e', 'console.log(process.cwd())'], {
        cwd: testDir,
        env: {},
        onOutput,
      });

      await new Promise<void>(resolve => {
        proc.on('close', () => resolve());
      });

      expect(lines.some(l => l.includes(testDir))).toBe(true);
    });
  });

  describe('runCommand', () => {
    it('should run a command and return exit code', async () => {
      const result = await runCommand('node', ['--version'], {
        cwd: testDir,
        env: {},
      });

      expect(result.exitCode).toBe(0);
    });

    it('should capture output', async () => {
      const result = await runCommand('node', ['-e', 'console.log("output line")'], {
        cwd: testDir,
        env: {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.output.some(l => l.includes('output line'))).toBe(true);
    });

    it('should call onOutput callback', async () => {
      const onOutput = vi.fn();

      const result = await runCommand('node', ['-e', 'console.log("callback test")'], {
        cwd: testDir,
        env: {},
        onOutput,
      });

      expect(result.exitCode).toBe(0);
      expect(onOutput).toHaveBeenCalled();
    });

    it('should return non-zero exit code on failure', async () => {
      const result = await runCommand('node', ['-e', 'process.exit(42)'], {
        cwd: testDir,
        env: {},
      });

      expect(result.exitCode).toBe(42);
    });

    it('should reject on spawn error', async () => {
      await expect(
        runCommand('nonexistent-command-that-does-not-exist', [], {
          cwd: testDir,
          env: {},
        }),
      ).rejects.toThrow();
    });

    it('should capture multiple output lines', async () => {
      const result = await runCommand(
        'node',
        ['-e', 'console.log("line1"); console.log("line2"); console.log("line3")'],
        {
          cwd: testDir,
          env: {},
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.output.length).toBeGreaterThanOrEqual(3);
    });

    it('should capture both stdout and stderr', async () => {
      const result = await runCommand(
        'node',
        ['-e', 'console.log("stdout"); console.error("stderr")'],
        {
          cwd: testDir,
          env: {},
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.output.some(l => l.includes('stdout'))).toBe(true);
      expect(result.output.some(l => l.includes('[stderr]') && l.includes('stderr'))).toBe(true);
    });
  });
});
