"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlterColumnNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const column_node_js_1 = require("./column-node.js");
/**
 * @internal
 */
exports.AlterColumnNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'AlterColumnNode';
    },
    create(column, prop, value) {
        return (0, object_utils_js_1.freeze)({
            kind: 'AlterColumnNode',
            column: column_node_js_1.ColumnNode.create(column),
            [prop]: value,
        });
    },
});
