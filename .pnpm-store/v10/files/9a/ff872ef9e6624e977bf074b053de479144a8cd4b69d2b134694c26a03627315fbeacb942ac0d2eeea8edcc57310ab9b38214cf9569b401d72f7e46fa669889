"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonTableExpressionNameNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const column_node_js_1 = require("./column-node.js");
const table_node_js_1 = require("./table-node.js");
/**
 * @internal
 */
exports.CommonTableExpressionNameNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CommonTableExpressionNameNode';
    },
    create(tableName, columnNames) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CommonTableExpressionNameNode',
            table: table_node_js_1.TableNode.create(tableName),
            columns: columnNames
                ? (0, object_utils_js_1.freeze)(columnNames.map(column_node_js_1.ColumnNode.create))
                : undefined,
        });
    },
});
