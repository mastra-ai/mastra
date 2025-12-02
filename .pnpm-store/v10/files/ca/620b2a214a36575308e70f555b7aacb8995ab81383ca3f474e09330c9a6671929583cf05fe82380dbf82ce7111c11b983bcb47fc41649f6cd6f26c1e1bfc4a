"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDefaultValueExpression = parseDefaultValueExpression;
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const value_node_js_1 = require("../operation-node/value-node.js");
function parseDefaultValueExpression(value) {
    return (0, operation_node_source_js_1.isOperationNodeSource)(value)
        ? value.toOperationNode()
        : value_node_js_1.ValueNode.createImmediate(value);
}
