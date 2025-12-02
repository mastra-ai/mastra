"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const raw_node_js_1 = require("../operation-node/raw-node.js");
const value_node_js_1 = require("../operation-node/value-node.js");
const reference_parser_js_1 = require("../parser/reference-parser.js");
const table_parser_js_1 = require("../parser/table-parser.js");
const value_parser_js_1 = require("../parser/value-parser.js");
const query_id_js_1 = require("../util/query-id.js");
const raw_builder_js_1 = require("./raw-builder.js");
exports.sql = Object.assign((sqlFragments, ...parameters) => {
    return (0, raw_builder_js_1.createRawBuilder)({
        queryId: (0, query_id_js_1.createQueryId)(),
        rawNode: raw_node_js_1.RawNode.create(sqlFragments, parameters?.map(parseParameter) ?? []),
    });
}, {
    ref(columnReference) {
        return (0, raw_builder_js_1.createRawBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            rawNode: raw_node_js_1.RawNode.createWithChild((0, reference_parser_js_1.parseStringReference)(columnReference)),
        });
    },
    val(value) {
        return (0, raw_builder_js_1.createRawBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            rawNode: raw_node_js_1.RawNode.createWithChild((0, value_parser_js_1.parseValueExpression)(value)),
        });
    },
    value(value) {
        return this.val(value);
    },
    table(tableReference) {
        return (0, raw_builder_js_1.createRawBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            rawNode: raw_node_js_1.RawNode.createWithChild((0, table_parser_js_1.parseTable)(tableReference)),
        });
    },
    id(...ids) {
        const fragments = new Array(ids.length + 1).fill('.');
        fragments[0] = '';
        fragments[fragments.length - 1] = '';
        return (0, raw_builder_js_1.createRawBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            rawNode: raw_node_js_1.RawNode.create(fragments, ids.map(identifier_node_js_1.IdentifierNode.create)),
        });
    },
    lit(value) {
        return (0, raw_builder_js_1.createRawBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            rawNode: raw_node_js_1.RawNode.createWithChild(value_node_js_1.ValueNode.createImmediate(value)),
        });
    },
    literal(value) {
        return this.lit(value);
    },
    raw(sql) {
        return (0, raw_builder_js_1.createRawBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            rawNode: raw_node_js_1.RawNode.createWithSql(sql),
        });
    },
    join(array, separator = (0, exports.sql) `, `) {
        const nodes = new Array(Math.max(2 * array.length - 1, 0));
        const sep = separator.toOperationNode();
        for (let i = 0; i < array.length; ++i) {
            nodes[2 * i] = parseParameter(array[i]);
            if (i !== array.length - 1) {
                nodes[2 * i + 1] = sep;
            }
        }
        return (0, raw_builder_js_1.createRawBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            rawNode: raw_node_js_1.RawNode.createWithChildren(nodes),
        });
    },
});
function parseParameter(param) {
    if ((0, operation_node_source_js_1.isOperationNodeSource)(param)) {
        return param.toOperationNode();
    }
    return (0, value_parser_js_1.parseValueExpression)(param);
}
