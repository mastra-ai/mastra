"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePartitionBy = parsePartitionBy;
const partition_by_item_node_js_1 = require("../operation-node/partition-by-item-node.js");
const reference_parser_js_1 = require("./reference-parser.js");
function parsePartitionBy(partitionBy) {
    return (0, reference_parser_js_1.parseReferenceExpressionOrList)(partitionBy).map(partition_by_item_node_js_1.PartitionByItemNode.create);
}
