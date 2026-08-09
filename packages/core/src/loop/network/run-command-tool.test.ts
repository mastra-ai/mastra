import { describe, expect, it } from 'vitest';

import { createRunCommandTool } from './run-command-tool';

/**
 * Tests for run-command-tool path containment.
 *
 * The tool functions that need testing are private (`isPathAllowed`,
 * `extractBaseCommand`), so we test them indirectly through the
 * `execute` method of the public tool API. We craft inputs that
 * exercise the private functions and check the rejection messages.
 */

describe('createRunCommandTool - basic security', () => {
  it('rejects unsafe characters in command', async () => {
    const tool = createRunCommandTool();
    const result = await tool.execute?.({ command: 'echo test | cat', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('unsafe');
  });

  it('rejects blocked commands', async () => {
    const tool = createRunCommandTool();
    const result = await tool.execute?.({ command: 'rm -rf /', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('is not permitted');
  });

  it('rejects commands not in allowlist when configured', async () => {
    const tool = createRunCommandTool({ allowedCommands: ['git', 'npm'] });
    const result = await tool.execute?.({ command: 'ls -la', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('not in the allowed commands');
  });
});

// ── extractBaseCommand ───────────────────────────────────────────
// The function is private; we test it by crafting commands where the
// extracted base command hits the blocklist (if extraction works
// correctly) or escapes it (if extraction is broken on Windows).

describe('extractBaseCommand — cross-platform command extraction', () => {
  it('extracts base command from POSIX path', async () => {
    // `mkdir` is blocked by BLOCKED_COMMANDS but only if extraction works.
    // If /usr/bin/mkdir is treated as the whole string, it won't match 'mkdir'.
    const tool = createRunCommandTool({
      additionalBlockedCommands: ['mkdir'],
    });
    const result = await tool.execute?.({ command: '/usr/bin/mkdir testdir', timeout: 5000 });
    // After fix: extracts 'mkdir' → rejected by blocklist.
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('is not permitted');
  });

  it('extracts base command from Windows path', async () => {
    // On Windows, extractBaseCommand must split on both \ and /.
    // Before the fix: `lastIndexOf('/')` returns -1 for a pure Windows path,
    // so `C:\\Windows\\System32\\ftp help` would be treated as the base command
    // instead of extracting `ftp`.
    const tool = createRunCommandTool({
      additionalBlockedCommands: ['ftp'],
    });
    const result = await tool.execute?.({ command: 'C:\\Windows\\System32\\ftp help', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('is not permitted');
  });

  it('extracts base command from path with mixed separators', async () => {
    // Mixed-forward-slash Windows path (what `path.posix.normalize` might produce)
    const tool = createRunCommandTool({
      additionalBlockedCommands: ['ftp'],
    });
    const result = await tool.execute?.({ command: 'C:/Windows/System32/ftp help', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('is not permitted');
  });

  it('extracts base command from relative Windows path', async () => {
    const tool = createRunCommandTool({
      additionalBlockedCommands: ['node'],
    });
    const result = await tool.execute?.({ command: '.\\bin\\node server.js', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('is not permitted');
  });

  it('extracts simple command with no slashes', async () => {
    const tool = createRunCommandTool({
      additionalBlockedCommands: ['rmdir'],
    });
    const result = await tool.execute?.({ command: 'rmdir /s /q temp', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('is not permitted');
  });
});

// ── isPathAllowed ─────────────────────────────────────────────────
// Tested indirectly by providing a cwd and allowedBasePaths. Before the
// fix, Windows base paths would reject ALL cwds because `startsWith(base + '/')`
// used forward slashes while `normalize()` produced backslash paths.

describe('isPathAllowed — cross-platform path containment', () => {
  const basePath = process.platform === 'win32' ? 'C:\\projects' : '/tmp/projects';

  it('allows cwd that is the base path itself', async () => {
    const tool = createRunCommandTool({
      allowedBasePaths: [basePath],
      allowedCommands: ['echo'],
    });
    const result = await tool.execute?.({ command: 'echo hello', cwd: basePath, timeout: 5000 });
    expect(result?.success).toBe(true);
  });

  it('rejects cwd outside base path', async () => {
    const tool = createRunCommandTool({
      allowedBasePaths: [basePath],
    });
    const outside = process.platform === 'win32' ? 'C:\\outside' : '/outside';
    const result = await tool.execute?.({ command: 'echo hello', cwd: outside, timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('not within allowed paths');
  });

  it('allows cwd as subdirectory of base (POSIX path)', async () => {
    // This test MUST pass on all platforms — before the fix, it would
    // fail on Windows because `startsWith(base + '/')` produces `C:\projects/`
    // which doesn't match `C:\projects\sub`.
    const tool = createRunCommandTool({
      allowedBasePaths: [basePath],
      allowedCommands: ['echo'],
    });
    const subdir = process.platform === 'win32' ? 'C:\\projects\\sub' : '/tmp/projects/sub';
    const result = await tool.execute?.({ command: 'echo ok', cwd: subdir, timeout: 5000 });
    expect(result?.success).toBe(true);
  });

  it('allows any cwd when no base paths are configured', async () => {
    const tool = createRunCommandTool({
      allowedBasePaths: [],
      allowedCommands: ['echo'],
    });
    const result = await tool.execute?.({ command: 'echo anywhere', cwd: '/anywhere', timeout: 5000 });
    expect(result?.success).toBe(true);
  });
});

// ── traversal guard ───────────────────────────────────────────────

describe('createRunCommandTool — traversal rejection', () => {
  const basePath = process.platform === 'win32' ? 'C:\\projects' : '/tmp/projects';

  it('rejects path with .. traversal', async () => {
    const tool = createRunCommandTool({
      allowedBasePaths: [basePath],
    });
    const result = await tool.execute?.({
      command: 'echo pwn',
      cwd: process.platform === 'win32' ? 'C:\\projects\\..\\ssh' : '/tmp/projects/../ssh',
      timeout: 5000,
    });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('traversal');
  });

  it('does NOT reject path containing ... (not real traversal)', async () => {
    // `...` is not `..` — should pass through to isPathAllowed
    const tool = createRunCommandTool({
      allowedBasePaths: [basePath],
      allowedCommands: ['echo'],
    });
    const pathWithDots = process.platform === 'win32' ? 'C:\\projects\\my...app' : '/tmp/projects/my...app';
    const result = await tool.execute?.({ command: 'echo ok', cwd: pathWithDots, timeout: 5000 });
    expect(result?.success).toBe(true);
  });
});
