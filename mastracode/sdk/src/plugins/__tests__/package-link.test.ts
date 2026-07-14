import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { ensureMastraCodePackageLink, findMastraCodePackageRoot } from '../package-link.js';

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

  it('replaces a dangling mastracode package link', () => {
    const pluginRoot = makePluginRoot();
    const linkPath = path.join(pluginRoot, 'node_modules', 'mastracode');
    fs.writeFileSync(path.join(pluginRoot, 'package.json'), JSON.stringify({ peerDependencies: { mastracode: '*' } }));
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(path.join(pluginRoot, 'missing-mastracode'), linkPath, 'dir');

    ensureMastraCodePackageLink(pluginRoot);

    expect(fs.realpathSync(linkPath)).toBe(fs.realpathSync(mastracodePackageRoot));
  });

  it('does not link mastracode when the plugin declares a package dependency', () => {
    const pluginRoot = makePluginRoot();
    fs.writeFileSync(path.join(pluginRoot, 'package.json'), JSON.stringify({ dependencies: { mastracode: '^1.0.0' } }));

    ensureMastraCodePackageLink(pluginRoot);

    expect(fs.existsSync(path.join(pluginRoot, 'node_modules', 'mastracode'))).toBe(false);
  });
});
