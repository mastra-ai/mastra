import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.hoisted(() => vi.fn());
vi.mock('execa', () => ({ execa: execaMock }));

import { createPluginMCPServer, resolvePluginConfigInput } from '../mcp.js';
import { prepareGithubPluginSource } from '../source.js';

let tempDir: string | undefined;

afterEach(() => {
  vi.clearAllMocks();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function writePlugin(
  dir: string,
  options: { config?: string; name?: string; version?: string; tools?: string } = {},
): void {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'src/index.ts'),
    `import { createTool, defineMastraCodePlugin, z } from 'mastracode/plugin';
export default defineMastraCodePlugin({
  id: 'acme.mcp',
  ${options.name ? `name: '${options.name}',` : ''}
  ${options.version ? `version: '${options.version}',` : ''}
  ${options.config ?? ''}
  ${
    options.tools === 'none'
      ? ''
      : `tools: context => ({ echo: { tool: createTool({ id: 'echo', description: 'echo', inputSchema: z.object({ value: z.string() }), outputSchema: z.object({ value: z.string() }), execute: async ({ value }) => ({ value: value + ':' + String(context.config.label) + ':' + String(context.config.enabled) }) }) } })`
  }
});`,
  );
}

function setup(): { projectRoot: string; homeDir: string; pluginDir: string } {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-mcp-'));
  const projectRoot = path.join(tempDir, 'project');
  const homeDir = path.join(tempDir, 'home');
  const pluginDir = path.join(tempDir, 'plugin');
  fs.mkdirSync(projectRoot, { recursive: true });
  return { projectRoot, homeDir, pluginDir };
}

describe('createPluginMCPServer', () => {
  it('acquires a local plugin and lists and invokes its normalized tool', async () => {
    const paths = setup();
    writePlugin(paths.pluginDir, {
      name: 'Acme MCP',
      version: '1.2.3',
      config: `config: { label: { type: 'string', default: 'default' }, enabled: { type: 'boolean', default: false } },`,
    });

    const result = await createPluginMCPServer({
      specifier: paths.pluginDir,
      ...paths,
      envConfig: JSON.stringify({ label: 'environment', enabled: true }),
      config: { label: 'explicit' },
    });

    expect(result.plugin).toEqual({ id: 'acme.mcp', name: 'Acme MCP', version: '1.2.3' });
    expect(result.config).toEqual({ label: 'explicit', enabled: true });
    expect(await result.server.getToolListInfo()).toMatchObject({ tools: [{ name: 'echo' }] });
    await expect(result.server.executeTool('echo', { value: 'hello' })).resolves.toEqual({
      value: 'hello:explicit:true',
    });
    await result.close();
    await result.close();
  });

  it('uses stable identity fallbacks and supports plugins without tools', async () => {
    const paths = setup();
    writePlugin(paths.pluginDir, { tools: 'none' });
    const result = await createPluginMCPServer({ specifier: paths.pluginDir, ...paths });
    expect(result.plugin).toEqual({ id: 'acme.mcp', name: 'acme.mcp', version: '0.0.0' });
    expect(await result.server.getToolListInfo()).toEqual({ tools: [] });
    await result.close();
  });

  it('rejects unknown, invalid, and missing required config before returning a server', async () => {
    const paths = setup();
    writePlugin(paths.pluginDir, { config: `config: { label: { type: 'string' } },` });
    await expect(createPluginMCPServer({ specifier: paths.pluginDir, ...paths })).rejects.toThrow(
      'Missing required plugin configuration key: label',
    );
    await expect(
      createPluginMCPServer({ specifier: paths.pluginDir, ...paths, config: { nope: 'x' } }),
    ).rejects.toThrow('Unknown plugin configuration key: nope');
    await expect(
      createPluginMCPServer({ specifier: paths.pluginDir, ...paths, config: { label: true } }),
    ).rejects.toThrow('Invalid value for plugin configuration key: label');
  });
});

describe('resolvePluginConfigInput', () => {
  it('merges explicit values over environment values', () => {
    expect(resolvePluginConfigInput({ first: 'explicit' }, '{"first":"env","second":true}')).toEqual({
      first: 'explicit',
      second: true,
    });
    expect(resolvePluginConfigInput({ only: 'explicit' }, '{}')).toEqual({ only: 'explicit' });
  });

  it.each(['{', '[]', 'null', '"text"'])('rejects malformed or non-object environment JSON: %s', value => {
    expect(() => resolvePluginConfigInput(undefined, value)).toThrow('MASTRACODE_PLUGIN_CONFIG must be');
  });

  it('rejects invalid environment value types without including their values', () => {
    const secret = 'do-not-leak';
    expect(() => resolvePluginConfigInput(undefined, JSON.stringify({ token: { secret } }))).toThrow(
      'MASTRACODE_PLUGIN_CONFIG has an invalid value for key: token',
    );
    try {
      resolvePluginConfigInput(undefined, JSON.stringify({ token: { secret } }));
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

describe('standalone GitHub acquisition', () => {
  function mockCommands(pluginId = 'acme.mcp', head = ''): void {
    execaMock.mockImplementation(async (command: string, args: string[], options?: { cwd?: string }) => {
      if (command === 'gh' && args[0] === 'repo' && args[1] === 'clone') {
        writePlugin(args[3], { name: pluginId, tools: 'none' });
      }
      if (command === 'git' && args[0] === 'rev-parse') return { stdout: head };
      return { stdout: '', cwd: options?.cwd };
    });
  }

  it('freshly clones mutable refs and atomically promotes the prepared checkout', async () => {
    const paths = setup();
    mockCommands();
    const options = { ...paths, standalone: true, ref: 'main' };
    const first = await prepareGithubPluginSource('https://github.com/acme/plugin', options);
    const second = await prepareGithubPluginSource('https://github.com/acme/plugin', options);
    expect(first.pluginRoot).toBe(second.pluginRoot);
    expect(fs.existsSync(path.join(first.pluginRoot, 'src/index.ts'))).toBe(true);
    expect(execaMock.mock.calls.filter(call => call[1]?.[0] === 'repo')).toHaveLength(2);
    expect(fs.readdirSync(path.dirname(first.pluginRoot)).some(name => name.includes('.tmp-'))).toBe(false);
  });

  it('freshly clones an unpinned default source and short SHA', async () => {
    const paths = setup();
    mockCommands();
    await prepareGithubPluginSource('https://github.com/acme/plugin', { ...paths, standalone: true });
    await prepareGithubPluginSource('https://github.com/acme/plugin', { ...paths, standalone: true });
    await prepareGithubPluginSource('https://github.com/acme/plugin', { ...paths, standalone: true, ref: 'abc1234' });
    await prepareGithubPluginSource('https://github.com/acme/plugin', { ...paths, standalone: true, ref: 'abc1234' });
    expect(execaMock.mock.calls.filter(call => call[1]?.[0] === 'repo')).toHaveLength(4);
  });

  it('reuses a verified full commit checkout', async () => {
    const paths = setup();
    const sha = 'a'.repeat(40);
    mockCommands('acme.mcp', sha);
    await prepareGithubPluginSource('https://github.com/acme/plugin', { ...paths, standalone: true, ref: sha });
    await prepareGithubPluginSource('https://github.com/acme/plugin', { ...paths, standalone: true, ref: sha });
    expect(execaMock.mock.calls.filter(call => call[1]?.[0] === 'repo')).toHaveLength(1);
  });

  it('serializes same-key preparation', async () => {
    const paths = setup();
    mockCommands();
    const options = { ...paths, standalone: true, ref: 'main', lockWaitMs: 2_000 };
    const [first, second] = await Promise.all([
      prepareGithubPluginSource('https://github.com/acme/plugin', options),
      prepareGithubPluginSource('https://github.com/acme/plugin', options),
    ]);
    expect(first.pluginRoot).toBe(second.pluginRoot);
    expect(fs.existsSync(path.join(first.pluginRoot, 'src/index.ts'))).toBe(true);
    expect(fs.existsSync(`${first.pluginRoot}.lock`)).toBe(false);
  });

  it('cleans stale same-key locks', async () => {
    const paths = setup();
    mockCommands();
    const options = { ...paths, standalone: true, ref: 'main', lockWaitMs: 2_000, staleLockMs: 1 };
    const first = await prepareGithubPluginSource('https://github.com/acme/plugin', options);
    fs.mkdirSync(`${first.pluginRoot}.lock`, { recursive: true });
    fs.utimesSync(`${first.pluginRoot}.lock`, new Date(0), new Date(0));
    await expect(prepareGithubPluginSource('https://github.com/acme/plugin', options)).resolves.toMatchObject({
      pluginRoot: first.pluginRoot,
    });
    expect(fs.existsSync(`${first.pluginRoot}.lock`)).toBe(false);
  });
});
