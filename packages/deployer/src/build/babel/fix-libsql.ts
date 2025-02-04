import babel from '@babel/core';
import { addNamed } from '@babel/helper-module-imports';

export function rewriteLibsqlImport() {
  const t = babel.types;
  let hasReplaced = false;

  return {
    name: 'rewrite-libsql-import',
    visitor: {
      FunctionDeclaration(path) {
        if (path.node.id?.name === 'requireNative' && !hasReplaced) {
          hasReplaced = true;
          const createRequire = addNamed(path, 'createRequire', 'module');

          const requireIdentifier = t.identifier('require');
          path.replaceWith(
            t.functionDeclaration(
              t.identifier('requireNative'),
              [],
              t.blockStatement([
                t.variableDeclaration('const', [
                  t.variableDeclarator(
                    requireIdentifier,
                    t.callExpression(createRequire, [
                      t.memberExpression(
                        t.metaProperty(t.identifier('import'), t.identifier('meta')),
                        t.identifier('url'),
                      ),
                    ]),
                  ),
                ]),
                t.returnStatement(t.callExpression(requireIdentifier, [t.stringLiteral('./libsql.node')])),
              ]),
            ),
          );
        }
      },
    },
  } as babel.PluginObj;
}
