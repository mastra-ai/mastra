import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Project } from 'ts-morph';
import { afterEach, describe, expect, it } from 'vitest';
import { replaceTypes, stripNominalBrands } from './replace-types.js';

describe('stripNominalBrands', () => {
  function strip(code) {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('index.d.ts', code);
    stripNominalBrands(sourceFile);
    return sourceFile.getFullText();
  }

  it('removes #private, private and protected members but keeps the public surface', () => {
    const output = strip(
      [
        'export declare class FixtureBase {',
        '    #private;',
        '    protected logger: string;',
        '    private secret;',
        '    name?: string;',
        '    protected registerOptions(opts?: unknown): void;',
        '    private static registry;',
        '    protected get computed(): string;',
        '    getName(): string | undefined;',
        '}',
      ].join('\n'),
    );

    expect(output).not.toContain('#private');
    expect(output).not.toContain('protected');
    expect(output).not.toContain('private');
    expect(output).toContain('name?: string;');
    expect(output).toContain('getName(): string | undefined;');
  });

  it('keeps constructors regardless of visibility', () => {
    const output = strip(
      ['export declare class WithCtor {', '    protected constructor(name: string);', '    name: string;', '}'].join(
        '\n',
      ),
    );

    expect(output).toContain('protected constructor(name: string);');
    expect(output).toContain('name: string;');
  });

  it('leaves interfaces and type aliases untouched', () => {
    const code = [
      'export interface IProvider {',
      '    name?: string;',
      '    authenticate(token: string): Promise<unknown>;',
      '}',
      'export type ProviderName = string;',
    ].join('\n');

    expect(strip(code)).toBe(code);
  });
});

describe('replaceTypes emits brand-free copies of bundled declarations', () => {
  let tmpRoot;

  afterEach(async () => {
    if (tmpRoot) {
      await rm(tmpRoot, { recursive: true, force: true });
      tmpRoot = undefined;
    }
  });

  it('strips nominal brands from the copied declaration graph', async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'types-builder-test-'));

    // Fake bundled package installed in node_modules.
    const fixtureRoot = join(tmpRoot, 'node_modules', '@internal', 'fixture');
    await mkdir(join(fixtureRoot, 'dist'), { recursive: true });
    await writeFile(
      join(fixtureRoot, 'package.json'),
      JSON.stringify({
        name: '@internal/fixture',
        version: '0.0.0',
        types: './dist/index.d.ts',
        main: './dist/index.js',
        exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
      }),
    );
    await writeFile(join(fixtureRoot, 'dist', 'index.js'), 'export class FixtureBase {}');
    await writeFile(
      join(fixtureRoot, 'dist', 'index.d.ts'),
      [
        'export declare class FixtureBase {',
        '    #private;',
        '    protected logger: string;',
        '    name?: string;',
        '    getName(): string | undefined;',
        '}',
      ].join('\n'),
    );

    // Consumer package whose declaration imports the bundled package.
    const pkgRoot = join(tmpRoot, 'pkg');
    await mkdir(join(pkgRoot, 'dist'), { recursive: true });
    const entryFile = join(pkgRoot, 'dist', 'index.d.ts');
    await writeFile(
      entryFile,
      [
        "import { FixtureBase } from '@internal/fixture';",
        'export declare class MyProvider extends FixtureBase {',
        '}',
      ].join('\n'),
    );

    await replaceTypes(entryFile, pkgRoot, new Set(['@internal/fixture']));

    const copiedPath = join(pkgRoot, 'dist', '_types', '@internal_fixture', 'dist', 'index.d.ts');
    const copied = await readFile(copiedPath, 'utf8');

    expect(copied).not.toContain('#private');
    expect(copied).not.toContain('protected');
    expect(copied).toContain('name?: string;');
    expect(copied).toContain('getName(): string | undefined;');

    // Entry file now points at the local copy instead of the bundled package.
    const rewrittenEntry = await readFile(entryFile, 'utf8');
    expect(rewrittenEntry).not.toContain("'@internal/fixture'");
    expect(rewrittenEntry).toContain('./_types/@internal_fixture/dist/index.d.ts');
  });
});
