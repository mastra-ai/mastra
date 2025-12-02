import type { TypeParameters } from '../utils/getTypeParameters.js';
import type { TypeDescriptor, TSFunctionSignatureType } from '../Documentation.js';
import type { NodePath } from '@babel/traverse';
import type { TypeScript } from '@babel/types';
/**
 * Tries to identify the typescript type by inspecting the path for known
 * typescript type names. This method doesn't check whether the found type is actually
 * existing. It simply assumes that a match is always valid.
 *
 * If there is no match, "unknown" is returned.
 */
export default function getTSType(path: NodePath<TypeScript>, typeParamMap?: TypeParameters | null): TypeDescriptor<TSFunctionSignatureType>;
