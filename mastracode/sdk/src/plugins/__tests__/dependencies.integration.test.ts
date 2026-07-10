import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const runIntegration = process.env.MC_PLUGIN_COREPACK_INTEGRATION === '1';
const originalCorepackHome = process.env.COREPACK_HOME;
const tempDirs: string[] = [];

afterEach(() => {
  if (originalCorepackHome === undefined) delete process.env.COREPACK_HOME;
  else process.env.COREPACK_HOME = originalCorepackHome;
  for (const tempDir of tempDirs.splice(0)) fs.rmSync(tempDir, { recursive: true, force: true });
  vi.resetModules();
});

function makeInstallFixture(version: string): { pluginRoot: string; corepackHome: string; scriptSentinel: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `mc-corepack-pnpm-${version}-`));
  tempDirs.push(root);
  const pluginRoot = path.join(root, 'plugin');
  const dependencyRoot = path.join(root, 'dependency');
  const corepackHome = path.join(root, 'corepack-home');
  const scriptSentinel = path.join(root, 'lifecycle-script-ran');
  fs.mkdirSync(pluginRoot);
  fs.mkdirSync(dependencyRoot);
  fs.mkdirSync(corepackHome);
  fs.writeFileSync(
    path.join(dependencyRoot, 'package.json'),
    JSON.stringify({
      name: 'local-plugin-dependency',
      version: '1.0.0',
      scripts: { install: `node -e "require('node:fs').writeFileSync('${scriptSentinel}', 'ran')"` },
    }),
  );
  fs.writeFileSync(path.join(dependencyRoot, 'index.js'), 'module.exports = "installed";\n');
  fs.writeFileSync(
    path.join(pluginRoot, 'package.json'),
    JSON.stringify({
      name: 'corepack-plugin-fixture',
      version: '1.0.0',
      packageManager: `pnpm@${version}`,
      dependencies: { 'local-plugin-dependency': 'file:../dependency' },
    }),
  );
  return { pluginRoot, corepackHome, scriptSentinel };
}

describe.runIf(runIntegration)('global Corepack plugin installs', () => {
  it.each(['10.24.0', '11.8.0'])(
    'installs with pnpm %s and disables lifecycle scripts',
    async version => {
      const { pluginRoot, corepackHome, scriptSentinel } = makeInstallFixture(version);
      expect(fs.readdirSync(corepackHome)).toEqual([]);
      process.env.COREPACK_HOME = corepackHome;
      vi.resetModules();
      const { installPluginDependencies } = await import('../dependencies.js');
      const output: string[] = [];

      try {
        await installPluginDependencies(pluginRoot, pluginRoot, {
          onOutput: chunk => output.push(chunk.toString()),
        });
      } catch (error) {
        throw new Error(
          `Global Corepack failed to acquire pnpm ${version} or pnpm failed to install the fixture. Output:\n${output.join('')}`,
          { cause: error },
        );
      }

      expect(fs.existsSync(path.join(pluginRoot, 'node_modules/local-plugin-dependency/package.json'))).toBe(true);
      expect(fs.existsSync(scriptSentinel)).toBe(false);
    },
    120_000,
  );
});
