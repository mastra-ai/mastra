import type { NodePath } from '@babel/traverse';
import type { CallExpression } from '@babel/types';
/**
 * Returns true if the expression is a function call of the form
 * `React.createClass(...)` or
 * ```
 * import createReactClass from 'create-react-class';
 * createReactClass(...);
 * ```
 */
export default function isReactCreateClassCall(path: NodePath): path is NodePath<CallExpression & {
    __reactBuiltinTypeHint: true;
}>;
