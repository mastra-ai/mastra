import babel from '@babel/core';

export function removeDeployer() {
  const t = babel.types;

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
          if (t.isObjectExpression(newMastraObj.arguments[0]) && newMastraObj.arguments[0].properties?.[0]) {
            const deployer = newMastraObj.arguments[0].properties.find(
              prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'deployer',
            );

            if (!deployer) {
              return;
            }

            newMastraObj.arguments[0].properties = newMastraObj.arguments[0].properties.filter(
              prop => prop !== deployer,
            );

            // try to find the binding of the deployer which should be the reference to the deployer
            if (t.isObjectProperty(deployer) && t.isIdentifier(deployer.value)) {
              const deployerBinding = state.file.scope.getBinding(deployer.value.name);

              if (deployerBinding) {
                deployerBinding?.path?.parentPath?.remove();
              }
            }

            path.replaceWith(newMastraObj);
          }
        }
      },
    },
  } as babel.PluginObj;
}
