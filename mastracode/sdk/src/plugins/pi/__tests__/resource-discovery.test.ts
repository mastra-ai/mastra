import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { inspectPiPackageManifest } from '../package-manifest.js';
import { discoverPiPackageResources } from '../resource-discovery.js';

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function makePackage(manifest: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-resources-'));
  tempDir = root;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', ...manifest }));
  return root;
}

function write(root: string, relativePath: string, content = ''): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

describe('discoverPiPackageResources', () => {
  it('discovers explicit manifest resources with globs, exclusions, and deterministic dedupe', () => {
    const root = makePackage({
      pi: {
        extensions: ['./extensions', './extensions/**/*.ts', '!./extensions/private/**'],
        skills: ['./skills'],
        prompts: ['./prompts/*.md'],
        themes: ['./themes/*.json'],
      },
    });
    write(root, 'extensions/index.ts');
    write(root, 'extensions/nested/tool.ts');
    write(root, 'extensions/private/hidden.ts');
    write(root, 'skills/one/SKILL.md');
    write(root, 'skills/ignored.txt');
    write(root, 'prompts/review.md');
    write(root, 'themes/dark.json');

    expect(discoverPiPackageResources(inspectPiPackageManifest(root))).toEqual({
      extensions: ['extensions/index.ts', 'extensions/nested/tool.ts'],
      skills: ['skills/one/SKILL.md'],
      prompts: ['prompts/review.md'],
      themes: ['themes/dark.json'],
    });
  });

  it('uses conventional resource directories only when package.json#pi is absent', () => {
    const root = makePackage({});
    write(root, 'extensions/index.js');
    write(root, 'skills/one/SKILL.md');
    write(root, 'skills/top-level.md');
    write(root, 'prompts/plan.md');
    write(root, 'themes/light.json');

    expect(discoverPiPackageResources(inspectPiPackageManifest(root))).toEqual({
      extensions: ['extensions/index.js'],
      skills: ['skills/one/SKILL.md', 'skills/top-level.md'],
      prompts: ['prompts/plan.md'],
      themes: ['themes/light.json'],
    });
  });

  it('rejects manifest escapes and resource symlinks', () => {
    const root = makePackage({ pi: { extensions: ['../outside.ts'] } });
    expect(() => discoverPiPackageResources(inspectPiPackageManifest(root))).toThrow('must stay inside');

    fs.writeFileSync(path.join(root, 'target.ts'), 'export default {}');
    fs.mkdirSync(path.join(root, 'extensions'));
    fs.symlinkSync(path.join(root, 'target.ts'), path.join(root, 'extensions/link.ts'));
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'fixture', pi: { extensions: ['./extensions'] } }),
    );
    expect(() => discoverPiPackageResources(inspectPiPackageManifest(root))).toThrow('cannot be a symlink');
  });
});
