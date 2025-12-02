"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const on_node_js_1 = require("./on-node.js");
/**
 * @internal
 */
exports.JoinNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'JoinNode';
    },
    create(joinType, table) {
        return (0, object_utils_js_1.freeze)({
            kind: 'JoinNode',
            joinType,
            table,
            on: undefined,
        });
    },
    createWithOn(joinType, table, on) {
        return (0, object_utils_js_1.freeze)({
            kind: 'JoinNode',
            joinType,
            table,
            on: on_node_js_1.OnNode.create(on),
        });
    },
    cloneWithOn(joinNode, operation) {
        return (0, object_utils_js_1.freeze)({
            ...joinNode,
            on: joinNode.on
                ? on_node_js_1.OnNode.cloneWithOperation(joinNode.on, 'And', operation)
                : on_node_js_1.OnNode.create(operation),
        });
    },
});
