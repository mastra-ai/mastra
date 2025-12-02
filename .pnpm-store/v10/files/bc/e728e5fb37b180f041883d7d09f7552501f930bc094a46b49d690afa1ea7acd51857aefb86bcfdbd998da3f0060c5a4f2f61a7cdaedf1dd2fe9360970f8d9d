import type { TypeParameters } from '../utils/getTypeParameters.js';
import type { TypeDescriptor } from '../Documentation.js';
import type { NodePath } from '@babel/traverse';
import type { FlowType } from '@babel/types';
/**
 * Tries to identify the flow type by inspecting the path for known
 * flow type names. This method doesn't check whether the found type is actually
 * existing. It simply assumes that a match is always valid.
 *
 * If there is no match, "unknown" is returned.
 */
export default function getFlowType(path: NodePath<FlowType>, typeParams?: TypeParameters | null): TypeDescriptor;
