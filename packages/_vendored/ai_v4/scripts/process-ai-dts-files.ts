import { embedTypes } from '@internal/types-builder/embed-types';
import { Project, Node, SyntaxKind } from 'ts-morph';
import type { ExportDeclaration } from 'ts-morph';
import { copyAIDtsFiles } from './copy-ai-dts-files.ts';

async function fixExportBugInDtsFile(dtsFile: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(dtsFile);

  let fixCount = 0;
  for (const mod of sourceFile.getModules()) {
    const body = mod.getBody();
    if (!body || !Node.isModuleBlock(body)) {
      continue;
    }

    const syntaxList = body.getChildSyntaxList();
    if (!syntaxList) {
      continue;
    }

    const moduleName = mod.getName();
    const declarations: ExportDeclaration[] = [];
    for (const child of syntaxList.getChildren()) {
      if (child.getKind() === SyntaxKind.Block) {
        const text = child.getText().trim();
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

export async function processAIDtsFiles() {
  const dtsFiles = await copyAIDtsFiles();

  for (const dtsFile of dtsFiles) {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(dtsFile);

    const uniqueSymbols = sourceFile
      .getVariableDeclarations()
      .filter(decl => decl.getTypeNode()?.getText() === 'unique symbol')
      .map(decl => decl.getName());

    if (uniqueSymbols.length > 0) {
      sourceFile.addExportDeclaration({
        namedExports: uniqueSymbols,
      });

      await sourceFile.save();
    }

    await embedTypes(dtsFile, process.cwd(), new Set(['@ai-sdk/*', '@opentelemetry/api', '@types/json-schema']));
    await fixExportBugInDtsFile(dtsFile);
  }
}
