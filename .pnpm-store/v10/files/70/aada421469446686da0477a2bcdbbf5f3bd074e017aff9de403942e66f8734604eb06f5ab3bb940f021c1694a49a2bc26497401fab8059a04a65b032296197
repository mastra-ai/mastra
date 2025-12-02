"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSelectArg = parseSelectArg;
exports.parseSelectAll = parseSelectAll;
const object_utils_js_1 = require("../util/object-utils.js");
const selection_node_js_1 = require("../operation-node/selection-node.js");
const reference_parser_js_1 = require("./reference-parser.js");
const dynamic_reference_builder_js_1 = require("../dynamic/dynamic-reference-builder.js");
const expression_parser_js_1 = require("./expression-parser.js");
const table_parser_js_1 = require("./table-parser.js");
const expression_builder_js_1 = require("../expression/expression-builder.js");
function parseSelectArg(selection) {
    if ((0, object_utils_js_1.isFunction)(selection)) {
        return parseSelectArg(selection((0, expression_builder_js_1.expressionBuilder)()));
    }
    else if ((0, object_utils_js_1.isReadonlyArray)(selection)) {
        return selection.map((it) => parseSelectExpression(it));
    }
    else {
        return [parseSelectExpression(selection)];
    }
}
function parseSelectExpression(selection) {
    if ((0, object_utils_js_1.isString)(selection)) {
        return selection_node_js_1.SelectionNode.create((0, reference_parser_js_1.parseAliasedStringReference)(selection));
    }
    else if ((0, dynamic_reference_builder_js_1.isDynamicReferenceBuilder)(selection)) {
        return selection_node_js_1.SelectionNode.create(selection.toOperationNode());
    }
    else {
        return selection_node_js_1.SelectionNode.create((0, expression_parser_js_1.parseAliasedExpression)(selection));
    }
}
function parseSelectAll(table) {
    if (!table) {
        return [selection_node_js_1.SelectionNode.createSelectAll()];
    }
    else if (Array.isArray(table)) {
        return table.map(parseSelectAllArg);
    }
    else {
        return [parseSelectAllArg(table)];
    }
}
function parseSelectAllArg(table) {
    if ((0, object_utils_js_1.isString)(table)) {
        return selection_node_js_1.SelectionNode.createSelectAllFromTable((0, table_parser_js_1.parseTable)(table));
    }
    throw new Error(`invalid value selectAll expression: ${JSON.stringify(table)}`);
}
