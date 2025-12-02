"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONReferenceNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.JSONReferenceNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'JSONReferenceNode';
    },
    create(reference, traversal) {
        return (0, object_utils_js_1.freeze)({
            kind: 'JSONReferenceNode',
            reference,
            traversal,
        });
    },
    cloneWithTraversal(node, traversal) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            traversal,
        });
    },
});
