"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AliasedDynamicTableBuilder = exports.DynamicTableBuilder = void 0;
exports.isAliasedDynamicTableBuilder = isAliasedDynamicTableBuilder;
const alias_node_js_1 = require("../operation-node/alias-node.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const table_parser_js_1 = require("../parser/table-parser.js");
const object_utils_js_1 = require("../util/object-utils.js");
class DynamicTableBuilder {
    #table;
    get table() {
        return this.#table;
    }
    constructor(table) {
        this.#table = table;
    }
    as(alias) {
        return new AliasedDynamicTableBuilder(this.#table, alias);
    }
}
exports.DynamicTableBuilder = DynamicTableBuilder;
class AliasedDynamicTableBuilder {
    #table;
    #alias;
    get table() {
        return this.#table;
    }
    get alias() {
        return this.#alias;
    }
    constructor(table, alias) {
        this.#table = table;
        this.#alias = alias;
    }
    toOperationNode() {
        return alias_node_js_1.AliasNode.create((0, table_parser_js_1.parseTable)(this.#table), identifier_node_js_1.IdentifierNode.create(this.#alias));
    }
}
exports.AliasedDynamicTableBuilder = AliasedDynamicTableBuilder;
function isAliasedDynamicTableBuilder(obj) {
    return ((0, object_utils_js_1.isObject)(obj) &&
        (0, operation_node_source_js_1.isOperationNodeSource)(obj) &&
        (0, object_utils_js_1.isString)(obj.table) &&
        (0, object_utils_js_1.isString)(obj.alias));
}
