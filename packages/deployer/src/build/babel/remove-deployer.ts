import babel from '@babel/core';

export function removeDeployer() {
  const t = babel.types;

  // Helper to remove deployer property from an object and clean up its binding
  function removeDeployerFromObject(
    objectExpr: babel.types.ObjectExpression,
    scope: { getBinding: (name: string) => { path?: babel.NodePath } | undefined },
  ): babel.types.ObjectProperty | undefined {
    const deployerProp = objectExpr.properties.find(
      prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'deployer',
    ) as babel.types.ObjectProperty | undefined;

    if (deployerProp) {
      objectExpr.properties = objectExpr.properties.filter(prop => prop !== deployerProp);

      // Clean up the deployer binding if it's a reference
      if (t.isIdentifier(deployerProp.value)) {
        const deployerBinding = scope.getBinding(deployerProp.value.name);
        if (deployerBinding) {
          deployerBinding.path?.parentPath?.remove();
        }
      }
    }

    return deployerProp;
  }

  return {
    name: 'remove-deployer',
    visitor: {
      NewExpression(path, state) {
        // is a variable declaration
        const varDeclaratorPath = path.findParent(path => t.isVariableDeclarator(path.node));
        if (!varDeclaratorPath) {
          return;
        }

        const parentNode = path.parentPath.node;
        // check if it's a const of mastra
        if (!t.isVariableDeclarator(parentNode) || !t.isIdentifier(parentNode.id) || parentNode.id.name !== 'mastra') {
          return;
        }

        if (!state.hasReplaced) {
          state.hasReplaced = true;
          const newMastraObj = t.cloneNode(path.node);
          if (t.isObjectExpression(newMastraObj.arguments[0]) && newMastraObj.arguments[0].properties?.length) {
            const objectArg = newMastraObj.arguments[0];
            let foundDeployer = false;

            // First, check for direct deployer property
            const directDeployer = removeDeployerFromObject(objectArg, state.file.scope);
            if (directDeployer) {
              foundDeployer = true;
            }

            // Then, check spread elements for deployer properties
            for (const prop of objectArg.properties) {
              if (t.isSpreadElement(prop) && t.isIdentifier(prop.argument)) {
                const spreadBinding = state.file.scope.getBinding(prop.argument.name);
                if (spreadBinding && t.isVariableDeclarator(spreadBinding.path.node)) {
                  const init = spreadBinding.path.node.init;
                  if (t.isObjectExpression(init)) {
                    const spreadDeployer = removeDeployerFromObject(init, state.file.scope);
                    if (spreadDeployer) {
                      foundDeployer = true;
                    }
                  }
                }
              }
            }

            if (foundDeployer) {
              path.replaceWith(newMastraObj);
            }
          }
        }
      },
    },
  } as babel.PluginObj;
}
