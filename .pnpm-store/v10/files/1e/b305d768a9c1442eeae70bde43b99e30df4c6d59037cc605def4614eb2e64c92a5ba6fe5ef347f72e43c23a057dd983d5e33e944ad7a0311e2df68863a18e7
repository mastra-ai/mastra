"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDataTypeExpression = parseDataTypeExpression;
const data_type_node_js_1 = require("../operation-node/data-type-node.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
function parseDataTypeExpression(dataType) {
    if ((0, operation_node_source_js_1.isOperationNodeSource)(dataType)) {
        return dataType.toOperationNode();
    }
    if ((0, data_type_node_js_1.isColumnDataType)(dataType)) {
        return data_type_node_js_1.DataTypeNode.create(dataType);
    }
    throw new Error(`invalid column data type ${JSON.stringify(dataType)}`);
}
