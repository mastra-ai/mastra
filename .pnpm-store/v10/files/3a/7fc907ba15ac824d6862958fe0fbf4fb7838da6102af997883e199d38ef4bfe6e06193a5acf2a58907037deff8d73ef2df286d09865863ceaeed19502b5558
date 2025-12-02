"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIndexNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.CreateIndexNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CreateIndexNode';
    },
    create(name) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CreateIndexNode',
            name: identifier_node_js_1.IdentifierNode.create(name),
        });
    },
    cloneWith(node, props) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            ...props,
        });
    },
    cloneWithColumns(node, columns) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            columns: [...(node.columns || []), ...columns],
        });
    },
});
