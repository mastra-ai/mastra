import babel from '@babel/core';

export function removeNonReferencedNodes() {
  const t = babel.types;

  return {
    name: 'remove-non-referenced-nodes',
    visitor: {
      Program(path) {
        // Get the scope information
        const scope = path.scope;

        // Filter body to keep only referenced nodes
        const currentBody = path.get('body');
        const filteredBody = currentBody.filter(childPath => {
          if (childPath.isExportDeclaration()) {
            return true;
          }

          // For variable declarations, check if any declared variables are referenced
          if (childPath.isVariableDeclaration()) {
            return childPath.node.declarations.some(decl => {
              if (!t.isIdentifier(decl.id)) {
                return false;
              }

              const name = decl.id.name;
              const binding = scope.getBinding(name);
              // Keep if it has references or is exported
              return binding && (binding.referenced || binding.referencePaths.length > 0);
            });
          }

          // For function/class declarations, check if they're referenced
          if (childPath.isFunctionDeclaration() || childPath.isClassDeclaration()) {
            if (!t.isIdentifier(childPath.node.id)) {
              return false;
            }

            const name = childPath.node.id.name;
            const binding = scope.getBinding(name);
            return binding && (binding.referenced || binding.referencePaths.length > 0);
          }

          // For imports, check if any imported items are referenced
          if (childPath.isImportDeclaration()) {
            return childPath.node.specifiers.some(specifier => {
              const importedName = specifier.local.name;
              const binding = scope.getBinding(importedName);
              return binding && (binding.referenced || binding.referencePaths.length > 0);
            });
          }

          // Default to keeping other node types
          return false;
        });

        // Replace the program body with filtered nodes
        path.set(
          'body',
          filteredBody.map(p => p.node),
        );
      },
    },
  } as babel.PluginObj;
}
