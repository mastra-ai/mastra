"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhereNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const and_node_js_1 = require("./and-node.js");
const or_node_js_1 = require("./or-node.js");
/**
 * @internal
 */
exports.WhereNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'WhereNode';
    },
    create(filter) {
        return (0, object_utils_js_1.freeze)({
            kind: 'WhereNode',
            where: filter,
        });
    },
    cloneWithOperation(whereNode, operator, operation) {
        return (0, object_utils_js_1.freeze)({
            ...whereNode,
            where: operator === 'And'
                ? and_node_js_1.AndNode.create(whereNode.where, operation)
                : or_node_js_1.OrNode.create(whereNode.where, operation),
        });
    },
});
