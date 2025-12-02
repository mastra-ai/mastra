import type { NodePath } from '@babel/traverse';
import type { CallExpression } from '@babel/types';
/**
 * Returns true if the expression is a function call of the form
 * `React.cloneElement(...)`.
 */
export default function isReactCloneElementCall(path: NodePath): path is NodePath<CallExpression & {
    __reactBuiltinTypeHint: true;
}>;
