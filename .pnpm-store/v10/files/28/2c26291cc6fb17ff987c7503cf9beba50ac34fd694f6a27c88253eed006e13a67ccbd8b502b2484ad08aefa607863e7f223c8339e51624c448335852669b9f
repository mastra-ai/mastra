"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColumnNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.ColumnNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ColumnNode';
    },
    create(column) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ColumnNode',
            column: identifier_node_js_1.IdentifierNode.create(column),
        });
    },
});
