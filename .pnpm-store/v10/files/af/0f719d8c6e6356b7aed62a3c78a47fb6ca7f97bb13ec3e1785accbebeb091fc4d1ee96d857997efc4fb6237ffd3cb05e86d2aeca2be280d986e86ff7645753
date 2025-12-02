"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJoin = parseJoin;
const join_node_js_1 = require("../operation-node/join-node.js");
const binary_operation_parser_js_1 = require("./binary-operation-parser.js");
const parse_utils_js_1 = require("./parse-utils.js");
const table_parser_js_1 = require("./table-parser.js");
function parseJoin(joinType, args) {
    if (args.length === 3) {
        return parseSingleOnJoin(joinType, args[0], args[1], args[2]);
    }
    else if (args.length === 2) {
        return parseCallbackJoin(joinType, args[0], args[1]);
    }
    else if (args.length === 1) {
        return parseOnlessJoin(joinType, args[0]);
    }
    else {
        throw new Error('not implemented');
    }
}
function parseCallbackJoin(joinType, from, callback) {
    return callback((0, parse_utils_js_1.createJoinBuilder)(joinType, from)).toOperationNode();
}
function parseSingleOnJoin(joinType, from, lhsColumn, rhsColumn) {
    return join_node_js_1.JoinNode.createWithOn(joinType, (0, table_parser_js_1.parseTableExpression)(from), (0, binary_operation_parser_js_1.parseReferentialBinaryOperation)(lhsColumn, '=', rhsColumn));
}
function parseOnlessJoin(joinType, from) {
    return join_node_js_1.JoinNode.create(joinType, (0, table_parser_js_1.parseTableExpression)(from));
}
