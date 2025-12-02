"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJsonObjectArgs = getJsonObjectArgs;
const expression_wrapper_js_1 = require("../expression/expression-wrapper.js");
const alias_node_js_1 = require("../operation-node/alias-node.js");
const column_node_js_1 = require("../operation-node/column-node.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const reference_node_js_1 = require("../operation-node/reference-node.js");
const table_node_js_1 = require("../operation-node/table-node.js");
const value_node_js_1 = require("../operation-node/value-node.js");
function getJsonObjectArgs(node, table) {
    const args = [];
    for (const { selection: s } of node.selections ?? []) {
        if (reference_node_js_1.ReferenceNode.is(s) && column_node_js_1.ColumnNode.is(s.column)) {
            args.push(colName(s.column.column.name), colRef(table, s.column.column.name));
        }
        else if (column_node_js_1.ColumnNode.is(s)) {
            args.push(colName(s.column.name), colRef(table, s.column.name));
        }
        else if (alias_node_js_1.AliasNode.is(s) && identifier_node_js_1.IdentifierNode.is(s.alias)) {
            args.push(colName(s.alias.name), colRef(table, s.alias.name));
        }
        else {
            throw new Error(`can't extract column names from the select query node`);
        }
    }
    return args;
}
function colName(col) {
    return new expression_wrapper_js_1.ExpressionWrapper(value_node_js_1.ValueNode.createImmediate(col));
}
function colRef(table, col) {
    return new expression_wrapper_js_1.ExpressionWrapper(reference_node_js_1.ReferenceNode.create(column_node_js_1.ColumnNode.create(col), table_node_js_1.TableNode.create(table)));
}
