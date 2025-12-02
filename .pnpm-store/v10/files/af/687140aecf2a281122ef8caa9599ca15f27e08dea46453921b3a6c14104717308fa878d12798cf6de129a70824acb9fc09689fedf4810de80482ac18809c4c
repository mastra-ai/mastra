/*eslint no-loop-func: 0, no-use-before-define: 0*/
import resolveToValue from './resolveToValue.js';
/**
 * Splits a MemberExpression or CallExpression into parts.
 * E.g. foo.bar.baz becomes ['foo', 'bar', 'baz']
 */
function toArray(path) {
    const parts = [path];
    let result = [];
    while (parts.length > 0) {
        path = parts.shift();
        if (path.isCallExpression()) {
            parts.push(path.get('callee'));
            continue;
        }
        else if (path.isMemberExpression()) {
            parts.push(path.get('object'));
            const property = path.get('property');
            if (path.node.computed) {
                const resolvedPath = resolveToValue(property);
                if (resolvedPath !== undefined) {
                    result = result.concat(toArray(resolvedPath));
                }
                else {
                    result.push('<computed>');
                }
            }
            else if (property.isIdentifier()) {
                result.push(property.node.name);
            }
            else if (property.isPrivateName()) {
                // new test
                result.push(`#${property.get('id').node.name}`);
            }
            continue;
        }
        else if (path.isIdentifier()) {
            result.push(path.node.name);
            continue;
        }
        else if (path.isTSAsExpression()) {
            const expression = path.get('expression');
            if (expression.isIdentifier()) {
                result.push(expression.node.name);
            }
            continue;
        }
        else if (path.isLiteral() && path.node.extra?.raw) {
            result.push(path.node.extra.raw);
            continue;
        }
        else if (path.isThisExpression()) {
            result.push('this');
            continue;
        }
        else if (path.isObjectExpression()) {
            const properties = path.get('properties').map(function (property) {
                if (property.isSpreadElement()) {
                    return `...${toString(property.get('argument'))}`;
                }
                else if (property.isObjectProperty()) {
                    return (toString(property.get('key')) +
                        ': ' +
                        toString(property.get('value')));
                }
                else if (property.isObjectMethod()) {
                    return toString(property.get('key')) + ': <function>';
                }
                else {
                    throw new Error('Unrecognized object property type');
                }
            });
            result.push('{' + properties.join(', ') + '}');
            continue;
        }
        else if (path.isArrayExpression()) {
            result.push('[' +
                path
                    .get('elements')
                    .map(function (el) {
                    return toString(el);
                })
                    .join(', ') +
                ']');
            continue;
        }
    }
    return result.reverse();
}
/**
 * Creates a string representation of a member expression.
 */
function toString(path) {
    return toArray(path).join('.');
}
export { toString as String, toArray as Array };
