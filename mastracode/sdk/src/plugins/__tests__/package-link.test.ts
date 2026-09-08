import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ModuleKind, transpileModule } from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

import { assertHostPluginRuntime, ensureMastraCodePackageLink, findMastraCodePackageRoot } from '../package-link.js';

const mastracodePackageRoot = findMastraCodePackageRoot(path.dirname(fileURLToPath(import.meta.url)));

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function makePluginRoot(): string {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-link-'));
  tempDir = pluginRoot;
  return pluginRoot;
}

describe('findMastraCodePackageRoot', () => {
  it('finds the mastracode package root from source and bundled dist paths', () => {
    expect(findMastraCodePackageRoot(path.join(mastracodePackageRoot, 'src', 'plugins'))).toBe(mastracodePackageRoot);
    expect(findMastraCodePackageRoot(path.join(mastracodePackageRoot, 'dist'))).toBe(mastracodePackageRoot);
  });
});

describe('assertHostPluginRuntime', () => {
  it.each([false, true])('checks a hermetic published package layout with CLI=%s', withCli => {
    const root = makePluginRoot();
    const sdk = path.join(root, 'node_modules', '.pnpm', 'sdk', 'node_modules', '@mastra', 'code-sdk');
    fs.mkdirSync(sdk, { recursive: true });
    fs.writeFileSync(
      path.join(sdk, 'package.json'),
      JSON.stringify({ name: '@mastra/code-sdk', type: 'module', exports: { './package.json': './package.json' } }),
    );
    const source = fs.readFileSync(fileURLToPath(new URL('../package-link.ts', import.meta.url)), 'utf8');
    fs.writeFileSync(
      path.join(sdk, 'package-link.js'),
      transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext } }).outputText,
    );
    const cli = path.join(root, 'node_modules', 'mastracode');
    if (withCli) {
      fs.mkdirSync(cli, { recursive: true });
      fs.writeFileSync(
        path.join(cli, 'package.json'),
        JSON.stringify({ name: 'mastracode', type: 'module', exports: { './package.json': './package.json' } }),
      );
    }
    const plugin = path.join(root, 'plugin');
    fs.mkdirSync(path.join(plugin, 'node_modules', '@mastra'), { recursive: true });
    fs.symlinkSync(sdk, path.join(plugin, 'node_modules', '@mastra', 'code-sdk'), 'dir');
    if (withCli) fs.symlinkSync(cli, path.join(plugin, 'node_modules', 'mastracode'), 'dir');
    const entry = path.join(plugin, 'entry.ts');
    const runner = path.join(withCli ? cli : root, 'runner.mjs');
    fs.writeFileSync(
      runner,
      `import { assertHostPluginRuntime } from ${JSON.stringify(pathToFileURL(path.join(sdk, 'package-link.js')).href)}; assertHostPluginRuntime(${JSON.stringify(entry)});`,
    );
    const run = () =>
      spawnSync(process.execPath, [runner], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '' },
      });
    const aligned = run();
    expect(aligned.stderr).toBe('');
    expect(aligned.status).toBe(0);
    const runtimeLink = path.join(plugin, 'node_modules', '@mastra', 'code-sdk');
    fs.unlinkSync(runtimeLink);
    fs.mkdirSync(runtimeLink);
    fs.writeFileSync(
      path.join(runtimeLink, 'package.json'),
      JSON.stringify({ name: '@mastra/code-sdk', exports: { './package.json': './package.json' } }),
    );
    const mismatched = run();
    expect(mismatched.status).not.toBe(0);
    expect(mismatched.stderr).toContain('Plugin runtime mismatch');
  });

  it('accepts realpath-equivalent host links without changing the plugin installation', () => {
    const pluginRoot = makePluginRoot();
    ensureMastraCodePackageLink(pluginRoot);
    const link = path.join(pluginRoot, 'node_modules', 'mastracode');
    const target = fs.readlinkSync(link);
    expect(() => assertHostPluginRuntime(path.join(pluginRoot, 'plugin.ts'))).not.toThrow();
    expect(fs.readlinkSync(link)).toBe(target);
  });

  it('accepts plugins using the host SDK directly', () => {
    const pluginRoot = makePluginRoot();
    const sdkRoot = path.resolve(mastracodePackageRoot, '..', 'sdk');
    const link = path.join(pluginRoot, 'node_modules', '@mastra', 'code-sdk');
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(sdkRoot, link, 'dir');
    expect(() => assertHostPluginRuntime(path.join(pluginRoot, 'plugin.ts'))).not.toThrow();
  });
});

describe('ensureMastraCodePackageLink', () => {
  it('links mastracode when it is not declared as an installable dependency', () => {
    const pluginRoot = makePluginRoot();
    fs.writeFileSync(path.join(pluginRoot, 'package.json'), JSON.stringify({ peerDependencies: { mastracode: '*' } }));

    ensureMastraCodePackageLink(pluginRoot);

    expect(fs.realpathSync(path.join(pluginRoot, 'node_modules', 'mastracode'))).toBe(
      fs.realpathSync(mastracodePackageRoot),
    );
  });

  it('replaces an auto-installed mastracode package when only a peer dependency is declared', () => {
    const pluginRoot = makePluginRoot();
    const installedPackageDir = path.join(pluginRoot, 'node_modules', 'mastracode');
    fs.writeFileSync(path.join(pluginRoot, 'package.json'), JSON.stringify({ peerDependencies: { mastracode: '*' } }));
    fs.mkdirSync(installedPackageDir, { recursive: true });
    fs.writeFileSync(path.join(installedPackageDir, 'package.json'), JSON.stringify({ name: 'mastracode' }));

    ensureMastraCodePackageLink(pluginRoot);

    expect(fs.realpathSync(path.join(pluginRoot, 'node_modules', 'mastracode'))).toBe(
      fs.realpathSync(mastracodePackageRoot),
    );
  });

  it('does not link mastracode when the plugin declares a package dependency', () => {
    const pluginRoot = makePluginRoot();
    fs.writeFileSync(path.join(pluginRoot, 'package.json'), JSON.stringify({ dependencies: { mastracode: '^1.0.0' } }));

    ensureMastraCodePackageLink(pluginRoot);

    expect(fs.existsSync(path.join(pluginRoot, 'node_modules', 'mastracode'))).toBe(false);
  });
});
