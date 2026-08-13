import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRunCommandTool,
  extractBaseCommand,
  hasPathTraversal,
  isPathAllowed,
  toPosixPath,
} from './run-command-tool';

vi.mock('node:child_process', () => ({
  exec: vi.fn((command: string, options: unknown, callback?: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    const cb = typeof options === 'function' ? options : callback;
    cb?.(null, { stdout: `ok:${command}`, stderr: '' });
    return {} as any;
  }),
}));

describe('toPosixPath', () => {
  it('converts Windows separators to forward slashes', () => {
    expect(toPosixPath('C:\\projects\\sub')).toBe('C:/projects/sub');
  });

  it('leaves POSIX paths unchanged', () => {
    expect(toPosixPath('/tmp/projects/sub')).toBe('/tmp/projects/sub');
  });
});

describe('extractBaseCommand', () => {
  it('returns the command when there is no path', () => {
    expect(extractBaseCommand('git status')).toBe('git');
  });

  it('extracts from a POSIX path', () => {
    expect(extractBaseCommand('/usr/bin/git status')).toBe('git');
  });

  it('extracts from a Windows path', () => {
    expect(extractBaseCommand('C:\\Windows\\System32\\ftp help')).toBe('ftp');
  });

  it('extracts from a relative Windows path', () => {
    expect(extractBaseCommand('.\\bin\\node server.js')).toBe('node');
  });

  it('extracts from mixed separators', () => {
    expect(extractBaseCommand('C:/Windows/System32\\ftp help')).toBe('ftp');
  });

  it('extracts when arguments are tab-separated', () => {
    expect(extractBaseCommand('rm\t-rf\t/')).toBe('rm');
  });

  it('strips quotes around the command token', () => {
    expect(extractBaseCommand('"rm" -rf /')).toBe('rm');
    expect(extractBaseCommand("'ftp' help")).toBe('ftp');
  });

  it('strips quotes around a path command token', () => {
    expect(extractBaseCommand('"/usr/bin/rm" -rf /')).toBe('rm');
  });
});

describe('hasPathTraversal', () => {
  it('detects .. segments with either separator', () => {
    expect(hasPathTraversal('/tmp/projects/../ssh')).toBe(true);
    expect(hasPathTraversal('C:\\projects\\..\\ssh')).toBe(true);
  });

  it('does not treat ... as traversal', () => {
    expect(hasPathTraversal('/tmp/projects/my...app')).toBe(false);
  });
});

describe('isPathAllowed', () => {
  it('allows any path when no base paths are configured', () => {
    expect(isPathAllowed('/anywhere', [])).toBe(true);
  });

  it('allows the base path and its subdirectories', () => {
    expect(isPathAllowed('/tmp/projects', ['/tmp/projects'])).toBe(true);
    expect(isPathAllowed('/tmp/projects/sub', ['/tmp/projects'])).toBe(true);
  });

  it('rejects paths outside the base', () => {
    expect(isPathAllowed('/outside', ['/tmp/projects'])).toBe(false);
  });

  it('rejects sibling prefixes that only share a string prefix', () => {
    expect(isPathAllowed('/tmp/projects-other', ['/tmp/projects'])).toBe(false);
  });

  it('allows descendants when the base is filesystem root /', () => {
    expect(isPathAllowed('/', ['/'])).toBe(true);
    expect(isPathAllowed('/tmp', ['/'])).toBe(true);
    expect(isPathAllowed('/tmp/projects', ['/'])).toBe(true);
  });

  it('allows Windows-style subdirectory containment after POSIX normalization', () => {
    // Simulate the Windows normalize()/resolve() output shape by comparing via toPosixPath.
    const base = toPosixPath('C:\\projects');
    const inside = toPosixPath('C:\\projects\\sub');
    const sibling = toPosixPath('C:\\projects-other');
    const descendantPrefix = base.endsWith('/') ? base : `${base}/`;
    expect(inside === base || inside.startsWith(descendantPrefix)).toBe(true);
    expect(sibling === base || sibling.startsWith(descendantPrefix)).toBe(false);
  });

  it('allows descendants when POSIX-normalized Windows root already ends with /', () => {
    // On Windows, resolve('C:\\') normalizes to a root that already ends with `/`
    // after toPosixPath (e.g. `C:/`). Appending another `/` would yield `C://` and
    // fail to match descendants — so only append when missing.
    const base = toPosixPath('C:\\');
    const inside = toPosixPath('C:\\Windows\\System32');
    const descendantPrefix = base.endsWith('/') ? base : `${base}/`;
    expect(base.endsWith('/')).toBe(true);
    expect(inside === base || inside.startsWith(descendantPrefix)).toBe(true);
  });
});

describe('createRunCommandTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unsafe characters in command', async () => {
    const tool = createRunCommandTool();
    const result = await tool.execute?.({ command: 'echo test | cat', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('unsafe');
  });

  it('rejects the same unsafe command on repeated invocations (stateless regex)', async () => {
    const tool = createRunCommandTool();
    const first = await tool.execute?.({ command: 'ls; rm', timeout: 5000 });
    const second = await tool.execute?.({ command: 'ls; rm', timeout: 5000 });
    expect(first?.success).toBe(false);
    expect(second?.success).toBe(false);
    expect(second?.message).toContain('unsafe');
  });

  it('rejects blocked commands', async () => {
    const tool = createRunCommandTool();
    const result = await tool.execute?.({ command: 'rm -rf /', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('is not permitted');
  });

  it('rejects tab-separated blocked commands', async () => {
    const tool = createRunCommandTool();
    const result = await tool.execute?.({ command: 'rm\t-rf\t/', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain("'rm' is not permitted");
  });

  it('rejects quoted blocked commands', async () => {
    const tool = createRunCommandTool();
    const doubleQuoted = await tool.execute?.({ command: '"rm" -rf /', timeout: 5000 });
    const singleQuoted = await tool.execute?.({ command: "'curl' http://example.com", timeout: 5000 });
    expect(doubleQuoted?.success).toBe(false);
    expect(doubleQuoted?.message).toContain("'rm' is not permitted");
    expect(singleQuoted?.success).toBe(false);
    expect(singleQuoted?.message).toContain("'curl' is not permitted");
  });

  it('rejects commands not in the allowlist', async () => {
    const tool = createRunCommandTool({ allowedCommands: ['git', 'npm'] });
    const result = await tool.execute?.({ command: 'ls -la', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('not in the allowed commands');
  });

  it('blocks Windows-path commands via base-command extraction', async () => {
    // Backslashes are normally rejected as unsafe; this path is only reachable
    // when that filter is disabled (or when the path uses forward slashes).
    const tool = createRunCommandTool({ allowUnsafeCharacters: true });
    const result = await tool.execute?.({
      command: 'C:\\Windows\\System32\\ftp help',
      timeout: 5000,
    });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain("'ftp' is not permitted");
  });

  it('blocks POSIX-path commands via base-command extraction', async () => {
    const tool = createRunCommandTool({ additionalBlockedCommands: ['mkdir'] });
    const result = await tool.execute?.({ command: '/usr/bin/mkdir testdir', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain("'mkdir' is not permitted");
  });

  it('rejects cwd outside allowedBasePaths', async () => {
    const tool = createRunCommandTool({ allowedBasePaths: ['/tmp/projects'] });
    const result = await tool.execute?.({ command: 'echo hello', cwd: '/outside', timeout: 5000 });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('not within allowed paths');
  });

  it('allows cwd under allowedBasePaths', async () => {
    const tool = createRunCommandTool({
      allowedBasePaths: ['/tmp/projects'],
      allowedCommands: ['echo'],
    });
    const result = await tool.execute?.({
      command: 'echo hello',
      cwd: '/tmp/projects/sub',
      timeout: 5000,
    });
    expect(result?.success).toBe(true);
  });

  it('rejects cwd containing .. traversal', async () => {
    const tool = createRunCommandTool({ allowedBasePaths: ['/tmp/projects'] });
    const result = await tool.execute?.({
      command: 'echo pwn',
      cwd: '/tmp/projects/../ssh',
      timeout: 5000,
    });
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('traversal');
  });

  it('does not reject ... as traversal', async () => {
    const tool = createRunCommandTool({
      allowedBasePaths: ['/tmp/projects'],
      allowedCommands: ['echo'],
    });
    const result = await tool.execute?.({
      command: 'echo ok',
      cwd: '/tmp/projects/my...app',
      timeout: 5000,
    });
    expect(result?.success).toBe(true);
  });
});
