/**
 * `textExtensions` on SandboxFilesystem, exercised through the real grep tool
 * over a real local shell (the same executor a LocalSandbox uses). (#28365)
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createWorkspaceTools, Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { afterAll, describe, expect, it } from 'vitest';

import type { SandboxCommandResult, SandboxExec } from './sandbox-filesystem';
import { SandboxFilesystem } from './sandbox-filesystem';

/** Runs commands on the host, like LocalSandbox, and records each one. */
function createLocalShellExec(commands: string[]): SandboxExec {
  return {
    id: 'local-shell-text-extensions',
    executeCommand(command, args = [], options): Promise<SandboxCommandResult> {
      commands.push([command, ...args].join(' '));
      return new Promise(resolve => {
        execFile(
          command,
          args,
          { timeout: options?.timeout, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
          (error, stdout, stderr) => {
            const code = error?.code;
            resolve({ exitCode: typeof code === 'number' ? code : error ? 1 : 0, stdout, stderr });
          },
        );
      });
    },
  };
}

const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

function createSandboxFilesystem(textExtensions?: string[]) {
  const workdir = realpathSync(mkdtempSync(join(tmpdir(), 'mastra-sandbox-text-ext-')));
  tmpDirs.push(workdir);
  const commands: string[] = [];
  const filesystem = new SandboxFilesystem({ sandbox: createLocalShellExec(commands), workdir, textExtensions });
  return { filesystem, commands };
}

/** Whether the grep tool read this file host-side (its fallback walk) rather than using native search results. */
function readHostSide(commands: string[], fileName: string): boolean {
  return commands.some(command => command.includes('base64 <') && command.includes(fileName));
}

async function grep(filesystem: SandboxFilesystem, input: { pattern: string; path?: string }) {
  const workspace = new Workspace({ filesystem });
  const tools = await createWorkspaceTools(workspace);
  return tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(input, { workspace });
}

describe('SandboxFilesystem textExtensions (local shell)', () => {
  it('lets grep search files whose extension the caller registers (#28365)', async () => {
    // Registered without a dot and in upper case, like LocalFilesystem accepts.
    const { filesystem, commands } = createSandboxFilesystem(['SASX']);
    await filesystem.writeFile('reports/q3.sasx', 'data q3;\n  set findme;\nrun;\n');
    await filesystem.writeFile('src/index.ts', 'export const findme = 1;\n');

    const result = await grep(filesystem, { pattern: 'findme' });

    // The sandbox's native grep found the match; the tool did not fall back.
    expect(readHostSide(commands, 'q3.sasx')).toBe(false);
    expect(result).toContain('reports/q3.sasx:2:7:   set findme;');
    // Built-in text extensions are still searched alongside the registered one.
    expect(result).toContain('src/index.ts:1:14: export const findme = 1;');
    expect(result).toContain('2 matches across 2 files');
  });

  it('honors registered extensions when grep falls back to walking the tree (#28365)', async () => {
    // Every native engine rejects this pattern (ripgrep and POSIX ERE can't
    // run the lookahead, and the `grep -P` path refuses `\e`), so the tool
    // lists directories and reads files host-side instead. In JavaScript it
    // still means "findme followed by a semicolon".
    const { filesystem, commands } = createSandboxFilesystem(['.sasx']);
    await filesystem.writeFile('reports/q3.sasx', 'set findme;\n');
    await filesystem.writeFile('reports/q4.sasy', 'set findme;\n');

    const result = await grep(filesystem, { pattern: String.raw`findm\e(?=;)` });

    expect(readHostSide(commands, 'q3.sasx')).toBe(true);
    expect(result).toContain('reports/q3.sasx:1:5: set findme;');
    expect(result).not.toContain('q4.sasy');
    expect(result).toContain('1 match across 1 file');
  });

  it('searches an explicitly targeted file with a registered extension (#28365)', async () => {
    const { filesystem } = createSandboxFilesystem(['.sasx']);
    await filesystem.writeFile('q3.sasx', 'findme\n');

    const result = await grep(filesystem, { pattern: 'findme', path: 'q3.sasx' });

    expect(result).toContain('1 match across 1 file');
    expect(result).not.toContain('unsupported extension');
  });

  it('still skips unregistered extensions by default', async () => {
    const { filesystem } = createSandboxFilesystem();
    await filesystem.writeFile('q3.sasx', 'findme\n');

    const result = await grep(filesystem, { pattern: 'findme', path: 'q3.sasx' });

    expect(result).toContain('0 matches across 0 files');
    expect(result).toContain('1 file skipped: unsupported extension');
  });
});
