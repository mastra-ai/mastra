"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameColumnNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const column_node_js_1 = require("./column-node.js");
/**
 * @internal
 */
exports.RenameColumnNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'RenameColumnNode';
    },
    create(column, newColumn) {
        return (0, object_utils_js_1.freeze)({
            kind: 'RenameColumnNode',
            column: column_node_js_1.ColumnNode.create(column),
            renameTo: column_node_js_1.ColumnNode.create(newColumn),
        });
    },
});
