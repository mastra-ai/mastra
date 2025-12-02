"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const and_node_js_1 = require("./and-node.js");
const or_node_js_1 = require("./or-node.js");
/**
 * @internal
 */
exports.OnNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'OnNode';
    },
    create(filter) {
        return (0, object_utils_js_1.freeze)({
            kind: 'OnNode',
            on: filter,
        });
    },
    cloneWithOperation(onNode, operator, operation) {
        return (0, object_utils_js_1.freeze)({
            ...onNode,
            on: operator === 'And'
                ? and_node_js_1.AndNode.create(onNode.on, operation)
                : or_node_js_1.OrNode.create(onNode.on, operation),
        });
    },
});
