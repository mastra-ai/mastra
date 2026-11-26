import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const tsc = join(packageDir, 'node_modules/typescript/bin/tsc');

// What the published declarations may take from @mastra/core. Every name here exists in the oldest core
// in the peer range (>=1.82). Adding one means checking that first, or the next release of this package
// breaks typechecking for apps on an older core.
const ALLOWED_CORE_TYPES = new Set([
  'IMastraLogger',
  'Knowledge',
  'KnowledgeConfig',
  'KnowledgePageStore',
  'KnowledgeScopeDeclarations',
  'KnowledgeStorage',
  'MastraCompositeStore',
]);

function emittedDeclaration(): string {
  const out = mkdtempSync(join(tmpdir(), 'platform-knowledge-dts-'));
  try {
    const config = join(out, 'tsconfig.json');
    writeFileSync(
      config,
      JSON.stringify({
        extends: join(packageDir, 'tsconfig.json'),
        compilerOptions: {
          noEmit: false,
          emitDeclarationOnly: true,
          declarationMap: false,
          rootDir: packageDir,
          typeRoots: [join(packageDir, 'node_modules/@types')],
          outDir: join(out, 'dist'),
        },
        files: [join(packageDir, 'src/knowledge/index.ts')],
        include: [],
      }),
    );
    execFileSync(process.execPath, [tsc, '-p', config], { cwd: packageDir, stdio: 'pipe' });
    const files = readdirSync(join(out, 'dist'), { recursive: true, encoding: 'utf8' });
    const declaration = files.find(file => file.replaceAll('\\', '/').endsWith('knowledge/index.d.ts'))!;
    return readFileSync(join(out, 'dist', declaration), 'utf8');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

it('publishes PlatformKnowledge types that take nothing from @mastra/core older cores lack', () => {
  const declaration = emittedDeclaration();
  expect(declaration).toContain('PlatformKnowledgeImporterClass');

  const fromCore = new Set<string>();
  for (const [, names] of declaration.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@mastra\/core[^'"]*['"]/g,
  )) {
    for (const name of names!.split(',')) {
      const imported = name
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]!;
      if (imported) fromCore.add(imported);
    }
  }
  for (const [, name] of declaration.matchAll(/import\(['"]@mastra\/core[^'"]*['"]\)\.(\w+)/g)) fromCore.add(name!);

  expect(fromCore.size).toBeGreaterThan(0);
  expect([...fromCore].filter(name => !ALLOWED_CORE_TYPES.has(name))).toEqual([]);
}, 60_000);
