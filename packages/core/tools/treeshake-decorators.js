export default function (babel) {
  const { types: t } = babel;

  const collected = new Map();

  return {
    name: 'add-pure-to-decorators',
    visitor: {
      Program: {
        exit(path) {
          const body = path.node.body;
          for (const [key, nodes] of collected.entries()) {
            const lastIndex = body.findIndex(n => n === nodes[nodes.length - 1]);

            if (lastIndex === -1) {
              continue;
            }

            // Create the arrow function first
            const arrowFn = t.parenthesizedExpression(
              t.arrowFunctionExpression(
                [t.identifier('_')],
                t.blockStatement([...nodes.map(node => t.cloneNode(node)), t.returnStatement(t.identifier(key))]),
              ),
            );

            // Add the comment as a CommentBlock
            arrowFn.leadingComments = [
              {
                type: 'CommentBlock',
                value: '@__PURE__',
              },
            ];

            body.splice(
              lastIndex + 1,
              0,
              t.assignmentExpression('=', t.identifier(key), t.callExpression(arrowFn, [t.identifier(key)])),
            );

            body.splice(lastIndex - 2, 3);
          }
        },
      },

      ExpressionStatement(path) {
        const expression = path.node.expression;
        if (
          !t.isAssignmentExpression(expression) ||
          !t.isCallExpression(expression.right) ||
          !t.isIdentifier(expression.right.callee) ||
          expression.right.callee.name !== '__decorateElement'
        ) {
          return;
        }

        const nodeIndex = path.container.findIndex(c => c === path.node);
        const decoratorFns = [];
        for (let i = -1; i < 2; i++) {
          decoratorFns.push(path.container[nodeIndex + i]);
        }

        collected.set(expression.left.name, decoratorFns);
      },
    },
  };
}
