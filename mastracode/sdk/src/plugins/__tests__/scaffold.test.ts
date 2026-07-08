import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { formatScaffoldSuccess, resolveScaffoldTarget, scaffoldPlugin } from '../scaffold.js';

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe('scaffoldPlugin', () => {
  it('resolves bare plugin names under project plugin local sources', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-scaffold-'));

    expect(resolveScaffoldTarget('my-plugin', { projectRoot: tempDir })).toBe(
      path.join(tempDir, '.mastracode', 'plugins', 'sources', 'local', 'my-plugin'),
    );
    expect(resolveScaffoldTarget('./my-plugin', { projectRoot: tempDir })).toBe(path.join(tempDir, 'my-plugin'));
    expect(resolveScaffoldTarget('plugins/my-plugin', { projectRoot: tempDir })).toBe(
      path.join(tempDir, 'plugins', 'my-plugin'),
    );
  });

  it('creates a TypeScript-only ESM plugin scaffold', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-scaffold-'));
    const target = path.join(tempDir, 'my-plugin');

    const createdDir = scaffoldPlugin(target, { id: 'acme.foo', name: 'Foo Tools' });

    expect(createdDir).toBe(target);

    expect(JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf-8'))).toMatchObject({
      name: 'my-plugin',
      type: 'module',
      exports: './src/index.ts',
      peerDependencies: { mastracode: '*' },
    });
    expect(JSON.parse(fs.readFileSync(path.join(target, 'tsconfig.json'), 'utf-8')).compilerOptions).toMatchObject({
      verbatimModuleSyntax: true,
      erasableSyntaxOnly: true,
    });
    const indexSource = fs.readFileSync(path.join(target, 'src/index.ts'), 'utf-8');
    expect(indexSource).toContain("import { createTool, defineMastraCodePlugin, z } from 'mastracode/plugin';");
    expect(indexSource).toContain('execute: async context =>');
    expect(indexSource).toContain('id: "acme.foo"');
    expect(JSON.parse(fs.readFileSync(path.join(target, '.mastracode-plugin.json'), 'utf-8'))).toEqual({
      plugins: [{ id: 'acme.foo', name: 'Foo Tools', entry: 'src/index.ts' }],
    });
    expect(fs.existsSync(path.join(target, 'node_modules', 'mastracode'))).toBe(true);
  });

  it('scaffolds bare plugin names into project plugin local sources', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-scaffold-'));

    const createdDir = scaffoldPlugin('my-plugin', { projectRoot: tempDir });

    expect(createdDir).toBe(path.join(tempDir, '.mastracode', 'plugins', 'sources', 'local', 'my-plugin'));
    expect(JSON.parse(fs.readFileSync(path.join(createdDir, 'package.json'), 'utf-8'))).toMatchObject({
      name: 'my-plugin',
    });
    expect(JSON.parse(fs.readFileSync(path.join(tempDir, '.mastracode-plugin.json'), 'utf-8'))).toEqual({
      plugins: [
        {
          id: 'my-plugin',
          name: 'My Plugin',
          entry: '.mastracode/plugins/sources/local/my-plugin/src/index.ts',
        },
      ],
    });
  });

  it('refuses to overwrite non-empty directories', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-scaffold-'));
    tempDir = dir;
    fs.writeFileSync(path.join(dir, 'existing.txt'), 'content');

    expect(() => scaffoldPlugin(dir)).toThrow('Directory already exists and is not empty');
  });

  it('prints next steps', () => {
    expect(formatScaffoldSuccess('/tmp/plugin')).toContain('/plugins');
  });
});
