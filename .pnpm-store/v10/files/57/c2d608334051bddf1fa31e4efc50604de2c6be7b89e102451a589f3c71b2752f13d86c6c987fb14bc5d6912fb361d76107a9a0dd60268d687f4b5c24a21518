"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpressionBuilder = createExpressionBuilder;
exports.expressionBuilder = expressionBuilder;
const select_query_builder_js_1 = require("../query-builder/select-query-builder.js");
const select_query_node_js_1 = require("../operation-node/select-query-node.js");
const table_parser_js_1 = require("../parser/table-parser.js");
const with_schema_plugin_js_1 = require("../plugin/with-schema/with-schema-plugin.js");
const query_id_js_1 = require("../util/query-id.js");
const function_module_js_1 = require("../query-builder/function-module.js");
const reference_parser_js_1 = require("../parser/reference-parser.js");
const binary_operation_parser_js_1 = require("../parser/binary-operation-parser.js");
const parens_node_js_1 = require("../operation-node/parens-node.js");
const expression_wrapper_js_1 = require("./expression-wrapper.js");
const operator_node_js_1 = require("../operation-node/operator-node.js");
const unary_operation_parser_js_1 = require("../parser/unary-operation-parser.js");
const value_parser_js_1 = require("../parser/value-parser.js");
const noop_query_executor_js_1 = require("../query-executor/noop-query-executor.js");
const case_builder_js_1 = require("../query-builder/case-builder.js");
const case_node_js_1 = require("../operation-node/case-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const json_path_builder_js_1 = require("../query-builder/json-path-builder.js");
const binary_operation_node_js_1 = require("../operation-node/binary-operation-node.js");
const and_node_js_1 = require("../operation-node/and-node.js");
const tuple_node_js_1 = require("../operation-node/tuple-node.js");
const json_path_node_js_1 = require("../operation-node/json-path-node.js");
const data_type_parser_js_1 = require("../parser/data-type-parser.js");
const cast_node_js_1 = require("../operation-node/cast-node.js");
function createExpressionBuilder(executor = noop_query_executor_js_1.NOOP_QUERY_EXECUTOR) {
    function binary(lhs, op, rhs) {
        return new expression_wrapper_js_1.ExpressionWrapper((0, binary_operation_parser_js_1.parseValueBinaryOperation)(lhs, op, rhs));
    }
    function unary(op, expr) {
        return new expression_wrapper_js_1.ExpressionWrapper((0, unary_operation_parser_js_1.parseUnaryOperation)(op, expr));
    }
    const eb = Object.assign(binary, {
        fn: undefined,
        eb: undefined,
        selectFrom(table) {
            return (0, select_query_builder_js_1.createSelectQueryBuilder)({
                queryId: (0, query_id_js_1.createQueryId)(),
                executor,
                queryNode: select_query_node_js_1.SelectQueryNode.createFrom((0, table_parser_js_1.parseTableExpressionOrList)(table)),
            });
        },
        case(reference) {
            return new case_builder_js_1.CaseBuilder({
                node: case_node_js_1.CaseNode.create((0, object_utils_js_1.isUndefined)(reference)
                    ? undefined
                    : (0, reference_parser_js_1.parseReferenceExpression)(reference)),
            });
        },
        ref(reference, op) {
            if ((0, object_utils_js_1.isUndefined)(op)) {
                return new expression_wrapper_js_1.ExpressionWrapper((0, reference_parser_js_1.parseStringReference)(reference));
            }
            return new json_path_builder_js_1.JSONPathBuilder((0, reference_parser_js_1.parseJSONReference)(reference, op));
        },
        jsonPath() {
            return new json_path_builder_js_1.JSONPathBuilder(json_path_node_js_1.JSONPathNode.create());
        },
        table(table) {
            return new expression_wrapper_js_1.ExpressionWrapper((0, table_parser_js_1.parseTable)(table));
        },
        val(value) {
            return new expression_wrapper_js_1.ExpressionWrapper((0, value_parser_js_1.parseValueExpression)(value));
        },
        refTuple(...values) {
            return new expression_wrapper_js_1.ExpressionWrapper(tuple_node_js_1.TupleNode.create(values.map(reference_parser_js_1.parseReferenceExpression)));
        },
        tuple(...values) {
            return new expression_wrapper_js_1.ExpressionWrapper(tuple_node_js_1.TupleNode.create(values.map(value_parser_js_1.parseValueExpression)));
        },
        lit(value) {
            return new expression_wrapper_js_1.ExpressionWrapper((0, value_parser_js_1.parseSafeImmediateValue)(value));
        },
        unary,
        not(expr) {
            return unary('not', expr);
        },
        exists(expr) {
            return unary('exists', expr);
        },
        neg(expr) {
            return unary('-', expr);
        },
        between(expr, start, end) {
            return new expression_wrapper_js_1.ExpressionWrapper(binary_operation_node_js_1.BinaryOperationNode.create((0, reference_parser_js_1.parseReferenceExpression)(expr), operator_node_js_1.OperatorNode.create('between'), and_node_js_1.AndNode.create((0, value_parser_js_1.parseValueExpression)(start), (0, value_parser_js_1.parseValueExpression)(end))));
        },
        betweenSymmetric(expr, start, end) {
            return new expression_wrapper_js_1.ExpressionWrapper(binary_operation_node_js_1.BinaryOperationNode.create((0, reference_parser_js_1.parseReferenceExpression)(expr), operator_node_js_1.OperatorNode.create('between symmetric'), and_node_js_1.AndNode.create((0, value_parser_js_1.parseValueExpression)(start), (0, value_parser_js_1.parseValueExpression)(end))));
        },
        and(exprs) {
            if ((0, object_utils_js_1.isReadonlyArray)(exprs)) {
                return new expression_wrapper_js_1.ExpressionWrapper((0, binary_operation_parser_js_1.parseFilterList)(exprs, 'and'));
            }
            return new expression_wrapper_js_1.ExpressionWrapper((0, binary_operation_parser_js_1.parseFilterObject)(exprs, 'and'));
        },
        or(exprs) {
            if ((0, object_utils_js_1.isReadonlyArray)(exprs)) {
                return new expression_wrapper_js_1.ExpressionWrapper((0, binary_operation_parser_js_1.parseFilterList)(exprs, 'or'));
            }
            return new expression_wrapper_js_1.ExpressionWrapper((0, binary_operation_parser_js_1.parseFilterObject)(exprs, 'or'));
        },
        parens(...args) {
            const node = (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args);
            if (parens_node_js_1.ParensNode.is(node)) {
                // No double wrapping.
                return new expression_wrapper_js_1.ExpressionWrapper(node);
            }
            else {
                return new expression_wrapper_js_1.ExpressionWrapper(parens_node_js_1.ParensNode.create(node));
            }
        },
        cast(expr, dataType) {
            return new expression_wrapper_js_1.ExpressionWrapper(cast_node_js_1.CastNode.create((0, reference_parser_js_1.parseReferenceExpression)(expr), (0, data_type_parser_js_1.parseDataTypeExpression)(dataType)));
        },
        withSchema(schema) {
            return createExpressionBuilder(executor.withPluginAtFront(new with_schema_plugin_js_1.WithSchemaPlugin(schema)));
        },
    });
    eb.fn = (0, function_module_js_1.createFunctionModule)();
    eb.eb = eb;
    return eb;
}
function expressionBuilder(_) {
    return createExpressionBuilder();
}
