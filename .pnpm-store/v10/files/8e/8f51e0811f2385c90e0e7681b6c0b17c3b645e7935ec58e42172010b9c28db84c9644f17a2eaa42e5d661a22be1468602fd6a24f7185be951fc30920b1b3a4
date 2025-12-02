import type { NodePath } from '@babel/traverse';
import type { Expression, PrivateName } from '@babel/types';
interface MemberDescriptor {
    path: NodePath<Expression | PrivateName>;
    computed: boolean;
    argumentPaths: NodePath[];
}
/**
 * Given a "nested" Member/CallExpression, e.g.
 *
 * foo.bar()[baz][42]
 *
 * this returns a list of "members". In this example it would be something like
 * [
 *   {path: NodePath<bar>, arguments: NodePath<empty>, computed: false},
 *   {path: NodePath<baz>, arguments: null, computed: true},
 *   {path: NodePath<42>, arguments: null, computed: false}
 * ]
 */
export default function getMembers(path: NodePath, includeRoot?: boolean): MemberDescriptor[];
export {};
