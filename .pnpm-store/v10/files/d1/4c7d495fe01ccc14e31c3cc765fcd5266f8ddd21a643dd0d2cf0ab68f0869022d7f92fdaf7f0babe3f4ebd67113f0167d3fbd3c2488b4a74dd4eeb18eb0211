import type { NodePath } from '@babel/traverse';
import type Documentation from '../Documentation.js';
import type { TypeParameters } from './getTypeParameters.js';
/**
 * Given an React component (stateless or class) tries to find
 * flow or TS types for the props. It may find multiple types.
 * If not found or it is not one of the supported component types,
 *  this function returns an empty array.
 */
declare const _default: (componentDefinition: NodePath) => NodePath[];
export default _default;
export declare function applyToTypeProperties(documentation: Documentation, path: NodePath, callback: (propertyPath: NodePath, params: TypeParameters | null) => void, typeParams: TypeParameters | null): void;
