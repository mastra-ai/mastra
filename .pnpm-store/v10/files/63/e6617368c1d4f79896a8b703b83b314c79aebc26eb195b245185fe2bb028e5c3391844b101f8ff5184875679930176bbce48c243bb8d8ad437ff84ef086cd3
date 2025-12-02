"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseInsertExpression = parseInsertExpression;
const column_node_js_1 = require("../operation-node/column-node.js");
const primitive_value_list_node_js_1 = require("../operation-node/primitive-value-list-node.js");
const value_list_node_js_1 = require("../operation-node/value-list-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const value_parser_js_1 = require("./value-parser.js");
const values_node_js_1 = require("../operation-node/values-node.js");
const expression_parser_js_1 = require("./expression-parser.js");
const default_insert_value_node_js_1 = require("../operation-node/default-insert-value-node.js");
const expression_builder_js_1 = require("../expression/expression-builder.js");
function parseInsertExpression(arg) {
    const objectOrList = (0, object_utils_js_1.isFunction)(arg) ? arg((0, expression_builder_js_1.expressionBuilder)()) : arg;
    const list = (0, object_utils_js_1.isReadonlyArray)(objectOrList)
        ? objectOrList
        : (0, object_utils_js_1.freeze)([objectOrList]);
    return parseInsertColumnsAndValues(list);
}
function parseInsertColumnsAndValues(rows) {
    const columns = parseColumnNamesAndIndexes(rows);
    return [
        (0, object_utils_js_1.freeze)([...columns.keys()].map(column_node_js_1.ColumnNode.create)),
        values_node_js_1.ValuesNode.create(rows.map((row) => parseRowValues(row, columns))),
    ];
}
function parseColumnNamesAndIndexes(rows) {
    const columns = new Map();
    for (const row of rows) {
        const cols = Object.keys(row);
        for (const col of cols) {
            if (!columns.has(col) && row[col] !== undefined) {
                columns.set(col, columns.size);
            }
        }
    }
    return columns;
}
function parseRowValues(row, columns) {
    const rowColumns = Object.keys(row);
    const rowValues = Array.from({
        length: columns.size,
    });
    let hasUndefinedOrComplexColumns = false;
    let indexedRowColumns = rowColumns.length;
    for (const col of rowColumns) {
        const columnIdx = columns.get(col);
        if ((0, object_utils_js_1.isUndefined)(columnIdx)) {
            indexedRowColumns--;
            continue;
        }
        const value = row[col];
        if ((0, object_utils_js_1.isUndefined)(value) || (0, expression_parser_js_1.isExpressionOrFactory)(value)) {
            hasUndefinedOrComplexColumns = true;
        }
        rowValues[columnIdx] = value;
    }
    const hasMissingColumns = indexedRowColumns < columns.size;
    if (hasMissingColumns || hasUndefinedOrComplexColumns) {
        const defaultValue = default_insert_value_node_js_1.DefaultInsertValueNode.create();
        return value_list_node_js_1.ValueListNode.create(rowValues.map((it) => (0, object_utils_js_1.isUndefined)(it) ? defaultValue : (0, value_parser_js_1.parseValueExpression)(it)));
    }
    return primitive_value_list_node_js_1.PrimitiveValueListNode.create(rowValues);
}
