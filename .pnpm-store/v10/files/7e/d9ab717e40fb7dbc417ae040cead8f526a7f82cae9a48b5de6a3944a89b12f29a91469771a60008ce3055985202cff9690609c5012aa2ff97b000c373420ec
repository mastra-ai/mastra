import type { NodePath } from '@babel/traverse';
import type { AssignmentExpression, ClassMethod, ClassPrivateMethod, ClassProperty, ObjectMethod, ObjectProperty } from '@babel/types';
import type { MethodDescriptor } from '../Documentation.js';
export type MethodNodePath = NodePath<AssignmentExpression> | NodePath<ClassMethod> | NodePath<ClassPrivateMethod> | NodePath<ClassProperty> | NodePath<ObjectMethod> | NodePath<ObjectProperty>;
export default function getMethodDocumentation(methodPath: MethodNodePath, options?: {
    isStatic?: boolean;
}): MethodDescriptor | null;
