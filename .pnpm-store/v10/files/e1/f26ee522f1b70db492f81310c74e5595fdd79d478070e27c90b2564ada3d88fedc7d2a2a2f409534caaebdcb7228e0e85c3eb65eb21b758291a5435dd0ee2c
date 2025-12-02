"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMergeWhen = parseMergeWhen;
exports.parseMergeThen = parseMergeThen;
const matched_node_js_1 = require("../operation-node/matched-node.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const raw_node_js_1 = require("../operation-node/raw-node.js");
const when_node_js_1 = require("../operation-node/when-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const binary_operation_parser_js_1 = require("./binary-operation-parser.js");
function parseMergeWhen(type, args, refRight) {
    return when_node_js_1.WhenNode.create((0, binary_operation_parser_js_1.parseFilterList)([
        matched_node_js_1.MatchedNode.create(!type.isMatched, type.bySource),
        ...(args && args.length > 0
            ? [
                args.length === 3 && refRight
                    ? (0, binary_operation_parser_js_1.parseReferentialBinaryOperation)(args[0], args[1], args[2])
                    : (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args),
            ]
            : []),
    ], 'and', false));
}
function parseMergeThen(result) {
    if ((0, object_utils_js_1.isString)(result)) {
        return raw_node_js_1.RawNode.create([result], []);
    }
    if ((0, operation_node_source_js_1.isOperationNodeSource)(result)) {
        return result.toOperationNode();
    }
    return result;
}
