import type { NodePath } from '@babel/traverse';
import type { CallExpression } from '@babel/types';
/**
 * Returns true if the expression is a function call of the form
 * `React.foo(...)`.
 */
export default function isReactBuiltinCall(path: NodePath, name: string): path is NodePath<CallExpression & {
    __reactBuiltinTypeHint: true;
}>;
