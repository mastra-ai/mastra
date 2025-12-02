"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFunctionModule = createFunctionModule;
const expression_wrapper_js_1 = require("../expression/expression-wrapper.js");
const aggregate_function_node_js_1 = require("../operation-node/aggregate-function-node.js");
const function_node_js_1 = require("../operation-node/function-node.js");
const reference_parser_js_1 = require("../parser/reference-parser.js");
const select_parser_js_1 = require("../parser/select-parser.js");
const aggregate_function_builder_js_1 = require("./aggregate-function-builder.js");
const object_utils_js_1 = require("../util/object-utils.js");
const table_parser_js_1 = require("../parser/table-parser.js");
function createFunctionModule() {
    const fn = (name, args) => {
        return new expression_wrapper_js_1.ExpressionWrapper(function_node_js_1.FunctionNode.create(name, (0, reference_parser_js_1.parseReferenceExpressionOrList)(args ?? [])));
    };
    const agg = (name, args) => {
        return new aggregate_function_builder_js_1.AggregateFunctionBuilder({
            aggregateFunctionNode: aggregate_function_node_js_1.AggregateFunctionNode.create(name, args ? (0, reference_parser_js_1.parseReferenceExpressionOrList)(args) : undefined),
        });
    };
    return Object.assign(fn, {
        agg,
        avg(column) {
            return agg('avg', [column]);
        },
        coalesce(...values) {
            return fn('coalesce', values);
        },
        count(column) {
            return agg('count', [column]);
        },
        countAll(table) {
            return new aggregate_function_builder_js_1.AggregateFunctionBuilder({
                aggregateFunctionNode: aggregate_function_node_js_1.AggregateFunctionNode.create('count', (0, select_parser_js_1.parseSelectAll)(table)),
            });
        },
        max(column) {
            return agg('max', [column]);
        },
        min(column) {
            return agg('min', [column]);
        },
        sum(column) {
            return agg('sum', [column]);
        },
        any(column) {
            return fn('any', [column]);
        },
        jsonAgg(table) {
            return new aggregate_function_builder_js_1.AggregateFunctionBuilder({
                aggregateFunctionNode: aggregate_function_node_js_1.AggregateFunctionNode.create('json_agg', [
                    (0, object_utils_js_1.isString)(table) ? (0, table_parser_js_1.parseTable)(table) : table.toOperationNode(),
                ]),
            });
        },
        toJson(table) {
            return new expression_wrapper_js_1.ExpressionWrapper(function_node_js_1.FunctionNode.create('to_json', [
                (0, object_utils_js_1.isString)(table) ? (0, table_parser_js_1.parseTable)(table) : table.toOperationNode(),
            ]));
        },
    });
}
