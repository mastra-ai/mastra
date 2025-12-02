"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSimpleReferenceExpression = parseSimpleReferenceExpression;
exports.parseReferenceExpressionOrList = parseReferenceExpressionOrList;
exports.parseReferenceExpression = parseReferenceExpression;
exports.parseJSONReference = parseJSONReference;
exports.parseStringReference = parseStringReference;
exports.parseAliasedStringReference = parseAliasedStringReference;
exports.parseColumnName = parseColumnName;
exports.parseOrderedColumnName = parseOrderedColumnName;
const alias_node_js_1 = require("../operation-node/alias-node.js");
const column_node_js_1 = require("../operation-node/column-node.js");
const reference_node_js_1 = require("../operation-node/reference-node.js");
const table_node_js_1 = require("../operation-node/table-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const expression_parser_js_1 = require("./expression-parser.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const order_by_parser_js_1 = require("./order-by-parser.js");
const operator_node_js_1 = require("../operation-node/operator-node.js");
const json_reference_node_js_1 = require("../operation-node/json-reference-node.js");
const json_operator_chain_node_js_1 = require("../operation-node/json-operator-chain-node.js");
const json_path_node_js_1 = require("../operation-node/json-path-node.js");
function parseSimpleReferenceExpression(exp) {
    if ((0, object_utils_js_1.isString)(exp)) {
        return parseStringReference(exp);
    }
    return exp.toOperationNode();
}
function parseReferenceExpressionOrList(arg) {
    if ((0, object_utils_js_1.isReadonlyArray)(arg)) {
        return arg.map((it) => parseReferenceExpression(it));
    }
    else {
        return [parseReferenceExpression(arg)];
    }
}
function parseReferenceExpression(exp) {
    if ((0, expression_parser_js_1.isExpressionOrFactory)(exp)) {
        return (0, expression_parser_js_1.parseExpression)(exp);
    }
    return parseSimpleReferenceExpression(exp);
}
function parseJSONReference(ref, op) {
    const referenceNode = parseStringReference(ref);
    if ((0, operator_node_js_1.isJSONOperator)(op)) {
        return json_reference_node_js_1.JSONReferenceNode.create(referenceNode, json_operator_chain_node_js_1.JSONOperatorChainNode.create(operator_node_js_1.OperatorNode.create(op)));
    }
    const opWithoutLastChar = op.slice(0, -1);
    if ((0, operator_node_js_1.isJSONOperator)(opWithoutLastChar)) {
        return json_reference_node_js_1.JSONReferenceNode.create(referenceNode, json_path_node_js_1.JSONPathNode.create(operator_node_js_1.OperatorNode.create(opWithoutLastChar)));
    }
    throw new Error(`Invalid JSON operator: ${op}`);
}
function parseStringReference(ref) {
    const COLUMN_SEPARATOR = '.';
    if (!ref.includes(COLUMN_SEPARATOR)) {
        return reference_node_js_1.ReferenceNode.create(column_node_js_1.ColumnNode.create(ref));
    }
    const parts = ref.split(COLUMN_SEPARATOR).map(trim);
    if (parts.length === 3) {
        return parseStringReferenceWithTableAndSchema(parts);
    }
    if (parts.length === 2) {
        return parseStringReferenceWithTable(parts);
    }
    throw new Error(`invalid column reference ${ref}`);
}
function parseAliasedStringReference(ref) {
    const ALIAS_SEPARATOR = ' as ';
    if (ref.includes(ALIAS_SEPARATOR)) {
        const [columnRef, alias] = ref.split(ALIAS_SEPARATOR).map(trim);
        return alias_node_js_1.AliasNode.create(parseStringReference(columnRef), identifier_node_js_1.IdentifierNode.create(alias));
    }
    else {
        return parseStringReference(ref);
    }
}
function parseColumnName(column) {
    return column_node_js_1.ColumnNode.create(column);
}
function parseOrderedColumnName(column) {
    const ORDER_SEPARATOR = ' ';
    if (column.includes(ORDER_SEPARATOR)) {
        const [columnName, order] = column.split(ORDER_SEPARATOR).map(trim);
        if (!(0, order_by_parser_js_1.isOrderByDirection)(order)) {
            throw new Error(`invalid order direction "${order}" next to "${columnName}"`);
        }
        return (0, order_by_parser_js_1.parseOrderBy)([columnName, order])[0];
    }
    else {
        return parseColumnName(column);
    }
}
function parseStringReferenceWithTableAndSchema(parts) {
    const [schema, table, column] = parts;
    return reference_node_js_1.ReferenceNode.create(column_node_js_1.ColumnNode.create(column), table_node_js_1.TableNode.createWithSchema(schema, table));
}
function parseStringReferenceWithTable(parts) {
    const [table, column] = parts;
    return reference_node_js_1.ReferenceNode.create(column_node_js_1.ColumnNode.create(column), table_node_js_1.TableNode.create(table));
}
function trim(str) {
    return str.trim();
}
