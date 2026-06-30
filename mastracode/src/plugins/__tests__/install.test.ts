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
  it('clones with argv and writes a relative checkout path', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    execaMock.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args[0] === 'clone') {
        const checkoutDir = args[2];
        if (!checkoutDir) throw new Error('missing checkout dir');
        writePlugin(checkoutDir, 'acme.github');
      }
      return { stdout: '' };
    });

    await expect(
      installGithubPlugin('https://github.com/acme/mastracode-plugin#main', 'global', { projectRoot, homeDir }),
    ).resolves.toBe('acme.github');

    expect(execaMock).toHaveBeenNthCalledWith(1, 'git', [
      'clone',
      'https://github.com/acme/mastracode-plugin.git',
      path.join(homeDir, '.mastracode/plugins/sources/github/acme-mastracode-plugin'),
    ]);
    expect(execaMock).toHaveBeenNthCalledWith(2, 'git', ['checkout', 'main'], {
      cwd: path.join(homeDir, '.mastracode/plugins/sources/github/acme-mastracode-plugin'),
    });
    expect(
      loadPluginRegistry(path.join(homeDir, '.mastracode/plugins/plugins.json')).plugins['acme.github'],
    ).toMatchObject({
      source: 'github',
      path: 'sources/github/acme-mastracode-plugin',
      ref: 'main',
    });
  });

  it('uses a repository plugin manifest for nested scaffolded GitHub plugins', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-install-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    execaMock.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args[0] === 'clone') {
        const checkoutDir = args[2];
        if (!checkoutDir) throw new Error('missing checkout dir');
        writePlugin(path.join(checkoutDir, '.mastracode', 'plugins', 'sources', 'local', 'alexandria'), 'alexandria');
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

    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins.alexandria,
    ).toMatchObject({
      source: 'github',
      path: 'sources/github/acme-alexandria',
      entry: '.mastracode/plugins/sources/local/alexandria/src/index.ts',
    });
  });
});
