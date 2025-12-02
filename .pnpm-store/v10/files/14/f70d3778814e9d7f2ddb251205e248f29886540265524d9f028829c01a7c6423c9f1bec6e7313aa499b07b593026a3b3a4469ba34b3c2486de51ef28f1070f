"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HavingNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const and_node_js_1 = require("./and-node.js");
const or_node_js_1 = require("./or-node.js");
/**
 * @internal
 */
exports.HavingNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'HavingNode';
    },
    create(filter) {
        return (0, object_utils_js_1.freeze)({
            kind: 'HavingNode',
            having: filter,
        });
    },
    cloneWithOperation(havingNode, operator, operation) {
        return (0, object_utils_js_1.freeze)({
            ...havingNode,
            having: operator === 'And'
                ? and_node_js_1.AndNode.create(havingNode.having, operation)
                : or_node_js_1.OrNode.create(havingNode.having, operation),
        });
    },
});
