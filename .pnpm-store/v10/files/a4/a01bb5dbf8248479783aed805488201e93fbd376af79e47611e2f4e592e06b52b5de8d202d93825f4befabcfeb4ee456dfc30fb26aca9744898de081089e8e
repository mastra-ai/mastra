"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropColumnNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const column_node_js_1 = require("./column-node.js");
/**
 * @internal
 */
exports.DropColumnNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DropColumnNode';
    },
    create(column) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DropColumnNode',
            column: column_node_js_1.ColumnNode.create(column),
        });
    },
});
