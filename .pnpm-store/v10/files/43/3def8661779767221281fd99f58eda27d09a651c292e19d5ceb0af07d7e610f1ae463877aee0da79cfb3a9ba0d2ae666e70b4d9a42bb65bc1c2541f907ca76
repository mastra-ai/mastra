"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUpdate = parseUpdate;
exports.parseUpdateObjectExpression = parseUpdateObjectExpression;
const column_node_js_1 = require("../operation-node/column-node.js");
const column_update_node_js_1 = require("../operation-node/column-update-node.js");
const expression_builder_js_1 = require("../expression/expression-builder.js");
const object_utils_js_1 = require("../util/object-utils.js");
const value_parser_js_1 = require("./value-parser.js");
const reference_parser_js_1 = require("./reference-parser.js");
function parseUpdate(...args) {
    if (args.length === 2) {
        return [
            column_update_node_js_1.ColumnUpdateNode.create((0, reference_parser_js_1.parseReferenceExpression)(args[0]), (0, value_parser_js_1.parseValueExpression)(args[1])),
        ];
    }
    return parseUpdateObjectExpression(args[0]);
}
function parseUpdateObjectExpression(update) {
    const updateObj = (0, object_utils_js_1.isFunction)(update) ? update((0, expression_builder_js_1.expressionBuilder)()) : update;
    return Object.entries(updateObj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
        return column_update_node_js_1.ColumnUpdateNode.create(column_node_js_1.ColumnNode.create(key), (0, value_parser_js_1.parseValueExpression)(value));
    });
}
