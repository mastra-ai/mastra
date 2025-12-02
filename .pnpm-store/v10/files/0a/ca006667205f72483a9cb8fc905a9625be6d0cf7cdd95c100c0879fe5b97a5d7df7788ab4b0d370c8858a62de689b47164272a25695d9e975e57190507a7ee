import type { NodePath } from '@babel/traverse';
import type { ClassDeclaration, ClassExpression } from '@babel/types';
/**
 * Returns `true` of the path represents a class definition which either extends
 * `React.Component` or has a superclass and implements a `render()` method.
 */
export default function isReactComponentClass(path: NodePath): path is NodePath<ClassDeclaration | ClassExpression>;
