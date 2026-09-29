import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunCommandTool, extractBaseCommand, isPathAllowed } from './run-command-tool';

const run = (tool: ReturnType<typeof createRunCommandTool>, input: { command: string; cwd?: string }) =>
  tool.execute!({ timeout: 10000, ...input } as any, {} as any) as Promise<any>;

describe('isPathAllowed', () => {
  it('handles POSIX paths', () => {
    const p = path.posix;
    expect(isPathAllowed('/base', ['/base'], p)).toBe(true);
    expect(isPathAllowed('/base/sub/dir', ['/base'], p)).toBe(true);
    expect(isPathAllowed('/base2', ['/base'], p)).toBe(false);
    expect(isPathAllowed('/base/../etc', ['/base'], p)).toBe(false);
    expect(isPathAllowed('/base/..cache', ['/base'], p)).toBe(true);
    expect(isPathAllowed('/anything', [], p)).toBe(true);
  });

  it('handles Windows paths', () => {
    const p = path.win32;
    expect(isPathAllowed('C:\\base', ['C:\\base'], p)).toBe(true);
    expect(isPathAllowed('C:\\base\\sub', ['C:\\base'], p)).toBe(true);
    expect(isPathAllowed('c:\\BASE\\sub', ['C:\\base'], p)).toBe(true);
    expect(isPathAllowed('C:/base/sub', ['C:\\base'], p)).toBe(true);
    expect(isPathAllowed('C:\\base2', ['C:\\base'], p)).toBe(false);
    expect(isPathAllowed('C:\\base\\..\\x', ['C:\\base'], p)).toBe(false);
    expect(isPathAllowed('D:\\base\\sub', ['C:\\base'], p)).toBe(false);
  });
});

describe('extractBaseCommand', () => {
  it.each([
    ['git status', 'git'],
    ['/usr/bin/git status', 'git'],
    ['"rm" x', 'rm'],
    ["'rm' x", 'rm'],
    ['r"m" x', 'rm'],
    ['"r"m x', 'rm'],
    ['./echo. x', 'echo.'],
    ['git.exe status', 'git.exe'],
  ])('POSIX: %s -> %s', (input, expected) => {
    expect(extractBaseCommand(input, 'linux')).toBe(expected);
  });

  it.each([
    ['C:\\tools\\git.exe status', 'git'],
    ['.\\bin\\node -v', 'node'],
    ['RM.EXE -rf x', 'rm'],
    ['script.cmd', 'script'],
    ['"rm.exe" -rf x', 'rm'],
    ['"C:/Program Files/rm.exe" x', 'rm'],
    ['rm. -rf x', 'rm'],
    ['rm.exe. -rf x', 'rm'],
    ['r"m" x', 'rm'],
  ])('Windows: %s -> %s', (input, expected) => {
    expect(extractBaseCommand(input, 'win32')).toBe(expected);
  });
});

describe('createRunCommandTool', () => {
  describe('on win32', () => {
    const originalPlatform = process.platform;
    beforeEach(() => Object.defineProperty(process, 'platform', { value: 'win32' }));
    afterEach(() => Object.defineProperty(process, 'platform', { value: originalPlatform }));

    it.each(['tool.exe x', 'tool x', 'TOOL.EXE. x'])(
      'blocks %s when additionalBlockedCommands has an extension',
      async command => {
        const tool = createRunCommandTool({ additionalBlockedCommands: ['tool.exe'] });
        const res = await run(tool, { command });
        expect(res.success).toBe(false);
        expect(res.message).toContain("'tool' is not permitted");
      },
    );

    it('matches allowedCommands entries that have an extension', async () => {
      const tool = createRunCommandTool({ allowedCommands: ['node.exe'], allowedBasePaths: ['C:\\nowhere'] });
      const res = await run(tool, { command: 'node.exe -v', cwd: 'C:\\elsewhere' });
      // Passing the allowlist means the next check (cwd) is what rejects it.
      expect(res.message).toContain('is not within allowed paths');
    });
  });

  it.runIf(process.platform === 'win32')('blocks Windows-path invocations of blocked commands', async () => {
    const tool = createRunCommandTool({ allowUnsafeCharacters: true });
    const res = await run(tool, { command: 'C:\\Windows\\rm.exe x' });
    expect(res.success).toBe(false);
    expect(res.message).toContain("'rm' is not permitted");
  });

  it.skipIf(process.platform === 'win32')(
    'does not strip trailing dots on POSIX when matching the allowlist',
    async () => {
      const tool = createRunCommandTool({ allowedCommands: ['echo'] });
      const res = await run(tool, { command: './echo. x' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('not in the allowed commands list');
    },
  );

  it.each(['"rm" x', 'r"m" x', '"r"m x', "r'm' x"])('blocks %s in default mode', async command => {
    const res = await run(createRunCommandTool(), { command });
    expect(res.success).toBe(false);
    expect(res.message).toContain("'rm' is not permitted");
  });

  it('applies the allowlist to Windows-path invocations', async () => {
    const tool = createRunCommandTool({ allowUnsafeCharacters: true, allowedCommands: ['git'] });
    const res = await run(tool, { command: 'C:\\tools\\node.exe -v' });
    expect(res.success).toBe(false);
    expect(res.message).toContain('not in the allowed commands list');
  });

  it('rejects unsafe characters on every call', async () => {
    const tool = createRunCommandTool();
    for (let i = 0; i < 4; i++) {
      const res = await run(tool, { command: 'echo a; echo b' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('unsafe characters');
    }
  });

  it('runs commands inside allowed base paths and rejects others', async () => {
    const tool = createRunCommandTool({ allowedBasePaths: [process.cwd()] });
    const ok = await run(tool, { command: 'node -v', cwd: process.cwd() });
    expect(ok.success).toBe(true);
    const bad = await run(tool, { command: 'node -v', cwd: path.resolve(process.cwd(), '..') });
    expect(bad.success).toBe(false);
    expect(bad.message).toContain('not within allowed paths');
  });
});
