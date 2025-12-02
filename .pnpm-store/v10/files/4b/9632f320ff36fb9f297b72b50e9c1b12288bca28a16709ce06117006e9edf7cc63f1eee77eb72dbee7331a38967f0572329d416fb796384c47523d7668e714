import type { NodePath } from '@babel/traverse';
import type { ClassMethod, ClassProperty, ObjectMethod, ObjectProperty, ObjectTypeProperty, ObjectTypeSpreadProperty, SpreadElement, TSMethodSignature, TSPropertySignature } from '@babel/types';
export declare const COMPUTED_PREFIX = "@computed#";
/**
 * In an ObjectExpression, the name of a property can either be an identifier
 * or a literal (or dynamic, but we don't support those). This function simply
 * returns the value of the literal or name of the identifier.
 */
export default function getPropertyName(propertyPath: NodePath<ClassMethod | ClassProperty | ObjectMethod | ObjectProperty | ObjectTypeProperty | ObjectTypeSpreadProperty | SpreadElement | TSMethodSignature | TSPropertySignature>): string | null;
