import { types as t } from '@babel/core';
import type { PluginObject } from '@babel/core';

export function checkConfigExport(result: { hasValidConfig: boolean; projectType?: string }): PluginObject {
  // Track which local variable names are assigned to `new Mastra()`
  const mastraVars = new Set<string>();
  // Track local bindings imported as the named `MastraFactory` export (including aliases).
  // Detection is based on the imported name, not the module source, so it works with
  // both relative imports and a future package export.
  const factoryBindings = new Set<string>();

  return {
    visitor: {
      ImportDeclaration(path) {
        for (const spec of path.node.specifiers) {
          if (
            t.isImportSpecifier(spec) &&
            t.isIdentifier(spec.imported, { name: 'MastraFactory' }) &&
            t.isIdentifier(spec.local)
          ) {
            factoryBindings.add(spec.local.name);
          }
        }
      },
      NewExpression(path) {
        // Detect `new MastraFactory(...)` using the tracked import binding.
        if (t.isIdentifier(path.node.callee) && factoryBindings.has(path.node.callee.name)) {
          result.projectType = 'software-factory';
        }
      },
      ExportNamedDeclaration(path) {
        const decl = path.node.declaration;
        // 1) export const mastra = new Mastra(...)
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
        /**
         * 2) export { foo as mastra }
         * 3) export { mastra }
         * 4) export { mastra, foo }
         */
        if (Array.isArray(path.node.specifiers)) {
          for (const spec of path.node.specifiers) {
            if (
              t.isExportSpecifier(spec) &&
              t.isIdentifier(spec.exported, { name: 'mastra' }) &&
              t.isIdentifier(spec.local) &&
              mastraVars.has(spec.local.name)
            ) {
              result.hasValidConfig = true;
            }
          }
        }
      },
      // For cases 2-4 we need to track whether those variables are assigned to `new Mastra()`
      VariableDeclaration(path) {
        for (const decl of path.node.declarations) {
          if (
            t.isIdentifier(decl.id) &&
            t.isNewExpression(decl.init) &&
            t.isIdentifier(decl.init.callee, { name: 'Mastra' })
          ) {
            mastraVars.add(decl.id.name);
          }
        }
      },
    },
  };
}
