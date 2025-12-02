"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTableExpressionOrList = parseTableExpressionOrList;
exports.parseTableExpression = parseTableExpression;
exports.parseAliasedTable = parseAliasedTable;
exports.parseTable = parseTable;
const object_utils_js_1 = require("../util/object-utils.js");
const alias_node_js_1 = require("../operation-node/alias-node.js");
const table_node_js_1 = require("../operation-node/table-node.js");
const expression_parser_js_1 = require("./expression-parser.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const dynamic_table_builder_js_1 = require("../dynamic/dynamic-table-builder.js");
function parseTableExpressionOrList(table) {
    if ((0, object_utils_js_1.isReadonlyArray)(table)) {
        return table.map((it) => parseTableExpression(it));
    }
    else {
        return [parseTableExpression(table)];
    }
}
function parseTableExpression(table) {
    if ((0, object_utils_js_1.isString)(table)) {
        return parseAliasedTable(table);
    }
    else if ((0, dynamic_table_builder_js_1.isAliasedDynamicTableBuilder)(table)) {
        return table.toOperationNode();
    }
    else {
        return (0, expression_parser_js_1.parseAliasedExpression)(table);
    }
}
function parseAliasedTable(from) {
    const ALIAS_SEPARATOR = ' as ';
    if (from.includes(ALIAS_SEPARATOR)) {
        const [table, alias] = from.split(ALIAS_SEPARATOR).map(trim);
        return alias_node_js_1.AliasNode.create(parseTable(table), identifier_node_js_1.IdentifierNode.create(alias));
    }
    else {
        return parseTable(from);
    }
}
function parseTable(from) {
    const SCHEMA_SEPARATOR = '.';
    if (from.includes(SCHEMA_SEPARATOR)) {
        const [schema, table] = from.split(SCHEMA_SEPARATOR).map(trim);
        return table_node_js_1.TableNode.createWithSchema(schema, table);
    }
    else {
        return table_node_js_1.TableNode.create(from);
    }
}
function trim(str) {
    return str.trim();
}
