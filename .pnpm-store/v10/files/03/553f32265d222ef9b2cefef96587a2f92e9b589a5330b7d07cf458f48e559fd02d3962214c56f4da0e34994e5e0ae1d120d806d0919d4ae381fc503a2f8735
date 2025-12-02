"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSelectQueryBuilder = createSelectQueryBuilder;
exports.createQueryCreator = createQueryCreator;
exports.createJoinBuilder = createJoinBuilder;
exports.createOverBuilder = createOverBuilder;
const join_node_js_1 = require("../operation-node/join-node.js");
const over_node_js_1 = require("../operation-node/over-node.js");
const select_query_node_js_1 = require("../operation-node/select-query-node.js");
const join_builder_js_1 = require("../query-builder/join-builder.js");
const over_builder_js_1 = require("../query-builder/over-builder.js");
const select_query_builder_js_1 = require("../query-builder/select-query-builder.js");
const query_creator_js_1 = require("../query-creator.js");
const noop_query_executor_js_1 = require("../query-executor/noop-query-executor.js");
const query_id_js_1 = require("../util/query-id.js");
const table_parser_js_1 = require("./table-parser.js");
function createSelectQueryBuilder() {
    return (0, select_query_builder_js_1.createSelectQueryBuilder)({
        queryId: (0, query_id_js_1.createQueryId)(),
        executor: noop_query_executor_js_1.NOOP_QUERY_EXECUTOR,
        queryNode: select_query_node_js_1.SelectQueryNode.createFrom((0, table_parser_js_1.parseTableExpressionOrList)([])),
    });
}
function createQueryCreator() {
    return new query_creator_js_1.QueryCreator({
        executor: noop_query_executor_js_1.NOOP_QUERY_EXECUTOR,
    });
}
function createJoinBuilder(joinType, table) {
    return new join_builder_js_1.JoinBuilder({
        joinNode: join_node_js_1.JoinNode.create(joinType, (0, table_parser_js_1.parseTableExpression)(table)),
    });
}
function createOverBuilder() {
    return new over_builder_js_1.OverBuilder({
        overNode: over_node_js_1.OverNode.create(),
    });
}
