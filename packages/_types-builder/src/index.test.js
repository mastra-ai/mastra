import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { generateTypes } from './index.js';

const tscBin = join(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin', 'tsc');

async function writeFiles(root, files) {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), typeof content === 'string' ? content : JSON.stringify(content));
  }
}

describe('generateTypes', () => {
  let root;

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // Both versions of `dep` used to be copied to `dist/_types/dep`, so one overwrote the other, and the alias copy
  // was skipped while imports still pointed at it. Consumers silently got `any` under skipLibCheck. (#28732)
  it('keeps each bundled version and npm alias resolvable for consumers', async () => {
    root = await mkdtemp(join(tmpdir(), 'types-builder-'));
    await writeFiles(root, {
      'package.json': { name: 'fixture', version: '1.0.0', type: 'module' },
      'tsconfig.build.json': {
        compilerOptions: {
          module: 'nodenext',
          moduleResolution: 'nodenext',
          declaration: true,
          emitDeclarationOnly: true,
          outDir: 'dist',
          rootDir: 'src',
          types: [],
        },
        include: ['src'],
      },
      'src/index.ts': [
        "import type { V1 } from 'dep';",
        "import type { O } from 'other';",
        "import type { V2 } from 'dep-v2';",
        'export type All = [V1, O, V2];',
      ].join('\n'),
      'store/dep@1/node_modules/dep/package.json': { name: 'dep', version: '1.0.0', types: 'dist/index.d.ts' },
      'store/dep@1/node_modules/dep/dist/index.d.ts': 'export type V1 = 1;',
      'store/dep@2/node_modules/dep/package.json': { name: 'dep', version: '2.0.0', types: 'dist/index.d.ts' },
      'store/dep@2/node_modules/dep/dist/index.d.ts': 'export type V2 = 2;',
      'store/other@1/node_modules/other/package.json': { name: 'other', version: '1.0.0', types: 'dist/index.d.ts' },
      'store/other@1/node_modules/other/dist/index.d.ts': "import type { V2 } from 'dep';\nexport type O = V2;",
      'consumer/tsconfig.json': {
        compilerOptions: { module: 'nodenext', strict: true, noEmit: true, skipLibCheck: true, types: [] },
        files: ['check.ts'],
      },
      'consumer/check.ts': [
        "import type { All } from '../dist/index.js';",
        'export const ok: All = [1, 2, 2];',
        '// @ts-expect-error',
        'export const wrongV1: All = [2, 2, 2];',
        '// @ts-expect-error',
        'export const wrongNested: All = [1, 1, 2];',
        '// @ts-expect-error',
        'export const wrongAlias: All = [1, 2, 1];',
      ].join('\n'),
    });
    // pnpm layout: `other` sees dep@2 as a sibling, and the npm alias `"dep-v2": "npm:dep@2.0.0"` links to that
    // same directory.
    for (const [target, link] of [
      ['store/dep@1/node_modules/dep', 'node_modules/dep'],
      ['store/other@1/node_modules/other', 'node_modules/other'],
      ['store/dep@2/node_modules/dep', 'node_modules/dep-v2'],
      ['store/dep@2/node_modules/dep', 'store/other@1/node_modules/dep'],
    ]) {
      await mkdir(dirname(join(root, link)), { recursive: true });
      await symlink(join(root, target), join(root, link), 'dir');
    }

    await generateTypes(root, new Set(['dep', 'other', 'dep-v2']));

    const result = await promisify(execFile)(process.execPath, [tscBin, '-p', 'consumer/tsconfig.json'], {
      cwd: root,
    }).catch(error => error);
    expect(result.stdout).toBe('');
  }, 60_000);
});
