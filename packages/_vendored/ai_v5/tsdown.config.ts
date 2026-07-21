import { fileURLToPath } from 'node:url';
import { embedTypes } from '@internal/types-builder/embed-types';
import type { ExportDeclaration } from 'ts-morph';
import { Project, Node, SyntaxKind } from 'ts-morph';
import { defineConfig } from 'tsdown';

const vercelOidcStubPath = fileURLToPath(new URL('../oidc-stub.ts', import.meta.url));

async function fixExportBugInDtsFile(dtsFile: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(dtsFile);

  let fixCount = 0;
  for (const mod of sourceFile.getModules()) {
    const body = mod.getBody();
    if (!body || !Node.isModuleBlock(body)) {
      continue;
    }

    // Get the syntax list containing statements
    const syntaxList = body.getChildSyntaxList();
    if (!syntaxList) {
      continue;
    }

    const moduleName = mod.getName();
    const declarations: ExportDeclaration[] = [];
    for (const child of syntaxList.getChildren()) {
      if (child.getKind() === SyntaxKind.Block) {
        const text = child.getText().trim();

        // Pattern: starts with { and contains "identifier as identifier"
        const startsWithBrace = text.startsWith('{');
        const endsWithBrace = text.endsWith('};') || text.endsWith('}');

        if (startsWithBrace && endsWithBrace) {
          const tmpProject = new Project();
          const tmpFile = tmpProject.createSourceFile('tmp.dts', `export ${text}`);

          declarations.push(...tmpFile.getExportDeclarations());
          fixCount++;
        }
      }
    }

    if (declarations.length) {
      mod.remove();
      const newModule = sourceFile.addModule({
        name: moduleName,
        isExported: true,
      });

      declarations.forEach(declaration => {
        const exports = declaration.getNamedExports().map(specifier => {
          return {
            name: specifier.getName(),
            alias: specifier.getAliasNode()?.getText(),
          };
        });

        newModule.addExportDeclaration({
          namedExports: exports,
        });
      });
    }
  }

  const uniqueSymbols = sourceFile
    .getVariableDeclarations()
    .filter(decl => decl.getTypeNode()?.getText() === 'unique symbol')
    .map(decl => decl.getName());

  // Export them all
  if (uniqueSymbols.length > 0) {
    sourceFile.addExportDeclaration({
      namedExports: uniqueSymbols,
    });
    fixCount++;
  }

  if (fixCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`Fixed ${fixCount} broken namespace export(s)`);
    await sourceFile.save();
  }
}

export default defineConfig({
  entry: ['src/index.ts', 'src/internal.ts', 'src/test.ts'],
  format: ['esm'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  target: 'node22',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    neverBundle: ['msw', 'msw/node', 'vitest'],
  },
  alias: {
    '@vercel/oidc': vercelOidcStubPath,
  },
  onSuccess: async () => {
    const { copyAIDtsFiles } = await import(new URL('./scripts/copy-ai-dts-files.ts', import.meta.url).href);
    const dtsFiles = await copyAIDtsFiles();

    for (const dtsFile of dtsFiles) {
      await embedTypes(
        dtsFile,
        process.cwd(),
        new Set([
          'ai',
          '@ai-sdk/*',
          '@opentelemetry/api',
          '@standard-schema/spec',
          '@types/json-schema',
          'eventsource-parser',
        ]),
      );

      await fixExportBugInDtsFile(dtsFile);
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
