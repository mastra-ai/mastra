"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSetOperations = parseSetOperations;
const expression_builder_js_1 = require("../expression/expression-builder.js");
const set_operation_node_js_1 = require("../operation-node/set-operation-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const expression_parser_js_1 = require("./expression-parser.js");
function parseSetOperations(operator, expression, all) {
    if ((0, object_utils_js_1.isFunction)(expression)) {
        expression = expression((0, expression_builder_js_1.createExpressionBuilder)());
    }
    if (!(0, object_utils_js_1.isReadonlyArray)(expression)) {
        expression = [expression];
    }
    return expression.map((expr) => set_operation_node_js_1.SetOperationNode.create(operator, (0, expression_parser_js_1.parseExpression)(expr), all));
}
