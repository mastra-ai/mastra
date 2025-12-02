"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnConflictNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const where_node_js_1 = require("./where-node.js");
/**
 * @internal
 */
exports.OnConflictNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'OnConflictNode';
    },
    create() {
        return (0, object_utils_js_1.freeze)({
            kind: 'OnConflictNode',
        });
    },
    cloneWith(node, props) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            ...props,
        });
    },
    cloneWithIndexWhere(node, operation) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            indexWhere: node.indexWhere
                ? where_node_js_1.WhereNode.cloneWithOperation(node.indexWhere, 'And', operation)
                : where_node_js_1.WhereNode.create(operation),
        });
    },
    cloneWithIndexOrWhere(node, operation) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            indexWhere: node.indexWhere
                ? where_node_js_1.WhereNode.cloneWithOperation(node.indexWhere, 'Or', operation)
                : where_node_js_1.WhereNode.create(operation),
        });
    },
    cloneWithUpdateWhere(node, operation) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            updateWhere: node.updateWhere
                ? where_node_js_1.WhereNode.cloneWithOperation(node.updateWhere, 'And', operation)
                : where_node_js_1.WhereNode.create(operation),
        });
    },
    cloneWithUpdateOrWhere(node, operation) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            updateWhere: node.updateWhere
                ? where_node_js_1.WhereNode.cloneWithOperation(node.updateWhere, 'Or', operation)
                : where_node_js_1.WhereNode.create(operation),
        });
    },
    cloneWithoutIndexWhere(node) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            indexWhere: undefined,
        });
    },
    cloneWithoutUpdateWhere(node) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            updateWhere: undefined,
        });
    },
});
