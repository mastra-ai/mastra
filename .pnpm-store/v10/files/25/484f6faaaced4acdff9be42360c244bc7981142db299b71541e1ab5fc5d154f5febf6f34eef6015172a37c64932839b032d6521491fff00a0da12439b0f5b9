import type { NodePath } from '@babel/traverse';
import type { GenericTypeAnnotation } from '@babel/types';
/**
 * See `supportedUtilityTypes` for which types are supported and
 * https://flow.org/en/docs/types/utilities/ for which types are available.
 */
export declare function isSupportedUtilityType(path: NodePath): path is NodePath<GenericTypeAnnotation>;
/**
 * Unwraps well known utility types. For example:
 *
 *   $ReadOnly<T> => T
 */
export declare function unwrapUtilityType(path: NodePath): NodePath;
