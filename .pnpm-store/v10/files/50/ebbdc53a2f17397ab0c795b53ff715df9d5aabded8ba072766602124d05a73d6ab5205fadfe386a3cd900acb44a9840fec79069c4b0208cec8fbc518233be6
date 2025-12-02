import type { NodePath } from '@babel/traverse';
import type { Expression, MemberExpression } from '@babel/types';
/**
 * Returns the path to the first part of the MemberExpression. I.e. given a
 * path representing
 *
 * foo.bar.baz
 *
 * it returns the path of/to `foo`.
 */
export default function getMemberExpressionRoot(memberExpressionPath: NodePath<MemberExpression>): NodePath<Expression>;
