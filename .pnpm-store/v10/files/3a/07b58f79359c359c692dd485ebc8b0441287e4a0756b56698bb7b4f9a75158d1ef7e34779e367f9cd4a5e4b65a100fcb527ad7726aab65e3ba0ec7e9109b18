/// <reference types="./immediate-value-transformer.d.ts" />
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js';
import { ValueListNode } from '../../operation-node/value-list-node.js';
import { ValueNode } from '../../operation-node/value-node.js';
/**
 * Transforms all ValueNodes to immediate.
 *
 * WARNING! This should never be part of the public API. Users should never use this.
 * This is an internal helper.
 *
 * @internal
 */
export class ImmediateValueTransformer extends OperationNodeTransformer {
    transformPrimitiveValueList(node) {
        return ValueListNode.create(node.values.map(ValueNode.createImmediate));
    }
    transformValue(node) {
        return ValueNode.createImmediate(node.value);
    }
}
