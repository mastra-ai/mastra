import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({ execa: execaMock }));

import { detectEntry, discoverLocalPlugins, installGithubPlugin, installLocalPlugin } from '../install.js';
import { loadPluginRegistry } from '../registry.js';

const mastracodePackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let tempDir: string | undefined;

afterEach(() => {
  vi.clearAllMocks();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function writePlugin(pluginDir: string, id: string): void {
  fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'src/index.ts'),
    `import { defineMastraCodePlugin } from 'mastracode/plugin';

export default defineMastraCodePlugin({ id: '${id}', version: '1.2.3', tools: { installed_tool: { tool: { id: 'installed_tool' } } } });`,
  );
}

describe('detectEntry', () => {
  it('detects TypeScript entry candidates', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    tempDir = dir;
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/index.ts'), 'export default {}');

    expect(detectEntry(dir)).toBe('src/index.ts');
  });

  it('rejects non-TypeScript explicit entries', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    tempDir = dir;
    fs.writeFileSync(path.join(dir, 'index.js'), 'export default {}');

    expect(() => detectEntry(dir, 'index.js')).toThrow('Plugin entry must be a .ts file');
  });

  it('accepts an explicit entry directory and detects its TypeScript entry', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    tempDir = dir;
    writePlugin(path.join(dir, '.mastracode', 'plugins', 'sources', 'local', 'alexandria'), 'alexandria');

    expect(detectEntry(dir, '.mastracode/plugins/sources/local/alexandria')).toBe(
      '.mastracode/plugins/sources/local/alexandria/src/index.ts',
    );
  });

  it('uses .mastracode-plugin.json when present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    tempDir = dir;
    writePlugin(path.join(dir, '.mastracode', 'plugins', 'sources', 'local', 'alexandria'), 'alexandria');
    fs.writeFileSync(
      path.join(dir, '.mastracode-plugin.json'),
      JSON.stringify({
        plugins: [
          {
            id: 'alexandria',
            entry: '.mastracode/plugins/sources/local/alexandria/src/index.ts',
          },
        ],
      }),
    );

    expect(detectEntry(dir)).toBe('.mastracode/plugins/sources/local/alexandria/src/index.ts');
  });
});

describe('discoverLocalPlugins', () => {
  it('finds scaffolded plugins under project local sources', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const firstPluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'sources', 'local', 'first-plugin');
    const secondPluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'sources', 'local', 'second-plugin');
    writePlugin(firstPluginDir, 'acme.first');
    writePlugin(secondPluginDir, 'acme.second');
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export default {}');

    expect(discoverLocalPlugins('.', { projectRoot })).toEqual([
      { name: 'first-plugin', path: firstPluginDir, entry: 'src/index.ts' },
      { name: 'second-plugin', path: secondPluginDir, entry: 'src/index.ts' },
    ]);
  });

  it('finds installable plugins under another project path', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const otherProject = path.join(tempDir, 'other-project');
    const pluginDir = path.join(otherProject, '.mastracode', 'plugins', 'sources', 'local', 'nested-plugin');
    writePlugin(pluginDir, 'acme.nested');

    expect(discoverLocalPlugins(otherProject, { projectRoot })).toEqual([
      { name: 'nested-plugin', path: pluginDir, entry: 'src/index.ts' },
    ]);
  });
});

describe('installLocalPlugin', () => {
  it('loads the local plugin and writes the scoped registry record', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'local-plugin');
    writePlugin(pluginDir, 'acme.local');

    await expect(installLocalPlugin(pluginDir, 'project', { projectRoot, homeDir })).resolves.toBe('acme.local');

    expect(fs.realpathSync(path.join(pluginDir, 'node_modules', 'mastracode'))).toBe(
      fs.realpathSync(mastracodePackageRoot),
    );
    expect(loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json'))).toEqual({
      disabledPlugins: [],
      plugins: {
        'acme.local': {
          enabled: true,
          source: 'local',
          specifier: pluginDir,
          path: pluginDir,
          entry: 'src/index.ts',
          version: '1.2.3',
        },
      },
    });
  });
});

describe('installGithubPlugin', () => {
  it('clones with gh CLI and writes a relative checkout path', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(homeDir, '.mastracode/plugins/sources/github/acme-mastracode-plugin');
    execaMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'clone') {
        const destination = args[3];
        if (!destination) throw new Error('missing checkout dir');
        writePlugin(destination, 'acme.github');
      }
      return { stdout: '' };
    });

    await expect(
      installGithubPlugin('https://github.com/acme/mastracode-plugin#main', 'global', { projectRoot, homeDir }),
    ).resolves.toBe('acme.github');

    expect(execaMock).toHaveBeenNthCalledWith(
      1,
      'gh',
      ['--version'],
      expect.objectContaining({ env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(execaMock).toHaveBeenNthCalledWith(
      2,
      'gh',
      ['auth', 'status'],
      expect.objectContaining({ env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(execaMock).toHaveBeenNthCalledWith(
      3,
      'gh',
      ['repo', 'clone', 'acme/mastracode-plugin', checkoutDir],
      expect.objectContaining({ env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(execaMock).toHaveBeenNthCalledWith(
      4,
      'git',
      ['checkout', 'main'],
      expect.objectContaining({
        cwd: checkoutDir,
        env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }),
      }),
    );
    expect(
      loadPluginRegistry(path.join(homeDir, '.mastracode/plugins/plugins.json')).plugins['acme.github'],
    ).toMatchObject({
      source: 'github',
      path: 'sources/github/acme-mastracode-plugin',
      ref: 'main',
    });
  });

  it('installs checkout dependencies before loading and writing the registry record', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(homeDir, '.mastracode/plugins/sources/github/acme-dep-plugin');
    execaMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'clone') {
        const destination = args[3];
        if (!destination) throw new Error('missing checkout dir');
        writePlugin(destination, 'acme.dep');
        fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0' }));
        fs.writeFileSync(path.join(destination, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
      }
      return { stdout: '' };
    });

    await expect(
      installGithubPlugin('https://github.com/acme/dep-plugin', 'global', { projectRoot, homeDir }),
    ).resolves.toBe('acme.dep');

    expect(execaMock).toHaveBeenNthCalledWith(
      3,
      'gh',
      ['repo', 'clone', 'acme/dep-plugin', checkoutDir, '--', '--depth', '1'],
      expect.anything(),
    );
    expect(execaMock).toHaveBeenNthCalledWith(
      4,
      'pnpm',
      ['install', '--frozen-lockfile', '--ignore-scripts'],
      expect.objectContaining({ cwd: checkoutDir }),
    );
    expect(
      loadPluginRegistry(path.join(homeDir, '.mastracode/plugins/plugins.json')).plugins['acme.dep'],
    ).toMatchObject({
      source: 'github',
      path: 'sources/github/acme-dep-plugin',
    });
  });

  it('does not write a registry record when dependency installation fails', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const installError = new Error('dependency install failed');
    execaMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'clone') {
        const destination = args[3];
        if (!destination) throw new Error('missing checkout dir');
        writePlugin(destination, 'acme.dep-fail');
        fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0' }));
      }
      if (cmd === 'pnpm') {
        throw installError;
      }
      return { stdout: '' };
    });

    await expect(
      installGithubPlugin('https://github.com/acme/dep-fail', 'global', { projectRoot, homeDir }),
    ).rejects.toThrow(installError);

    expect(loadPluginRegistry(path.join(homeDir, '.mastracode/plugins/plugins.json')).plugins).toEqual({});
  });

  it('throws an actionable error when gh is unavailable', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    execaMock.mockRejectedValueOnce(new Error('not found'));

    await expect(
      installGithubPlugin('https://github.com/acme/plugin', 'project', { projectRoot, homeDir }),
    ).rejects.toThrow('GitHub CLI is required to install GitHub plugins. Install gh and run gh auth login.');
  });

  it('throws an actionable error when gh is unauthenticated', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    execaMock.mockResolvedValueOnce({ stdout: '' }).mockRejectedValueOnce(new Error('not authenticated'));

    await expect(
      installGithubPlugin('https://github.com/acme/plugin', 'project', { projectRoot, homeDir }),
    ).rejects.toThrow('GitHub CLI is not authenticated. Run gh auth login, then install the plugin again.');
  });

  it('uses a repository plugin manifest for nested scaffolded GitHub plugins', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    execaMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'clone') {
        const checkoutDir = args[3];
        if (!checkoutDir) throw new Error('missing checkout dir');
        const nestedPluginDir = path.join(checkoutDir, '.mastracode', 'plugins', 'sources', 'local', 'alexandria');
        writePlugin(nestedPluginDir, 'alexandria');
        fs.writeFileSync(path.join(nestedPluginDir, 'package.json'), JSON.stringify({ name: 'alexandria' }));
        fs.writeFileSync(
          path.join(checkoutDir, '.mastracode-plugin.json'),
          JSON.stringify({
            plugins: [
              {
                id: 'alexandria',
                entry: '.mastracode/plugins/sources/local/alexandria/src/index.ts',
              },
            ],
          }),
        );
      }
      return { stdout: '' };
    });

    await expect(
      installGithubPlugin('https://github.com/acme/alexandria', 'project', { projectRoot, homeDir }),
    ).resolves.toBe('alexandria');

    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-alexandria');
    const nestedPluginDir = path.join(checkoutDir, '.mastracode/plugins/sources/local/alexandria');
    expect(execaMock).toHaveBeenCalledWith(
      'gh',
      ['repo', 'clone', 'acme/alexandria', checkoutDir, '--', '--depth', '1'],
      expect.objectContaining({ env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(execaMock).toHaveBeenCalledWith(
      'npm',
      ['install', '--ignore-scripts'],
      expect.objectContaining({ cwd: nestedPluginDir }),
    );
    expect(fs.realpathSync(path.join(nestedPluginDir, 'node_modules', 'mastracode'))).toBe(
      fs.realpathSync(mastracodePackageRoot),
    );
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins.alexandria,
    ).toMatchObject({
      source: 'github',
      path: 'sources/github/acme-alexandria',
      entry: '.mastracode/plugins/sources/local/alexandria/src/index.ts',
    });
  });
});
