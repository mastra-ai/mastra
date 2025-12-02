import type { NodePath } from '@babel/traverse';
import type { CallExpression } from '@babel/types';
/**
 * Returns true if the expression is a function call of the form
 * `React.Children.only(...)` or `React.Children.map(...)`.
 */
export default function isReactChildrenElementCall(path: NodePath): path is NodePath<CallExpression & {
    __reactBuiltinTypeHint: true;
}>;
