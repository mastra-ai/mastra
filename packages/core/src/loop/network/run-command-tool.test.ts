import { tmpdir } from 'node:os';
import { parse, join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { createRunCommandTool } from './run-command-tool';

/**
 * These tests drive the tool through its public surface. Every command used
 * here is rejected during validation, or is a bare `echo`, so nothing
 * destructive can run even if a check regresses.
 */
describe('createRunCommandTool', () => {
  describe('unsafe character filter', () => {
    it('rejects the same command on every call, not every other one', async () => {
      // The allowlist holds a command that cannot exist, so a command slipping
      // past the character filter still cannot execute.
      const tool = createRunCommandTool({ allowedCommands: ['mastra-no-such-command'] });
      const command = 'echo hi; echo bye';

      const messages: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await tool.execute({ command, timeout: 1000 });
        expect(result.success).toBe(false);
        messages.push(result.message ?? '');
      }

      // Shared `/g` regexes carry `lastIndex` between `test()` calls, so the
      // second check used to start mid-string and find nothing.
      expect(messages.map(message => message.includes('unsafe characters'))).toEqual([true, true, true]);
    });

    it('still rejects a newline on a repeated call', async () => {
      const tool = createRunCommandTool({ allowedCommands: ['mastra-no-such-command'] });
      const command = 'echo one\necho two';

      const first = await tool.execute({ command, timeout: 1000 });
      const second = await tool.execute({ command, timeout: 1000 });

      expect(first.message).toContain('unsafe characters');
      expect(second.message).toContain('unsafe characters');
    });
  });

  describe('base command extraction', () => {
    it('strips a Windows-style directory prefix so the blocklist still applies', async () => {
      // `git` is the only allowed command, so an unrecognised base command is
      // refused by the allowlist rather than executed.
      const tool = createRunCommandTool({ allowUnsafeCharacters: true, allowedCommands: ['git'] });

      const result = await tool.execute({ command: '.\\bin\\rm -rf build', timeout: 1000 });

      expect(result.success).toBe(false);
      // Before the fix the whole path was treated as the base command, which
      // matched neither the blocklist nor the allowlist.
      expect(result.message).toContain("'rm' is not permitted");
    });

    it('still strips a POSIX directory prefix', async () => {
      const tool = createRunCommandTool({ allowedCommands: ['git'] });

      const result = await tool.execute({ command: '/usr/local/bin/rm -rf build', timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.message).toContain("'rm' is not permitted");
    });
  });

  describe('working directory containment', () => {
    it('accepts a directory when the allowed base path is the filesystem root', async () => {
      const root = parse(process.cwd()).root;
      const tool = createRunCommandTool({ allowedCommands: ['echo'], allowedBasePaths: [root] });

      const result = await tool.execute({ command: 'echo ok', cwd: process.cwd(), timeout: 5000 });

      // A root base path used to be concatenated into `//`, which no path
      // could ever start with, so every directory was refused.
      expect(result.message ?? '').not.toContain('not within allowed paths');
    });

    it('rejects a sibling directory that merely shares a prefix', async () => {
      const base = join(tmpdir(), 'mastra-base');
      const tool = createRunCommandTool({ allowedCommands: ['echo'], allowedBasePaths: [base] });

      const result = await tool.execute({ command: 'echo ok', cwd: `${base}-evil`, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not within allowed paths');
    });

    it('rejects a traversal that climbs out of the allowed base path', async () => {
      const base = join(tmpdir(), 'mastra-base');
      const tool = createRunCommandTool({ allowedCommands: ['echo'], allowedBasePaths: [base] });

      const result = await tool.execute({ command: 'echo ok', cwd: join(base, '..', 'elsewhere'), timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not within allowed paths');
    });
  });
});
