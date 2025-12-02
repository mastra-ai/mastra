"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImmediateValueTransformer = void 0;
const operation_node_transformer_js_1 = require("../../operation-node/operation-node-transformer.js");
const value_list_node_js_1 = require("../../operation-node/value-list-node.js");
const value_node_js_1 = require("../../operation-node/value-node.js");
/**
 * Transforms all ValueNodes to immediate.
 *
 * WARNING! This should never be part of the public API. Users should never use this.
 * This is an internal helper.
 *
 * @internal
 */
class ImmediateValueTransformer extends operation_node_transformer_js_1.OperationNodeTransformer {
    transformPrimitiveValueList(node) {
        return value_list_node_js_1.ValueListNode.create(node.values.map(value_node_js_1.ValueNode.createImmediate));
    }
    transformValue(node) {
        return value_node_js_1.ValueNode.createImmediate(node.value);
    }
}
exports.ImmediateValueTransformer = ImmediateValueTransformer;
