"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCommonTableExpression = parseCommonTableExpression;
const common_table_expression_name_node_js_1 = require("../operation-node/common-table-expression-name-node.js");
const parse_utils_js_1 = require("./parse-utils.js");
const object_utils_js_1 = require("../util/object-utils.js");
const cte_builder_js_1 = require("../query-builder/cte-builder.js");
const common_table_expression_node_js_1 = require("../operation-node/common-table-expression-node.js");
function parseCommonTableExpression(nameOrBuilderCallback, expression) {
    const expressionNode = expression((0, parse_utils_js_1.createQueryCreator)()).toOperationNode();
    if ((0, object_utils_js_1.isFunction)(nameOrBuilderCallback)) {
        return nameOrBuilderCallback(cteBuilderFactory(expressionNode)).toOperationNode();
    }
    return common_table_expression_node_js_1.CommonTableExpressionNode.create(parseCommonTableExpressionName(nameOrBuilderCallback), expressionNode);
}
function cteBuilderFactory(expressionNode) {
    return (name) => {
        return new cte_builder_js_1.CTEBuilder({
            node: common_table_expression_node_js_1.CommonTableExpressionNode.create(parseCommonTableExpressionName(name), expressionNode),
        });
    };
}
function parseCommonTableExpressionName(name) {
    if (name.includes('(')) {
        const parts = name.split(/[\(\)]/);
        const table = parts[0];
        const columns = parts[1].split(',').map((it) => it.trim());
        return common_table_expression_name_node_js_1.CommonTableExpressionNameNode.create(table, columns);
    }
    else {
        return common_table_expression_name_node_js_1.CommonTableExpressionNameNode.create(name);
    }
}
