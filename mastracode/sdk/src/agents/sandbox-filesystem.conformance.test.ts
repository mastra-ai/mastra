/**
 * SandboxFilesystem conformance tests.
 *
 * Runs the shared `@internal/workspace-test-utils` filesystem suite against a
 * `SandboxFilesystem` backed by a real local shell (`sh -c` on the host, the
 * same executor a LocalSandbox uses). This exercises every shell-quoted code
 * path — base64 reads/writes, the portable stat/readdir fallbacks — on the
 * host OS, so running it on macOS covers the BSD variants and CI covers GNU.
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFilesystemTestSuite } from '@internal/workspace-test-utils';
import { afterAll } from 'vitest';

import type { SandboxCommandResult, SandboxExec } from './sandbox-filesystem';
import { SandboxFilesystem } from './sandbox-filesystem';

/** Minimal SandboxExec that runs commands on the host, like LocalSandbox does. */
function createLocalShellExec(): SandboxExec {
  return {
    id: 'local-shell-test',
    executeCommand(command, args = [], options): Promise<SandboxCommandResult> {
      return new Promise(resolve => {
        execFile(
          command,
          args,
          { timeout: options?.timeout, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
          (error, stdout, stderr) => {
            const exitCode =
              error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
                ? ((error as unknown as { code: number }).code ?? 1)
                : error
                  ? 1
                  : 0;
            resolve({ exitCode, stdout, stderr });
          },
        );
      });
    },
  };
}

const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup.
    }
  }
});

function createSandboxFilesystem(): SandboxFilesystem {
  // realpathSync: on macOS tmpdir() is a symlink (/var -> /private/var); the
  // filesystem's realpath containment guard needs the resolved workdir.
  const workdir = realpathSync(mkdtempSync(join(tmpdir(), 'mastra-sandbox-fs-')));
  tmpDirs.push(workdir);
  return new SandboxFilesystem({ sandbox: createLocalShellExec(), workdir });
}

createFilesystemTestSuite({
  suiteName: 'SandboxFilesystem Conformance (local shell)',
  createFilesystem: () => createSandboxFilesystem(),
  capabilities: {
    supportsAppend: true,
    supportsBinaryFiles: true,
    supportsForceDelete: true,
    supportsOverwrite: true,
    supportsEmptyDirectories: true,
    deleteThrowsOnMissing: true,
    supportsConcurrency: true,
    supportsPermissions: false,
    supportsMounting: false,
    // Write payloads travel as base64 inside a single `sh -c` argument, so
    // they are bounded by the host's ARG_MAX (~1MB on macOS). Keep test
    // payloads comfortably under that.
    maxTestFileSize: 128 * 1024,
  },
  // Every operation shells out (often several commands), so give slow CI
  // hosts more headroom than the 5s default.
  testTimeout: 20000,
});
