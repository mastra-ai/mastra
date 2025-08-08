import type { PluginObj } from '@babel/core';
import babel from '@babel/core';

export function checkConfigExport(result: { hasValidConfig: boolean }): PluginObj {
  const t = babel.types;

  return {
    visitor: {
      // export const mastra = new Mastra()
      ExportNamedDeclaration(path) {
        const decl = path.node.declaration;

        if (t.isVariableDeclaration(decl)) {
          const varDecl = decl.declarations[0];

          if (
            t.isIdentifier(varDecl?.id, { name: 'mastra' }) &&
            t.isNewExpression(varDecl.init) &&
            t.isIdentifier(varDecl.init.callee, { name: 'Mastra' })
          ) {
            result.hasValidConfig = true;
          }
        }
      },
    },
  };
}
