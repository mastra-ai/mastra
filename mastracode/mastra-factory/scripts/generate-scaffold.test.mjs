import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { dependencyVersionSpec, generateScaffold } from './generate-scaffold.mjs';

const tempDirectories = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture({ createFactoryVersion = '1.0.0', coreVersion = '2.0.0', mastraVersion = '3.0.0' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-scaffold-generator-'));
  tempDirectories.push(root);
  const packageRoot = path.join(root, 'mastracode/mastra-factory');
  const webRoot = path.join(root, 'mastracode/web');
  const outputDir = path.join(packageRoot, 'generated/scaffold');

  writeJson(path.join(packageRoot, 'package.json'), { name: 'create-factory', version: createFactoryVersion });
  fs.mkdirSync(path.join(packageRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'scripts/scaffold-readme.md'), '# Factory\n');
  writeJson(path.join(webRoot, 'package.json'), {
    dependencies: {
      '@mastra/core': 'link:../../packages/core',
      zod: '^4.3.6',
    },
    devDependencies: {
      '@types/node': '22.20.1',
      mastra: 'link:../../packages/cli',
      varlock: '^1.9.0',
    },
    engines: { node: '>=22.19.0' },
  });
  fs.mkdirSync(path.join(webRoot, 'src/mastra'), { recursive: true });
  fs.writeFileSync(
    path.join(webRoot, 'src/mastra/index.ts'),
    "import { Mastra } from '@mastra/core/mastra';\nexport { Mastra };\n",
  );
  fs.writeFileSync(path.join(webRoot, '.env.schema'), '# header\n# ---\n# Section\nFOO=\n');
  fs.writeFileSync(path.join(webRoot, 'docker-compose.yml'), 'services: {}\n');
  writeJson(path.join(root, 'packages/core/package.json'), { name: '@mastra/core', version: coreVersion });
  writeJson(path.join(root, 'packages/cli/package.json'), { name: 'mastra', version: mastraVersion });
  writeJson(path.join(root, 'packages/memory/package.json'), { name: '@mastra/memory', version: coreVersion });

  return { root, packageRoot, webRoot, outputDir };
}

function snapshotDirectory(directory) {
  const snapshot = {};
  function walk(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const entryRelative = path.join(relative, entry.name);
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(entryPath, entryRelative);
      else snapshot[entryRelative] = fs.readFileSync(entryPath, 'utf8');
    }
  }
  walk(directory);
  return snapshot;
}

describe('generateScaffold', () => {
  it('copies authoritative source files byte-for-byte and generates deterministic metadata', () => {
    const fixture = createFixture();
    generateScaffold(fixture);
    const first = snapshotDirectory(fixture.outputDir);
    generateScaffold(fixture);
    const second = snapshotDirectory(fixture.outputDir);

    expect(second).toEqual(first);
    for (const relativePath of ['src/mastra/index.ts', '.env.schema', 'docker-compose.yml']) {
      expect(fs.readFileSync(path.join(fixture.outputDir, relativePath))).toEqual(
        fs.readFileSync(path.join(fixture.webRoot, relativePath)),
      );
    }
    const manifest = JSON.parse(first['package.json']);
    expect(manifest.dependencies).toMatchObject({
      '@mastra/core': '^2.0.0',
      '@mastra/memory': '^2.0.0',
      zod: '^4.3.6',
    });
    expect(manifest.devDependencies.mastra).toBe('^3.0.0');
    expect(first['.env.example']).toContain('# FOO=');
    expect(first.npmrc).toBeUndefined();
  });

  it('uses exact matching-channel versions for prerelease packages', () => {
    const fixture = createFixture({
      createFactoryVersion: '1.0.0-alpha.4',
      coreVersion: '2.0.0-alpha.2',
      mastraVersion: '3.0.0-alpha.9',
    });
    const { manifest } = generateScaffold(fixture);
    expect(manifest.dependencies['@mastra/core']).toBe('2.0.0-alpha.2');
    expect(manifest.dependencies['@mastra/memory']).toBe('2.0.0-alpha.2');
    expect(manifest.devDependencies.mastra).toBe('3.0.0-alpha.9');
    expect(fs.readFileSync(path.join(fixture.outputDir, 'npmrc'), 'utf8')).toBe('legacy-peer-deps=true\n');
  });

  it('rejects prerelease dependencies in a stable create-factory release', () => {
    expect(() => dependencyVersionSpec('@mastra/core', '2.0.0-alpha.1', '1.0.0')).toThrow(
      'stable create-factory@1.0.0 cannot include prerelease @mastra/core@2.0.0-alpha.1',
    );
  });

  it('rejects mismatched prerelease channels', () => {
    expect(() => dependencyVersionSpec('@mastra/core', '2.0.0-beta.1', '1.0.0-alpha.1')).toThrow(
      'prerelease channel mismatch',
    );
  });

  it('fails loudly when an authoritative input is missing', () => {
    const fixture = createFixture();
    fs.rmSync(path.join(fixture.webRoot, 'docker-compose.yml'));
    expect(() => generateScaffold(fixture)).toThrow('missing source file');
  });

  it('fails when the source adds an unmapped package import', () => {
    const fixture = createFixture();
    fs.appendFileSync(path.join(fixture.webRoot, 'src/mastra/index.ts'), "import 'unexpected-package';\n");
    expect(() => generateScaffold(fixture)).toThrow('unmapped package import unexpected-package');
  });
});
