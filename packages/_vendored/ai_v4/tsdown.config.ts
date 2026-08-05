import { embedTypes } from '@internal/types-builder/embed-types';
import { Project, Node, SyntaxKind } from 'ts-morph';
import type { ExportDeclaration } from 'ts-morph';
import { defineConfig } from 'tsdown';

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
    .filter(decl => decl.getTypeNode()?.getText() === 'unique symbol' && !decl.isExported)
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

// NOTE: `src/test.ts` is intentionally built separately (tsdown.test.config.ts).
// It pulls in Node-only dependencies (http, createRequire CJS interop, ...). When it
// shared a build with `src/index.ts`, tsdown hoisted an eager
// `createRequire(import.meta.url)` into a shared chunk that @mastra/core's
// browser-consumable entries (e.g. agent/message-list -> @mastra/ai-sdk/ui) load,
// crashing browser bundles. Do not merge `src/test.ts` back into this entry list.
// Regression test: client-sdks/ai-sdk/src/__tests__/browser-bundle.test.ts
//
// Ordering: the test config runs FIRST (and owns `clean: true`) because this
// config's onSuccess (copyAIDtsFiles) only copies a .d.ts for entries whose .js
// already exists in dist/ — dist/test.js must be present or test.d.ts is skipped.
export default defineConfig({
  entry: ['src/index.ts', 'src/mcp-stdio.ts'],
  format: ['esm'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  target: 'node22',
  clean: false,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {},
  onSuccess: async () => {
    const { copyAIDtsFiles } = await import(new URL('./scripts/copy-ai-dts-files.ts', import.meta.url).href);
    const dtsFiles = await copyAIDtsFiles();

    for (const dtsFile of dtsFiles) {
      const project = new Project();
      const sourceFile = project.addSourceFileAtPath(dtsFile);

      const uniqueSymbols = sourceFile
        .getVariableDeclarations()
        .filter(decl => decl.getTypeNode()?.getText() === 'unique symbol')
        .map(decl => decl.getName());

      // Export them all
      if (uniqueSymbols.length > 0) {
        sourceFile.addExportDeclaration({
          namedExports: uniqueSymbols,
        });

        await sourceFile.save();
      }

      await embedTypes(dtsFile, process.cwd(), new Set(['@ai-sdk/*', '@opentelemetry/api', '@types/json-schema']));

      await fixExportBugInDtsFile(dtsFile);
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
