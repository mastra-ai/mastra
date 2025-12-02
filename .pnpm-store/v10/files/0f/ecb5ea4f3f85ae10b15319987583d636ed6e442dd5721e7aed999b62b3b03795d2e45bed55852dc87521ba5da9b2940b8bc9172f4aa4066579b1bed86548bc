"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGroupBy = parseGroupBy;
const group_by_item_node_js_1 = require("../operation-node/group-by-item-node.js");
const expression_builder_js_1 = require("../expression/expression-builder.js");
const object_utils_js_1 = require("../util/object-utils.js");
const reference_parser_js_1 = require("./reference-parser.js");
function parseGroupBy(groupBy) {
    groupBy = (0, object_utils_js_1.isFunction)(groupBy) ? groupBy((0, expression_builder_js_1.expressionBuilder)()) : groupBy;
    return (0, reference_parser_js_1.parseReferenceExpressionOrList)(groupBy).map(group_by_item_node_js_1.GroupByItemNode.create);
}
