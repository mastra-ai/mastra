"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateViewBuilder = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const create_view_node_js_1 = require("../operation-node/create-view-node.js");
const reference_parser_js_1 = require("../parser/reference-parser.js");
const immediate_value_plugin_js_1 = require("../plugin/immediate-value/immediate-value-plugin.js");
class CreateViewBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Adds the "temporary" modifier.
     *
     * Use this to create a temporary view.
     */
    temporary() {
        return new CreateViewBuilder({
            ...this.#props,
            node: create_view_node_js_1.CreateViewNode.cloneWith(this.#props.node, {
                temporary: true,
            }),
        });
    }
    materialized() {
        return new CreateViewBuilder({
            ...this.#props,
            node: create_view_node_js_1.CreateViewNode.cloneWith(this.#props.node, {
                materialized: true,
            }),
        });
    }
    /**
     * Only implemented on some dialects like SQLite. On most dialects, use {@link orReplace}.
     */
    ifNotExists() {
        return new CreateViewBuilder({
            ...this.#props,
            node: create_view_node_js_1.CreateViewNode.cloneWith(this.#props.node, {
                ifNotExists: true,
            }),
        });
    }
    orReplace() {
        return new CreateViewBuilder({
            ...this.#props,
            node: create_view_node_js_1.CreateViewNode.cloneWith(this.#props.node, {
                orReplace: true,
            }),
        });
    }
    columns(columns) {
        return new CreateViewBuilder({
            ...this.#props,
            node: create_view_node_js_1.CreateViewNode.cloneWith(this.#props.node, {
                columns: columns.map(reference_parser_js_1.parseColumnName),
            }),
        });
    }
    /**
     * Sets the select query or a `values` statement that creates the view.
     *
     * WARNING!
     * Some dialects don't support parameterized queries in DDL statements and therefore
     * the query or raw {@link sql } expression passed here is interpolated into a single
     * string opening an SQL injection vulnerability. DO NOT pass unchecked user input
     * into the query or raw expression passed to this method!
     */
    as(query) {
        const queryNode = query
            .withPlugin(new immediate_value_plugin_js_1.ImmediateValuePlugin())
            .toOperationNode();
        return new CreateViewBuilder({
            ...this.#props,
            node: create_view_node_js_1.CreateViewNode.cloneWith(this.#props.node, {
                as: queryNode,
            }),
        });
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    toOperationNode() {
        return this.#props.executor.transformQuery(this.#props.node, this.#props.queryId);
    }
    compile() {
        return this.#props.executor.compileQuery(this.toOperationNode(), this.#props.queryId);
    }
    async execute() {
        await this.#props.executor.executeQuery(this.compile());
    }
}
exports.CreateViewBuilder = CreateViewBuilder;
