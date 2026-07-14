import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';
import { describe, expect, it, vi } from 'vitest';

import { parsePluginMCPArgs, startPluginMCPCommand } from '../plugin-mcp.js';

describe('parsePluginMCPArgs', () => {
  it('parses local and GitHub sources, refs, literal strings, empty values, and values containing equals', () => {
    expect(parsePluginMCPArgs(['/tmp/plugin', '--config', 'label=a=b', '--config', 'enabled=false'])).toEqual({
      specifier: '/tmp/plugin',
      config: { label: 'a=b', enabled: 'false' },
    });
    expect(parsePluginMCPArgs(['https://github.com/acme/plugin', '--ref', 'main', '--config', 'empty='])).toEqual({
      specifier: 'https://github.com/acme/plugin',
      ref: 'main',
      config: { empty: '' },
    });
  });

  it.each([
    [[], 'Missing plugin specifier'],
    [['--ref', 'main'], 'Missing plugin specifier'],
    [['plugin', '--ref'], 'Missing value for --ref'],
    [['plugin', '--ref', 'main', '--ref', 'next'], 'Duplicate --ref flag'],
    [['plugin', '--config'], 'Missing value for --config'],
    [['plugin', '--config', '=value'], '--config must use key=value'],
    [['plugin', '--config', 'key=one', '--config', 'key=two'], 'Duplicate --config key: key'],
    [['plugin', '--wat'], 'Unknown argument: --wat'],
  ])('rejects malformed arguments', (args, message) => {
    expect(() => parsePluginMCPArgs(args)).toThrow(message);
  });
});

describe('startPluginMCPCommand', () => {
  it('passes CLI and environment options and starts stdio after resolution', async () => {
    const events: string[] = [];
    const listeners = new Map<string, () => void>();
    const runtime = {
      cwd: () => '/project',
      env: { MASTRACODE_PLUGIN_CONFIG: '{"label":"environment"}' },
      on: vi.fn((event: string, listener: () => void) => listeners.set(event, listener)),
      exit: vi.fn() as never,
    };
    const lifecycle = {
      server: { startStdio: vi.fn(async () => events.push('stdio')) },
      close: vi.fn(async () => events.push('close')),
    };
    const createServer = vi.fn(async () => {
      events.push('resolved');
      return lifecycle;
    });

    await startPluginMCPCommand(
      ['https://github.com/acme/plugin', '--ref', 'main', '--config', 'label=explicit'],
      runtime,
      createServer as never,
    );

    expect(createServer).toHaveBeenCalledWith({
      specifier: 'https://github.com/acme/plugin',
      cwd: '/project',
      ref: 'main',
      config: { label: 'explicit' },
      envConfig: '{"label":"environment"}',
    });
    expect(events).toEqual(['resolved', 'stdio']);
    expect(lifecycle.server.startStdio).toHaveBeenCalledOnce();
    expect(listeners.has('SIGINT')).toBe(true);
    expect(listeners.has('SIGTERM')).toBe(true);
  });

  it('does not start stdio when resolution fails', async () => {
    const runtime = { cwd: () => '/project', env: {}, on: vi.fn(), exit: vi.fn() as never };
    const createServer = vi.fn(async () => {
      throw new Error('startup failed');
    });
    await expect(startPluginMCPCommand(['plugin'], runtime, createServer as never)).rejects.toThrow('startup failed');
  });

  it('closes exactly once when multiple termination signals arrive', async () => {
    const listeners = new Map<string, () => void>();
    const runtime = {
      cwd: () => '/project',
      env: {},
      on: vi.fn((event: string, listener: () => void) => listeners.set(event, listener)),
      exit: vi.fn() as never,
    };
    const lifecycle = { server: { startStdio: vi.fn() }, close: vi.fn(async () => {}) };
    await startPluginMCPCommand(['plugin'], runtime, vi.fn(async () => lifecycle) as never);
    listeners.get('SIGINT')?.();
    listeners.get('SIGTERM')?.();
    await vi.waitFor(() => expect(lifecycle.close).toHaveBeenCalledOnce());
  });
});

describe('plugin MCP process boundary', () => {
  it('writes startup failures only to stderr without terminal reset bytes or config values', async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const mainPath = path.resolve(testDir, '../main.ts');
    const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));
    const secret = 'must-not-leak';
    const result = await execa(process.execPath, [tsxCli, mainPath, 'plugin', 'mcp'], {
      reject: false,
      env: { ...process.env, MASTRACODE_PLUGIN_CONFIG: JSON.stringify({ token: secret }) },
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stdout).not.toContain('\x1b');
    expect(result.stderr).toContain('Missing plugin specifier');
    expect(result.stderr).not.toContain(secret);
  });
});
